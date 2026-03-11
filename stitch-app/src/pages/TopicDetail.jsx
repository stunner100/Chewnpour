import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useAction, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';
import { useStudyTimer } from '../hooks/useStudyTimer';
import { useVoicePlayback } from '../lib/useVoicePlayback';
import TopicSettingsModal from '../components/TopicSettingsModal';
import TopicReExplainModal from '../components/TopicReExplainModal';
import TopicSidebar from '../components/TopicSidebar';
import TopicNotesPanel from '../components/TopicNotesPanel';
import TopicChatPanel from '../components/TopicChatPanel';
import HighlightExplainPopover from '../components/HighlightExplainPopover';
import LessonContentRenderer from '../components/LessonContentRenderer';
import { useTextSelection } from '../hooks/useTextSelection';
import {
    SECTION_TITLE_PATTERN,
    SECTION_TITLES_SET,
    cleanDisplayLine,
    cleanInlineText,
    isArtifactLine,
    normalizeLessonContent,
    slugifyText,
} from '../lib/topicContentFormatting';
import { resolveTopicIllustrationUrl } from '../lib/topicIllustration';
import { isLikelyConvexId } from '../lib/convexId';

// ── Pure rendering helpers (hoisted out of the component to avoid re-creation) ──

const resolveConvexErrorMessage = (error, fallbackMessage) => {
    const dataMessage = typeof error?.data === 'string'
        ? error.data
        : typeof error?.data?.message === 'string'
            ? error.data.message
            : '';
    const resolved = String(dataMessage || error?.message || fallbackMessage || '')
        .replace(/^Uncaught (ConvexError|Error):\s*/i, '')
        .trim();
    return resolved || fallbackMessage;
};

const isReExplainQuotaExceededError = (error) => {
    const code = String(error?.data?.code || '').trim().toUpperCase();
    if (code === 'REEXPLAIN_QUOTA_EXCEEDED') return true;
    const message = String(error?.message || error?.data?.message || '').toUpperCase();
    return message.includes('REEXPLAIN_QUOTA_EXCEEDED');
};

