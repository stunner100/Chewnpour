import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useStudyTimer } from './useStudyTimer';
import { useRouteResolvedTopic } from './useRouteResolvedTopic';
import { useVoicePlayback } from '../lib/useVoicePlayback';
import useReadingProgress from '../components/lesson/useReadingProgress';
import { useTextSelection } from './useTextSelection';
import { cleanDisplayLine, cleanInlineText } from '../lib/topicContentFormatting';
import { isPlaceholderTopicIllustration, resolveTopicIllustrationUrl } from '../lib/topicIllustration';
import {
    buildTopicQuizRoute,
    buildEssayQuizRoute,
    buildTimedExamRoute,
    getCurrentHashTargetId,
    scrollHashTargetIntoView,
} from '../lib/topicLessonHelpers';
import { buildLessonView } from '../lib/lessonView';
import { lessonFromMarkdown } from '../lib/lessonSchema';
import { useStudyProgress } from './useStudyProgress';

const fetchTopicPayload = async (topicId) => {
    const response = await fetch(`/api/topics/${encodeURIComponent(topicId)}`, {
        credentials: 'include',
    });
    if (response.status === 404) return null;
    if (!response.ok) {
        throw new Error(`Failed to load topic (${response.status})`);
    }
    const payload = await response.json();
    const topic = payload?.topic;
    if (!topic) return null;
    return {
        ...topic,
        _id: topic.id || topic._id,
        sourceUploadId: topic.sourceUploadId || topic.uploadId || null,
        assessmentRoute: topic.assessmentRoute || 'topic_quiz',
        inLessonChecks: Array.isArray(topic.inLessonChecks) ? topic.inLessonChecks : [],
    };
};

const reExplainTopicRequest = async (topicId, style) => {
    const response = await fetch(`/api/topics/${encodeURIComponent(topicId)}/re-explain`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ style }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload?.error || `Failed to re-explain (${response.status})`);
    }
    return payload;
};

