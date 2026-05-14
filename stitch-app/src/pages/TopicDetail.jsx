import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useAction, useMutation, useConvexAuth } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';
import { useStudyTimer } from '../hooks/useStudyTimer';
import { useRouteResolvedTopic } from '../hooks/useRouteResolvedTopic';
import { useVoicePlayback } from '../lib/useVoicePlayback';
import TopicSettingsModal from '../components/TopicSettingsModal';
import TopicReExplainModal from '../components/TopicReExplainModal';
import TopicSidebar from '../components/TopicSidebar';
import TopicNotesPanel from '../components/TopicNotesPanel';
import TopicChatPanel from '../components/TopicChatPanel';
import HighlightExplainPopover from '../components/HighlightExplainPopover';
import LessonHeader from '../components/lesson/LessonHeader';
import LessonProgressBar from '../components/lesson/LessonProgressBar';
import LessonTOC from '../components/lesson/LessonTOC';
import StudyActionsPanel from '../components/lesson/StudyActionsPanel';
import PracticeActionsCard from '../components/lesson/PracticeActionsCard';
import LessonPodcastCard from '../components/lesson/LessonPodcastCard';
import MobileLessonActions from '../components/lesson/MobileLessonActions';
import FloatingStudyTools from '../components/lesson/FloatingStudyTools';
import useReadingProgress from '../components/lesson/useReadingProgress';
import LessonContentRenderer from '../components/LessonContentRenderer';
import StudyModeSelector from '../components/StudyModeSelector';
import SourcePanel from '../components/SourcePanel';
import NextStepsGuidance from '../components/NextStepsGuidance';
import GuidedStudyPath from '../components/GuidedStudyPath';
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

const SECTION_SETS = {
    quick_revision: ['big idea', 'key ideas', 'key ideas in simple words', 'key ideas in plain english', 'simple introduction', 'quick check', 'summary'],
    exam_prep: ['key ideas', 'key ideas in simple words', 'key ideas in plain english', 'common mistakes', 'common mistakes and misconceptions', 'worked example', 'worked examples', 'mini worked example', 'quick check', 'summary'],
    practice_only: ['quick check', 'self-check', 'self-check prompts'],
    full: null,
};
const EMBEDDED_SECTION_SPLIT_PATTERN = new RegExp(`((?:^|\\s)(?:${SECTION_TITLE_PATTERN})\\s*(?:[:\\-]|\\b))`, 'i');
const SECTION_TEXT_STRIP_PATTERN = /[^a-z\s]/g;
const QUICK_CHECK_SECTION_PATTERN = /\bquick check\b/;
const WORD_BANK_SECTION_PATTERN = /\b(word bank|glossary|quick glossary)\b/;
const ANALOGY_SECTION_PATTERN = /\b(analog|everyday analog)\b/;
const COMMON_MISTAKE_SECTION_PATTERN = /\b(common mistake|misconception)\b/;
const STEP_TERM_PATTERN = /step/i;

const buildObjectiveExamRoute = (examTopicId) =>
    examTopicId ? `/dashboard/exam/${examTopicId}?autostart=mcq` : '/dashboard';
const buildEssayExamRoute = (examTopicId) =>
    examTopicId ? `/dashboard/exam/${examTopicId}?autostart=essay` : '/dashboard';

const getCurrentHashTargetId = () => {
    if (typeof window === 'undefined') return '';
    const rawHash = window.location.hash ? window.location.hash.slice(1) : '';
    if (!rawHash) return '';
    try {
        return decodeURIComponent(rawHash).trim();
    } catch {
        return rawHash.trim();
    }
};

const scrollHashTargetIntoView = ({ behavior = 'auto' } = {}) => {
    const targetId = getCurrentHashTargetId();
    if (!targetId) return false;
    const node = document.getElementById(targetId);
    if (!node) return false;
    node.scrollIntoView({ behavior, block: 'start' });
    return true;
};

