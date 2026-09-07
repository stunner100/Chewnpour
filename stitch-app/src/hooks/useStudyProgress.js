import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildStudyContext, normalizeStudyPosition } from '../lib/studyPosition';

const fetchTopicProgress = async (topicId) => {
    const response = await fetch(`/api/topics/${encodeURIComponent(topicId)}/progress`, {
        credentials: 'include',
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload?.progress || null;
};

const fetchTopicPassages = async (topicId) => {
    const response = await fetch(`/api/topics/${encodeURIComponent(topicId)}/passages`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    if (!response.ok) return [];
    const payload = await response.json().catch(() => ({}));
    const rows = Array.isArray(payload?.passages) ? payload.passages : [];
    return rows
        .map((row, index) => {
            const text = String(row.text || row.content || '').trim();
            if (!text) return null;
            const chunkIndex = Number.isFinite(Number(row.chunkIndex))
                ? Number(row.chunkIndex)
                : index;
            return {
                passageId: row.passageId || row.id || `passage-${chunkIndex}`,
                page: Number(row.page) || chunkIndex + 1,
                sectionHint: row.sectionHint || `Passage ${chunkIndex + 1}`,
                text,
            };
        })
        .filter(Boolean);
};

const upsertTopicProgressRequest = async (topicId, patch) => {
    const response = await fetch(`/api/topics/${encodeURIComponent(topicId)}/progress`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch || {}),
    });
    if (!response.ok) {
        throw new Error(`Failed to save progress (${response.status})`);
    }
    const payload = await response.json();
    return payload?.progress || null;
};

const sameStudyPosition = (left, right) => Boolean(
    left
    && right
    && left.sectionIndex === right.sectionIndex
    && left.sectionCount === right.sectionCount
    && left.sectionTitle === right.sectionTitle
    && left.finished === right.finished,
);

/**
 * Loads topic_progress + source passages, persists the current lesson
 * section on the existing progress row, and exposes tutor studyContext.
 */
export const useStudyProgress = ({ topicId, userId, lessonSteps }) => {
    const [topicProgress, setTopicProgress] = useState(null);
    const [progressLoaded, setProgressLoaded] = useState(false);
    const [sourcePassages, setSourcePassages] = useState([]);
    const [currentStepSpeech, setCurrentStepSpeech] = useState('');
    const [stepperReport, setStepperReport] = useState(null);
    const lastPersistedPositionRef = useRef(null);
    const persistQueueRef = useRef(Promise.resolve());
    const pendingPositionRef = useRef(null);
    const latestPositionRef = useRef(null);
    const completedAtRef = useRef(null);
    completedAtRef.current = topicProgress?.completedAt;
    const restoredPosition = useMemo(
        () => normalizeStudyPosition(topicProgress?.studyPosition),
        [topicProgress?.studyPosition],
    );
    const currentStepIndex = stepperReport?.index ?? restoredPosition?.sectionIndex ?? 0;
    const currentStepTitle = stepperReport?.title ?? restoredPosition?.sectionTitle ?? '';
    const currentStepFinished = stepperReport?.finished ?? Boolean(restoredPosition?.finished);

    useEffect(() => {
        if (!topicId || !userId) {
            setTopicProgress(null);
            setSourcePassages([]);
            setProgressLoaded(true);
            lastPersistedPositionRef.current = null;
            pendingPositionRef.current = null;
            latestPositionRef.current = null;
            persistQueueRef.current = Promise.resolve();
            setStepperReport(null);
            return undefined;
        }
        let cancelled = false;
        setProgressLoaded(false);
        lastPersistedPositionRef.current = null;
        pendingPositionRef.current = null;
        latestPositionRef.current = null;
        persistQueueRef.current = Promise.resolve();
        setStepperReport(null);
        fetchTopicProgress(topicId)
            .then((progress) => {
                if (!cancelled) setTopicProgress(progress);
            })
            .catch(() => {
                if (!cancelled) setTopicProgress(null);
            })
            .finally(() => {
                if (!cancelled) setProgressLoaded(true);
            });
        fetchTopicPassages(topicId)
            .then((passages) => {
                if (!cancelled) setSourcePassages(passages);
            })
            .catch(() => {
                if (!cancelled) setSourcePassages([]);
            });
        return () => {
            cancelled = true;
        };
    }, [topicId, userId]);

    const upsertProgress = useCallback(async (patch) => {
        if (!topicId) return null;
        try {
            const progress = await upsertTopicProgressRequest(topicId, patch);
            setTopicProgress(progress);
            return progress;
        } catch {
            return null;
        }
    }, [topicId]);

    const enqueueStudyPosition = useCallback((nextPosition) => {
        if (!nextPosition) return;
        pendingPositionRef.current = nextPosition;
        lastPersistedPositionRef.current = nextPosition;
        persistQueueRef.current = persistQueueRef.current
            .then(async () => {
                const queued = pendingPositionRef.current;
                if (!queued) return;
                pendingPositionRef.current = null;
                await upsertProgress({
                    ...(completedAtRef.current ? {} : { lastStudiedAt: Date.now() }),
                    lastActivityKind: 'lesson',
                    studyPosition: queued,
                });
            })
            .catch(() => {});
    }, [upsertProgress]);

    const handleLessonStepChange = useCallback((payload) => {
        setCurrentStepSpeech(payload?.speechText || '');
        setStepperReport({
            index: Number.isFinite(payload?.index) ? payload.index : 0,
            title: payload?.title || '',
            finished: Boolean(payload?.finished),
        });
    }, []);

    const studyContext = useMemo(
        () => buildStudyContext({
            sectionIndex: currentStepIndex,
            sectionCount: Array.isArray(lessonSteps) ? lessonSteps.length : 0,
            sectionTitle: currentStepTitle,
            sectionExcerpt: currentStepSpeech,
        }),
        [currentStepIndex, currentStepTitle, currentStepSpeech, lessonSteps],
    );

    useEffect(() => {
        if (!topicId || !userId || !progressLoaded) return undefined;
        const sectionCount = Array.isArray(lessonSteps) ? lessonSteps.length : 0;
        if (sectionCount <= 0) return undefined;
        const nextPosition = normalizeStudyPosition({
            sectionIndex: currentStepIndex,
            sectionCount,
            sectionTitle: currentStepTitle,
            finished: currentStepFinished,
        });
        if (!nextPosition) return undefined;
        const previous = lastPersistedPositionRef.current;
        const restored = normalizeStudyPosition(topicProgress?.studyPosition);
        // The stepper reports section 0 until it mounts. Never let that
        // overwrite a restored later section, including on unmount.
        if (
            restored
            && !previous
            && nextPosition.sectionIndex === 0
            && restored.sectionIndex > 0
        ) {
            return undefined;
        }
        latestPositionRef.current = nextPosition;
        if (sameStudyPosition(previous, nextPosition)) return undefined;

        const timer = window.setTimeout(() => {
            enqueueStudyPosition(nextPosition);
        }, 450);
        return () => window.clearTimeout(timer);
    }, [
        topicId,
        userId,
        progressLoaded,
        currentStepIndex,
        currentStepTitle,
        currentStepFinished,
        lessonSteps,
        topicProgress?.studyPosition,
        enqueueStudyPosition,
    ]);

    useEffect(() => () => {
        const latest = latestPositionRef.current;
        if (latest) enqueueStudyPosition(latest);
    }, [topicId, userId, enqueueStudyPosition]);

    const handleFinishLesson = useCallback(() => {
        const sectionCount = Array.isArray(lessonSteps) ? lessonSteps.length : 0;
        const studyPosition = normalizeStudyPosition({
            sectionIndex: currentStepIndex,
            sectionCount,
            sectionTitle: currentStepTitle,
            finished: true,
        });
        lastPersistedPositionRef.current = studyPosition;
        if (topicProgress?.completedAt) {
            upsertProgress({
                lastActivityKind: 'lesson',
                studyPosition,
            }).catch(() => {});
            return;
        }
        upsertProgress({
            topicId,
            completedAt: Date.now(),
            lastStudiedAt: Date.now(),
            lastActivityKind: 'lesson',
            studyPosition,
        }).catch(() => {});
    }, [
        topicProgress?.completedAt,
        upsertProgress,
        topicId,
        lessonSteps,
        currentStepIndex,
        currentStepTitle,
    ]);

    return {
        currentStepIndex,
        currentStepSpeech,
        currentStepTitle,
        handleFinishLesson,
        handleLessonStepChange,
        hasSourcePassages: sourcePassages.length > 0,
        progressLoaded,
        sourcePassages,
        studyContext,
        topicProgress,
        upsertProgress,
    };
};
