import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useStudyTimer } from './useStudyTimer';
import { useRouteResolvedTopic } from './useRouteResolvedTopic';
import { useVoicePlayback } from '../lib/useVoicePlayback';
import useReadingProgress from '../components/lesson/useReadingProgress';
import { useTextSelection } from './useTextSelection';
import {
    SECTION_TITLE_PATTERN,
    SECTION_TITLES_SET,
    cleanDisplayLine,
    cleanInlineText,
    isArtifactLine,
    isLowSignalLessonLine,
    normalizeLessonContent,
    slugifyText,
} from '../lib/topicContentFormatting';
import { isPlaceholderTopicIllustration, resolveTopicIllustrationUrl } from '../lib/topicIllustration';
import {
    SECTION_SETS,
    EMBEDDED_SECTION_SPLIT_PATTERN,
    SECTION_TEXT_STRIP_PATTERN,
    QUICK_CHECK_SECTION_PATTERN,
    WORD_BANK_SECTION_PATTERN,
    ANALOGY_SECTION_PATTERN,
    COMMON_MISTAKE_SECTION_PATTERN,
    STEP_TERM_PATTERN,
    buildTopicQuizRoute,
    buildEssayQuizRoute,
    buildTimedExamRoute,
    getCurrentHashTargetId,
    scrollHashTargetIntoView,
} from '../lib/topicLessonHelpers';

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
    };
};

