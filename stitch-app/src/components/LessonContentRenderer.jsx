import React, { memo } from 'react';
import InteractiveQuickCheck from './InteractiveQuickCheck';
import InteractiveWordBank from './InteractiveWordBank';

const HEADER_SIZES = {
    1: "text-3xl md:text-4xl font-extrabold text-neutral-900 dark:text-white mt-10 md:mt-12 mb-5 md:mb-6 tracking-tight flex items-center gap-3",
    2: "text-xl md:text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-8 md:mt-10 mb-3 md:mb-4 tracking-tight flex items-center gap-2",
    3: "text-lg md:text-xl font-bold text-neutral-800 dark:text-neutral-200 mt-6 md:mt-8 mb-2 md:mb-3 flex items-center gap-2"
};

const ALERT_STYLES = {
    tip: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100 icon-lightbulb",
    note: "bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800 text-blue-900 dark:text-blue-100 icon-info",
    warning: "bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800 text-amber-900 dark:text-amber-100 icon-warning",
    important: "bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800 text-rose-900 dark:text-rose-100 icon-priority_high",
    "key takeaway": "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800 text-indigo-900 dark:text-indigo-100 icon-star"
};

const getHeaderIcon = (text) => {
    const lowText = text.toLowerCase();
    if (lowText.includes('intro')) return 'auto_stories';
    if (lowText.includes('practice') || lowText.includes('exercise')) return 'exercise';
    if (lowText.includes('summary') || lowText.includes('conclusion')) return 'task_alt';
    if (lowText.includes('block') || lowText.includes('concept')) return 'category';
    return null;
};

/**
 * Parse inline markdown into styled React elements.
 * Handles: **bold**, *italic*, `code`, and [link](url).
 */
