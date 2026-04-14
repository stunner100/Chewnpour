import React, { useMemo } from 'react';

const GENERIC_SECTION_PATTERNS = [
    /quick check/i,
    /summary/i,
    /word bank/i,
    /glossary/i,
    /common mistakes?/i,
    /self-check/i,
];

const isGenericSection = (value) =>
    GENERIC_SECTION_PATTERNS.some((pattern) => pattern.test(String(value || '')));

const buildGuidedSteps = (topicTitle, blocks) => {
    const headerBlocks = (Array.isArray(blocks) ? blocks : [])
        .filter((block) => block?.type === 'header' && block?.id && block?.text)
        .filter((block) => Number(block.level || 0) >= 2 && !isGenericSection(block.text))
        .slice(0, 4);

    if (headerBlocks.length > 0) {
        return headerBlocks.map((block, index) => ({
            key: `guided-${block.id}`,
            step: index + 1,
            title: block.text,
            description: index === 0
                ? `Start here to anchor the main idea of ${topicTitle || 'this lesson'}.`
                : index === headerBlocks.length - 1
                    ? 'Finish by checking how this section connects back to the overall lesson.'
                    : 'Use this section to deepen your understanding before moving on.',
            anchorId: block.id,
            askPrompt: `Teach me the section "${block.text}" step by step, then give me one quick check question.`,
        }));
    }

    const paragraphs = (Array.isArray(blocks) ? blocks : [])
        .filter((block) => block?.type === 'paragraph' && block?.text)
        .slice(0, 3);

    return paragraphs.map((block, index) => ({
        key: `guided-fallback-${index}`,
        step: index + 1,
        title: index === 0 ? 'Core idea' : index === 1 ? 'Important detail' : 'Check understanding',
        description: String(block.text || '').slice(0, 140),
        anchorId: null,
        askPrompt: `Help me understand this part of ${topicTitle || 'the lesson'}: "${block.text}"`,
    }));
};

const GuidedStudyPath = ({ topicTitle, blocks, onAskTutor }) => {
    const steps = useMemo(() => buildGuidedSteps(topicTitle, blocks), [topicTitle, blocks]);

    if (!steps.length) return null;

    return (
        <section className="card-base p-5 md:p-6">
            <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-primary text-[20px]">route</span>
                <div>
                    <h3 className="text-body-base font-semibold text-text-main-light dark:text-text-main-dark">
                        Guided Study Path
                    </h3>
                    <p className="text-caption text-text-faint-light dark:text-text-faint-dark">
                        Move through the lesson in a tighter order, then open the tutor on exactly the part you need.
                    </p>
                </div>
            </div>
            <div className="space-y-3">
                {steps.map((step) => (
                    <div
                        key={step.key}
                        className="rounded-2xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark p-4"
                    >
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-body-sm font-semibold">
                                {step.step}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">
                                    {step.title}
                                </h4>
                                <p className="mt-1 text-caption leading-relaxed text-text-sub-light dark:text-text-sub-dark">
                                    {step.description}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {step.anchorId && (
                                        <a
                                            href={`#${step.anchorId}`}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-light dark:border-border-dark text-caption text-text-sub-light dark:text-text-sub-dark hover:border-primary/20 hover:text-primary transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-[14px]">vertical_align_center</span>
                                            Jump to section
                                        </a>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => onAskTutor?.(step.askPrompt)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-caption hover:bg-primary/15 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[14px]">smart_toy</span>
                                        Ask tutor here
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default GuidedStudyPath;
