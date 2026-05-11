import React, { useState } from 'react';

const suggestedPrompts = [
    { icon: 'lightbulb', text: 'Explain in simple terms' },
    { icon: 'psychology', text: 'Give me an example' },
    { icon: 'quiz', text: 'Quiz me on this' },
];

const messages = [
    {
        type: 'user',
        content: "I'm having trouble understanding the process of cellular respiration. Can you explain the main stages?",
    },
    {
        type: 'ai',
        content: "Cellular respiration is the process by which cells convert nutrients into usable energy (ATP). It primarily occurs in three main stages. Let's break them down:",
        sections: [
            {
                title: '1. Glycolysis',
                text: 'Occurs in the cytoplasm. A glucose molecule is broken down into two molecules of pyruvate, producing a small net gain of 2 ATP.',
            },
            {
                title: '2. Krebs Cycle (Citric Acid Cycle)',
                text: 'Occurs in the mitochondria. Pyruvate is further broken down, releasing carbon dioxide and generating electron carriers (NADH and FADH2) along with 2 more ATP.',
            },
            {
                title: '3. Electron Transport Chain',
                text: 'Occurs in the inner mitochondrial membrane. The electron carriers transfer electrons through a series of proteins, driving the production of roughly 32-34 ATP. Oxygen is the final electron acceptor, forming water.',
            },
        ],
        source: 'Chapter 9: Cellular Respiration and Fermentation',
    },
];

const AIStudyTutor = () => {
    const [inputValue, setInputValue] = useState('');
    const [selectedMaterial, setSelectedMaterial] = useState('Biology 101');

    const materials = ['Biology 101', 'World History', 'Introduction to Psychology', 'Calculus I'];

    return (
        <div className="flex-1 flex flex-col md:ml-0 min-h-screen pt-16">
            <main className="flex-1 flex flex-col p-space-4 md:p-space-8 max-w-container-max mx-auto w-full">
                {/* Context Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-space-8 gap-4">
                    <div>
                        <h2 className="font-display-lg text-display-lg text-text-primary">AI Tutor</h2>
                        <p className="font-body-base text-body-base text-text-secondary mt-2">
                            Your personal academic assistant, ready to help you understand complex topics.
                        </p>
                    </div>
                    <div className="relative">
                        <select
                            value={selectedMaterial}
                            onChange={(e) => setSelectedMaterial(e.target.value)}
                            className="appearance-none bg-surface border border-border-default rounded-lg pl-4 pr-10 py-2.5 font-label-md text-label-md text-text-primary focus:ring-2 focus:ring-primary-soft focus:border-primary shadow-sm cursor-pointer min-w-[200px]"
                        >
                            {materials.map((m) => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">expand_more</span>
                    </div>
                </div>

                {/* Chat Interface */}
                <div className="flex-1 bg-surface rounded-2xl border border-border-subtle shadow-sm flex flex-col overflow-hidden h-[calc(100vh-220px)] min-h-[500px]">
                    {/* Chat History */}
                    <div className="flex-1 overflow-y-auto p-space-6 flex flex-col gap-space-8">
                        {/* Timestamp */}
                        <div className="text-center">
                            <span className="font-label-xs text-label-xs text-text-muted bg-surface-soft px-3 py-1 rounded-full">Today, 10:42 AM</span>
                        </div>

                        {messages.map((msg, idx) => (
                            <React.Fragment key={idx}>
                                {msg.type === 'user' ? (
                                    <div className="flex justify-end">
                                        <div className="max-w-[80%] md:max-w-[70%] bg-surface-muted rounded-2xl rounded-tr-sm p-space-5 shadow-sm border border-border-subtle">
                                            <p className="font-body-base text-body-base text-text-primary">{msg.content}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex justify-start gap-4">
                                        <div className="w-10 h-10 rounded-full bg-primary-soft flex items-center justify-center flex-shrink-0 border border-primary-fixed-dim">
                                            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
                                        </div>
                                        <div className="max-w-[85%] md:max-w-[75%] bg-ai-subtle rounded-2xl rounded-tl-sm p-space-6 shadow-sm border border-outline-variant">
                                            <p className="font-body-base text-body-base text-text-primary mb-4">{msg.content}</p>
                                            {msg.sections && (
                                                <div className="space-y-4 mb-5">
                                                    {msg.sections.map((section, sidx) => (
                                                        <div key={sidx} className="pl-4 border-l-2 border-primary">
                                                            <h4 className="font-label-md text-label-md text-text-primary mb-1">{section.title}</h4>
                                                            <p className="font-body-sm text-body-sm text-text-secondary">{section.text}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {msg.source && (
                                                <div className="bg-surface p-3 rounded-lg border border-border-subtle inline-flex items-center gap-2 mt-2">
                                                    <span className="material-symbols-outlined text-info text-[18px]">menu_book</span>
                                                    <span className="font-label-xs text-label-xs text-text-secondary">Source: {msg.source}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </React.Fragment>
                        ))}

                        {/* AI Typing Indicator */}
                        <div className="flex justify-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-primary-soft flex items-center justify-center flex-shrink-0 border border-primary-fixed-dim">
                                <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
                            </div>
                            <div className="bg-ai-subtle rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm border border-outline-variant flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-primary/60 animate-pulse"></div>
                                <div className="w-2 h-2 rounded-full bg-primary/60 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                                <div className="w-2 h-2 rounded-full bg-primary/60 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                            </div>
                        </div>
                    </div>

                    {/* Input Area */}
                    <div className="p-space-5 bg-surface border-t border-border-subtle flex flex-col gap-space-4">
                        {/* Suggested Prompts */}
                        <div className="flex flex-wrap gap-2">
                            {suggestedPrompts.map((prompt, idx) => (
                                <button
                                    key={idx}
                                    className="px-4 py-2 bg-surface-soft border border-border-default rounded-full font-label-xs text-label-xs text-text-secondary hover:bg-surface-muted hover:text-text-primary transition-colors flex items-center gap-1.5"
                                >
                                    <span className="material-symbols-outlined text-[16px]">{prompt.icon}</span>
                                    {prompt.text}
                                </button>
                            ))}
                        </div>
                        {/* Input Field */}
                        <div className="relative flex items-end gap-2 bg-surface-soft rounded-xl border border-border-strong p-2 focus-within:ring-2 focus-within:ring-primary-soft focus-within:border-primary transition-all shadow-sm">
                            <button className="p-2 text-text-muted hover:text-primary transition-colors rounded-lg flex items-center justify-center self-end mb-1">
                                <span className="material-symbols-outlined">attach_file</span>
                            </button>
                            <textarea
                                className="flex-1 bg-transparent border-none focus:ring-0 resize-none py-3 px-2 font-body-base text-body-base text-text-primary placeholder:text-text-muted min-h-[48px] max-h-[120px]"
                                placeholder={`Ask a question about ${selectedMaterial}...`}
                                rows={1}
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                style={{ overflowY: 'hidden' }}
                            />
                            <button className="w-10 h-10 bg-primary text-on-primary rounded-lg flex items-center justify-center hover:bg-primary-hover transition-colors shadow-sm self-end mb-1 flex-shrink-0">
                                <span className="material-symbols-outlined">send</span>
                            </button>
                        </div>
                        <div className="text-center">
                            <p className="font-label-xs text-label-xs text-text-muted">AI Tutor can make mistakes. Verify important academic information.</p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AIStudyTutor;
