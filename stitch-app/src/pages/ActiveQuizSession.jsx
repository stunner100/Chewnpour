import React, { useState } from 'react';

const quizData = {
    title: 'Neurobiology 101',
    module: 'Module 3 Review',
    difficulty: 'Medium',
    totalQuestions: 10,
    currentQuestion: 3,
    question: 'Which part of the brain is most associated with long-term memory formation?',
    options: [
        { id: 'A', text: 'The Amygdala', correct: false },
        { id: 'B', text: 'The Hippocampus', correct: true },
        { id: 'C', text: 'The Cerebellum', correct: false },
        { id: 'D', text: 'The Prefrontal Cortex', correct: false },
    ],
    explanation: 'The hippocampus, located in the inner region of the temporal lobe, plays a major role in learning and memory. It is specifically critical for the consolidation of information from short-term memory to long-term memory, as well as spatial memory that enables navigation.',
};

const ActiveQuizSession = () => {
    const [selectedOption, setSelectedOption] = useState('B');
    const [showExplanation, setShowExplanation] = useState(true);

    const progress = (quizData.currentQuestion / quizData.totalQuestions) * 100;

    return (
        <div className="flex-1 flex flex-col ml-0 h-[calc(100vh-64px)] overflow-hidden">
            <main className="flex-1 min-h-0 p-space-4 md:px-space-10 md:py-space-8 flex flex-col items-center justify-start overflow-y-auto">
                <div className="w-full max-w-[800px] flex flex-col gap-space-8">
                    {/* Progress & Meta Header */}
                    <div className="flex flex-col gap-space-4 w-full">
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="font-label-md text-label-md text-text-secondary uppercase tracking-wider mb-space-1">
                                    {quizData.title}
                                </p>
                                <h2 className="font-headline-sm text-headline-sm text-text-primary">{quizData.module}</h2>
                            </div>
                            <span className="px-space-3 py-space-1 bg-warning-soft text-warning rounded-full font-label-xs text-label-xs font-bold border border-warning/20">
                                {quizData.difficulty} Difficulty
                            </span>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full flex items-center gap-space-4">
                            <div className="flex-1 h-2 bg-surface-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary rounded-full transition-all duration-500"
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                            <span className="font-label-md text-label-md text-text-secondary whitespace-nowrap">
                                Question {quizData.currentQuestion} of {quizData.totalQuestions}
                            </span>
                        </div>
                    </div>

                    {/* Question */}
                    <div className="mt-space-4">
                        <h1 className="font-display-lg text-display-lg text-text-primary leading-tight">
                            {quizData.question}
                        </h1>
                    </div>

                    {/* Answer Options */}
                    <div className="flex flex-col gap-space-3 w-full mt-space-2">
                        {quizData.options.map((option) => {
                            const isSelected = selectedOption === option.id;
                            const isCorrect = option.correct;
                            const showResult = showExplanation && isSelected;

                            let optionClasses = 'group relative flex items-center p-space-4 bg-surface border border-border-default rounded-xl hover:shadow-md hover:border-border-strong cursor-pointer transition-all duration-200';
                            if (showResult && isCorrect) {
                                optionClasses = 'relative flex items-center p-space-4 bg-success-soft border-2 border-success rounded-xl shadow-sm z-10';
                            } else if (showResult && !isCorrect) {
                                optionClasses = 'relative flex items-center p-space-4 bg-error-soft border-2 border-error rounded-xl shadow-sm z-10';
                            }

                            return (
                                <div key={option.id}>
                                    <button
                                        onClick={() => {
                                            setSelectedOption(option.id);
                                            setShowExplanation(true);
                                        }}
                                        className={optionClasses}
                                    >
                                        {showResult && isCorrect ? (
                                            <div className="w-8 h-8 rounded-full bg-success text-on-primary flex items-center justify-center mr-space-4 shadow-sm">
                                                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'wght' 600" }}>check</span>
                                            </div>
                                        ) : showResult && !isCorrect ? (
                                            <div className="w-8 h-8 rounded-full bg-error text-on-primary flex items-center justify-center mr-space-4 shadow-sm">
                                                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'wght' 600" }}>close</span>
                                            </div>
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-surface-soft border border-border-subtle flex items-center justify-center mr-space-4 font-label-md text-text-secondary group-hover:bg-surface-muted transition-colors">
                                                {option.id}
                                            </div>
                                        )}
                                        <span className={`font-body-lg text-body-lg flex-1 ${showResult && isCorrect ? 'text-text-primary font-medium' : showResult && !isCorrect ? 'text-text-primary' : 'text-text-primary'}`}>
                                            {option.text}
                                        </span>
                                    </button>
                                    {showResult && isCorrect && (
                                        <div className="relative bg-surface border border-success/30 rounded-b-xl rounded-tr-xl p-space-6 shadow-sm -mt-space-4 pt-space-8 ml-space-6 z-0">
                                            <div className="flex items-start gap-space-3">
                                                <span className="material-symbols-outlined text-success mt-1" style={{ fontVariationSettings: "'FILL' 1" }}>lightbulb</span>
                                                <div>
                                                    <h3 className="font-headline-sm text-headline-sm text-success mb-space-2">Correct!</h3>
                                                    <p className="font-body-base text-body-base text-text-secondary leading-relaxed">
                                                        {quizData.explanation}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Action Footer */}
                    <div className="flex justify-between items-center w-full mt-space-8 pt-space-6 border-t border-border-subtle">
                        <button className="px-space-4 py-space-2 text-text-muted hover:text-text-primary font-label-md text-label-md transition-colors flex items-center gap-space-2 rounded-lg hover:bg-surface-soft">
                            <span className="material-symbols-outlined text-sm">flag</span>
                            Flag for review
                        </button>
                        <button className="bg-primary text-on-primary px-space-8 py-space-3 rounded-xl font-label-md text-label-md hover:bg-primary-hover hover:shadow-md transition-all flex items-center gap-space-2">
                            Next Question
                            <span className="material-symbols-outlined">arrow_forward</span>
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ActiveQuizSession;
