import React, { memo } from 'react';
import InteractiveQuickCheck from './InteractiveQuickCheck';
import InteractiveWordBank from './InteractiveWordBank';
import LessonDefinitionBlock from './LessonDefinitionBlock';
import AppIcon from './AppIcon';

const HEADER_SIZES = {
    1: "text-3xl md:text-4xl font-extrabold text-neutral-900 dark:text-white mt-10 md:mt-12 mb-5 md:mb-6 tracking-tight flex items-center gap-3",
    2: "text-xl md:text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-8 md:mt-10 mb-3 md:mb-4 tracking-tight flex items-center gap-2",
    3: "text-lg md:text-xl font-bold text-neutral-800 dark:text-neutral-200 mt-6 md:mt-8 mb-2 md:mb-3 flex items-center gap-2"
};

// Design tokens + dark mode; tip / warning / important stay visually distinct.
const ALERT_VARIANTS = {
    tip: {
        className:
            'bg-success-soft dark:bg-emerald-950/35 border-success/20 dark:border-emerald-700/45 text-success dark:text-emerald-300',
        icon: 'lightbulb',
    },
    note: {
        className:
            'bg-info-soft dark:bg-sky-950/40 border-info/20 dark:border-sky-700/45 text-info dark:text-sky-300',
        icon: 'info',
    },
    warning: {
        className:
            'bg-warning-soft dark:bg-amber-950/40 border-warning/30 dark:border-amber-700/50 text-warning dark:text-amber-200',
        icon: 'warning',
    },
    important: {
        className:
            'bg-error-soft dark:bg-red-950/35 border-error/25 dark:border-red-800/50 text-error dark:text-red-300',
        icon: 'priority_high',
    },
    'key takeaway': {
        className:
            'bg-mastery-soft dark:bg-violet-950/35 border-mastery/25 dark:border-violet-700/50 text-mastery dark:text-violet-300',
        icon: 'star',
    },
    definition: {
        className:
            'bg-info-soft dark:bg-sky-950/40 border-info/20 dark:border-sky-700/45 text-info dark:text-sky-300',
        icon: 'menu_book',
    },
    example: {
        className:
            'bg-surface-soft dark:bg-neutral-900/50 border-border-default dark:border-neutral-600 text-text-secondary dark:text-neutral-300',
        icon: 'code',
    },
    'exam tip': {
        className:
            'bg-mastery-soft dark:bg-violet-950/35 border-mastery/25 dark:border-violet-700/50 text-mastery dark:text-violet-300',
        icon: 'school',
    },
    'ai explanation': {
        className:
            'bg-ai-subtle dark:bg-orange-950/30 border-ai-soft dark:border-orange-900/40 text-on-secondary-container dark:text-orange-200',
        icon: 'psychology',
    },
};
const DEFAULT_ALERT_VARIANT = ALERT_VARIANTS.note;

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
    const partCounts = new Map();
    return parts.map((part) => {
        if (!part) return null;
        const seenCount = partCounts.get(part) || 0;
        partCounts.set(part, seenCount + 1);
        const key = `${part}-${seenCount}`;
        if (part.startsWith('**') && part.endsWith('**')) {
            return (
                <strong key={key} className="font-semibold text-neutral-900 dark:text-white">
                    {cleanInline(part.slice(2, -2))}
                </strong>
            );
        }
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
            return (
                <em key={key} className="italic text-neutral-700 dark:text-neutral-300">
                    {cleanInline(part.slice(1, -1))}
                </em>
            );
        }
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
            return (
                <code key={key} className="px-1.5 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-[0.9em] font-mono text-neutral-800 dark:text-neutral-200 border border-neutral-200/60 dark:border-neutral-700/60">
                    {part.slice(1, -1)}
                </code>
            );
        }
        const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (linkMatch) {
            return (
                <a key={key} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 decoration-primary/30 hover:decoration-primary/70 transition-colors">
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

const SectionAskMenu = ({ sectionTitle, onAskTutor }) => {
    const [open, setOpen] = React.useState(false);
    const menuRef = React.useRef(null);

    React.useEffect(() => {
        if (!open) return undefined;
        const handlePointer = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) setOpen(false);
        };
        const handleKey = (event) => {
            if (event.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', handlePointer);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handlePointer);
            document.removeEventListener('keydown', handleKey);
        };
    }, [open]);

    return (
        <div ref={menuRef} className="relative mb-3 -mt-1">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-caption font-medium text-text-muted transition-colors hover:bg-surface hover:text-primary"
                aria-expanded={open}
                aria-haspopup="menu"
            >
                <AppIcon name="smart_toy" className="text-[14px]" />
                Ask about this section
                <AppIcon name={open ? 'expand_less' : 'expand_more'} className="text-[14px]" />
            </button>
            {open ? (
                <div
                    role="menu"
                    className="absolute left-0 top-full z-20 mt-1 min-w-[12rem] rounded-xl border border-border-subtle bg-surface p-1 shadow-sm"
                >
                    {TUTOR_PROMPTS.map((tp) => (
                        <button
                            key={tp.label}
                            type="button"
                            role="menuitem"
                            onClick={() => {
                                onAskTutor(`${tp.prompt} "${sectionTitle}"`);
                                setOpen(false);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-caption text-text-secondary transition-colors hover:bg-surface-soft hover:text-primary"
                        >
                            <AppIcon name={tp.icon} className="text-[14px]" />
                            {tp.label}
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
};

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
                                className={`group ${HEADER_SIZES[block.level] || HEADER_SIZES[3]} scroll-mt-20 md:scroll-mt-32 ${animationClass}`}
                                style={animationStyle}
                            >
                                {icon && <AppIcon name={icon} className="text-primary/70" />}
                                <span className="flex-1">{block.text}</span>
                                {onViewSource && (
                                    <button
                                        type="button"
                                        onClick={() => onViewSource(block.id)}
                                        className="ml-auto text-caption text-text-faint-light dark:text-text-faint-dark hover:text-primary flex items-center gap-1 opacity-0 group-hover:opacity-100 hover:opacity-100 focus-visible:opacity-100 transition-opacity shrink-0"
                                        title="View source"
                                        aria-label="View source for this section"
                                    >
                                        <AppIcon name="link" className="text-[14px]" aria-hidden="true" />
                                    </button>
                                )}
                            </div>
                            {showTutorPrompts && (
                                <SectionAskMenu sectionTitle={block.text} onAskTutor={onAskTutor} />
                            )}
                        </React.Fragment>
                    );
                }

                if (block.type === 'alert') {
                    if (block.alertType === 'definition') {
                        return (
                            <LessonDefinitionBlock
                                blockKey={block.key}
                                term="Definition"
                                text={block.text}
                                bold={bold}
                                animationClass={animationClass}
                                animationStyle={animationStyle}
                                variant="alert"
                            />
                        );
                    }

                    const variant = ALERT_VARIANTS[block.alertType] || DEFAULT_ALERT_VARIANT;
                    return (
                        <div
                            key={block.key}
                            className={`my-4 md:my-6 p-4 md:p-5 rounded-2xl border flex gap-3 md:gap-4 ${variant.className} ${animationClass}`}
                            style={animationStyle}
                        >
                            <AppIcon name={variant.icon} className="shrink-0 text-current opacity-70" />
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{block.alertType}</span>
                                <div className="text-[15px] md:text-base font-medium leading-relaxed">{bold(block.text)}</div>
                            </div>
                        </div>
                    );
                }

                if (block.type === 'definition') {
                    return (
                        <LessonDefinitionBlock
                            blockKey={block.key}
                            term={block.term}
                            text={block.text}
                            bold={bold}
                            animationClass={animationClass}
                            animationStyle={animationStyle}
                        />
                    );
                }

                if (block.type === 'example') {
                    return (
                        <div key={block.key} className={`my-4 md:my-6 pl-5 pr-5 md:pl-6 md:pr-6 py-4 md:py-5 border-l-4 border-primary-400 dark:border-primary-600 bg-primary-50/30 dark:bg-primary-950/20 rounded-r-2xl ${animationClass}`} style={animationStyle}>
                            <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400 mb-2">
                                <AppIcon name="lightbulb_circle" className="text-[20px]" />
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
                        <div key={block.key} className={`mb-3 ml-1 flex items-start gap-3 group md:mb-4 ${animationClass}`} style={animationStyle}>
                            <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-text-muted/70" />
                            <span className="text-[15px] leading-7 text-neutral-700 dark:text-neutral-300 md:text-base">{bold(block.text)}</span>
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
                        <div key={block.key} id="topic-wordbank" style={{ scrollMarginTop: 108 }}>
                            <InteractiveWordBank
                                key={starredTerms ? `wb-${starredTerms.length}` : 'wb-0'}
                                terms={wordBankTerms}
                                topicId={topicId}
                                starredTerms={starredTerms}
                                onTermsStarred={onTermsStarred}
                            />
                        </div>
                    );
                }

                if (block.type === 'numbered') {
                    return (
                        <div key={block.key} className={`flex items-start gap-4 ml-1 mb-3 md:mb-4 group ${animationClass}`} style={animationStyle}>
                            <span className="flex items-center justify-center size-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">
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
                            <AppIcon name="lightbulb" className="text-amber-500 dark:text-amber-400 text-[20px] shrink-0 mt-0.5" />
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
                            <div className="mt-1.5 size-5 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center shrink-0">
                                <AppIcon name="close" className="text-[14px] text-red-500" />
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
                            <AppIcon name="format_quote" className="absolute top-2 left-2 text-primary/10 text-4xl" />
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
