import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';

const TopicDetail = () => {
    const { topicId } = useParams();
    const generateQuestions = useAction(api.ai.generateQuestionsForTopic);
    const reExplainTopic = useAction(api.ai.reExplainTopic);
    const [startingExam, setStartingExam] = useState(false);
    const [startExamError, setStartExamError] = useState('');
    const [reExplainOpen, setReExplainOpen] = useState(false);
    const [reExplainStyle, setReExplainStyle] = useState('Simple summary');
    const [reExplainLoading, setReExplainLoading] = useState(false);
    const [reExplainError, setReExplainError] = useState('');
    const [overrideContent, setOverrideContent] = useState('');
    const [cachedContent, setCachedContent] = useState('');
    const [readingMode, setReadingMode] = useState(true);
    const [scrollProgress, setScrollProgress] = useState(0);
    const contentRef = useRef(null);
    const navigate = useNavigate();
    const topicData = useQuery(
        api.topics.getTopicWithQuestions,
        topicId ? { topicId } : 'skip'
    );
    const topic = topicData || null;
    const questions = topic?.questions || [];
    const courseId = topic?.courseId;
    const storageKey = topicId ? `topicOverride:${topicId}` : null;
    const contentCacheKey = topicId ? `topicContent:${topicId}` : null;

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
        const previous = document.documentElement.style.scrollBehavior;
        document.documentElement.style.scrollBehavior = 'smooth';
        return () => {
            document.documentElement.style.scrollBehavior = previous;
        };
    }, []);

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
        return content
            .replace(/\\n/g, '\n')
            .replace(/\r\n/g, '\n')
            .replace(/\\\s*(?=\n|$)/g, '')
            .replace(/"\s*>\s*"/g, '\n')
            .replace(/"\s*>\s*/g, '\n')
            .replace(/\s*>\s*"/g, '\n')
            .replace(/>\s*(?=[A-Za-z])/g, '\n> ')
            .replace(/\n>\s*/g, '\n> ')
            .replace(/([.?!])\s+([A-Z])/g, '$1\n\n$2') // Split sentences into paragraphs
            .replace(/\s+(- \*\*)/g, '\n\n$1') // Split before inline bold list items
            .replace(/\s+(\*\*[^*]+\*\* :)/g, '\n\n$1') // Split before bold titles followed by colons
            .replace(/([.?!])\s+(\*\*)/g, '$1\n\n$2') // Split after punctuation if bold follows
            .replace(/([a-z])\s+-\s+([A-Z])/g, '$1\n\n- $2') // Identify list items (requires spaces)
            .replace(/\s+-\s+([A-Z])/g, '\n\n- $1') // Identify list items (fallback)
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }, [content]);
    const contentLines = typeof normalizedContent === 'string'
        ? normalizedContent.split(/\\n|\n/).filter(Boolean)
        : null;

    useEffect(() => {
        const handleScroll = () => {
            if (!contentRef.current) return;
            const rect = contentRef.current.getBoundingClientRect();
            const scrollTop = window.scrollY || window.pageYOffset;
            const elementTop = scrollTop + rect.top;
            const elementHeight = contentRef.current.offsetHeight;
            const viewportHeight = window.innerHeight;

            if (elementHeight <= viewportHeight) {
                setScrollProgress(100);
                return;
            }

            const maxScroll = elementHeight - viewportHeight;
            const currentScroll = Math.min(Math.max(scrollTop - elementTop, 0), maxScroll);
            const progress = Math.round((currentScroll / maxScroll) * 100);
            setScrollProgress(progress);
        };

        const onScroll = () => requestAnimationFrame(handleScroll);
        handleScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        return () => {
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
        };
    }, [normalizedContent, readingMode]);

    const cleanInline = (text) => {
        if (!text) return '';
        return text
            .replace(/\\\\\[/g, '')
            .replace(/\\\\\]/g, '')
            .replace(/\\\\#/g, '')
            .replace(/\\\\/g, '')
            .replace(/\[/g, '')
            .replace(/\]/g, '')
            .replace(/#+/g, '')
            .trim();
    };

    const cleanLine = (text) => {
        return cleanInline(text)
            .replace(/\*/g, '')
            .replace(/^[-•]\s+/, '')
            .trim();
    };

    const slugify = (text, suffix = '') =>
        cleanLine(text)
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-+|-+$/g, '') + (suffix ? `-${suffix}` : '');

    const parsed = useMemo(() => {
        if (!normalizedContent || typeof normalizedContent !== 'string') {
            return { blocks: [], toc: [] };
        }

        const lines = normalizedContent.split(/\n/);
        const blocks = [];
        const toc = [];
        let headerCount = 0;

        for (let i = 0; i < lines.length; i += 1) {
            const raw = lines[i]?.trim?.() ?? '';
            if (!raw) {
                blocks.push({ type: 'spacer', key: `spacer-${i}` });
                continue;
            }

            // Headers
            const headerMatch = raw.match(/^(#{1,6})\s+(.+)$/);
            if (headerMatch) {
                const level = headerMatch[1].length;
                const text = cleanLine(headerMatch[2]);
                const id = slugify(text, headerCount);
                headerCount += 1;
                toc.push({ id, text, level });
                blocks.push({ type: 'header', level, text, id, key: `h-${i}` });
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

            const numMatch = raw.match(/^(\d+)\.\s+(.+)$/);
            if (numMatch) {
                blocks.push({ type: 'numbered', num: numMatch[1], text: numMatch[2], key: `n-${i}` });
                continue;
            }

            // Blockquotes
            if (raw.startsWith('> ')) {
                blocks.push({ type: 'quote', text: raw.slice(2), key: `q-${i}` });
                continue;
            }

            // Default Paragraph
            blocks.push({ type: 'paragraph', text: raw, key: `p-${i}` });
        }

        return { blocks, toc };
    }, [normalizedContent]);

    const handleStartExam = async () => {
        if (!topicId) {
            setStartExamError('Topic not found. Please return to the dashboard and try again.');
            return;
        }

        setStartExamError('');
        setStartingExam(true);

        try {
            if (questions.length === 0) {
                const result = await generateQuestions({ topicId });
                const generatedCount = result?.count ?? 0;
                if (!result?.success || generatedCount === 0) {
                    setStartExamError('Unable to generate questions yet. Please try again.');
                    return;
                }
            }

            navigate(`/dashboard/exam/${topicId}`);
        } catch (error) {
            setStartExamError('Failed to start the exam. Please try again.');
        } finally {
            setStartingExam(false);
        }
    };

    if (!topicId) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="text-center max-w-md px-6">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Topic not found</h2>
                    <p className="text-slate-500 font-medium mb-6">Please return to your dashboard and select a topic.</p>
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
                    <p className="text-slate-500 font-medium">Loading lesson...</p>
                </div>
            </div>
        );
    }

    if (topicData === null) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="text-center max-w-md px-6">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Topic not found</h2>
                    <p className="text-slate-500 font-medium mb-6">We couldn’t find this topic. Please return to your dashboard.</p>
                    <Link to="/dashboard" className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/20">
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-background-light dark:bg-background-dark font-display antialiased text-[#0d161c] dark:text-white min-h-screen flex flex-col overflow-x-hidden">
            <header className="fixed top-0 inset-x-0 z-40 flex items-center justify-between px-6 lg:px-10 py-4 bg-white/70 dark:bg-background-dark/70 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 shadow-glass">
                <div className="flex items-center gap-6">
                    <Link to={courseId ? `/dashboard/course/${courseId}` : "/dashboard"} className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-primary transition-all text-sm font-bold group">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                            <span className="material-symbols-outlined text-[18px] group-hover:-translate-x-0.5 transition-transform">arrow_back_ios_new</span>
                        </div>
                        <span className="hidden sm:inline">Back to Syllabus</span>
                    </Link>
                    <div className="hidden md:block w-px h-6 bg-slate-200 dark:bg-slate-700/50"></div>
                    <div className="hidden md:flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                        <span className="text-xs font-black tracking-widest uppercase text-slate-400 dark:text-slate-500">{cleanLine(topic?.title || 'Topic')}</span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setReadingMode((value) => !value)}
                        className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200/60 dark:border-slate-700/60 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all shadow-sm active:scale-95"
                    >
                        <span className="material-symbols-outlined text-[18px]">{readingMode ? 'splitscreen' : 'menu_book'}</span>
                        {readingMode ? 'Split View' : 'Focus Mode'}
                    </button>
                    <div className="hidden lg:flex items-center gap-3 bg-slate-100/50 dark:bg-slate-800/50 px-4 py-2 rounded-full border border-slate-200/50 dark:border-slate-700/50">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Progress</span>
                        <div className="w-24 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)] transition-[width] duration-200"
                                style={{ width: `${scrollProgress}%` }}
                            ></div>
                        </div>
                    </div>
                    <button className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100/50 dark:bg-slate-800/50 text-slate-500 hover:bg-primary hover:text-white transition-all transform hover:rotate-90">
                        <span className="material-symbols-outlined text-[22px]">settings</span>
                    </button>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-primary text-white flex items-center justify-center font-black text-sm shadow-lg shadow-primary/20 ring-2 ring-white dark:ring-slate-800">JS</div>
                </div>
            </header>
            <main className={`flex-1 w-full mx-auto px-6 lg:px-10 pt-24 pb-8 lg:pt-28 lg:pb-12 ${readingMode ? 'max-w-4xl' : 'max-w-[1440px]'}`}>
                <div className={`grid grid-cols-1 ${readingMode ? '' : 'lg:grid-cols-12'} gap-8 lg:gap-12`}>
                    <div ref={contentRef} className={`${readingMode ? '' : 'lg:col-span-9'} space-y-8`}>
                        <div className="bg-surface-light dark:bg-surface-dark rounded-3xl p-8 lg:p-10 shadow-card border border-slate-100 dark:border-slate-800 relative">
                            <div className="flex flex-col gap-4 max-w-none">
                                <span className="md:hidden inline-block w-fit px-3 py-1 text-[10px] font-extrabold tracking-widest uppercase text-primary bg-primary/10 rounded-full border border-primary/10 mb-2">{cleanLine(topic?.title || 'Topic')}</span>
                                <h1 className="text-3xl lg:text-5xl font-extrabold text-[#0d161c] dark:text-white tracking-tight leading-tight">
                                    {cleanLine(topic?.title || 'Topic Overview')}
                                </h1>
                                <p className="text-slate-500 dark:text-slate-400 text-base lg:text-lg font-medium">{cleanLine(topic?.description || "You're doing great, let's dive in!")}</p>
                                <div className="pt-2">
                                    <button
                                        onClick={() => setReExplainOpen(true)}
                                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-white rounded-full transition-all duration-200 shadow-soft-ui border border-slate-200/70 dark:border-slate-700/70 cursor-pointer hover:shadow-soft-ui-hover hover:border-primary/30 active:scale-95 active:shadow-inner group"
                                    >
                                        <span className="material-symbols-outlined text-[20px] text-primary group-hover:text-primary/80 transition-colors">lightbulb</span>
                                        <span className="text-xs font-bold tracking-tight">Re-explain differently</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className={`${readingMode ? '' : 'grid grid-cols-1 md:grid-cols-2'} gap-8`}>
                            <div className={`flex flex-col justify-center h-full ${readingMode ? '' : 'md:col-span-2'}`}>
                                <div className="bg-surface-light dark:bg-surface-dark rounded-3xl p-8 h-full border border-slate-100 dark:border-slate-800 shadow-card hover:shadow-lg transition-shadow duration-300">
                                    <div className="flex items-center gap-3 mb-6">
                                        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/10">
                                            Lesson Overview
                                        </span>
                                    </div>

                                    {normalizedContent ? (
                                        <div className="prose prose-lg prose-slate dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 leading-relaxed">
                                            {parsed.blocks.map((block, index) => {
                                                if (block.type === 'spacer') {
                                                    return <div key={block.key} className="h-4"></div>;
                                                }

                                                const parseBold = (text) => {
                                                    const parts = text.split(/(\*\*.*?\*\*)/);
                                                    return parts.map((part, i) => {
                                                        if (part.startsWith('**') && part.endsWith('**')) {
                                                            return <span key={i} className="font-bold text-slate-900 dark:text-white bg-yellow-100/50 dark:bg-yellow-900/30 px-1 rounded">{cleanInline(part.slice(2, -2))}</span>;
                                                        }
                                                        return cleanLine(part);
                                                    });
                                                };

                                                const animationClass = "animate-fade-in fill-mode-forwards opacity-0";
                                                const animationStyle = { animationDelay: `${index * 100}ms` };

                                                if (block.type === 'header') {
                                                    const sizes = {
                                                        1: "text-4xl font-extrabold text-[#0d161c] dark:text-white mt-12 mb-6 tracking-tight flex items-center gap-3",
                                                        2: "text-2xl font-bold text-slate-900 dark:text-slate-100 mt-10 mb-4 tracking-tight flex items-center gap-2",
                                                        3: "text-xl font-bold text-slate-800 dark:text-slate-200 mt-8 mb-3 flex items-center gap-2"
                                                    };

                                                    const getHeaderIcon = (text) => {
                                                        const lowText = text.toLowerCase();
                                                        if (lowText.includes('intro')) return 'auto_stories';
                                                        if (lowText.includes('practice') || lowText.includes('exercise')) return 'exercise';
                                                        if (lowText.includes('summary') || lowText.includes('conclusion')) return 'task_alt';
                                                        if (lowText.includes('block') || lowText.includes('concept')) return 'category';
                                                        return null;
                                                    };

                                                    const icon = getHeaderIcon(block.text);

                                                    return (
                                                        <div
                                                            key={block.key}
                                                            id={block.id}
                                                            className={`${sizes[block.level] || sizes[3]} scroll-mt-32 ${animationClass}`}
                                                            style={animationStyle}
                                                        >
                                                            {icon && <span className="material-symbols-outlined text-primary/70">{icon}</span>}
                                                            {block.text}
                                                        </div>
                                                    );
                                                }

                                                if (block.type === 'alert') {
                                                    const styles = {
                                                        tip: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 icon-lightbulb",
                                                        note: "bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800 text-blue-900 dark:text-blue-100 icon-info",
                                                        warning: "bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800 text-amber-900 dark:text-amber-100 icon-warning",
                                                        important: "bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800 text-rose-900 dark:text-rose-100 icon-priority_high",
                                                        "key takeaway": "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800 text-indigo-900 dark:text-indigo-100 icon-star"
                                                    };

                                                    const currentStyle = styles[block.alertType] || styles.note;
                                                    const iconName = currentStyle.split('icon-')[1];

                                                    return (
                                                        <div key={block.key} className={`my-6 p-5 rounded-2xl border flex gap-4 ${currentStyle.split('icon-')[0]} ${animationClass}`} style={animationStyle}>
                                                            <span className="material-symbols-outlined shrink-0 text-current opacity-70">{iconName}</span>
                                                            <div className="flex flex-col gap-1">
                                                                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{block.alertType}</span>
                                                                <div className="text-base font-medium leading-relaxed">{parseBold(block.text)}</div>
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                if (block.type === 'definition') {
                                                    return (
                                                        <div key={block.key} className={`my-6 p-6 rounded-[2rem] bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300 ${animationClass}`} style={animationStyle}>
                                                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                                                <span className="material-symbols-outlined text-6xl">menu_book</span>
                                                            </div>
                                                            <h4 className="text-sm font-bold text-primary uppercase tracking-wider mb-2 flex items-center gap-2">
                                                                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                                                                {block.term}
                                                            </h4>
                                                            <div className="text-lg font-semibold text-slate-800 dark:text-slate-100 leading-relaxed italic">
                                                                {parseBold(block.text)}
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                if (block.type === 'example') {
                                                    return (
                                                        <div key={block.key} className={`my-6 pl-6 pr-6 py-5 border-l-4 border-indigo-400 dark:border-indigo-600 bg-indigo-50/30 dark:bg-indigo-950/20 rounded-r-2xl ${animationClass}`} style={animationStyle}>
                                                            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-2">
                                                                <span className="material-symbols-outlined text-[20px]">lightbulb_circle</span>
                                                                <span className="text-xs font-black uppercase tracking-widest">Example</span>
                                                            </div>
                                                            <div className="text-slate-700 dark:text-slate-300 text-base leading-relaxed">
                                                                {parseBold(block.text)}
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                if (block.type === 'bullet') {
                                                    return (
                                                        <div key={block.key} className={`flex items-start gap-3 ml-1 mb-4 group ${animationClass}`} style={animationStyle}>
                                                            <div className="mt-1.5 h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                                                                <span className="material-symbols-outlined text-[14px] text-primary">arrow_forward</span>
                                                            </div>
                                                            <span className="text-base leading-7 text-slate-700 dark:text-slate-300">{parseBold(block.text)}</span>
                                                        </div>
                                                    );
                                                }

                                                if (block.type === 'numbered') {
                                                    return (
                                                        <div key={block.key} className={`flex items-start gap-4 ml-1 mb-4 group ${animationClass}`} style={animationStyle}>
                                                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-[10px] font-black shrink-0 mt-0.5 shadow-sm shadow-primary/30">
                                                                {block.num}
                                                            </span>
                                                            <span className="text-base leading-7 text-slate-700 dark:text-slate-300">{parseBold(block.text)}</span>
                                                        </div>
                                                    );
                                                }

                                                if (block.type === 'quote') {
                                                    return (
                                                        <div key={block.key} className={`border-l-4 border-primary/30 bg-primary/5 pl-8 py-6 pr-6 rounded-r-3xl my-8 relative ${animationClass}`} style={animationStyle}>
                                                            <span className="absolute top-2 left-2 material-symbols-outlined text-primary/10 text-4xl">format_quote</span>
                                                            <div className="italic text-xl text-slate-600 dark:text-slate-300 font-medium leading-relaxed relative z-10">
                                                                {parseBold(block.text)}
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <p key={block.key} className={`my-6 text-lg leading-relaxed text-slate-700 dark:text-slate-300 font-medium ${animationClass}`} style={animationStyle}>
                                                        {parseBold(block.text)}
                                                    </p>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-16 text-center opacity-60">
                                            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 animate-pulse">
                                                <span className="material-symbols-outlined text-slate-400 text-[32px]">auto_stories</span>
                                            </div>
                                            <p className="text-slate-500 font-medium text-lg">Preparing your lesson content...</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="bg-indigo-50/50 dark:bg-slate-800/30 rounded-3xl p-8 border border-indigo-100 dark:border-slate-700 flex flex-col md:flex-row gap-6 items-start">
                            <div className="flex-shrink-0 p-3 bg-white dark:bg-slate-700 rounded-2xl shadow-sm">
                                <span className="material-symbols-outlined text-indigo-500 text-[28px]">swap_horiz</span>
                            </div>
                            <div>
                                <h2 className="text-sm font-bold text-indigo-500 uppercase tracking-wider mb-2">Alternative View</h2>
                                <p className="font-rounded text-lg italic leading-relaxed text-slate-700 dark:text-slate-300">
                                    {cleanLine(topic?.description || 'Explore the topic from a different angle to deepen understanding.')}
                                </p>
                            </div>
                        </div>
                    </div>

                    {!readingMode && (
                        <div className="lg:col-span-3 space-y-6">
                            <div className="sticky top-28 space-y-6">
                                <div className="glass-card rounded-[2.5rem] p-8 border border-slate-200/50 dark:border-slate-700/50 overflow-hidden relative group">
                                    <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors"></div>
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-500 shadow-sm border border-indigo-500/10">
                                            <span className="material-symbols-outlined text-[20px]">analytics</span>
                                        </div>
                                        <h3 className="font-black text-xs uppercase tracking-[0.2em] text-slate-400">Lesson Stats</h3>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-50/50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                                            <div className="text-2xl font-black text-slate-800 dark:text-white mb-1">
                                                {normalizedContent ? Math.ceil(normalizedContent.split(/\s+/).length / 200) : 1}
                                            </div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Minutes</div>
                                        </div>
                                        <div className="bg-slate-50/50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                                            <div className="text-2xl font-black text-slate-800 dark:text-white mb-1">
                                                {normalizedContent ? normalizedContent.split(/\s+/).length : 0}
                                            </div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Words</div>
                                        </div>
                                    </div>
                                </div>

                                {normalizedContent && parsed.toc.length > 0 && (
                                    <div className="glass-card rounded-[2.5rem] p-8 border border-slate-200/50 dark:border-slate-700/50 hidden lg:block relative overflow-hidden group">
                                        <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-primary/5 rounded-full blur-xl group-hover:bg-primary/10 transition-colors"></div>
                                        <h3 className="font-black text-xs uppercase tracking-[0.2em] text-slate-400 mb-6 flex items-center gap-3">
                                            <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center">
                                                <span className="material-symbols-outlined text-[18px]">format_list_bulleted</span>
                                            </div>
                                            Table of Contents
                                        </h3>
                                        <nav className="space-y-3 relative z-10">
                                            {parsed.toc.map((item) => {
                                                return (
                                                    <a
                                                        key={item.id}
                                                        href={`#${item.id}`}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            const el = document.getElementById(item.id);
                                                            if (!el) return;
                                                            const offset = 120;
                                                            const top = el.getBoundingClientRect().top + window.scrollY - offset;
                                                            window.scrollTo({ top, behavior: 'smooth' });
                                                        }}
                                                        className={`group/item flex items-center gap-3 py-1 text-sm transition-all hover:translate-x-1 ${item.level === 1 ? 'font-black text-slate-800 dark:text-slate-200' :
                                                            item.level === 2 ? 'pl-4 font-bold text-slate-500 dark:text-slate-400' :
                                                                'pl-8 text-slate-400 dark:text-slate-500'
                                                            }`}
                                                    >
                                                        <span className={`w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700 group-hover/item:bg-primary transition-colors ${item.level === 1 ? 'w-2 h-2' : ''}`}></span>
                                                        {item.text}
                                                    </a>
                                                );
                                            })}
                                        </nav>
                                    </div>
                                )}

                                <div className="bg-gradient-to-br from-indigo-500 to-primary rounded-[2.5rem] p-8 text-white shadow-xl shadow-primary/20 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-8 opacity-10 transform scale-150 rotate-12 group-hover:rotate-45 transition-transform duration-700">
                                        <span className="material-symbols-outlined text-8xl">bolt</span>
                                    </div>
                                    <h3 className="font-black text-[10px] uppercase tracking-[0.3em] opacity-70 mb-4 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                                        Lesson Snapshot
                                    </h3>
                                    <ul className="space-y-4 relative z-10">
                                        {(contentLines && contentLines.length > 0 ? contentLines : [
                                            cleanLine(topic?.description || 'Lesson summary loading...')
                                        ]).slice(0, 3).map((line, idx) => {
                                            if (!line || typeof line !== 'string') return null;

                                            const summaryLine = cleanLine(line);
                                            if (!summaryLine) return null;

                                            return (
                                                <li key={idx} className="flex items-start gap-4">
                                                    <div className="mt-1.5 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0 border border-white/10 group-hover:bg-white/30 transition-colors">
                                                        <span className="material-symbols-outlined text-[12px]">done_all</span>
                                                    </div>
                                                    <span className="text-xs font-bold text-white/90 leading-relaxed line-clamp-2 uppercase tracking-wide">{summaryLine}</span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-12 w-full">
                    <div className="relative rounded-[2.5rem] bg-gradient-to-br from-slate-50 to-white dark:from-surface-dark dark:to-background-dark p-8 lg:p-14 text-center border border-slate-200 dark:border-slate-800 shadow-lg group/card">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-400 via-primary to-indigo-500 opacity-80"></div>
                        <div className="relative z-10 flex flex-col lg:flex-row items-center lg:items-center justify-between gap-8 max-w-5xl mx-auto">
                            <div className="text-center lg:text-left max-w-xl">
                                <h3 className="text-2xl lg:text-3xl font-extrabold text-[#0d161c] dark:text-white mb-2">Ready to test yourself?</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm lg:text-base font-medium">Generate questions first, then take the exam when you're ready.</p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto items-center justify-center">
                                <Link to={topicId ? `/dashboard/concept-intro/${topicId}` : "/dashboard/concept-intro"} className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-slate-800 text-[#0d161c] dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 hover:-translate-y-1 transition-all duration-300 rounded-2xl text-sm font-bold shadow-soft flex items-center justify-center gap-2 group border border-slate-200 dark:border-slate-700">
                                    <span>Practice Concepts</span>
                                    <span className="material-symbols-outlined text-[20px] group-hover:translate-x-1 transition-transform">lightbulb</span>
                                </Link>
                                <button
                                    onClick={handleStartExam}
                                    disabled={startingExam}
                                    className="w-full sm:w-auto px-8 py-4 bg-primary text-white hover:bg-primary/90 hover:-translate-y-1 transition-all duration-300 rounded-2xl text-sm font-bold shadow-xl shadow-primary/25 flex items-center justify-center gap-2 group disabled:opacity-60"
                                >
                                    <span>{startingExam ? 'Preparing Exam...' : 'Start Exam'}</span>
                                    <span className="material-symbols-outlined text-[20px] group-hover:translate-x-1 transition-transform">assignment_turned_in</span>
                                </button>
                            </div>
                        </div>
                        {startExamError && (
                            <div className="mt-6 max-w-5xl mx-auto rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                                {startExamError}
                            </div>
                        )}
                        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
                        <div className="absolute -top-24 -left-24 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
                    </div>
                </div>
            </main>

            {reExplainOpen && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
                    <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Re-explain this lesson</h3>
                            <button
                                onClick={() => setReExplainOpen(false)}
                                className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-primary flex items-center justify-center"
                            >
                                <span className="material-symbols-outlined text-[20px]">close</span>
                            </button>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Choose how you want this explanation to be rewritten.</p>
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            {[
                                'Simple summary',
                                'Step-by-step',
                                'Story/analogy',
                                'Bullet points',
                                'Short & direct',
                                'Teach me like I’m 12'
                            ].map((option) => (
                                <button
                                    key={option}
                                    onClick={() => setReExplainStyle(option)}
                                    className={`px-3 py-2 rounded-xl text-sm font-semibold border transition-colors ${reExplainStyle === option
                                        ? 'bg-primary text-white border-primary'
                                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                                        }`}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                        {reExplainError && (
                            <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800">
                                {reExplainError}
                            </div>
                        )}
                        <div className="flex items-center justify-end gap-3">
                            <button
                                onClick={() => setReExplainOpen(false)}
                                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:text-slate-900"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    if (!topicId) return;
                                    setReExplainError('');
                                    setReExplainLoading(true);
                                    try {
                                        const result = await reExplainTopic({ topicId, style: reExplainStyle });
                                        setOverrideContent(result?.content || '');
                                        setReExplainOpen(false);
                                    } catch (err) {
                                        setReExplainError('Failed to re-explain. Please try again.');
                                    } finally {
                                        setReExplainLoading(false);
                                    }
                                }}
                                disabled={reExplainLoading}
                                className="px-5 py-2 rounded-xl text-sm font-semibold bg-primary text-white shadow-sm shadow-primary/30 hover:shadow-primary/50 disabled:opacity-60"
                            >
                                {reExplainLoading ? 'Rewriting...' : 'Re-explain'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TopicDetail;