export const useTopicDetail = () => {
    const { topicId: topicIdParam } = useParams();
    const routeTopicId = typeof topicIdParam === 'string' ? topicIdParam.trim() : '';
    const { user, profile, updateProfile, loading: authLoading } = useAuth();
    useStudyTimer(user?.id);
    const [reExplainOpen, setReExplainOpen] = useState(false);
    const [reExplainStyle, setReExplainStyle] = useState("Teach me like I'm 12");
    const [reExplainLoading, setReExplainLoading] = useState(false);
    const [reExplainError, setReExplainError] = useState('');
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [voiceSaving, setVoiceSaving] = useState(false);
    const [voiceSettingsError, setVoiceSettingsError] = useState('');
    const [overrideContent, setOverrideContent] = useState('');
    const [explanationView, setExplanationView] = useState('original');
    const [cachedLesson, setCachedLesson] = useState(null);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [moreOpen, setMoreOpen] = useState(false);
    const [contentsOpen, setContentsOpen] = useState(false);
    const [requestedSectionIndex, setRequestedSectionIndex] = useState(null);
    const [notesOpen, setNotesOpen] = useState(false);
    const [notesAppendText, setNotesAppendText] = useState('');
    const [chatOpen, setChatOpen] = useState(false);
    const [sourceOpen, setSourceOpen] = useState(false);
    const [topicQueryResult, setTopicQueryResult] = useState(undefined);
    const [studyModeState, setStudyModeState] = useState(() => ({
        routeTopicId,
        // Default to full lesson so direct links (e.g. lesson cards) open readable content
        // instead of the study-mode picker. Hash targets still imply full navigation context.
        value: 'full',
    }));
    const studyMode = studyModeState.routeTopicId === routeTopicId
        ? studyModeState.value
        : 'full';
    const setStudyMode = useCallback((value) => {
        setStudyModeState({ routeTopicId, value });
    }, [routeTopicId]);

    const [chatInitialPrompt, setChatInitialPrompt] = useState('');
    const sidePanelScrollYRef = useRef(0);
    const captureLessonScrollForSidePanel = useCallback(() => {
        if (typeof window === 'undefined') return;
        sidePanelScrollYRef.current = window.scrollY || 0;
    }, []);
    const restoreLessonScrollAfterPanelClose = useCallback(() => {
        if (typeof window === 'undefined') return;
        const top = sidePanelScrollYRef.current;
        const restore = () => {
            if (scrollHashTargetIntoView({ behavior: 'auto' })) return;
            window.scrollTo({ top, behavior: 'auto' });
        };
        window.requestAnimationFrame(() => {
            restore();
            window.setTimeout(restore, 120);
        });
    }, []);
    const openNotes = useCallback(() => {
        captureLessonScrollForSidePanel();
        setChatOpen(false);
        setNotesOpen(true);
    }, [captureLessonScrollForSidePanel]);
    const closeNotes = useCallback(() => {
        setNotesOpen(false);
        restoreLessonScrollAfterPanelClose();
    }, [restoreLessonScrollAfterPanelClose]);
    const openChat = useCallback(() => {
        captureLessonScrollForSidePanel();
        setChatInitialPrompt('');
        setNotesOpen(false);
        setChatOpen(true);
    }, [captureLessonScrollForSidePanel]);
    const closeChat = useCallback(() => {
        setChatOpen(false);
        restoreLessonScrollAfterPanelClose();
    }, [restoreLessonScrollAfterPanelClose]);
    const openSource = useCallback(() => {
        captureLessonScrollForSidePanel();
        setSourceOpen(true);
    }, [captureLessonScrollForSidePanel]);
    const closeSource = useCallback(() => {
        setSourceOpen(false);
        restoreLessonScrollAfterPanelClose();
    }, [restoreLessonScrollAfterPanelClose]);
    const handleAskTutor = useCallback((prompt) => {
        captureLessonScrollForSidePanel();
        setChatInitialPrompt(prompt);
        setNotesOpen(false);
        setContentsOpen(false);
        setChatOpen(true);
    }, [captureLessonScrollForSidePanel]);
    const openContents = useCallback(() => {
        setChatOpen(false);
        setNotesOpen(false);
        setContentsOpen(true);
    }, []);
    const closeContents = useCallback(() => {
        setContentsOpen(false);
    }, []);
    const requestSectionIndex = useCallback((index) => {
        if (!Number.isFinite(Number(index))) return;
        setRequestedSectionIndex(Math.round(Number(index)));
        setContentsOpen(false);
    }, []);
    const onRequestConsumed = useCallback(() => {
        setRequestedSectionIndex(null);
    }, []);
    const contentRef = useRef(null);
    const mainRef = useRef(null);
    const { selection, clearSelection } = useTextSelection(contentRef, Boolean(routeTopicId));
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const focusPanel = searchParams.get('panel');
    useEffect(() => {
        if (focusPanel !== 'podcast') return undefined;
        const timer = window.setTimeout(() => {
            const node = document.getElementById('topic-podcast');
            if (node) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 350);
        return () => window.clearTimeout(timer);
    }, [focusPanel]);
    useEffect(() => {
        if (focusPanel !== 'wordbank') return undefined;
        const timer = window.setTimeout(() => {
            const node = document.getElementById('topic-wordbank');
            if (node) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 350);
        return () => window.clearTimeout(timer);
    }, [focusPanel]);
    const reloadDashboard = useCallback(() => {
        if (typeof window !== 'undefined') {
            window.location.assign('/dashboard');
            return;
        }
        navigate('/dashboard', { replace: true });
    }, [navigate]);

    useEffect(() => {
        if (!routeTopicId || authLoading || !user?.id) {
            setTopicQueryResult(undefined);
            return undefined;
        }

        let cancelled = false;
        setTopicQueryResult(undefined);

        fetchTopicPayload(routeTopicId)
            .then((topic) => {
                if (!cancelled) setTopicQueryResult(topic);
            })
            .catch(() => {
                if (!cancelled) setTopicQueryResult(null);
            });

        return () => {
            cancelled = true;
        };
    }, [routeTopicId, authLoading, user?.id]);

    const {
        topic,
        topicId,
        isLoadingRouteTopic,
        isMissingRouteTopic,
    } = useRouteResolvedTopic(routeTopicId, topicQueryResult, {
        suspendMissingDetection: authLoading || !user?.id || topicQueryResult === undefined,
    });
    const courseId = topic?.courseId;
    const finalAssessmentTopic = null;
    const voiceModeEnabled = Boolean(profile?.voiceModeEnabled);
    const podcastEnabled = true;
    const isVoicePremium = false;

    const storageKey = topicId ? `topicOverride:${topicId}` : null;
    const lessonCacheKey = topicId ? `topicLesson:${topicId}` : null;
    const synthesizeLessonVoice = useCallback(async (text) => {
        if (!topicId) {
            throw new Error('No lesson selected.');
        }
        const spoken = String(text || '').trim();
        if (!spoken) {
            throw new Error('No explanation text available to read.');
        }
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), 25000);
        try {
            const response = await fetch('/api/topic-voice', {
                method: 'POST',
                credentials: 'include',
                signal: controller.signal,
                headers: {
                    Accept: 'audio/mpeg',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ topicId, text: spoken }),
            });
            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(payload?.error || `Voice request failed (${response.status})`);
            }
            const buffer = await response.arrayBuffer();
            if (!buffer || buffer.byteLength === 0) {
                throw new Error('Voice playback did not return audio.');
            }
            const blob = new Blob([buffer], { type: 'audio/mpeg' });
            return URL.createObjectURL(blob);
        } catch (error) {
            if (error?.name === 'AbortError' || /terminated|fetch failed/i.test(String(error?.message || ''))) {
                throw new Error('Voice is taking too long. Tap Play again.');
            }
            throw error;
        } finally {
            window.clearTimeout(timer);
        }
    }, [topicId]);
    const {
        isSupported: isVoiceSupported,
        status: voiceStatus,
        error: voicePlaybackError,
        play: playVoice,
        pause: pauseVoice,
        resume: resumeVoice,
        stop: stopVoice,
        isPlaying,
        isPaused,
        primeVoicePlayback,
    } = useVoicePlayback({
        remoteStream: synthesizeLessonVoice,
    });

    useEffect(() => {
        setExplanationView('original');
        setOverrideContent('');
    }, [topicId]);

    useEffect(() => {
        if (!storageKey) return;
        try {
            const cached = localStorage.getItem(storageKey);
            if (cached) {
                setOverrideContent(cached);
            }
        } catch (error) {
            console.warn('Failed to load cached lesson content', error);
        }
    }, [storageKey]);

    useEffect(() => {
        if (!lessonCacheKey) return;
        try {
            const cached = localStorage.getItem(lessonCacheKey);
            if (cached) {
                setCachedLesson(JSON.parse(cached));
            }
        } catch (error) {
            console.warn('Failed to load cached lesson', error);
        }
    }, [lessonCacheKey]);

    useEffect(() => {
        if (!lessonCacheKey || !topic?.lesson) return;
        try {
            localStorage.setItem(lessonCacheKey, JSON.stringify(topic.lesson));
        } catch (error) {
            console.warn('Failed to cache lesson', error);
        }
    }, [lessonCacheKey, topic?.lesson]);

    const originalLesson = topic?.lesson || cachedLesson;
    const hasReexplainedLesson = Boolean(overrideContent);
    // Re-explain still returns markdown; it is read into the lesson shape and
    // has no in-lesson checks until re-explain returns the lesson schema.
    const simplifiedLesson = useMemo(
        () => (overrideContent ? lessonFromMarkdown(overrideContent) : null),
        [overrideContent],
    );
    const showSimplified = explanationView === 'simplified' && Boolean(simplifiedLesson);
    const lesson = showSimplified ? simplifiedLesson : originalLesson;
    const previousVoiceModeRef = useRef(voiceModeEnabled);

    useEffect(() => {
        if (previousVoiceModeRef.current && !voiceModeEnabled) {
            stopVoice();
        }
        previousVoiceModeRef.current = voiceModeEnabled;
    }, [voiceModeEnabled, stopVoice]);


    // Scroll to top on mount/navigation
    useEffect(() => {
        if (getCurrentHashTargetId()) return;
        if (mainRef.current) mainRef.current.scrollTop = 0;
        window.scrollTo(0, 0);
    }, [topicId]);

    useEffect(() => {
        const handleScroll = () => {
            setShowScrollTop((window.scrollY || 0) > 600);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cleanInline = useCallback((text) => cleanInlineText(text), []);

    const cleanLine = (text) => cleanDisplayLine(text);

    const sanitizeTopicTitle = (value) => {
        return cleanLine(value || '')
            .replace(/\s*[•|]\s.*$/, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
    };
    const firstLessonHeading = cleanDisplayLine(lesson?.sections?.[0]?.title || '');
    const cleanedTopicTitle = sanitizeTopicTitle(topic?.title || '');
    const looksBrokenTopicTitle = (() => {
        if (!cleanedTopicTitle) return true;
        if (cleanedTopicTitle.length > 95) return true;
        if (/\b(in this class|in this lesson|we will)\b/i.test(cleanedTopicTitle)) return true;
        if (/\bdis$/i.test(cleanedTopicTitle)) return true;
        return false;
    })();
    const resolvedTopicTitle = looksBrokenTopicTitle && firstLessonHeading
        ? firstLessonHeading
        : (cleanedTopicTitle || firstLessonHeading || 'Topic Overview');
    const headerTopicTitle = resolvedTopicTitle;
    const heroTopicTitle = resolvedTopicTitle;
    const topicIllustrationUrl = resolveTopicIllustrationUrl(topic?.illustrationUrl);
    const showTopicIllustration = Boolean(topicIllustrationUrl)
        && !isPlaceholderTopicIllustration(topic?.illustrationUrl || topicIllustrationUrl);

    const toggleVoiceMode = async () => {
        if (!user) return;
        setVoiceSettingsError('');
        setVoiceSaving(true);
        const nextValue = !voiceModeEnabled;
        if (!nextValue) {
            stopVoice();
        }
        const { error } = await updateProfile({ voiceModeEnabled: nextValue });
        if (error) {
            setVoiceSettingsError(error.message || 'Unable to update voice mode');
        }
        setVoiceSaving(false);
    };

    const lessonView = useMemo(() => buildLessonView({
        lesson,
        checks: showSimplified ? [] : topic?.inLessonChecks,
        studyMode,
    }), [lesson, showSimplified, topic?.inLessonChecks, studyMode]);
    const { steps: lessonSteps, wordBankTerms, hook: lessonHook } = lessonView;
    const hasLesson = lessonView.sections.length > 0;
    const lessonToc = useMemo(
        () => lessonView.sections.map((section, index) => ({ id: `lesson-section-${index}`, text: section.title, level: 2 })),
        [lessonView.sections],
    );

    const {
        currentStepIndex,
        currentStepSpeech,
        currentStepTitle,
        handleFinishLesson,
        handleLessonStepChange,
        hasSourcePassages,
        progressLoaded,
        sourcePassages,
        studyContext,
        topicProgress,
        upsertProgress,
    } = useStudyProgress({
        topicId,
        userId: user?.id,
        lessonSteps,
    });

    const speechText = useMemo(() => {
        if (!currentStepSpeech) return '';
        return currentStepSpeech
            .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/[#>`_~-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }, [currentStepSpeech]);
    const previousSpeechTextRef = useRef(speechText);

    useEffect(() => {
        if (
            previousSpeechTextRef.current !== speechText &&
            (isPlaying || isPaused)
        ) {
            stopVoice();
        }
        previousSpeechTextRef.current = speechText;
    }, [speechText, isPlaying, isPaused, stopVoice]);

    useEffect(() => {
        if (!voiceModeEnabled) return;
        if (!isVoicePremium) return;
        if (!speechText) return;
        primeVoicePlayback(speechText);
    }, [voiceModeEnabled, isVoicePremium, speechText, primeVoicePlayback]);

    // Save a text selection straight into the learner's existing notes.
    const handleSaveSelectionToNotes = useCallback((text) => {
        const note = String(text || '').trim();
        if (!note) return;
        setNotesAppendText(note);
        openNotes();
    }, [openNotes]);

    useEffect(() => {
        if (!studyMode) return undefined;
        if (!getCurrentHashTargetId()) return undefined;
        const timer = window.setTimeout(() => {
            scrollHashTargetIntoView({ behavior: 'auto' });
        }, 100);
        return () => window.clearTimeout(timer);
    }, [lessonSteps, studyMode]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const scrollAfterHashChange = () => {
            if (!getCurrentHashTargetId()) return;
            setStudyMode('full');
            const restore = () => scrollHashTargetIntoView({ behavior: 'auto' });
            window.requestAnimationFrame(() => {
                restore();
                window.setTimeout(restore, 120);
            });
        };

        window.addEventListener('hashchange', scrollAfterHashChange);
        return () => window.removeEventListener('hashchange', scrollAfterHashChange);
    }, [setStudyMode]);

    const assessmentRoute = topic?.assessmentRoute || 'topic_quiz';
    const isTopicQuizRoute = assessmentRoute === 'topic_quiz' || topic?.topicKind === 'document_final_exam';
    const topicHasQuiz = Number(topic?.questionCount || 0) > 0;
    const examTopicId = isTopicQuizRoute
        ? (topicHasQuiz ? topicId : null)
        : (finalAssessmentTopic?._id || null);
    const objectiveExamRoute = examTopicId ? buildTopicQuizRoute(examTopicId) : '';
    void buildEssayQuizRoute;
    const timedExamRoute = buildTimedExamRoute(courseId);
    const handleStartExam = useCallback(() => {
        navigate(timedExamRoute);
    }, [navigate, timedExamRoute]);
    const objectiveExamActionLabel = isTopicQuizRoute
        ? (topicProgress?.bestScore != null ? 'Retry quiz' : 'Start quiz')
        : (examTopicId ? 'Start quiz' : 'Quiz preparing');
    const hasQuizScore = topicProgress?.bestScore != null;
    const practiceDescription = isTopicQuizRoute
        ? 'A short quiz on what you just read.'
        : 'This topic is assessed in the course quiz for better question quality.';
    const postLessonPrompt = isTopicQuizRoute
        ? (hasQuizScore
            ? 'Try another format if you want more practice.'
            : 'A short quiz on what you just read.')
        : 'This topic will be assessed in the course quiz.';

    const { progress: readingProgress, activeId: activeSectionId } = useReadingProgress({
        toc: lessonToc,
        headerOffset: 108,
    });
    const activeSectionLabel = useMemo(() => {
        if (!activeSectionId) return '';
        const found = lessonToc.find((entry) => entry.id === activeSectionId);
        return found?.text || '';
    }, [activeSectionId, lessonToc]);
    const lessonStatusBadge = useMemo(() => {
        if (topicProgress?.completedAt) {
            return { label: 'Completed', icon: 'check_circle', className: 'bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-900/25 dark:text-emerald-300 dark:border-emerald-800/40' };
        }
        if (readingProgress > 5) {
            return { label: 'In progress', icon: 'play_circle', className: 'bg-primary-50 text-primary-700 border-primary-200/60 dark:bg-primary-900/25 dark:text-primary-300 dark:border-primary-800/40' };
        }
        return { label: 'Not started', icon: 'schedule', className: 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800/40 dark:text-zinc-300 dark:border-zinc-700/40' };
    }, [topicProgress?.completedAt, readingProgress]);

    const handleReExplain = useCallback(async () => {
        if (!topicId) return;
        setReExplainError('');
        setReExplainLoading(true);
        try {
            const result = await reExplainTopicRequest(topicId, reExplainStyle);
            const nextContent = result?.content || '';
            setOverrideContent(nextContent);
            setExplanationView('simplified');
            if (storageKey) {
                try {
                    if (nextContent.trim()) {
                        localStorage.setItem(storageKey, nextContent);
                    } else {
                        localStorage.removeItem(storageKey);
                    }
                } catch (error) {
                    console.warn('Failed to cache lesson content', error);
                }
            }
            setReExplainOpen(false);
        } catch (error) {
            setReExplainError(String(error?.message || 'Failed to re-explain. Please try again.'));
        } finally {
            setReExplainLoading(false);
        }
    }, [topicId, reExplainStyle, storageKey]);

    const handleStudyModeSelect = useCallback((mode) => {
        setStudyMode(mode || 'full');
        if (!getCurrentHashTargetId()) {
            if (mainRef.current) mainRef.current.scrollTop = 0;
            window.scrollTo(0, 0);
        }
    }, [setStudyMode]);

    const handleStudyModeSkip = useCallback(() => {
        handleStudyModeSelect('full');
    }, [handleStudyModeSelect]);

    const handleTermsStarred = useCallback((starred) => {
        upsertProgress({
            termsStarred: starred,
            lastStudiedAt: Date.now(),
        }).catch(() => {});
    }, [upsertProgress]);

    const courseHref = courseId
        ? `/dashboard/lessons?courseId=${encodeURIComponent(courseId)}`
        : '/dashboard/lessons';
    const cleanedDescription = cleanLine(topic?.description || '');

    const headerPrimaryAction = examTopicId
        ? { id: 'start-quiz', icon: 'quiz', label: objectiveExamActionLabel, href: objectiveExamRoute }
        : { id: 'start-quiz', icon: 'hourglass_top', label: objectiveExamActionLabel, disabled: true };

    // Header keeps only the primary CTA so the title always has room.
    // Fill-ins / Mark Complete live in the right rail + practice card.
    const headerSecondaryActions = [];

    // Rail's bold action is `headerPrimaryAction` (Start Quiz). Below it we
    // surface only complementary actions — no duplicate Start Quiz row.
    const studyToolActions = [
        {
            id: 'tutor-rail',
            icon: 'smart_toy',
            label: 'Ask AI Tutor',
            description: 'Get help on this lesson',
            onClick: openChat,
        },
        examTopicId && {
            id: 'quiz-rail',
            icon: 'quiz',
            label: objectiveExamActionLabel,
            description: 'Test this lesson',
            href: objectiveExamRoute,
        },
    ].filter(Boolean);

    // Mobile FAB only — Notes/Tutor live in MobileLessonActions; desktop uses header + rail.
    const studyToolSecondary = [
        {
            id: 'contents',
            icon: 'list',
            label: 'Contents',
            onClick: openContents,
        },
        {
            id: 'reexplain',
            icon: 'lightbulb',
            label: 'Re-explain differently',
            onClick: () => setReExplainOpen(true),
        },
        hasSourcePassages && {
            id: 'source',
            icon: 'menu_book',
            label: 'View source passages',
            onClick: openSource,
        },
        examTopicId && {
            id: 'quiz-more',
            icon: 'quiz',
            label: objectiveExamActionLabel,
            onClick: () => navigate(objectiveExamRoute),
        },
        isVoiceSupported && {
            id: 'settings',
            icon: 'volume_up',
            label: 'Read-aloud settings',
            onClick: () => setSettingsOpen(true),
        },
    ].filter(Boolean);

    // End-of-lesson practice: Quiz is secondary here because the sticky header owns the primary.
    const practicePrimary = [];

    const practiceSecondary = [
        examTopicId
            ? { id: 'p-start-quiz', icon: 'quiz', label: objectiveExamActionLabel, href: objectiveExamRoute }
            : { id: 'p-quiz-pending', icon: 'hourglass_top', label: 'Quiz preparing', disabled: true },
    ].filter(Boolean);

    const practiceTertiary = topicProgress?.completedAt ? [] : [{
        id: 'p-mark-complete',
        icon: 'check_circle',
        label: 'Mark Complete',
        onClick: () => {
            upsertProgress({ topicId, completedAt: Date.now(), lastStudiedAt: Date.now() }).catch(() => {});
        },
    }];

    const mobileActionItems = [
        { id: 'm-contents', icon: 'list', label: 'Contents', onClick: openContents },
        { id: 'm-notes', icon: 'edit_note', label: 'Notes', onClick: openNotes },
        { id: 'm-tutor', icon: 'smart_toy', label: 'AI Tutor', onClick: openChat },
        { id: 'm-more', icon: 'more_horiz', label: 'More', onClick: () => setMoreOpen(true) },
    ];
    const hasQuizCta = false;

    return {
        activeSectionId,
        activeSectionLabel,
        chatInitialPrompt,
        currentStepIndex,
        currentStepTitle,
        handleFinishLesson,
        handleSaveSelectionToNotes,
        hasQuizCta,
        hasSourcePassages,
        chatOpen,
        cleanInline,
        cleanLine,
        cleanedDescription,
        clearSelection,
        closeChat,
        closeContents,
        closeNotes,
        closeSource,
        contentsOpen,
        contentRef,
        courseHref,
        courseId,
        examTopicId,
        explanationView,
        hasReexplainedLesson,
        handleAskTutor,
        handleLessonStepChange,
        handleReExplain,
        handleStartExam,
        handleStudyModeSelect,
        handleStudyModeSkip,
        handleTermsStarred,
        headerPrimaryAction,
        headerSecondaryActions,
        headerTopicTitle,
        heroTopicTitle,
        isLoadingRouteTopic,
        isMissingRouteTopic,
        isPaused,
        isPlaying,
        isTopicQuizRoute,
        isVoiceSupported,
        lessonStatusBadge,
        lessonSteps,
        mainRef,
        mobileActionItems,
        moreOpen,
        hasLesson,
        lessonHook,
        notesAppendText,
        notesOpen,
        objectiveExamRoute,
        openChat,
        openContents,
        openNotes,
        openSource,
        pauseVoice,
        playVoice,
        podcastEnabled,
        postLessonPrompt,
        progressLoaded,
        requestedSectionIndex,
        requestSectionIndex,
        onRequestConsumed,
        practiceDescription,
        practicePrimary,
        practiceSecondary,
        practiceTertiary,
        readingProgress,
        reExplainError,
        reExplainLoading,
        reExplainOpen,
        reExplainStyle,
        reloadDashboard,
        resolvedTopicTitle,
        resumeVoice,
        routeTopicId,
        scrollToTop,
        selection,
        setExplanationView,
        setMoreOpen,
        setNotesAppendText,
        setReExplainOpen,
        setReExplainStyle,
        setSettingsOpen,
        settingsOpen,
        showTopicIllustration,
        showScrollTop,
        sourceOpen,
        sourcePassages,
        speechText,
        stopVoice,
        studyContext,
        studyMode,
        studyToolActions,
        studyToolSecondary,
        timedExamAvailable: topicHasQuiz,
        topic,
        topicId,
        topicIllustrationUrl,
        topicProgress,
        toggleVoiceMode,
        user,
        voiceModeEnabled,
        voicePlaybackError,
        voiceSaving,
        voiceSettingsError,
        voiceStatus,
        wordBankTerms,
    };
};
