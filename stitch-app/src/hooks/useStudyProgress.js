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
    const [currentStepTitle, setCurrentStepTitle] = useState('');
    const [currentStepFinished, setCurrentStepFinished] = useState(false);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const lastPersistedPositionRef = useRef(null);

    useEffect(() => {
        if (!topicId || !userId) {
            setTopicProgress(null);
            setSourcePassages([]);
            setProgressLoaded(true);
            lastPersistedPositionRef.current = null;
            return undefined;
        }
        let cancelled = false;
        setProgressLoaded(false);
        lastPersistedPositionRef.current = null;
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

    useEffect(() => {
        if (!topicId || !userId) return;
        upsertProgress({ topicId, lastStudiedAt: Date.now(), lastActivityKind: 'lesson' }).catch(() => {});
    }, [topicId, userId]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleLessonStepChange = useCallback((payload) => {
        setCurrentStepSpeech(payload?.speechText || '');
        setCurrentStepIndex(Number.isFinite(payload?.index) ? payload.index : 0);
        setCurrentStepTitle(payload?.title || '');
        setCurrentStepFinished(Boolean(payload?.finished));
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
        if (sameStudyPosition(previous, nextPosition)) return undefined;
        const restored = normalizeStudyPosition(topicProgress?.studyPosition);
        if (sameStudyPosition(restored, nextPosition) && !previous) {
            lastPersistedPositionRef.current = nextPosition;
            return undefined;
        }
        const timer = window.setTimeout(() => {
            lastPersistedPositionRef.current = nextPosition;
            upsertProgress({
                lastStudiedAt: Date.now(),
                lastActivityKind: 'lesson',
                studyPosition: nextPosition,
            }).catch(() => {});
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
        upsertProgress,
    ]);

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
                lastStudiedAt: Date.now(),
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
