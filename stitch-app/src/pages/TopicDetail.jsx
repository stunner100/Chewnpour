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

// ── Pure rendering helpers (hoisted out of the component to avoid re-creation) ──

const HEADER_SIZES = {
    1: "text-3xl md:text-4xl font-extrabold text-neutral-900 dark:text-white mt-10 md:mt-12 mb-5 md:mb-6 tracking-tight flex items-center gap-3",
    2: "text-xl md:text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-8 md:mt-10 mb-3 md:mb-4 tracking-tight flex items-center gap-2",
    3: "text-lg md:text-xl font-bold text-neutral-800 dark:text-neutral-200 mt-6 md:mt-8 mb-2 md:mb-3 flex items-center gap-2"
};

const getHeaderIcon = (text) => {
    const lowText = text.toLowerCase();
    if (lowText.includes('intro')) return 'auto_stories';
    if (lowText.includes('practice') || lowText.includes('exercise')) return 'exercise';
    if (lowText.includes('summary') || lowText.includes('conclusion')) return 'task_alt';
    if (lowText.includes('block') || lowText.includes('concept')) return 'category';
    return null;
};

const parseBold = (text, cleanInline, cleanLine) => {
    const parts = text.split(/(\*\*.*?\*\*)/);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <span key={i} className="font-bold text-neutral-900 dark:text-white bg-yellow-100/50 dark:bg-yellow-900/30 px-1 rounded">{cleanInline(part.slice(2, -2))}</span>;
        }
        return cleanLine(part);
    });
};

const ALERT_STYLES = {
    tip: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 icon-lightbulb",
    note: "bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800 text-blue-900 dark:text-blue-100 icon-info",
    warning: "bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800 text-amber-900 dark:text-amber-100 icon-warning",
    important: "bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800 text-rose-900 dark:text-rose-100 icon-priority_high",
    "key takeaway": "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800 text-indigo-900 dark:text-indigo-100 icon-star"
};