const fetchTopicProgress = async (topicId) => {
    const response = await fetch(`/api/topics/${encodeURIComponent(topicId)}/progress`, {
        credentials: 'include',
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload?.progress || null;
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
    const [cachedContent, setCachedContent] = useState('');
    const [shouldAnimateBlocks, setShouldAnimateBlocks] = useState(false);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [notesOpen, setNotesOpen] = useState(false);
    const [notesAppendText, setNotesAppendText] = useState('');
    const [chatOpen, setChatOpen] = useState(false);
    const [sourceOpen, setSourceOpen] = useState(false);
    const [topicQueryResult, setTopicQueryResult] = useState(undefined);
    const [topicProgress, setTopicProgress] = useState(null);
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
    const voiceModeEnabled = false;
    const podcastEnabled = false;
    const sourcePassages = [];
    const isVoicePremium = false;

    useEffect(() => {
        if (!topicId || !user?.id) {
            setTopicProgress(null);
            return undefined;
        }
        let cancelled = false;
        fetchTopicProgress(topicId)
            .then((progress) => {
                if (!cancelled) setTopicProgress(progress);
            })
            .catch(() => {
                if (!cancelled) setTopicProgress(null);
            });
        return () => {
            cancelled = true;
        };
    }, [topicId, user?.id]);

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

    const storageKey = topicId ? `topicOverride:${topicId}` : null;
    const contentCacheKey = topicId ? `topicContent:${topicId}` : null;
    const synthesizeLessonVoice = useCallback(async () => {
        throw new Error('Voice playback is temporarily unavailable.');
    }, []);
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
            if (isArtifactLine(raw) || !cleanedRaw || isLowSignalLessonLine(raw)) {
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
                        const questionText = qMatch[1].trim();
                        const answerText = aMatch[1].trim();
                        block.type = 'quickcheck_hidden';
                        next.type = 'quickcheck_hidden';
                        if (
                            !isLowSignalLessonLine(questionText)
                            && !isLowSignalLessonLine(answerText)
                        ) {
                            quickCheckPairs.push({
                                questionText,
                                answerText,
                                key: `qc-${b}`,
                            });
                        }
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
        let skippedDuplicateTitle = false;
        const normalizeTitle = (value) => String(value || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
        const pageTitleKey = normalizeTitle(resolvedTopicTitle);

        for (const block of filteredBlocks) {
            if (
                !skippedDuplicateTitle
                && block.type === 'header'
                && block.level === 1
                && pageTitleKey
                && normalizeTitle(block.text) === pageTitleKey
            ) {
                skippedDuplicateTitle = true;
                continue;
            }

            blocksWithWidgets.push(block);

            if (block.type !== 'header') {
                continue;
            }

            const normalized = block.text.toLowerCase().replace(SECTION_TEXT_STRIP_PATTERN, '').trim();

            if (
                !insertedQuickCheck
                && parsed.quickCheckPairs?.length > 0
                && QUICK_CHECK_SECTION_PATTERN.test(normalized)
            ) {
                blocksWithWidgets.push({
                    type: 'quickcheck_widget',
                    key: `${block.key}-quickcheck-widget`,
                });
                insertedQuickCheck = true;
            }

            if (
                !insertedWordBank
                && wordBankTerms?.length > 0
                && WORD_BANK_SECTION_PATTERN.test(normalized)
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
    }, [filteredBlocks, parsed.quickCheckPairs, resolvedTopicTitle, wordBankTerms]);

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
    const objectiveExamRoute = buildTopicQuizRoute(examTopicId);
    const essayExamRoute = buildEssayQuizRoute(examTopicId);
    const timedExamRoute = buildTimedExamRoute(courseId);
    const timedExamAvailable = Number(topic?.questionCount || 0) > 0;
    const handleStartExam = useCallback(() => {
        navigate(timedExamRoute);
    }, [navigate, timedExamRoute]);
    const objectiveExamActionLabel = isTopicQuizRoute
        ? (topicProgress?.bestScore != null ? 'Retry quiz' : 'Start quiz')
        : (examTopicId ? 'Start quiz' : 'Quiz preparing');
    const essayExamActionLabel = isTopicQuizRoute
        ? 'Start essay'
        : (examTopicId ? 'Start essay' : 'Essay preparing');
    const practiceDescription = isTopicQuizRoute
        ? 'Choose the format that fits how you want to test this lesson.'
        : 'This topic is assessed in the course quiz for better question quality.';
    const postLessonPrompt = isTopicQuizRoute
        ? 'Pick the next practice format for this topic.'
        : 'This topic will be assessed in the course quiz.';

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
            const result = await reExplainTopicRequest(topicId, reExplainStyle);
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

    const courseHref = courseId ? `/dashboard/course/${courseId}` : '/dashboard';
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
        },
    ].filter(Boolean);

    // Mobile FAB only — Notes/Tutor live in MobileLessonActions; desktop uses header + rail.
    const studyToolSecondary = [
        {
            id: 'reexplain',
            icon: 'lightbulb',
            label: 'Re-explain differently',
            onClick: () => setReExplainOpen(true),
        },
        {
            id: 'source',
            icon: 'menu_book',
            label: 'View source passages',
            onClick: openSource,
        },
        {
            id: 'settings',
            icon: 'settings',
            label: 'Voice settings',
            onClick: () => setSettingsOpen(true),
        },
    ];

    // End-of-lesson practice: Quiz is secondary here because the sticky header owns the primary.
    const practicePrimary = [];

    const practiceSecondary = [
        examTopicId
            ? { id: 'p-start-quiz', icon: 'quiz', label: objectiveExamActionLabel, href: objectiveExamRoute }
            : { id: 'p-quiz-pending', icon: 'hourglass_top', label: 'Quiz preparing', disabled: true },
        examTopicId && { id: 'p-essay', icon: 'edit_note', label: essayExamActionLabel, href: essayExamRoute },
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
            ? { id: 'm-quiz', icon: 'quiz', label: 'Quiz', href: objectiveExamRoute, primary: true }
            : { id: 'm-quiz', icon: 'hourglass_top', label: 'Quiz', disabled: true },
        { id: 'm-tutor', icon: 'smart_toy', label: 'Tutor', onClick: openChat },
        { id: 'm-notes', icon: 'edit_note', label: 'Notes', onClick: openNotes },
        topicProgress?.completedAt
            ? { id: 'm-settings', icon: 'settings', label: 'Voice', onClick: () => setSettingsOpen(true) }
            : {
                id: 'm-done',
                icon: 'check_circle',
                label: 'Done',
                onClick: () => upsertProgress({ topicId, completedAt: Date.now(), lastStudiedAt: Date.now() }).catch(() => {}),
            },
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
        mainRef,
        mobileActionItems,
        normalizedContent,
        notesAppendText,
        notesOpen,
        objectiveExamRoute,
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
        showTopicIllustration,
        showScrollTop,
        sourceOpen,
        sourcePassages,
        speechText,
        stopVoice,
        studyMode,
        studyToolActions,
        studyToolSecondary,
        timedExamAvailable,
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