const parseInlineFormatting = (text, cleanInline) => {
    if (!text) return '';
    const TOKEN_RE = /(\*\*[^*]+?\*\*|\*[^*\n]+?\*|`[^`\n]+?`|\[[^\]]+?\]\([^)]+?\))/g;
    const parts = text.split(TOKEN_RE);
    return parts.map((part, i) => {
        if (!part) return null;
        if (part.startsWith('**') && part.endsWith('**')) {
            return (
                <strong key={i} className="font-semibold text-neutral-900 dark:text-white">
                    {cleanInline(part.slice(2, -2))}
                </strong>
            );
        }
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
            return (
                <em key={i} className="italic text-neutral-700 dark:text-neutral-300">
                    {cleanInline(part.slice(1, -1))}
                </em>
            );
        }
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
            return (
                <code key={i} className="px-1.5 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-[0.9em] font-mono text-neutral-800 dark:text-neutral-200 border border-neutral-200/60 dark:border-neutral-700/60">
                    {part.slice(1, -1)}
                </code>
            );
        }
        const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (linkMatch) {
            return (
                <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 decoration-primary/30 hover:decoration-primary/70 transition-colors">
                    {cleanInline(linkMatch[1])}
                </a>
            );
        }
        return cleanInline(part);
    });
};

/**
 * Memoized lesson content block renderer.
 * Receives only the parsed blocks, animation flag, and cleanInline function.
 * Isolated from parent state changes (sidebar, notes, chat, voice, scroll).
 */
const TUTOR_PROMPTS = [
    { icon: 'lightbulb', label: 'Explain simply', prompt: 'Explain this section in simpler terms:' },
    { icon: 'add_circle', label: 'Give an example', prompt: 'Give me another example for this section:' },
    { icon: 'quiz', label: 'Test me', prompt: 'Ask me a quick question about this section:' },
    { icon: 'compare_arrows', label: 'Compare', prompt: 'Compare this concept with a related one from this section:' },
];

const LessonContentRenderer = memo(function LessonContentRenderer({
    blocks,
    shouldAnimateBlocks,
    cleanInline,
    onViewSource,
    onAskTutor,
    quickCheckPairs,
    wordBankTerms,
    topicId,
    starredTerms,
    onTermsStarred,
}) {
    const bold = (text) => parseInlineFormatting(text, cleanInline);

    return (
        <div className="prose prose-base md:prose-lg prose-neutral dark:prose-invert max-w-none text-neutral-700 dark:text-neutral-300 leading-relaxed [text-wrap:pretty]">
            {blocks.map((block, index) => {
                if (block.type === 'spacer') {
                    return <div key={block.key} className="h-2 md:h-3"></div>;
                }

                const animationClass = shouldAnimateBlocks ? "animate-fade-in fill-mode-forwards opacity-0" : "";
                const animationStyle = shouldAnimateBlocks ? { animationDelay: `${Math.min(index, 24) * 60}ms` } : undefined;

                if (block.type === 'header') {
                    const icon = getHeaderIcon(block.text);
                    const showTutorPrompts = onAskTutor && block.level === 2;
                    return (
                        <React.Fragment key={block.key}>
                            <div
                                id={block.id}
                                className={`${HEADER_SIZES[block.level] || HEADER_SIZES[3]} scroll-mt-20 md:scroll-mt-32 ${animationClass}`}
                                style={animationStyle}
                            >
                                {icon && <span className="material-symbols-outlined text-primary/70">{icon}</span>}
                                <span className="flex-1">{block.text}</span>
                                {onViewSource && (
                                    <button
                                        onClick={() => onViewSource(block.id)}
                                        className="ml-auto text-caption text-text-faint-light dark:text-text-faint-dark hover:text-primary flex items-center gap-1 opacity-0 group-hover:opacity-100 hover:opacity-100 focus:opacity-100 transition-opacity shrink-0"
                                        style={{ opacity: undefined }}
                                        title="View source"
                                    >
                                        <span className="material-symbols-outlined text-[14px]">link</span>
                                    </button>
                                )}
                            </div>
                            {showTutorPrompts && (
                                <div className={`flex items-center gap-1.5 flex-wrap mb-3 -mt-1 ${animationClass}`} style={animationStyle}>
                                    {TUTOR_PROMPTS.map((tp) => (
                                        <button
                                            key={tp.label}
                                            onClick={() => onAskTutor(`${tp.prompt} "${block.text}"`)}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-caption text-text-faint-light dark:text-text-faint-dark hover:text-primary hover:bg-primary/5 border border-transparent hover:border-primary/20 transition-all"
                                        >
                                            <span className="material-symbols-outlined text-[14px]">{tp.icon}</span>
                                            {tp.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </React.Fragment>
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
                            <div className="text-base md:text-lg text-neutral-800 dark:text-neutral-100 leading-relaxed">
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

                if (block.type === 'quickcheck_widget') {
                    return (
                        <InteractiveQuickCheck
                            key={block.key}
                            pairs={quickCheckPairs}
                            topicId={topicId}
                        />
                    );
                }

                if (block.type === 'wordbank_widget') {
                    return (
                        <InteractiveWordBank
                            key={block.key}
                            terms={wordBankTerms}
                            topicId={topicId}
                            starredTerms={starredTerms}
                            onTermsStarred={onTermsStarred}
                        />
                    );
                }

                if (block.type === 'numbered') {
                    return (
                        <div key={block.key} className={`flex items-start gap-4 ml-1 mb-3 md:mb-4 group ${animationClass}`} style={animationStyle}>
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">
                                {block.num}
                            </span>
                            <span className="text-[15px] md:text-base leading-7 text-neutral-700 dark:text-neutral-300">{bold(block.text)}</span>
                        </div>
                    );
                }

                // Hidden blocks (replaced by dedicated interactive components)
                if (block.type === 'quickcheck_hidden' || block.type === 'wordbank_hidden') {
                    return null;
                }

                // Analogy cards (compact, labeled)
                if (block.type === 'analogycard') {
                    return (
                        <div key={block.key} className={`my-3 p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200/60 dark:border-amber-700/30 flex gap-3 ${animationClass}`} style={animationStyle}>
                            <span className="material-symbols-outlined text-amber-500 dark:text-amber-400 text-[20px] shrink-0 mt-0.5">lightbulb</span>
                            <div>
                                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">{block.label}</span>
                                <p className="text-[15px] md:text-base text-neutral-700 dark:text-neutral-300 mt-1 leading-relaxed">{bold(block.text)}</p>
                            </div>
                        </div>
                    );
                }

                // Common Mistakes with labels
                if (block.type === 'mistake') {
                    const MISTAKE_BADGE = { 'Exam Trap': 'badge-danger', 'Common Confusion': 'badge-warning', 'Do Not Mix Up': 'badge-primary' };
                    return (
                        <div key={block.key} className={`flex items-start gap-3 ml-1 mb-4 group ${animationClass}`} style={animationStyle}>
                            <div className="mt-1.5 h-5 w-5 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-[14px] text-red-500">close</span>
                            </div>
                            <div className="flex-1">
                                {block.label && (
                                    <span className={`inline-block badge ${MISTAKE_BADGE[block.label] || 'badge'} mb-1.5 mr-2`}>{block.label}</span>
                                )}
                                <span className="text-[15px] md:text-base leading-7 text-neutral-700 dark:text-neutral-300">{bold(block.text)}</span>
                            </div>
                        </div>
                    );
                }

                if (block.type === 'quote') {
                    return (
                        <div key={block.key} className={`border-l-4 border-primary/30 bg-primary/5 pl-6 md:pl-8 py-5 md:py-6 pr-5 md:pr-6 rounded-r-3xl my-6 md:my-8 relative ${animationClass}`} style={animationStyle}>
                            <span className="absolute top-2 left-2 material-symbols-outlined text-primary/10 text-4xl">format_quote</span>
                            <div className="text-base md:text-lg text-neutral-600 dark:text-neutral-300 leading-relaxed relative z-10 italic">
                                {bold(block.text)}
                            </div>
                        </div>
                    );
                }

                return (
                    <p key={block.key} className={`my-3 md:my-4 text-base md:text-lg leading-[1.8] text-neutral-700 dark:text-neutral-300 ${animationClass}`} style={animationStyle}>
                        {bold(block.text)}
                    </p>
                );
            })}
        </div>
    );
});

export default LessonContentRenderer;