const useTopicDetailController = () => {
    const { topicId: topicIdParam } = useParams();
    const routeTopicId = typeof topicIdParam === 'string' ? topicIdParam.trim() : '';
    const { user, profile, updateProfile, loading: authLoading } = useAuth();
    const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
    useStudyTimer(user?.id);
    const synthesizeTopicVoice = useAction(api.ai.synthesizeTopicVoice);
    const reExplainTopic = useAction(api.ai.reExplainTopic);
    const [reExplainOpen, setReExplainOpen] = useState(false);
    const [reExplainStyle, setReExplainStyle] = useState("Teach me like I'm 12");
    const [reExplainLoading, setReExplainLoading] = useState(false);
    const [reExplainError, setReExplainError] = useState('');
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [voiceSaving, setVoiceSaving] = useState(false);
    const [voiceSettingsError, setVoiceSettingsError] = useState('');
    const [overrideContent, setOverrideContent] = useState('');
    const [cachedContent, setCachedContent] = useState('');
    const [shouldAnimateBlocks, setShouldAnimateBlocks] = useState(false);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [notesOpen, setNotesOpen] = useState(false);
    const [notesAppendText, setNotesAppendText] = useState('');
    const [chatOpen, setChatOpen] = useState(false);
    const [sourceOpen, setSourceOpen] = useState(false);
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
        setChatOpen(true);
    }, [captureLessonScrollForSidePanel]);
    const contentRef = useRef(null);
    const mainRef = useRef(null);
    const { selection, clearSelection } = useTextSelection(contentRef);
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
    const topicQueryResult = useQuery(
        api.topics.getTopicWithQuestions,
        routeTopicId && !authLoading && isConvexAuthenticated
            ? { topicId: routeTopicId }
            : 'skip'
    );
    const {
        topic,
        topicId,
        isLoadingRouteTopic,
        isMissingRouteTopic,
    } = useRouteResolvedTopic(routeTopicId, topicQueryResult, {
        suspendMissingDetection: authLoading || !isConvexAuthenticated,
    });
    const courseId = topic?.courseId;
    const finalAssessmentTopic = useQuery(
        api.topics.getFinalAssessmentTopicByCourseAndUpload,
        courseId && topic?.sourceUploadId ? { courseId, sourceUploadId: topic.sourceUploadId } : 'skip'
    );
    const voiceModeEnabled = Boolean(profile?.voiceModeEnabled);
    const podcastEnabled = import.meta.env.VITE_PODCAST_GEN_ENABLED === 'true' && topicId;
    const voiceQuota = useQuery(
        api.subscriptions.getVoiceGenerationQuotaStatus,
        user?.id && isConvexAuthenticated ? {} : 'skip'
    );
    const topicProgress = useQuery(
        api.topics.getUserTopicProgress,
        topicId ? { topicId } : 'skip'
    );
    const upsertProgress = useMutation(api.topics.upsertTopicProgress);
    const sourcePassages = useQuery(
        api.topics.getTopicSourcePassages,
        sourceOpen && topicId ? { topicId } : 'skip'
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
        if (!contentCacheKey) return;
        if (!topic?.content) return;
        try {
            localStorage.setItem(contentCacheKey, topic.content);
        } catch (error) {
            console.warn('Failed to cache topic content', error);
        }
    }, [contentCacheKey, topic?.content]);

    // Track topic study progress on mount
    useEffect(() => {
        if (!topicId || !user?.id) return;
        upsertProgress({ topicId, lastStudiedAt: Date.now() }).catch(() => {});
    }, [topicId, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
                if (!STEP_TERM_PATTERN.test(term) && !term.startsWith('-')) {
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
                const sectionSplit = raw.split(EMBEDDED_SECTION_SPLIT_PATTERN);
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

        // ── Second pass: section-aware block enrichment ──
        const quickCheckPairs = [];
        const wordBankTerms = [];
        let currentSection = '';

        const detectMistakeLabel = (text) => {
            if (/(exam|test|paper)/i.test(text)) return 'Exam Trap';
            if (/(confuse|similar|mix|same as)/i.test(text)) return 'Do Not Mix Up';
            if (/(common|often|many|students)/i.test(text)) return 'Common Confusion';
            return null;
        };

        for (let b = 0; b < blocks.length; b++) {
            const block = blocks[b];
            if (block.type === 'header') {
                currentSection = block.text.toLowerCase().replace(SECTION_TEXT_STRIP_PATTERN, '').trim();
                continue;
            }
            const blockText = typeof block.text === 'string' ? block.text : '';

            // Quick Check: collect Q/A pairs from numbered blocks
            if (QUICK_CHECK_SECTION_PATTERN.test(currentSection) && block.type === 'numbered') {
                const qMatch = blockText.match(/^\*\*Q:\*\*\s*(.+)/);
                if (qMatch) {
                    const next = blocks[b + 1];
                    const nextText = typeof next?.text === 'string' ? next.text : '';
                    const aMatch = nextText.match(/^\*\*A:\*\*\s*(.+)/);
                    if (aMatch) {
                        const pair = {
                            questionText: qMatch[1].trim(),
                            answerText: aMatch[1].trim(),
                            key: `qc-${b}`,
                        };
                        quickCheckPairs.push(pair);
                        block.type = 'quickcheck_hidden';
                        next.type = 'quickcheck_hidden';
                        b += 1; // skip answer line
                    }
                }
            }

            // Word Bank: collect term/definition from bullets
            if (WORD_BANK_SECTION_PATTERN.test(currentSection)
                && block.type === 'bullet') {
                const termMatch = blockText.match(/^(.+?)\s+[—–-]\s+(.+)$/);
                if (termMatch) {
                    wordBankTerms.push({
                        term: termMatch[1].replace(/\*\*/g, '').trim(),
                        definition: termMatch[2].trim(),
                        key: `wb-${b}`,
                    });
                    block.type = 'wordbank_hidden';
                }
            }

            // Analogies: convert numbered items to analogy cards
            if (ANALOGY_SECTION_PATTERN.test(currentSection)
                && block.type === 'numbered') {
                const analogyMatch = blockText.match(/^\*\*(.+?):\*\*\s*(.+)/);
                if (analogyMatch) {
                    block.type = 'analogycard';
                    block.label = analogyMatch[1].trim();
                    block.text = analogyMatch[2].trim();
                }
            }

            // Common Mistakes: add labels to bullets
            if (COMMON_MISTAKE_SECTION_PATTERN.test(currentSection)
                && block.type === 'bullet') {
                block.type = 'mistake';
                block.label = detectMistakeLabel(blockText);
            }
        }

        const wordCount = normalizedContent
            ? normalizedContent.replace(/[#>*_`~-]/g, ' ').split(/\s+/).filter(Boolean).length
            : 0;
        const readingMinutes = Math.max(1, Math.ceil(wordCount / 200));

        return { blocks, toc, readingMinutes, quickCheckPairs, wordBankTerms };
    }, [normalizedContent]);

    // Prefer structured definitions from the DB (always available, already cleaned) over the
    // markdown parse (fragile — only present when AI used a "Word Bank" heading in the right format).
    const dbDefinitions = topic?.structuredDefinitions ?? topic?.contentGraph?.definitions;
    const wordBankTerms = useMemo(() => {
        if (dbDefinitions?.length > 0) {
            return dbDefinitions.map((d, i) => ({ term: d.term, definition: d.meaning, key: `db-${i}` }));
        }
        return parsed.wordBankTerms;
    }, [dbDefinitions, parsed.wordBankTerms]);

    // Section filtering by study mode
    const filteredBlocks = useMemo(() => {
        if (!studyMode || studyMode === 'full' || !SECTION_SETS[studyMode]) return parsed.blocks;
        const allowed = SECTION_SETS[studyMode];
        let include = false;
        return parsed.blocks.filter((block) => {
            if (block.type === 'header') {
                const normalized = block.text.toLowerCase().replace(SECTION_TEXT_STRIP_PATTERN, '').trim();
                include = allowed.some((sectionTitle) => normalized.indexOf(sectionTitle) !== -1);
                return include; // always show allowed section headers
            }
            return include;
        });
    }, [parsed.blocks, studyMode]);

    const displayBlocks = useMemo(() => {
        const blocksWithWidgets = [];
        let insertedQuickCheck = false;
        let insertedWordBank = false;

        for (const block of filteredBlocks) {
            blocksWithWidgets.push(block);

            if (block.type !== 'header') {
                continue;
            }

            const normalized = block.text.toLowerCase().replace(SECTION_TEXT_STRIP_PATTERN, '').trim();

            if (
                !insertedQuickCheck &&
                parsed.quickCheckPairs?.length > 0 &&
                QUICK_CHECK_SECTION_PATTERN.test(normalized)
            ) {
                blocksWithWidgets.push({
                    type: 'quickcheck_widget',
                    key: `${block.key}-quickcheck-widget`,
                });
                insertedQuickCheck = true;
            }

            if (
                !insertedWordBank &&
                wordBankTerms?.length > 0 &&
                WORD_BANK_SECTION_PATTERN.test(normalized)
            ) {
                blocksWithWidgets.push({
                    type: 'wordbank_widget',
                    key: `${block.key}-wordbank-widget`,
                });
                insertedWordBank = true;
            }
        }

        if (!insertedQuickCheck && parsed.quickCheckPairs?.length > 0) {
            blocksWithWidgets.push({
                type: 'quickcheck_widget',
                key: 'quickcheck-widget-fallback',
            });
        }

        if (!insertedWordBank && wordBankTerms?.length > 0) {
            blocksWithWidgets.push({
                type: 'wordbank_widget',
                key: 'wordbank-widget-fallback',
            });
        }

        return blocksWithWidgets;
    }, [filteredBlocks, parsed.quickCheckPairs, wordBankTerms]);

    useEffect(() => {
        if (!studyMode) return undefined;
        if (!getCurrentHashTargetId()) return undefined;
        const timer = window.setTimeout(() => {
            scrollHashTargetIntoView({ behavior: 'auto' });
        }, 100);
        return () => window.clearTimeout(timer);
    }, [displayBlocks, studyMode]);

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
    const examTopicId = isTopicQuizRoute
        ? topicId
        : (finalAssessmentTopic?._id || null);
    const objectiveExamRoute = buildObjectiveExamRoute(examTopicId);
    const essayExamRoute = buildEssayExamRoute(examTopicId);
    const objectiveExamActionLabel = isTopicQuizRoute
        ? (topicProgress?.bestScore != null ? 'Retry Objective Quiz' : 'Start Objective Quiz')
        : (examTopicId ? 'Take Final Objective Quiz' : 'Final Objective Quiz Preparing');
    const essayExamActionLabel = isTopicQuizRoute
        ? 'Start Essay'
        : (examTopicId ? 'Take Final Essay' : 'Final Essay Preparing');
    const practiceDescription = isTopicQuizRoute
        ? 'Choose the format that fits how you want to test this lesson.'
        : 'This topic is assessed in the final exam for better question quality.';
    const postLessonPrompt = isTopicQuizRoute
        ? 'Pick the next practice format for this topic.'
        : 'This topic will be assessed in the final exam.';

    const { progress: readingProgress, activeId: activeSectionId } = useReadingProgress({
        toc: parsed.toc,
        headerOffset: 108,
    });
    const activeSectionLabel = useMemo(() => {
        if (!activeSectionId || !Array.isArray(parsed.toc)) return '';
        const found = parsed.toc.find((entry) => entry.id === activeSectionId);
        return found?.text || '';
    }, [activeSectionId, parsed.toc]);
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
            const result = await reExplainTopic({ topicId, style: reExplainStyle });
            const nextContent = result?.content || '';
            setOverrideContent(nextContent);
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
    }, [topicId, reExplainStyle, reExplainTopic, storageKey]);

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
            topicId,
            termsStarred: starred,
            lastStudiedAt: Date.now(),
        }).catch(() => {});
    }, [topicId, upsertProgress]);

    const courseHref = courseId ? `/dashboard/course/${courseId}` : '/dashboard';
    const cleanedDescription = cleanLine(topic?.description || '');

    const headerPrimaryAction = examTopicId
        ? { id: 'start-quiz', icon: 'quiz', label: objectiveExamActionLabel, href: objectiveExamRoute, reloadDocument: true }
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
        podcastEnabled && {
            id: 'podcast-rail',
            icon: 'podcasts',
            label: 'Listen as Podcast',
            description: 'Audio lesson for this topic',
            onClick: () => {
                const node = document.getElementById('topic-podcast');
                if (node) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
            },
        },
        examTopicId && {
            id: 'essay-rail',
            icon: 'edit_note',
            label: 'Take Essay',
            description: essayExamActionLabel,
            href: essayExamRoute,
            reloadDocument: true,
        },
        topicId && {
            id: 'fillins-rail',
            icon: 'spellcheck',
            label: 'Concept Fill-ins',
            description: 'Recall on key terms',
            href: `/dashboard/concept-intro/${topicId}`,
        },
    ].filter(Boolean);

    const studyToolSecondary = [
        {
            id: 'reexplain',
            icon: 'lightbulb',
            label: 'Re-explain differently',
            onClick: () => setReExplainOpen(true),
        },
        {
            id: 'notes',
            icon: 'edit_note',
            label: 'Open notes',
            onClick: openNotes,
        },
        {
            id: 'source',
            icon: 'menu_book',
            label: 'View source passages',
            onClick: openSource,
        },
    ];

    const practicePrimary = examTopicId
        ? [{ id: 'p-start-quiz', icon: 'quiz', label: 'Start Quiz', href: objectiveExamRoute, reloadDocument: true }]
        : [{ id: 'p-quiz-pending', icon: 'hourglass_top', label: 'Quiz preparing', disabled: true }];

    const practiceSecondary = [
        examTopicId && { id: 'p-essay', icon: 'edit_note', label: essayExamActionLabel, href: essayExamRoute, reloadDocument: true },
        topicId && { id: 'p-fillins', icon: 'spellcheck', label: 'Concept Fill-ins', href: `/dashboard/concept-intro/${topicId}` },
        { id: 'p-tutor', icon: 'smart_toy', label: 'Ask AI Tutor', onClick: openChat },
        podcastEnabled && { id: 'p-podcast', icon: 'podcasts', label: 'Generate Podcast', onClick: () => {
            const node = document.getElementById('topic-podcast');
            if (node) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } },
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
        examTopicId
            ? { id: 'm-quiz', icon: 'quiz', label: 'Quiz', href: objectiveExamRoute, reloadDocument: true, primary: true }
            : { id: 'm-quiz', icon: 'hourglass_top', label: 'Quiz', disabled: true },
        { id: 'm-tutor', icon: 'smart_toy', label: 'Tutor', onClick: openChat },
        { id: 'm-notes', icon: 'edit_note', label: 'Notes', onClick: openNotes },
        topicProgress?.completedAt
            ? podcastEnabled && { id: 'm-podcast', icon: 'podcasts', label: 'Podcast', onClick: () => {
                const node = document.getElementById('topic-podcast');
                if (node) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } }
            : { id: 'm-done', icon: 'check_circle', label: 'Done', primary: true, onClick: () => upsertProgress({ topicId, completedAt: Date.now(), lastStudiedAt: Date.now() }).catch(() => {}) },
    ].filter(Boolean);

    return {
        activeSectionId,
        activeSectionLabel,
        chatInitialPrompt,
        chatOpen,
        cleanInline,
        cleanLine,
        cleanedDescription,
        clearSelection,
        closeChat,
        closeNotes,
        closeSource,
        contentLines,
        contentRef,
        courseHref,
        courseId,
        displayBlocks,
        examTopicId,
        filteredBlocks,
        handleAskTutor,
        handleReExplain,
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
        mainRef,
        mobileActionItems,
        normalizedContent,
        notesAppendText,
        notesOpen,
        openChat,
        openNotes,
        openSource,
        parsed,
        pauseVoice,
        playVoice,
        podcastEnabled,
        postLessonPrompt,
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
        setNotesAppendText,
        setReExplainOpen,
        setReExplainStyle,
        setSettingsOpen,
        settingsOpen,
        shouldAnimateBlocks,
        showScrollTop,
        sourceOpen,
        sourcePassages,
        speechText,
        stopVoice,
        studyMode,
        studyToolActions,
        studyToolSecondary,
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

const TopicEmptyState = ({ title, description, action }) => (
    <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="text-center max-w-sm px-6">
            <h2 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-2">{title}</h2>
            <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mb-6">{description}</p>
            {action}
        </div>
    </div>
);

const TopicLoadingState = () => (
    <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="text-center">
            <div className="animate-spin rounded-full size-10 border-2 border-border-light dark:border-border-dark border-t-primary mx-auto mb-4" />
            <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">Loading lesson…</p>
        </div>
    </div>
);

const TopicStudyModeView = ({
    courseId,
    headerTopicTitle,
    onSelect,
    onSkip,
}) => (
    <div className="bg-background-light dark:bg-background-dark font-body antialiased text-text-main-light dark:text-text-main-dark min-h-screen flex flex-col overflow-x-hidden">
        <header className="fixed top-0 inset-x-0 z-40 flex items-center justify-between px-4 h-14 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-xl border-b border-border-light dark:border-border-dark">
            <div className="flex items-center gap-2 min-w-0">
                <Link
                    to={courseId ? `/dashboard/course/${courseId}` : '/dashboard'}
                    aria-label="Go back"
                    className="btn-icon size-8 shrink-0"
                >
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                </Link>
                <span className="text-body-sm font-medium text-text-sub-light dark:text-text-sub-dark truncate max-w-[200px] sm:max-w-sm">
                    {headerTopicTitle}
                </span>
            </div>
        </header>

        <main className="flex-1 pt-14">
            <StudyModeSelector
                topicTitle={headerTopicTitle}
                onSelect={onSelect}
                onSkip={onSkip}
            />
        </main>
    </div>
);

const TopicVoiceToolbar = ({
    isPaused,
    isPlaying,
    pauseVoice,
    playVoice,
    resumeVoice,
    speechText,
    stopVoice,
    voicePlaybackError,
    voiceStatus,
}) => {
    const handlePlay = () => {
        if (!speechText || voiceStatus === 'loading') return;
        if (isPaused) {
            resumeVoice();
            return;
        }
        playVoice(speechText);
    };

    return (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border-subtle dark:border-border-subtle-dark bg-surface-light dark:bg-surface-dark px-3.5 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
                <span className="size-8 rounded-lg bg-primary-50 dark:bg-primary-900/25 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>graphic_eq</span>
                </span>
                <div className="min-w-0">
                    <p className="text-caption font-semibold text-text-main-light dark:text-text-main-dark leading-tight">Read this lesson aloud</p>
                    {voicePlaybackError && (
                        <p className="text-[11px] text-rose-500 leading-tight mt-0.5 truncate">{voicePlaybackError}</p>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
                <button
                    onClick={handlePlay}
                    disabled={!speechText || voiceStatus === 'loading'}
                    className="btn-secondary text-caption px-3 py-1.5 gap-1 disabled:opacity-50"
                >
                    <span className="material-symbols-outlined text-[16px]">
                        {voiceStatus === 'loading' ? 'hourglass_top' : isPaused ? 'play_arrow' : 'volume_up'}
                    </span>
                    {voiceStatus === 'loading' ? 'Loading' : isPaused ? 'Resume' : 'Play'}
                </button>
                {(isPlaying || isPaused) && (
                    <>
                        <button onClick={pauseVoice} disabled={!isPlaying} className="btn-icon size-8 disabled:opacity-50" aria-label="Pause">
                            <span className="material-symbols-outlined text-[16px]">pause</span>
                        </button>
                        <button onClick={stopVoice} className="btn-icon size-8" aria-label="Stop">
                            <span className="material-symbols-outlined text-[16px]">stop</span>
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

const TopicLessonMainColumn = ({ controller }) => {
    const {
        cleanInline,
        cleanLine,
        contentLines,
        contentRef,
        displayBlocks,
        examTopicId,
        filteredBlocks,
        handleAskTutor,
        handleTermsStarred,
        heroTopicTitle,
        isPaused,
        isPlaying,
        isTopicQuizRoute,
        isVoiceSupported,
        mainRef,
        normalizedContent,
        openChat,
        openSource,
        parsed,
        pauseVoice,
        playVoice,
        podcastEnabled,
        postLessonPrompt,
        practiceDescription,
        practicePrimary,
        practiceSecondary,
        practiceTertiary,
        resolvedTopicTitle,
        resumeVoice,
        shouldAnimateBlocks,
        speechText,
        stopVoice,
        topic,
        topicId,
        topicIllustrationUrl,
        topicProgress,
        voicePlaybackError,
        voiceStatus,
        wordBankTerms,
    } = controller;

    return (
        <main ref={mainRef} className="min-w-0 space-y-6">
            <TopicSidebar
                normalizedContent={normalizedContent}
                contentLines={contentLines}
                toc={parsed.toc}
                cleanLine={cleanLine}
                topic={topic}
                mobileOnly
            />

            {topicIllustrationUrl && (
                <div className="overflow-hidden rounded-2xl border border-border-subtle dark:border-border-subtle-dark">
                    <img
                        src={topicIllustrationUrl}
                        alt={`${heroTopicTitle} illustration`}
                        loading="lazy"
                        className="h-44 md:h-56 w-full object-cover"
                    />
                </div>
            )}

            {isVoiceSupported && speechText && (
                <TopicVoiceToolbar
                    isPaused={isPaused}
                    isPlaying={isPlaying}
                    pauseVoice={pauseVoice}
                    playVoice={playVoice}
                    resumeVoice={resumeVoice}
                    speechText={speechText}
                    stopVoice={stopVoice}
                    voicePlaybackError={voicePlaybackError}
                    voiceStatus={voiceStatus}
                />
            )}

            <article className="bg-white rounded-3xl border border-border-subtle shadow-soft px-5 py-6 md:p-8" ref={contentRef}>
                {normalizedContent ? (
                    <LessonContentRenderer
                        blocks={displayBlocks}
                        shouldAnimateBlocks={shouldAnimateBlocks}
                        cleanInline={cleanInline}
                        onViewSource={openSource}
                        onAskTutor={handleAskTutor}
                        quickCheckPairs={parsed.quickCheckPairs}
                        wordBankTerms={wordBankTerms}
                        topicId={topicId}
                        starredTerms={topicProgress?.termsStarred}
                        onTermsStarred={handleTermsStarred}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="size-14 rounded-2xl bg-primary-soft flex items-center justify-center mb-4 animate-pulse">
                            <span className="material-symbols-outlined text-primary text-[26px]">auto_stories</span>
                        </div>
                        <h3 className="text-body-lg font-semibold text-text-primary">Preparing your lesson</h3>
                        <p className="text-body-sm text-text-secondary mt-1 max-w-xs">
                            ChewnPour is organizing this topic into key ideas, examples, checks, and study tools.
                        </p>
                    </div>
                )}
            </article>

            <PracticeActionsCard
                title={topicProgress?.completedAt ? 'Lesson complete — keep the momentum' : 'Ready to test your understanding?'}
                description={topicProgress?.completedAt ? postLessonPrompt : (isTopicQuizRoute ? 'Pick how you want to practice this lesson.' : practiceDescription)}
                primaryActions={practicePrimary}
                secondaryActions={practiceSecondary}
                tertiaryActions={practiceTertiary}
                completed={Boolean(topicProgress?.completedAt)}
                bestScore={topicProgress?.bestScore ?? null}
            />

            <details className="group bg-white rounded-3xl border border-border-subtle px-5 md:px-6">
                <summary className="flex items-center gap-3 py-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                    <span className="size-9 rounded-xl bg-primary-soft flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>route</span>
                    </span>
                    <span className="flex-1 min-w-0">
                        <span className="block text-body-md font-semibold text-text-primary leading-tight">Guided study path</span>
                        <span className="block text-caption text-text-muted mt-0.5">A section-by-section walkthrough of this lesson.</span>
                    </span>
                    <span className="material-symbols-outlined text-[20px] text-text-muted transition-transform group-open:rotate-180">expand_more</span>
                </summary>
                <div className="pb-5 pt-1">
                    <GuidedStudyPath
                        topicTitle={resolvedTopicTitle}
                        blocks={filteredBlocks}
                        onAskTutor={handleAskTutor}
                    />
                </div>
            </details>

            {topicProgress?.completedAt && (
                <div className="bg-white rounded-3xl border border-border-subtle p-5 md:p-6">
                    <NextStepsGuidance
                        topicId={topicId}
                        examTopicId={examTopicId}
                        topicTitle={resolvedTopicTitle}
                        percentage={null}
                        completedAt={topicProgress?.completedAt}
                        bestScore={topicProgress?.bestScore}
                        hasWordBank={wordBankTerms?.length > 0}
                        onOpenChat={openChat}
                        examLabel={isTopicQuizRoute ? 'Start the objective quiz' : 'Take the final objective quiz'}
                        examDescription={isTopicQuizRoute
                            ? 'Choose objective, essay, or concept practice for this topic.'
                            : 'This topic is assessed as part of the final exam.'}
                        variant="lesson"
                    />
                </div>
            )}

            {podcastEnabled ? (
                <div id="topic-podcast">
                    <LessonPodcastCard topicId={topicId} />
                </div>
            ) : null}
        </main>
    );
};

const TopicLessonPanels = ({ controller }) => {
    const {
        chatInitialPrompt,
        chatOpen,
        clearSelection,
        closeChat,
        closeNotes,
        closeSource,
        isVoiceSupported,
        mobileActionItems,
        notesAppendText,
        notesOpen,
        openNotes,
        playVoice,
        reExplainError,
        reExplainLoading,
        reExplainOpen,
        reExplainStyle,
        selection,
        setNotesAppendText,
        setReExplainOpen,
        setReExplainStyle,
        setSettingsOpen,
        settingsOpen,
        showScrollTop,
        sourceOpen,
        sourcePassages,
        stopVoice,
        studyToolSecondary,
        topic,
        topicId,
        toggleVoiceMode,
        user,
        voiceModeEnabled,
        voiceSaving,
        voiceSettingsError,
        handleReExplain,
        scrollToTop,
    } = controller;

    return (
        <>
            <TopicNotesPanel
                topicId={topicId}
                open={notesOpen}
                onClose={closeNotes}
                appendText={notesAppendText}
            />

            <TopicChatPanel
                topicId={topicId}
                topicTitle={topic?.title || ''}
                open={chatOpen}
                onClose={closeChat}
                initialPrompt={chatInitialPrompt}
            />

            <SourcePanel
                open={sourceOpen}
                onClose={closeSource}
                passages={sourcePassages}
            />

            {user && !chatOpen && !notesOpen && (
                <MobileLessonActions items={mobileActionItems} />
            )}

            <FloatingStudyTools
                hidden={chatOpen || notesOpen}
                tools={studyToolSecondary.map((tool) => ({ ...tool }))}
            />

            {showScrollTop && !notesOpen && !chatOpen && (
                <button
                    onClick={scrollToTop}
                    className="fixed z-30 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] right-4 lg:bottom-6 lg:right-auto lg:left-6 btn-icon size-10 bg-surface-light dark:bg-surface-dark border border-border-subtle dark:border-border-subtle-dark shadow-card"
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
        </>
    );
};

const TopicLessonBreadcrumbs = ({ courseTitle, courseHref, topicTitle }) => (
    <nav aria-label="Breadcrumb" className="font-body-sm text-body-sm text-text-secondary">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <li>
                <Link to="/dashboard/lessons" className="hover:text-text-primary transition-colors">Lessons</Link>
            </li>
            <li aria-hidden="true" className="text-text-muted">/</li>
            <li>
                <Link to={courseHref || '/dashboard/lessons'} className="hover:text-text-primary transition-colors">
                    {courseTitle || 'Course'}
                </Link>
            </li>
            <li aria-hidden="true" className="text-text-muted">/</li>
            <li className="font-medium text-text-primary line-clamp-1">{topicTitle}</li>
        </ol>
    </nav>
);

const TopicMetaBadges = ({ sourceLabel, topicProgress }) => {
    const completed = Boolean(topicProgress?.completedAt);
    const bestScore = Number(topicProgress?.bestScore ?? 0);
    let masteryLabel = 'In progress';
    let masteryClass = 'bg-surface-soft text-text-secondary border-border-subtle';
    let masteryIcon = 'auto_stories';
    if (completed && bestScore >= 80) {
        masteryLabel = 'Mastered';
        masteryClass = 'bg-success-soft text-success border-success/30';
        masteryIcon = 'check_circle';
    } else if (completed) {
        masteryLabel = 'Reviewing';
        masteryClass = 'bg-warning-soft text-warning border-warning/30';
        masteryIcon = 'event_repeat';
    }
    return (
        <div className="flex flex-wrap items-center gap-space-2">
            {sourceLabel ? (
                <span className="inline-flex items-center gap-space-2 rounded-full border border-border-subtle bg-surface px-space-3 py-space-1 font-label-xs text-label-xs text-text-secondary">
                    <span className="material-symbols-outlined text-[16px] text-text-muted">description</span>
                    <span>Source: {sourceLabel}</span>
                </span>
            ) : null}
            <span className={`inline-flex items-center gap-space-2 rounded-full border px-space-3 py-space-1 font-label-xs text-label-xs ${masteryClass}`}>
                <span className="material-symbols-outlined text-[16px]">{masteryIcon}</span>
                <span>{masteryLabel}</span>
            </span>
        </div>
    );
};

const TopicSummaryCard = ({ description }) => {
    if (!description) return null;
    return (
        <section className="rounded-2xl border border-primary/15 bg-primary-subtle p-space-5">
            <div className="mb-space-2 flex items-center gap-space-2 text-primary">
                <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>lightbulb</span>
                <h2 className="font-label-md text-label-md font-semibold">Topic Summary</h2>
            </div>
            <p className="font-body-md text-body-md leading-relaxed text-text-primary">{description}</p>
        </section>
    );
};

const TopicLessonNav = ({ prevTopic, nextTopic, examTopicId }) => {
    const navigate = useNavigate();
    if (!prevTopic && !nextTopic && !examTopicId) return null;
    const goTo = (topicId) => () => navigate(`/dashboard/topic/${topicId}`);
    return (
        <div className="flex items-center justify-between gap-space-4 border-t border-border-subtle pt-space-6">
            {prevTopic ? (
                <button
                    type="button"
                    onClick={goTo(prevTopic._id)}
                    className="inline-flex items-center gap-space-2 rounded-xl border border-border-default bg-surface px-space-4 py-space-3 font-label-md text-label-md text-text-primary transition-colors hover:bg-surface-soft"
                >
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                    <span className="line-clamp-1 text-left">Previous Lesson</span>
                </button>
            ) : (
                <span aria-hidden="true" />
            )}
            {nextTopic ? (
                <button
                    type="button"
                    onClick={goTo(nextTopic._id)}
                    className="inline-flex items-center gap-space-2 rounded-xl bg-primary px-space-4 py-space-3 font-label-md text-label-md text-surface transition-colors hover:bg-primary-hover"
                >
                    <span className="line-clamp-1">Next Lesson</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
            ) : examTopicId ? (
                <Link
                    to={buildObjectiveExamRoute(examTopicId)}
                    className="inline-flex items-center gap-space-2 rounded-xl bg-primary px-space-4 py-space-3 font-label-md text-label-md text-surface transition-colors hover:bg-primary-hover"
                >
                    <span>Take the quiz</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </Link>
            ) : (
                <span aria-hidden="true" />
            )}
        </div>
    );
};

const STUDY_ASSISTANT_PROMPTS = [
    'Explain this lesson in simpler terms',
    'Give me a real-world example',
    'Quiz me on this topic',
];

const TopicStudyAssistantCard = ({ topicTitle, onAsk, onOpen }) => {
    const [draft, setDraft] = useState('');
    const handleSubmit = (event) => {
        event.preventDefault();
        const trimmed = draft.trim();
        if (!trimmed) {
            onOpen();
            return;
        }
        onAsk(trimmed);
        setDraft('');
    };
    return (
        <aside className="sticky top-space-6 flex h-fit flex-col gap-space-4 rounded-2xl border border-border-subtle bg-surface p-space-5 shadow-sm">
            <header className="flex items-center justify-between">
                <div className="flex items-center gap-space-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ai-soft text-ai">
                        <span className="material-symbols-outlined text-[20px]">smart_toy</span>
                    </span>
                    <div>
                        <p className="font-label-md text-label-md font-semibold text-text-primary">Study Assistant</p>
                        <p className="flex items-center gap-space-1 font-label-xs text-label-xs text-success">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" /> Online
                        </p>
                    </div>
                </div>
            </header>
            <div className="rounded-xl bg-ai-subtle p-space-4 font-body-sm text-body-sm leading-relaxed text-text-primary">
                {`Hi! I noticed you're reading about ${topicTitle || 'this lesson'}. Ask me anything — I'll use your uploaded material to help you understand it.`}
            </div>
            <div className="flex flex-col gap-space-2">
                {STUDY_ASSISTANT_PROMPTS.map((prompt) => (
                    <button
                        key={prompt}
                        type="button"
                        onClick={() => onAsk(prompt)}
                        className="rounded-full border border-border-subtle bg-surface px-space-3 py-space-2 text-left font-label-sm text-label-sm text-text-primary transition-colors hover:border-ai/40 hover:bg-ai-subtle"
                    >
                        {prompt}
                    </button>
                ))}
            </div>
            <form onSubmit={handleSubmit} className="flex items-center gap-space-2 rounded-full border border-border-subtle bg-surface-soft px-space-3 py-space-2 focus-within:border-primary">
                <input
                    type="text"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Ask a question..."
                    className="flex-1 bg-transparent font-body-sm text-body-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                />
                <button
                    type="submit"
                    aria-label="Send"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-surface transition-colors hover:bg-primary-hover"
                >
                    <span className="material-symbols-outlined text-[18px]">send</span>
                </button>
            </form>
        </aside>
    );
};

const TopicLessonShell = ({ controller }) => {
    const {
        cleanedDescription,
        courseHref,
        examTopicId,
        handleAskTutor,
        openChat,
        resolvedTopicTitle,
        topic,
        topicId,
        topicProgress,
    } = controller;

    useEffect(() => {
        if (typeof document === 'undefined') return undefined;
        const root = document.documentElement;
        const hadDark = root.classList.contains('dark');
        if (hadDark) root.classList.remove('dark');
        return () => {
            if (hadDark) root.classList.add('dark');
        };
    }, []);

    const courseQueryResult = useQuery(
        api.courses.getCourseWithTopics,
        topic?.courseId ? { courseId: topic.courseId } : 'skip',
    );
    const courseTitle = courseQueryResult?.title || '';
    const courseTopics = Array.isArray(courseQueryResult?.topics) ? courseQueryResult.topics : [];
    const currentIndex = courseTopics.findIndex((entry) => String(entry._id) === String(topicId));
    const prevTopic = currentIndex > 0 ? courseTopics[currentIndex - 1] : null;
    const nextTopic = currentIndex >= 0 && currentIndex < courseTopics.length - 1
        ? courseTopics[currentIndex + 1]
        : null;
    const sourceLabel = courseTitle;

    return (
        <div className="cp-theme bg-[#FAF8F3] font-body text-[#1F2933] min-h-screen">
            <div className="mx-auto grid w-full max-w-[1280px] grid-cols-1 gap-space-6 px-space-4 py-space-6 md:px-space-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-space-8 lg:px-space-8 lg:py-space-8">
                <div className="min-w-0 space-y-space-6">
                    <TopicLessonBreadcrumbs
                        courseTitle={courseTitle}
                        courseHref={courseHref}
                        topicTitle={resolvedTopicTitle}
                    />
                    <header className="space-y-space-3">
                        <TopicMetaBadges sourceLabel={sourceLabel} topicProgress={topicProgress} />
                        <h1 className="font-display-md text-display-md font-bold tracking-tight text-text-primary md:text-display-lg">
                            {resolvedTopicTitle}
                        </h1>
                    </header>
                    <TopicSummaryCard description={cleanedDescription} />
                    <TopicLessonMainColumn controller={controller} />
                    <TopicLessonNav
                        prevTopic={prevTopic}
                        nextTopic={nextTopic}
                        examTopicId={examTopicId}
                    />
                </div>
                <div className="hidden lg:block">
                    <TopicStudyAssistantCard
                        topicTitle={resolvedTopicTitle}
                        onAsk={handleAskTutor}
                        onOpen={openChat}
                    />
                </div>
            </div>

            <TopicLessonPanels controller={controller} />
        </div>
    );
};

const TopicDetail = () => {
    const controller = useTopicDetailController();

    if (!controller.routeTopicId) {
        return (
            <TopicEmptyState
                title="Topic not found"
                description="Please return to your dashboard and select a topic."
                action={<Link to="/dashboard" className="btn-primary px-5 py-2.5 text-body-sm">Back to Dashboard</Link>}
            />
        );
    }

    if (controller.isLoadingRouteTopic) {
        return <TopicLoadingState />;
    }

    if (controller.isMissingRouteTopic) {
        return (
            <TopicEmptyState
                title="This topic link is stale"
                description="Reload the dashboard, reopen the course, and start from the topic card again."
                action={<button type="button" onClick={controller.reloadDashboard} className="btn-primary px-5 py-2.5 text-body-sm">Reload Dashboard</button>}
            />
        );
    }

    if (controller.studyMode === null) {
        return (
            <TopicStudyModeView
                courseId={controller.courseId}
                headerTopicTitle={controller.headerTopicTitle}
                onSelect={controller.handleStudyModeSelect}
                onSkip={controller.handleStudyModeSkip}
            />
        );
    }

    return <TopicLessonShell controller={controller} />;
};

export { TopicDetail };
export default TopicDetail;