const TopicDetail = () => {
    const { topicId } = useParams();
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
    const contentRef = useRef(null);
    const essayTopUpMarkerRef = useRef('');
    const navigate = useNavigate();
    const topicData = useQuery(
        api.topics.getTopicWithQuestions,
        topicId ? { topicId } : 'skip'
    );
    const topic = topicData || null;
    const EXAM_READY_MIN_MCQ_COUNT = 10;
    const EXAM_READY_MIN_ESSAY_COUNT = 3;
    const usableMcqCount = Number(topic?.usableMcqCount || 0);
    const usableEssayCount = Number(topic?.usableEssayCount || 0);
    const topicQuizStartReady = usableMcqCount >= EXAM_READY_MIN_MCQ_COUNT;
    const topicEssayStartReady = usableEssayCount >= EXAM_READY_MIN_ESSAY_COUNT;
    const topicExamReady = Boolean(topic?.examReady)
        || (topicQuizStartReady && usableEssayCount >= EXAM_READY_MIN_ESSAY_COUNT);
    const courseId = topic?.courseId;
    const voiceModeEnabled = Boolean(profile?.voiceModeEnabled);
    const storageKey = topicId ? `topicOverride:${topicId}` : null;
    const contentCacheKey = topicId ? `topicContent:${topicId}` : null;
    const synthesizeLessonVoice = useCallback(
        async (text) => {
            if (!topicId) {
                throw new Error('Topic not found.');
            }
            return synthesizeTopicVoice({
                topicId,
                text,
            });
        },
        [synthesizeTopicVoice, topicId]
    );
    const {
        isSupported: isVoiceSupported,
        status: voiceStatus,
        error: voicePlaybackError,
        playbackEngine,
        play: playVoice,
        pause: pauseVoice,
        resume: resumeVoice,
        stop: stopVoice,
        isPlaying,
        isPaused,
        availableVoices,
        selectedVoiceURI,
        selectedVoiceName,
        setVoicePreference,
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
        if (!topicId || !topicQuizStartReady) return;
        if (usableEssayCount >= EXAM_READY_MIN_ESSAY_COUNT) return;

        const scheduleMarker = `${topicId}:${usableEssayCount}`;
        if (essayTopUpMarkerRef.current === scheduleMarker) return;
        essayTopUpMarkerRef.current = scheduleMarker;

        void requestEssayQuestionTopUp({
            topicId,
            minimumCount: EXAM_READY_MIN_ESSAY_COUNT,
        }).catch((error) => {
            console.warn('Failed to schedule essay question top-up', error);
        });
    }, [
        topicId,
        topicQuizStartReady,
        usableEssayCount,
        EXAM_READY_MIN_ESSAY_COUNT,
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
    const browserLangRoot = useMemo(() => {
        if (typeof navigator === 'undefined' || !navigator.language) return 'en';
        return navigator.language.toLowerCase().split('-')[0];
    }, []);
    const voiceOptions = useMemo(() => {
        const localVoices = availableVoices.filter((voice) => voice.localService);
        const baseList = localVoices.length > 0 ? localVoices : availableVoices;
        const sameLang = baseList.filter((voice) => {
            const lang = (voice.lang || '').toLowerCase();
            return lang.startsWith(`${browserLangRoot}-`) || lang === browserLangRoot;
        });
        return (sameLang.length > 0 ? sameLang : baseList).slice(0, 40);
    }, [availableVoices, browserLangRoot]);
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
        if (!speechText) return;
        primeVoicePlayback(speechText);
    }, [voiceModeEnabled, speechText, primeVoicePlayback]);

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

    const cleanInline = (text) => cleanInlineText(text);

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
        if (!topicQuizStartReady) {
            setStartExamError(
                `Quiz is still preparing (${usableMcqCount}/${EXAM_READY_MIN_MCQ_COUNT} MCQ ready). Please check back in a moment.`
            );
            return;
        }
        if (preferredFormat === 'essay' && !topicEssayStartReady) {
            setStartExamError(
                `Essay questions are still preparing (${usableEssayCount}/${EXAM_READY_MIN_ESSAY_COUNT}). Please check back in a moment.`
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
        } catch {
            setReExplainError('Failed to re-explain. Please try again.');
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
            <main className={`flex-1 w-full mx-auto px-4 md:px-6 lg:px-10 pt-20 md:pt-24 pb-20 md:pb-8 lg:pt-28 lg:pb-12 ${readingMode ? 'max-w-4xl' : 'max-w-[1440px]'}`}>
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
                                        {voiceModeEnabled && (
                                            <div className="flex items-center gap-2 overflow-x-auto pb-1 -mb-1">
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
                                    {voiceModeEnabled && (
                                        <div className="mb-4">
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
                                                    {voiceStatus === 'playing' && (
                                                        playbackEngine === 'remote'
                                                            ? 'Reading explanation aloud...'
                                                            : 'Reading explanation aloud (browser voice)...'
                                                    )}
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

                                    {normalizedContent ? (
                                        <div className="prose prose-base md:prose-lg prose-neutral dark:prose-invert max-w-none text-neutral-700 dark:text-neutral-300 leading-relaxed">
                                            {parsed.blocks.map((block, index) => {
                                                if (block.type === 'spacer') {
                                                    return <div key={block.key} className="h-2 md:h-3"></div>;
                                                }

                                                const bold = (text) => parseBold(text, cleanInline, cleanLine);
                                                const animationClass = shouldAnimateBlocks ? "animate-fade-in fill-mode-forwards opacity-0" : "";
                                                const animationStyle = shouldAnimateBlocks ? { animationDelay: `${Math.min(index, 24) * 60}ms` } : undefined;

                                                if (block.type === 'header') {
                                                    const icon = getHeaderIcon(block.text);

                                                    return (
                                                        <div
                                                            key={block.key}
                                                            id={block.id}
                                                            className={`${HEADER_SIZES[block.level] || HEADER_SIZES[3]} scroll-mt-20 md:scroll-mt-32 ${animationClass}`}
                                                            style={animationStyle}
                                                        >
                                                            {icon && <span className="material-symbols-outlined text-primary/70">{icon}</span>}
                                                            {block.text}
                                                        </div>
                                                    );
                                                }

                                                if (block.type === 'alert') {
                                                    const currentStyle = ALERT_STYLES[block.alertType] || ALERT_STYLES.note;
                                                    const iconName = currentStyle.split('icon-')[1];

                                                    return (
                                                        <div key={block.key} className={`my-4 md:my-6 p-4 md:p-5 rounded-2xl border flex gap-3 md:gap-4 ${currentStyle.split('icon-')[0]} ${animationClass}`} style={animationStyle}>
                                                            <span className="material-symbols-outlined shrink-0 text-current opacity-70">{iconName}</span>
                                                            <div className="flex flex-col gap-1">
                                                                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{block.alertType}</span>
                                                                <div className="text-[15px] md:text-base font-medium leading-relaxed">{bold(block.text)}</div>
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                if (block.type === 'definition') {
                                                    return (
                                                        <div key={block.key} className={`my-4 md:my-6 p-5 md:p-6 rounded-[2rem] bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow duration-300 ${animationClass}`} style={animationStyle}>
                                                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                                                <span className="material-symbols-outlined text-6xl">menu_book</span>
                                                            </div>
                                                            <h4 className="text-sm font-bold text-primary uppercase tracking-wider mb-2 flex items-center gap-2">
                                                                <span className="w-2 h-2 rounded-full bg-primary"></span>
                                                                {block.term}
                                                            </h4>
                                                            <div className="text-base md:text-lg font-semibold text-neutral-800 dark:text-neutral-100 leading-relaxed italic">
                                                                {bold(block.text)}
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                if (block.type === 'example') {
                                                    return (
                                                        <div key={block.key} className={`my-4 md:my-6 pl-5 pr-5 md:pl-6 md:pr-6 py-4 md:py-5 border-l-4 border-indigo-400 dark:border-indigo-600 bg-indigo-50/30 dark:bg-indigo-950/20 rounded-r-2xl ${animationClass}`} style={animationStyle}>
                                                            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-2">
                                                                <span className="material-symbols-outlined text-[20px]">lightbulb_circle</span>
                                                                <span className="text-xs font-black uppercase tracking-widest">Example</span>
                                                            </div>
                                                            <div className="text-neutral-700 dark:text-neutral-300 text-[15px] md:text-base leading-relaxed">
                                                                {bold(block.text)}
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                if (block.type === 'bullet') {
                                                    return (
                                                        <div key={block.key} className={`flex items-start gap-3 ml-1 mb-3 md:mb-4 group ${animationClass}`} style={animationStyle}>
                                                            <div className="mt-1.5 h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                                                                <span className="material-symbols-outlined text-[14px] text-primary">arrow_forward</span>
                                                            </div>
                                                            <span className="text-[15px] md:text-base leading-7 text-neutral-700 dark:text-neutral-300">{bold(block.text)}</span>
                                                        </div>
                                                    );
                                                }

                                                if (block.type === 'numbered') {
                                                    return (
                                                        <div key={block.key} className={`flex items-start gap-4 ml-1 mb-3 md:mb-4 group ${animationClass}`} style={animationStyle}>
                                                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-[10px] font-black shrink-0 mt-0.5 shadow-sm shadow-primary/30">
                                                                {block.num}
                                                            </span>
                                                            <span className="text-[15px] md:text-base leading-7 text-neutral-700 dark:text-neutral-300">{bold(block.text)}</span>
                                                        </div>
                                                    );
                                                }

                                                if (block.type === 'quote') {
                                                    return (
                                                        <div key={block.key} className={`border-l-4 border-primary/30 bg-primary/5 pl-6 md:pl-8 py-5 md:py-6 pr-5 md:pr-6 rounded-r-3xl my-6 md:my-8 relative ${animationClass}`} style={animationStyle}>
                                                            <span className="absolute top-2 left-2 material-symbols-outlined text-primary/10 text-4xl">format_quote</span>
                                                            <div className="italic text-lg md:text-xl text-neutral-600 dark:text-neutral-300 font-medium leading-relaxed relative z-10">
                                                                {bold(block.text)}
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <p key={block.key} className={`my-3 md:my-4 text-base md:text-lg leading-relaxed text-neutral-700 dark:text-neutral-300 font-medium ${animationClass}`} style={animationStyle}>
                                                        {bold(block.text)}
                                                    </p>
                                                );
                                            })}
                                        </div>
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
                                disabled={startingExam || !topicQuizStartReady}
                                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-shadow disabled:opacity-60"
                            >
                                <span className="material-symbols-outlined text-lg">quiz</span>
                                <span>
                                    {startingExam
                                        ? 'Preparing...'
                                        : topicQuizStartReady
                                            ? 'Take MCQ Quiz'
                                            : 'Preparing Quiz...'}
                                </span>
                            </button>
                            <button
                                onClick={() => handleStartExam('essay')}
                                disabled={startingExam || !topicQuizStartReady || !topicEssayStartReady}
                                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-fuchsia-600 text-white rounded-xl text-sm font-semibold shadow-md shadow-purple-500/20 hover:shadow-lg hover:shadow-purple-500/30 transition-shadow disabled:opacity-60"
                            >
                                <span className="material-symbols-outlined text-lg">edit_note</span>
                                <span>
                                    {startingExam
                                        ? 'Preparing...'
                                        : topicEssayStartReady
                                            ? 'Take Essay Quiz'
                                            : `Essay Preparing (${usableEssayCount}/${EXAM_READY_MIN_ESSAY_COUNT})`}
                                </span>
                            </button>
                        </div>

                        {!topicQuizStartReady && (
                            <div className="mt-4 max-w-md mx-auto rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                                {`${usableMcqCount}/${EXAM_READY_MIN_MCQ_COUNT} MCQ and ${usableEssayCount}/${EXAM_READY_MIN_ESSAY_COUNT} essay questions ready.`}
                            </div>
                        )}
                        {topicQuizStartReady && !topicExamReady && (
                            <div className="mt-4 max-w-md mx-auto rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                                {`MCQ quiz is ready. Essay questions are still preparing (${usableEssayCount}/${EXAM_READY_MIN_ESSAY_COUNT}) and will continue building in the background.`}
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

            {showScrollTop && (
                <button
                    onClick={scrollToTop}
                    className="fixed bottom-6 right-6 z-30 w-11 h-11 rounded-full bg-primary text-white shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
                    aria-label="Scroll to top"
                >
                    <span className="material-symbols-outlined text-xl">arrow_upward</span>
                </button>
            )}

            <TopicSettingsModal
                open={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                voiceModeEnabled={voiceModeEnabled}
                onToggleVoiceMode={toggleVoiceMode}
                voiceSaving={voiceSaving}
                voiceSettingsError={voiceSettingsError}
                isVoiceSupported={isVoiceSupported}
                voiceOptions={voiceOptions}
                selectedVoiceURI={selectedVoiceURI}
                selectedVoiceName={selectedVoiceName}
                setVoicePreference={setVoicePreference}
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
