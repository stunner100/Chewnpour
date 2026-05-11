import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const quickCheckOptions = [
    { id: 'A', text: 'Amygdala', correct: false },
    { id: 'B', text: 'Hippocampus', correct: true },
    { id: 'C', text: 'Cerebellum', correct: false },
];

const LessonMemoryNeuralBasis = () => {
    const [selectedAnswer, setSelectedAnswer] = useState('B');
    const [showExplanation, setShowExplanation] = useState(false);

    return (
        <div className="flex-1 flex flex-col lg:flex-row relative pb-20 md:pb-0 pt-16">
            {/* Lesson Canvas */}
            <article className="flex-1 max-w-[800px] mx-auto w-full px-space-4 md:px-space-10 py-space-8 lg:py-space-12">
                {/* Breadcrumb & Meta */}
                <div className="mb-space-6 flex flex-col gap-2">
                    <nav className="flex items-center gap-2 text-text-muted font-body-sm text-body-sm">
                        <Link to="/dashboard/lessons" className="hover:text-primary transition-colors">Psychology 101</Link>
                        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                        <Link to="/dashboard/lessons" className="hover:text-primary transition-colors">Unit 3: Cognition</Link>
                        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                        <span className="text-text-primary font-medium">Memory</span>
                    </nav>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface border border-border-default font-label-xs text-label-xs text-text-secondary">
                            <span className="material-symbols-outlined text-[14px]">source</span>
                            Source: Psychology 101 Lecture Slides
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-success-soft text-success font-label-xs text-label-xs">
                            <span className="material-symbols-outlined text-[14px]">check_circle</span>
                            Mastered
                        </span>
                    </div>
                </div>

                {/* Title */}
                <h1 className="font-display-lg text-display-lg text-text-primary mb-space-8">The Neural Basis of Memory</h1>

                {/* Topic Summary Box */}
                <section className="mb-space-10 bg-surface rounded-xl p-space-6 shadow-sm border border-border-subtle">
                    <h2 className="font-headline-sm text-headline-sm text-primary mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">lightbulb</span>
                        Topic Summary
                    </h2>
                    <p className="font-body-base text-body-base text-text-secondary leading-relaxed">
                        Memory is not stored in a single location in the brain. Instead, it is distributed across multiple neural networks. The formation, consolidation, and retrieval of memories involve complex interactions between various brain structures, most notably the hippocampus, amygdala, and the cerebral cortex. This lesson explores how these structures collaborate to create our personal histories and learned skills.
                    </p>
                </section>

                {/* Reading Content */}
                <div className="space-y-space-8">
                    <section>
                        <h3 className="font-headline-sm text-headline-sm text-text-primary mb-4">1. The Hippocampus and Explicit Memory</h3>
                        <p className="font-body-lg text-body-lg text-text-primary leading-[1.7]">
                            The hippocampus acts as a temporary transit point for explicit memories (facts and episodes) before they are sent to other brain regions for long-term storage. Damage to this area can result in <strong className="text-primary">anterograde amnesia</strong>, the inability to form new declarative memories, while older memories often remain intact.
                        </p>
                        {/* Definition Callout */}
                        <div className="my-space-6 bg-info-soft rounded-lg p-space-4 flex gap-space-4 border border-info-soft">
                            <div className="mt-1">
                                <span className="material-symbols-outlined text-info">menu_book</span>
                            </div>
                            <div>
                                <h4 className="font-label-md text-label-md text-info mb-1 uppercase tracking-wider">Definition</h4>
                                <p className="font-body-base text-body-base text-text-primary mb-0"><strong>Explicit Memory:</strong> Also known as declarative memory, involves conscious recollection of factual information, previous experiences, and concepts.</p>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h3 className="font-headline-sm text-headline-sm text-text-primary mb-4">2. The Amygdala and Emotional Memory</h3>
                        <p className="font-body-lg text-body-lg text-text-primary leading-[1.7]">
                            The amygdala, located near the hippocampus, is responsible for attaching emotional significance to memories. Highly emotional events, such as a severe accident or a joyous celebration, trigger the release of stress hormones that signal the amygdala to initiate a memory trace in the frontal lobes and basal ganglia.
                        </p>
                        {/* Important Callout */}
                        <div className="my-space-6 bg-primary-soft rounded-lg p-space-4 flex gap-space-4 border border-warning-soft">
                            <div className="mt-1">
                                <span className="material-symbols-outlined text-warning">warning</span>
                            </div>
                            <div>
                                <h4 className="font-label-md text-label-md text-warning mb-1 uppercase tracking-wider">Exam Tip</h4>
                                <p className="font-body-base text-body-base text-text-primary mb-0">Be prepared to differentiate between the roles of the hippocampus (fact/event consolidation) and the amygdala (emotional tagging). A classic question often asks which structure is responsible for the intense recall of a frightening event.</p>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h3 className="font-headline-sm text-headline-sm text-text-primary mb-4">3. Memory Consolidation</h3>
                        <p className="font-body-lg text-body-lg text-text-primary leading-[1.7]">
                            Consolidation is the process by which a temporary, labile memory is transformed into a more stable, long-lasting form. This process involves structural changes at the synaptic level, often referred to as Long-Term Potentiation (LTP). Sleep plays a crucial role in memory consolidation, as the brain replays recent experiences and strengthens the associated neural connections.
                        </p>
                    </section>
                </div>

                {/* Divider */}
                <hr className="my-space-10 border-t border-border-default" />

                {/* Quick Check Section */}
                <section className="mb-space-12">
                    <h2 className="font-headline-sm text-headline-sm text-text-primary mb-space-6 flex items-center gap-2">
                        <span className="material-symbols-outlined text-text-muted">task_alt</span>
                        Quick Check
                    </h2>
                    <div className="bg-surface rounded-xl p-space-6 shadow-sm border border-border-subtle">
                        <p className="font-body-lg text-body-lg text-text-primary mb-4">Which brain structure is primarily responsible for forming new explicit memories?</p>
                        <div className="space-y-3">
                            {quickCheckOptions.map((option) => {
                                const isSelected = selectedAnswer === option.id;
                                const isCorrect = option.correct;
                                return (
                                    <label
                                        key={option.id}
                                        onClick={() => {
                                            setSelectedAnswer(option.id);
                                            setShowExplanation(true);
                                        }}
                                        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                                            isSelected && isCorrect
                                                ? 'border-success bg-success-soft'
                                                : isSelected && !isCorrect
                                                ? 'border-error bg-error-soft'
                                                : 'border-border-default hover:bg-surface-soft'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="q1"
                                            className="text-primary focus:ring-primary h-4 w-4 border-outline"
                                            checked={isSelected}
                                            onChange={() => {}}
                                        />
                                        <span className={`font-body-base text-body-base ${isSelected && isCorrect ? 'text-text-primary font-medium' : isSelected && !isCorrect ? 'text-text-primary' : 'text-text-secondary'}`}>
                                            {option.id}) {option.text}
                                        </span>
                                        {isSelected && isCorrect && (
                                            <span className="material-symbols-outlined text-success ml-auto">check_circle</span>
                                        )}
                                    </label>
                                );
                            })}
                        </div>
                        {showExplanation && selectedAnswer === 'B' && (
                            <div className="mt-4 p-4 bg-success-soft rounded-lg text-success font-body-sm text-body-sm">
                                Correct! The hippocampus is essential for consolidating short-term declarative memories into long-term storage.
                            </div>
                        )}
                    </div>
                </section>

                <div className="flex justify-between items-center pt-space-6 pb-space-12">
                    <button className="px-4 py-2 rounded-lg border border-border-default bg-surface hover:bg-surface-soft text-text-secondary font-label-md text-label-md transition-colors flex items-center gap-2">
                        <span className="material-symbols-outlined">arrow_back</span>
                        Previous Lesson
                    </button>
                    <button className="px-6 py-2 rounded-lg bg-primary hover:bg-primary-hover text-on-primary font-label-md text-label-md transition-colors shadow-sm flex items-center gap-2">
                        Next Lesson
                        <span className="material-symbols-outlined">arrow_forward</span>
                    </button>
                </div>
            </article>

            {/* Contextual AI Tutor Panel (Right Side) */}
            <aside className="hidden lg:flex w-[320px] border-l border-border-subtle bg-surface-soft flex-col h-[calc(100vh-64px)] sticky top-16">
                <div className="p-space-4 border-b border-border-default bg-surface flex items-center gap-3 shadow-sm">
                    <div className="w-8 h-8 rounded-full bg-ai-soft flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined text-[20px]">smart_toy</span>
                    </div>
                    <div>
                        <h3 className="font-label-md text-label-md text-text-primary">Study Assistant</h3>
                        <p className="font-label-xs text-label-xs text-success flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
                            Online
                        </p>
                    </div>
                </div>
                <div className="flex-1 p-space-4 overflow-y-auto flex flex-col gap-space-4">
                    <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-ai-soft flex-shrink-0 flex items-center justify-center text-primary mt-1">
                            <span className="material-symbols-outlined text-[14px]">smart_toy</span>
                        </div>
                        <div className="bg-ai-subtle rounded-2xl rounded-tl-sm p-3 text-text-primary font-body-sm text-body-sm border border-border-subtle shadow-sm">
                            <p>Hi! I noticed you're reading about <strong>The Neural Basis of Memory</strong>.</p>
                            <p className="mt-2">Need help understanding the role of the Hippocampus, or would you like me to generate a quick analogy?</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 ml-9">
                        <button className="px-3 py-1.5 rounded-full border border-border-default bg-surface hover:bg-primary-soft hover:border-primary-fixed-dim text-text-secondary hover:text-primary transition-colors font-label-xs text-label-xs text-left">
                            Explain the Hippocampus like I'm 5
                        </button>
                        <button className="px-3 py-1.5 rounded-full border border-border-default bg-surface hover:bg-primary-soft hover:border-primary-fixed-dim text-text-secondary hover:text-primary transition-colors font-label-xs text-label-xs text-left">
                            What's the difference vs Amygdala?
                        </button>
                    </div>
                </div>
                <div className="p-space-4 bg-surface border-t border-border-default">
                    <div className="relative flex items-center bg-surface-muted rounded-xl p-1 border border-border-subtle focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
                        <input className="flex-1 bg-transparent border-none text-body-sm font-body-sm text-text-primary placeholder:text-text-muted focus:ring-0 py-2 px-3" placeholder="Ask a question..." type="text" />
                        <button className="p-2 text-primary hover:bg-primary-soft rounded-lg transition-colors flex items-center justify-center">
                            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Mobile AI FAB */}
            <button className="lg:hidden fixed bottom-20 right-4 w-12 h-12 bg-primary text-on-primary rounded-full shadow-lg flex items-center justify-center hover:bg-primary-hover transition-colors z-50">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
            </button>
        </div>
    );
};

export default LessonMemoryNeuralBasis;
