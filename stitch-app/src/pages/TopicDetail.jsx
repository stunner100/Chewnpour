import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useAction } from 'convex/react';
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
    const [startingExam, setStartingExam] = useState(false);
    const [startExamError, setStartExamError] = useState('');
    const [reExplainOpen, setReExplainOpen] = useState(false);
    const [reExplainStyle, setReExplainStyle] = useState("Teach me like I'm 12");
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
    const mainRef = useRef(null);
    const { selection, clearSelection } = useTextSelection(contentRef);
    const navigate = useNavigate();
    const topicData = useQuery(
        api.topics.getTopicWithQuestions,
        topicId ? { topicId } : 'skip'
    );
    const topic = topicData || null;
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

    // Scroll to top on mount/navigation
    useEffect(() => {
        if (mainRef.current) mainRef.current.scrollTop = 0;
        window.scrollTo(0, 0);
    }, [topicId]);

    useEffect(() => {
        const handleScroll = () => {
            const scrollY = mainRef.current ? mainRef.current.scrollTop : window.scrollY;
            setShowScrollTop(scrollY > 600);
        };
        const target = mainRef.current;
        if (target) target.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            if (target) target.removeEventListener('scroll', handleScroll);
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

    const scrollToTop = () => {
        if (mainRef.current) mainRef.current.scrollTo({ top: 0, behavior: 'smooth' });
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
            <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
                <div className="text-center max-w-sm px-6">
                    <h2 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-2">Topic not found</h2>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mb-6">Please return to your dashboard and select a topic.</p>
                    <Link to="/dashboard" className="btn-primary px-5 py-2.5 text-body-sm">Back to Dashboard</Link>
                </div>
            </div>
        );
    }

    if (topicData === undefined) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-border-light dark:border-border-dark border-t-primary mx-auto mb-4" />
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">Loading lesson...</p>
                </div>
            </div>
        );
    }

    if (topicData === null) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
                <div className="text-center max-w-sm px-6">
                    <h2 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-2">Topic not found</h2>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mb-6">We couldn&apos;t find this topic.</p>
                    <Link to="/dashboard" className="btn-primary px-5 py-2.5 text-body-sm">Back to Dashboard</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-background-light dark:bg-background-dark font-body antialiased text-text-main-light dark:text-text-main-dark min-h-screen lg:h-screen flex flex-col overflow-x-hidden lg:overflow-hidden touch-pan-y">
            {/* Header */}
            <header className="fixed top-0 inset-x-0 z-40 flex items-center justify-between px-4 h-14 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-xl border-b border-border-light dark:border-border-dark">
                <div className="flex items-center gap-2 min-w-0">
                    <Link
                        to={courseId ? `/dashboard/course/${courseId}` : '/dashboard'}
                        aria-label="Go back"
                        className="btn-icon w-8 h-8 shrink-0"
                    >
                        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                    </Link>
                    <span className="text-body-sm font-medium text-text-sub-light dark:text-text-sub-dark truncate max-w-[200px] sm:max-w-sm">
                        {headerTopicTitle}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setReadingMode((v) => !v)}
                        className="hidden lg:flex btn-icon w-8 h-8"
                        title={readingMode ? 'Split view' : 'Focus mode'}
                    >
                        <span className="material-symbols-outlined text-[18px]">{readingMode ? 'splitscreen' : 'fullscreen'}</span>
                    </button>
                    <button
                        onClick={() => setSettingsOpen(true)}
                        className="btn-icon w-8 h-8"
                        aria-label="Settings"
                    >
                        <span className="material-symbols-outlined text-[18px]">settings</span>
                    </button>
                </div>
            </header>

            {/* Main content + side panels */}
            <div className="flex-1 flex flex-row pt-14 lg:min-h-0">
            <main ref={mainRef} className={`flex-1 min-w-0 w-full px-4 md:px-8 pt-6 pb-24 md:pb-12 transition-all duration-200 lg:overflow-y-auto`}>
            <div className={`mx-auto ${readingMode ? 'max-w-3xl' : 'max-w-6xl'} transition-all duration-200`}>
                <div className={`grid grid-cols-1 ${readingMode ? '' : 'lg:grid-cols-12'} gap-8`}>
                    {/* Lesson content */}
                    <div ref={contentRef} className={`${readingMode ? '' : 'lg:col-span-9'} space-y-6`}>
                        {/* Hero */}
                        <div>
                            <h1 className="text-display-sm md:text-display-lg text-text-main-light dark:text-text-main-dark mb-3">
                                {heroTopicTitle}
                            </h1>
                            <p className="text-body-base text-text-sub-light dark:text-text-sub-dark mb-5">
                                {cleanLine(topic?.description || "Let's dive in!")}
                            </p>
                            <div className="overflow-hidden rounded-xl border border-border-light dark:border-border-dark">
                                <img
                                    src={topicIllustrationUrl}
                                    alt={`${heroTopicTitle} illustration`}
                                    loading="lazy"
                                    className="h-40 w-full object-cover md:h-56"
                                />
                            </div>
                        </div>

                        {/* Toolbar row */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                onClick={() => setReExplainOpen(true)}
                                className="btn-secondary text-caption px-3.5 py-2 gap-1.5"
                            >
                                <span className="material-symbols-outlined text-[16px]">lightbulb</span>
                                Re-explain
                            </button>
                            {isVoiceSupported && speechText && (
                                <div className="hidden md:flex items-center gap-1.5">
                                    <button
                                        onClick={() => {
                                            if (!speechText || voiceStatus === 'loading') return;
                                            isPaused ? resumeVoice() : playVoice(speechText);
                                        }}
                                        disabled={!speechText || voiceStatus === 'loading'}
                                        className="btn-secondary text-caption px-3 py-2 gap-1 disabled:opacity-50"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">
                                            {voiceStatus === 'loading' ? 'hourglass_top' : isPaused ? 'play_arrow' : 'volume_up'}
                                        </span>
                                        {voiceStatus === 'loading' ? 'Loading' : isPaused ? 'Resume' : 'Play'}
                                    </button>
                                    {(isPlaying || isPaused) && (
                                        <>
                                            <button onClick={pauseVoice} disabled={!isPlaying} className="btn-icon w-8 h-8 disabled:opacity-50">
                                                <span className="material-symbols-outlined text-[16px]">pause</span>
                                            </button>
                                            <button onClick={stopVoice} className="btn-icon w-8 h-8">
                                                <span className="material-symbols-outlined text-[16px]">stop</span>
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                            {voicePlaybackError && (
                                <span className="text-caption text-red-500">{voicePlaybackError}</span>
                            )}
                        </div>

                        {/* Lesson body */}
                        <div className="card-base p-6 md:p-8">
                            {normalizedContent ? (
                                <LessonContentRenderer
                                    blocks={parsed.blocks}
                                    shouldAnimateBlocks={shouldAnimateBlocks}
                                    cleanInline={cleanInline}
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <div className="w-12 h-12 rounded-xl bg-surface-hover-light dark:bg-surface-hover-dark flex items-center justify-center mb-4 animate-pulse">
                                        <span className="material-symbols-outlined text-text-faint-light dark:text-text-faint-dark text-[24px]">auto_stories</span>
                                    </div>
                                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">Preparing your lesson...</p>
                                </div>
                            )}
                        </div>

                        {/* Practice section */}
                        <div className="card-base p-6 md:p-8 text-center">
                            <h3 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-1">Ready to practice?</h3>
                            <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mb-5">Test your understanding with questions from this lesson.</p>

                            <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
                                <Link
                                    to={topicId ? `/dashboard/concept/${topicId}` : '/dashboard/concept'}
                                    className="btn-secondary px-5 py-2.5 text-body-sm gap-2"
                                >
                                    <span className="material-symbols-outlined text-[18px] text-accent-emerald">school</span>
                                    Concept Practice
                                </Link>
                                <button
                                    onClick={() => handleStartExam('mcq')}
                                    disabled={startingExam}
                                    className="btn-primary px-5 py-2.5 text-body-sm gap-2 disabled:opacity-50"
                                >
                                    <span className="material-symbols-outlined text-[18px]">quiz</span>
                                    {startingExam ? 'Preparing...' : 'Objective Quiz'}
                                </button>
                                <button
                                    onClick={() => handleStartExam('essay')}
                                    disabled={startingExam}
                                    className="btn-secondary px-5 py-2.5 text-body-sm gap-2 disabled:opacity-50"
                                >
                                    <span className="material-symbols-outlined text-[18px]">edit_note</span>
                                    {startingExam ? 'Preparing...' : 'Essay Quiz'}
                                </button>
                            </div>

                            {startExamError && (
                                <p className="mt-4 text-caption text-red-500">{startExamError}</p>
                            )}
                        </div>
                    </div>

                    {/* Sidebar (split view) */}
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
            </div>
            </main>

            {/* Side panels (in-flow on lg, fixed overlay below lg) */}
            <TopicNotesPanel
                topicId={topicId}
                open={notesOpen}
                onClose={() => setNotesOpen(false)}
                appendText={notesAppendText}
            />

            <TopicChatPanel
                topicId={topicId}
                topicTitle={topic?.title || ''}
                open={chatOpen}
                onClose={() => setChatOpen(false)}
            />
            </div>

            {/* Floating action buttons */}
            {user && !chatOpen && !notesOpen && (
                <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6 right-4 z-30 flex flex-col gap-2">
                    <button
                        onClick={openChat}
                        className="w-11 h-11 rounded-full bg-primary text-white shadow-md flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
                        aria-label="Open AI tutor"
                    >
                        <span className="material-symbols-outlined text-[20px]">smart_toy</span>
                    </button>
                    <button
                        onClick={openNotes}
                        className="w-11 h-11 rounded-full bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-sub-light dark:text-text-sub-dark shadow-md flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
                        aria-label="Open notes"
                    >
                        <span className="material-symbols-outlined text-[20px]">edit_note</span>
                    </button>
                </div>
            )}

            {showScrollTop && !notesOpen && !chatOpen && (
                <button
                    onClick={scrollToTop}
                    className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6 left-4 z-30 btn-icon w-10 h-10 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-md"
                    aria-label="Scroll to top"
                >
                    <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
                </button>
            )}

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