const TopicDetail = () => {
    const { topicId: topicIdParam } = useParams();
    const normalizedTopicId = typeof topicIdParam === 'string' ? topicIdParam.trim() : '';
    const topicId = isLikelyConvexId(normalizedTopicId) ? normalizedTopicId : '';
    const { user, profile, updateProfile } = useAuth();
    useStudyTimer(user?.id);
    const synthesizeTopicVoice = useAction(api.ai.synthesizeTopicVoice);
    const reExplainTopic = useAction(api.ai.reExplainTopic);
    const requestEssayQuestionTopUp = useMutation(api.exams.requestEssayQuestionTopUp);
    const [startingExam, setStartingExam] = useState(false);
    const [startExamError, setStartExamError] = useState('');
    const [reExplainOpen, setReExplainOpen] = useState(false);
    const [reExplainStyle, setReExplainStyle] = useState('Teach me like I’m 12');
    const [reExplainLoading, setReExplainLoading] = useState(false);
    const [reExplainError, setReExplainError] = useState('');
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [voiceSaving, setVoiceSaving] = useState(false);
    const [voiceSettingsError, setVoiceSettingsError] = useState('');
    const [overrideContent, setOverrideContent] = useState('');
    const [cachedContent, setCachedContent] = useState('');
    const [readingMode, setReadingMode] = useState(true);
    const [shouldAnimateBlocks, setShouldAnimateBlocks] = useState(false);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [notesOpen, setNotesOpen] = useState(false);
    const [notesAppendText, setNotesAppendText] = useState('');
    const [chatOpen, setChatOpen] = useState(false);

    const openNotes = useCallback(() => { setChatOpen(false); setNotesOpen(true); }, []);
    const openChat = useCallback(() => { setNotesOpen(false); setChatOpen(true); }, []);
    const contentRef = useRef(null);
    const essayTopUpMarkerRef = useRef('');
    const { selection, clearSelection } = useTextSelection(contentRef);
    const navigate = useNavigate();
    const topicData = useQuery(
        api.topics.getTopicWithQuestions,
        topicId ? { topicId } : 'skip'
    );
    const topic = topicData || null;
    const DEFAULT_EXAM_READY_MIN_MCQ_COUNT = 10;
    const DEFAULT_EXAM_READY_MIN_ESSAY_COUNT = 3;
    const topicMcqTargetCount = Math.max(
        1,
        Math.round(Number(topic?.mcqTargetCount || DEFAULT_EXAM_READY_MIN_MCQ_COUNT))
    );
    const topicEssayTargetCount = Math.max(
        1,
        Math.round(Number(topic?.essayTargetCount || DEFAULT_EXAM_READY_MIN_ESSAY_COUNT))
    );
    const usableMcqCount = Number(topic?.usableMcqCount || 0);
    const usableEssayCount = Number(topic?.usableEssayCount || 0);
    const topicQuizStartReady = usableMcqCount >= topicMcqTargetCount;
    const topicEssayStartReady = usableEssayCount >= topicEssayTargetCount;
    const topicExamReady = Boolean(topic?.examReady)
        || (topicQuizStartReady && usableEssayCount >= topicEssayTargetCount);
    const courseId = topic?.courseId;
    const voiceModeEnabled = Boolean(profile?.voiceModeEnabled);
    const voiceQuota = useQuery(
        api.subscriptions.getVoiceGenerationQuotaStatus,
        user?.id ? {} : 'skip'
    );
    const isVoicePremium = Boolean(voiceQuota?.isPremium);
    const storageKey = topicId ? `topicOverride:${topicId}` : null;
    const contentCacheKey = topicId ? `topicContent:${topicId}` : null;
    const synthesizeLessonVoice = useCallback(
        async (text, options = {}) => {
            if (!topicId) {
                throw new Error('Topic not found.');
            }
            return synthesizeTopicVoice({
                topicId,
                text,
                consumeQuota: options.consumeQuota !== false,
            });
        },
        [synthesizeTopicVoice, topicId]
    );
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
        if (!contentCacheKey) return;
        try {
            const cached = localStorage.getItem(contentCacheKey);
            if (cached) {
                setCachedContent(cached);
            }
        } catch (error) {
            console.warn('Failed to load cached topic content', error);
        }
    }, [contentCacheKey]);

    useEffect(() => {
        if (!storageKey) return;
        try {
            if (overrideContent && overrideContent.trim()) {
                localStorage.setItem(storageKey, overrideContent);
            } else {
                localStorage.removeItem(storageKey);
            }
        } catch (error) {
            console.warn('Failed to cache lesson content', error);
        }
    }, [storageKey, overrideContent]);

    useEffect(() => {
        if (!contentCacheKey) return;
        if (!topic?.content) return;
        setCachedContent(topic.content);
        try {
            localStorage.setItem(contentCacheKey, topic.content);
        } catch (error) {
            console.warn('Failed to cache topic content', error);
        }
    }, [contentCacheKey, topic?.content]);

    useEffect(() => {
        if (!topicId) return;
        if (usableEssayCount >= topicEssayTargetCount) return;

        const scheduleMarker = `${topicId}:${usableEssayCount}`;
        if (essayTopUpMarkerRef.current === scheduleMarker) return;
        essayTopUpMarkerRef.current = scheduleMarker;

        void requestEssayQuestionTopUp({
            topicId,
            minimumCount: topicEssayTargetCount,
        }).catch((error) => {
            console.warn('Failed to schedule essay question top-up', error);
        });
    }, [
        topicId,
        usableEssayCount,
        topicEssayTargetCount,
        requestEssayQuestionTopUp,
    ]);

    const content = overrideContent || topic?.content || cachedContent;
    const normalizedContent = useMemo(() => {
        if (!content || typeof content !== 'string') return content;

        const normalized = normalizeLessonContent(content);
        const normalizedWordCount = normalized
            .replace(/[#>*_`~-]/g, ' ')
            .split(/\s+/)
            .filter(Boolean)
            .length;

        if (normalizedWordCount >= 40) {
            return normalized;
        }

        const heading = String(topic?.title || 'Lesson Overview')
            .replace(/^Topic\s*\d+\s*:\s*/i, '')
            .replace(/\s*[•|]\s.*$/, '')
            .replace(/\s+/g, ' ')
            .trim();
        const summary = String(topic?.description || '')
            .replace(/\s+/g, ' ')
            .trim();

        return [
            `## ${heading || 'Lesson Overview'}`,
            summary || 'This lesson is being prepared from your uploaded material.',
            '### What You Will Learn',
            '- Core ideas from this topic',
            '- Step-by-step explanations with examples',
            '- Common mistakes and how to avoid them',
            '### Note',
            'Full lesson details are still being finalized. You can tap "Re-explain differently" to regenerate immediately.',
        ].join('\n\n');
    }, [content, topic?.title, topic?.description]);
    const contentLines = typeof normalizedContent === 'string'
        ? normalizedContent.split(/\\n|\n/).filter(Boolean)
        : null;
    const speechText = useMemo(() => {
        if (!normalizedContent || typeof normalizedContent !== 'string') return '';
        return normalizedContent
            .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/[#>`_~-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }, [normalizedContent]);
    const previousSpeechTextRef = useRef(speechText);

    useEffect(() => {
        if (!voiceModeEnabled && (isPlaying || isPaused)) {
            stopVoice();
        }
    }, [voiceModeEnabled, isPlaying, isPaused, stopVoice]);

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

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const updateAnimationPreference = () => {
            const desktopViewport = window.innerWidth >= 1024;
            setShouldAnimateBlocks(!motionQuery.matches && desktopViewport);
        };

        updateAnimationPreference();
        window.addEventListener('resize', updateAnimationPreference, { passive: true });
        if (motionQuery.addEventListener) {
            motionQuery.addEventListener('change', updateAnimationPreference);
        } else if (motionQuery.addListener) {
            motionQuery.addListener(updateAnimationPreference);
        }

        return () => {
            window.removeEventListener('resize', updateAnimationPreference);
            if (motionQuery.removeEventListener) {
                motionQuery.removeEventListener('change', updateAnimationPreference);
            } else if (motionQuery.removeListener) {
                motionQuery.removeListener(updateAnimationPreference);
            }
        };
    }, []);

    useEffect(() => {
        const handleScroll = () => setShowScrollTop(window.scrollY > 600);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

    const cleanInline = useCallback((text) => cleanInlineText(text), []);

    const cleanLine = (text) => cleanDisplayLine(text);

    const sanitizeTopicTitle = (value) => {
        return cleanLine(value || '')
            .replace(/\s*[•|]\s.*$/, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
    };
    const firstLessonHeading = useMemo(() => {
        if (!normalizedContent || typeof normalizedContent !== 'string') return '';
        const lines = normalizedContent.split(/\n/);
        for (const line of lines) {
            const match = line.trim().match(/^#{1,6}\s+(.+)$/);
            if (match) {
                return cleanLine(match[1]);
            }
        }
        return '';
    }, [normalizedContent]);
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
    const profileInitial = useMemo(() => {
        const source = profile?.fullName || user?.name || user?.email || '';
        const firstCharacter = String(source).trim().charAt(0);
        return firstCharacter ? firstCharacter.toUpperCase() : 'S';
    }, [profile?.fullName, user?.name, user?.email]);

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

    const parsed = useMemo(() => {
        if (!normalizedContent || typeof normalizedContent !== 'string') {
            return { blocks: [], toc: [] };
        }

        const lines = normalizedContent.split(/\n/);
        const blocks = [];
        const toc = [];
        let headerCount = 0;
        let previousWasSpacer = false;

        for (let i = 0; i < lines.length; i += 1) {
            const raw = lines[i]?.trim?.() ?? '';
            if (!raw) {
                if (previousWasSpacer || blocks.length === 0) continue;
                blocks.push({ type: 'spacer', key: `spacer-${i}` });
                previousWasSpacer = true;
                continue;
            }
            previousWasSpacer = false;
            const cleanedRaw = cleanLine(raw);

            // Skip malformed marker-only lines that should not render as content blocks.
            if (isArtifactLine(raw) || !cleanedRaw) {
                continue;
            }

            // Headers
            const headerMatch = raw.match(/^(#{1,6})\s+(.+)$/);
            if (headerMatch) {
                const level = headerMatch[1].length;
                let text = cleanLine(headerMatch[2]);
                let trailingParagraph = '';
                if (text.length > 80) {
                    const splitMatch = text.match(/^(.{15,250}?[.!?)]|.{15,150}?[:])\s+([A-Z].+)$/);
                    if (splitMatch) {
                        text = splitMatch[1].trim();
                        trailingParagraph = splitMatch[2].trim();
                    }
                }
                const id = slugifyText(text, headerCount);
                headerCount += 1;
                toc.push({ id, text, level });
                blocks.push({ type: 'header', level, text, id, key: `h-${i}` });
                if (trailingParagraph) {
                    blocks.push({ type: 'paragraph', text: trailingParagraph, key: `p-${i}-after-header` });
                }
                continue;
            }

            const plainSectionTitle = cleanLine(raw)
                .replace(/:$/, '')
                .toLowerCase();
            if (SECTION_TITLES_SET.has(plainSectionTitle)) {
                const id = slugifyText(raw, headerCount);
                headerCount += 1;
                const text = cleanLine(raw).replace(/:$/, '');
                toc.push({ id, text, level: 3 });
                blocks.push({ type: 'header', level: 3, text, id, key: `h-section-${i}` });
                continue;
            }

            // Alerts (Tip, Note, Warning, Important)
            const alertMatch = raw.match(/^[-•*]?\s*(Tip|Note|Warning|Important|Key Takeaway):\s*(.+)$/i);
            if (alertMatch) {
                blocks.push({
                    type: 'alert',
                    alertType: alertMatch[1].toLowerCase(),
                    text: alertMatch[2],
                    key: `a-${i}`
                });
                continue;
            }

            // Definitions
            const defMatch = raw.match(/^[-•*]?\s*(Definition|Key Term|Concept):\s*(.+)$/i);
            if (defMatch) {
                blocks.push({
                    type: 'definition',
                    term: defMatch[1],
                    text: defMatch[2],
                    key: `d-${i}`
                });
                continue;
            }

            const emphasizedDefinitionMatch = raw.match(/^\*\*([^*]{2,40})\*\*\s*:\s*(.+)$/);
            if (emphasizedDefinitionMatch) {
                const term = cleanLine(emphasizedDefinitionMatch[1]);
                // Prevent matching generic lists or steps that happen to use bolding
                if (!term.toLowerCase().includes('step') && !term.startsWith('-')) {
                    blocks.push({
                        type: 'definition',
                        term,
                        text: emphasizedDefinitionMatch[2],
                        key: `d-em-${i}`
                    });
                    continue;
                }
            }

            // Examples
            const exampleMatch = raw.match(/^[-•*]?\s*(Example|For example):\s*(.+)$/i);
            if (exampleMatch) {
                blocks.push({
                    type: 'example',
                    text: exampleMatch[2],
                    key: `e-${i}`
                });
                continue;
            }

            // Lists
            if (raw.startsWith('- ') || raw.startsWith('• ') || raw.startsWith('* ')) {
                blocks.push({ type: 'bullet', text: raw.replace(/^[-•*]\s+/, ''), key: `b-${i}` });
                continue;
            }

            const numMatch = raw.match(/^(\d+)[.)]\s+(.+)$/);
            if (numMatch) {
                blocks.push({ type: 'numbered', num: numMatch[1], text: numMatch[2], key: `n-${i}` });
                continue;
            }

            // Blockquotes
            if (raw.startsWith('> ')) {
                const quoteText = cleanLine(raw.slice(2));
                if (!quoteText || isArtifactLine(quoteText)) {
                    continue;
                }
                blocks.push({ type: 'quote', text: quoteText, key: `q-${i}` });
                continue;
            }

            // Default Paragraph — try to split long text with embedded section titles
            if (raw.length > 200) {
                // Try to detect embedded section-like patterns and split them
                const sectionSplit = raw.split(new RegExp(`((?:^|\\s)(?:${SECTION_TITLE_PATTERN})\\s*(?:[:\\-]|\\b))`, 'i'));
                if (sectionSplit.length > 1) {
                    for (let j = 0; j < sectionSplit.length; j++) {
                        const part = sectionSplit[j]?.trim();
                        if (!part) continue;
                        // Check if this part looks like a section title (short, title-case)
                        if (part.length < 60 && /^[A-Z]/.test(part) && !/[.!?]$/.test(part)) {
                            const titleId = slugifyText(part, headerCount);
                            headerCount += 1;
                            toc.push({ id: titleId, text: cleanLine(part), level: 3 });
                            blocks.push({ type: 'header', level: 3, text: cleanLine(part), id: titleId, key: `h-${i}-${j}` });
                        } else {
                            blocks.push({ type: 'paragraph', text: part, key: `p-${i}-${j}` });
                        }
                    }
                    continue;
                }
            }
            blocks.push({ type: 'paragraph', text: raw, key: `p-${i}` });
        }

        return { blocks, toc };
    }, [normalizedContent]);

    const handleStartExam = async (preferredFormat = 'mcq') => {
        if (!topicId) {
            setStartExamError('Topic not found. Please return to the dashboard and try again.');
            return;
        }
        if (preferredFormat === 'essay' && !topicEssayStartReady) {
            setStartExamError(
                `Essay questions are still preparing (${usableEssayCount}/${topicEssayTargetCount}). Please check back in a moment.`
            );
            return;
        }

        setStartExamError('');
        setStartingExam(true);

        try {
            navigate(`/dashboard/exam/${topicId}`, {
                state: {
                    preferredFormat,
                    source: 'topic_detail',
                },
            });
        } catch {
            setStartExamError('Failed to start the exam. Please try again.');
        } finally {
            setStartingExam(false);
        }
    };

    const handleReExplain = useCallback(async () => {
        if (!topicId) return;
        setReExplainError('');
        setReExplainLoading(true);
        try {
            const result = await reExplainTopic({ topicId, style: reExplainStyle });
            setOverrideContent(result?.content || '');
            setReExplainOpen(false);
        } catch (error) {
            if (isReExplainQuotaExceededError(error)) {
                setReExplainError(
                    resolveConvexErrorMessage(
                        error,
                        "You've used your free lesson re-explain. Upgrade to premium for unlimited re-explains."
                    )
                );
            } else {
                setReExplainError(resolveConvexErrorMessage(error, 'Failed to re-explain. Please try again.'));
            }
        } finally {
            setReExplainLoading(false);
        }
    }, [topicId, reExplainStyle, reExplainTopic]);

    if (!topicId) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="text-center max-w-md px-6">
                    <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">Topic not found</h2>
                    <p className="text-neutral-500 font-medium mb-6">Please return to your dashboard and select a topic.</p>
                    <Link to="/dashboard" className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/20">
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    if (topicData === undefined) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-neutral-500 font-medium">Loading lesson...</p>
                </div>
            </div>
        );
    }

    if (topicData === null) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="text-center max-w-md px-6">
                    <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">Topic not found</h2>
                    <p className="text-neutral-500 font-medium mb-6">We couldn’t find this topic. Please return to your dashboard.</p>
                    <Link to="/dashboard" className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/20">
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-background-light dark:bg-background-dark font-display antialiased text-neutral-900 dark:text-white min-h-screen flex flex-col overflow-x-hidden touch-pan-y">
            <header className="fixed top-0 inset-x-0 z-40 flex items-center justify-between px-4 py-3 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border-b border-neutral-200/50 dark:border-neutral-800/50">
                <div className="flex items-center gap-3">
                    <Link to={courseId ? `/dashboard/course/${courseId}` : "/dashboard"} className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-xl">arrow_back</span>
                        <span className="hidden sm:inline text-sm font-medium">Back</span>
                    </Link>
                    <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700"></div>
                    <Link to="/dashboard" className="hidden sm:flex items-center gap-2 text-neutral-600 dark:text-neutral-400 hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-xl">home</span>
                        <span className="text-sm font-medium">Dashboard</span>
                    </Link>
                    <div className="hidden sm:block w-px h-5 bg-neutral-200 dark:bg-neutral-700"></div>
                    <span className="text-xs sm:text-sm font-semibold text-neutral-700 dark:text-neutral-300 truncate max-w-[180px] sm:max-w-[240px] md:max-w-md">
                        {headerTopicTitle}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setReadingMode((value) => !value)}
                        className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                        title={readingMode ? 'Switch to split view' : 'Switch to focus mode'}
                    >
                        <span className="material-symbols-outlined text-lg">{readingMode ? 'fullscreen' : 'splitscreen'}</span>
                        <span className="hidden md:inline">{readingMode ? 'Focus' : 'Split'}</span>
                    </button>
                    <button
                        onClick={() => setSettingsOpen(true)}
                        className="w-9 h-9 flex items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                        aria-label="Settings"
                    >
                        <span className="material-symbols-outlined text-xl">settings</span>
                    </button>
                    <Link to="/profile" className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-purple-500 p-0.5">
                        <div className="w-full h-full rounded-full bg-white dark:bg-neutral-900 flex items-center justify-center">
                            <span className="text-primary font-bold text-xs">{profileInitial}</span>
                        </div>
                    </Link>
                </div>
            </header>
            <main className={`flex-1 w-full mx-auto px-4 md:px-6 lg:px-10 pt-20 md:pt-24 pb-20 md:pb-8 lg:pt-28 lg:pb-12 ${readingMode ? 'max-w-4xl' : 'max-w-[1440px]'} transition-[margin] duration-200 ${notesOpen || chatOpen ? 'md:mr-80' : ''}`}>
                <div className={`grid grid-cols-1 ${readingMode ? '' : 'lg:grid-cols-12'} gap-8 lg:gap-12`}>
                    <div ref={contentRef} className={`${readingMode ? '' : 'lg:col-span-9'} space-y-8`}>
                        <div className="bg-surface-light dark:bg-surface-dark rounded-2xl md:rounded-3xl p-5 md:p-8 lg:p-10 shadow-card border border-neutral-100 dark:border-neutral-800 relative">
                            <div className="flex flex-col gap-4 max-w-none">
                                <span className="md:hidden inline-block w-fit px-3 py-1 text-[10px] font-extrabold tracking-widest uppercase text-primary bg-primary/10 rounded-full border border-primary/10 mb-2">{headerTopicTitle}</span>
                                <h1 className="text-xl sm:text-2xl lg:text-5xl font-extrabold text-neutral-900 dark:text-white tracking-tight leading-tight">
                                    {heroTopicTitle}
                                </h1>
                                <p className="text-neutral-500 dark:text-neutral-400 text-base lg:text-lg font-medium">{cleanLine(topic?.description || "You're doing great, let's dive in!")}</p>
                                <div className="overflow-hidden rounded-2xl border border-neutral-200/70 dark:border-neutral-700/70 bg-neutral-50 dark:bg-neutral-900/50">
                                    <img
                                        src={topicIllustrationUrl}
                                        alt={`${heroTopicTitle} illustration`}
                                        loading="lazy"
                                        className="h-44 w-full object-cover md:h-64"
                                    />
                                </div>
                                <div className="pt-2">
                                    <button
                                        onClick={() => setReExplainOpen(true)}
                                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800/80 text-neutral-800 dark:text-white rounded-full transition-shadow duration-200 shadow-soft-ui border border-neutral-200/70 dark:border-neutral-700/70 cursor-pointer hover:shadow-soft-ui-hover hover:border-primary/30 active:scale-95 active:shadow-inner group"
                                    >
                                        <span className="material-symbols-outlined text-[20px] text-primary group-hover:text-primary/80 transition-colors">lightbulb</span>
                                        <span className="text-xs font-bold tracking-tight">Re-explain differently</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className={`${readingMode ? '' : 'grid grid-cols-1 md:grid-cols-2'} gap-8`}>
                            <div className={`flex flex-col justify-center h-full ${readingMode ? '' : 'md:col-span-2'}`}>
                                <div className="bg-surface-light dark:bg-surface-dark rounded-3xl p-8 h-full border border-neutral-100 dark:border-neutral-800 shadow-card hover:shadow-lg transition-shadow duration-300">
                                    <div className="flex flex-col gap-3 mb-6">
                                        <div className="flex items-center justify-between">
                                            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/10">
                                                Lesson Overview
                                            </span>
                                        </div>
                                        {isVoiceSupported && speechText && (
                                            <div className="hidden md:flex items-center gap-2 overflow-x-auto pb-1 -mb-1">
                                                <button
                                                    onClick={() => {
                                                        if (!speechText) return;
                                                        if (voiceStatus === 'loading') return;
                                                        if (isPaused) {
                                                            resumeVoice();
                                                        } else {
                                                            playVoice(speechText);
                                                        }
                                                    }}
                                                    disabled={!isVoiceSupported || !speechText || voiceStatus === 'loading'}
                                                    className="inline-flex items-center gap-1 px-3 h-9 rounded-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-200 hover:border-primary/40 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">
                                                        {voiceStatus === 'loading' ? 'hourglass_top' : (isPaused ? 'play_arrow' : 'volume_up')}
                                                    </span>
                                                    {voiceStatus === 'loading' ? 'Loading...' : (isPaused ? 'Resume' : 'Play')}
                                                </button>
                                                <button
                                                    onClick={pauseVoice}
                                                    disabled={!isPlaying}
                                                    className="inline-flex items-center gap-1 px-3 h-9 rounded-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-200 hover:border-primary/40 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">pause</span>
                                                    Pause
                                                </button>
                                                <button
                                                    onClick={stopVoice}
                                                    disabled={!isPlaying && !isPaused}
                                                    className="inline-flex items-center gap-1 px-3 h-9 rounded-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-200 hover:border-primary/40 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">stop</span>
                                                    Stop
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    {isVoiceSupported && (
                                        <div className="mb-4 hidden md:block">
                                            {!isVoiceSupported && (
                                                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                                                    Voice mode is not supported in this browser.
                                                </div>
                                            )}
                                            {isVoiceSupported && !speechText && (
                                                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-600">
                                                    No explanation text is available to read aloud.
                                                </div>
                                            )}
                                            {isVoiceSupported && speechText && (
                                                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-600">
                                                    {voiceStatus === 'loading' && 'Generating voice audio...'}
                                                    {voiceStatus === 'playing' && 'Reading explanation aloud...'}
                                                    {voiceStatus === 'paused' && 'Reading paused.'}
                                                    {(voiceStatus === 'idle' || voiceStatus === 'error') && 'Tap Play to hear this explanation.'}
                                                </div>
                                            )}
                                            {voicePlaybackError && (
                                                <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                                                    {voicePlaybackError}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {isVoiceSupported && (
                                        <div className="mb-4 md:hidden">
                                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                                                Voice playback is temporarily unavailable on mobile.
                                            </div>
                                        </div>
                                    )}

                                    {normalizedContent ? (
                                        <LessonContentRenderer
                                            blocks={parsed.blocks}
                                            shouldAnimateBlocks={shouldAnimateBlocks}
                                            cleanInline={cleanInline}
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-16 text-center opacity-60">
                                            <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-4 animate-pulse">
                                                <span className="material-symbols-outlined text-neutral-400 text-[32px]">auto_stories</span>
                                            </div>
                                            <p className="text-neutral-500 font-medium text-lg">Preparing your lesson content...</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                    </div>

                    {!readingMode && (
                        <TopicSidebar
                            normalizedContent={normalizedContent}
                            contentLines={contentLines}
                            toc={parsed.toc}
                            cleanLine={cleanLine}
                            topic={topic}
                        />
                    )}
                </div>

                <div className="mt-12 w-full flex flex-col items-center">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-px w-16 bg-gradient-to-r from-transparent to-neutral-300 dark:to-neutral-600"></div>
                        <span className="material-symbols-outlined text-primary/40 text-2xl">expand_more</span>
                        <div className="h-px w-16 bg-gradient-to-l from-transparent to-neutral-300 dark:to-neutral-600"></div>
                    </div>
                    <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 md:p-8 text-center border border-neutral-200 dark:border-neutral-800 shadow-sm w-full">
                        <h3 className="text-xl md:text-2xl font-bold text-neutral-900 dark:text-white mb-2">Ready to practice?</h3>
                        <p className="text-neutral-500 dark:text-neutral-400 text-sm mb-6">Test your knowledge with questions based on this lesson.</p>

                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <Link
                                to={topicId ? `/dashboard/concept-intro/${topicId}` : "/dashboard/concept-intro"}
                                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl text-sm font-semibold shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/30 transition-shadow"
                            >
                                <span className="material-symbols-outlined text-lg">school</span>
                                <span>Study Concepts</span>
                            </Link>
                            <button
                                onClick={() => handleStartExam('mcq')}
                                disabled={startingExam}
                                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-shadow disabled:opacity-60"
                            >
                                <span className="material-symbols-outlined text-lg">quiz</span>
                                <span>
                                    {startingExam
                                        ? 'Preparing...'
                                        : 'Take MCQ Quiz'}
                                </span>
                            </button>
                            <button
                                onClick={() => handleStartExam('essay')}
                                disabled={startingExam || !topicEssayStartReady}
                                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-fuchsia-600 text-white rounded-xl text-sm font-semibold shadow-md shadow-purple-500/20 hover:shadow-lg hover:shadow-purple-500/30 transition-shadow disabled:opacity-60"
                            >
                                <span className="material-symbols-outlined text-lg">edit_note</span>
                                <span>
                                    {startingExam
                                        ? 'Preparing...'
                                        : topicEssayStartReady
                                            ? 'Take Essay Quiz'
                                            : `Essay Preparing (${usableEssayCount}/${topicEssayTargetCount})`}
                                </span>
                            </button>
                        </div>

                        {!topicQuizStartReady && (
                            <div className="mt-4 max-w-md mx-auto rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                                {`${usableMcqCount}/${topicMcqTargetCount} MCQ and ${usableEssayCount}/${topicEssayTargetCount} essay questions ready.`}
                            </div>
                        )}
                        {topicQuizStartReady && !topicExamReady && (
                            <div className="mt-4 max-w-md mx-auto rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                                {`MCQ quiz is ready. Essay questions are still preparing (${usableEssayCount}/${topicEssayTargetCount}) and will continue building in the background.`}
                            </div>
                        )}
                        {startExamError && (
                            <div className="mt-4 max-w-md mx-auto rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                {startExamError}
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* AI Tutor floating button */}
            {user && !chatOpen && !notesOpen && (
                <button
                    onClick={openChat}
                    className="fixed bottom-20 right-[4.5rem] z-30 w-11 h-11 rounded-full bg-primary text-white shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
                    aria-label="Open AI tutor"
                >
                    <span className="material-symbols-outlined text-xl">smart_toy</span>
                </button>
            )}

            {/* Notes floating button */}
            {user && !notesOpen && !chatOpen && (
                <button
                    onClick={openNotes}
                    className="fixed bottom-20 right-6 z-30 w-11 h-11 rounded-full bg-amber-500 text-white shadow-lg shadow-amber-500/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
                    aria-label="Open notes"
                >
                    <span className="material-symbols-outlined text-xl">edit_note</span>
                </button>
            )}

            {showScrollTop && !notesOpen && !chatOpen && (
                <button
                    onClick={scrollToTop}
                    className="fixed bottom-20 md:bottom-6 left-4 md:left-auto md:right-6 z-30 w-11 h-11 rounded-full bg-primary text-white shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
                    aria-label="Scroll to top"
                >
                    <span className="material-symbols-outlined text-xl">arrow_upward</span>
                </button>
            )}

            {/* Notes panel */}
            <TopicNotesPanel
                topicId={topicId}
                open={notesOpen}
                onClose={() => setNotesOpen(false)}
                appendText={notesAppendText}
            />

            {/* AI Tutor chat panel */}
            <TopicChatPanel
                topicId={topicId}
                topicTitle={topic?.title || ''}
                open={chatOpen}
                onClose={() => setChatOpen(false)}
            />

            {/* Highlight explain popover */}
            {selection && (
                <HighlightExplainPopover
                    selection={selection}
                    topicId={topicId}
                    onClose={clearSelection}
                    onCopyToNotes={(text) => {
                        setNotesAppendText(text);
                        openNotes();
                        clearSelection();
                    }}
                />
            )}

            <TopicSettingsModal
                open={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                voiceModeEnabled={voiceModeEnabled}
                onToggleVoiceMode={toggleVoiceMode}
                voiceSaving={voiceSaving}
                voiceSettingsError={voiceSettingsError}
                isVoiceSupported={isVoiceSupported}
                stopVoice={stopVoice}
                playVoice={playVoice}
            />

            <TopicReExplainModal
                open={reExplainOpen}
                onClose={() => setReExplainOpen(false)}
                selectedStyle={reExplainStyle}
                onStyleChange={setReExplainStyle}
                loading={reExplainLoading}
                error={reExplainError}
                onReExplain={handleReExplain}
            />
        </div>
    );
};

export { TopicDetail };
export default TopicDetail;
