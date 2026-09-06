import React from 'react';
import AppIcon from '../AppIcon';

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/**
 * One quiz question with large answer-option cards. Presentational only:
 * the parent (TopicQuizPlayer) owns the selected index and change handler.
 * Uses native radio semantics (sr-only inputs) for keyboard accessibility.
 */
const QuizQuestion = ({ question, selectedIndex, onSelect }) => {
    const options = Array.isArray(question?.options) ? question.options : [];
    return (
        <fieldset className="border-0 p-0">
            <legend className="font-display text-display-md font-bold leading-snug tracking-[-0.02em] text-text-primary">
                {question?.prompt}
            </legend>
            <div className="mt-6 space-y-3">
                {options.map((option, optionIndex) => {
                    const selected = Number(selectedIndex) === optionIndex;
                    const letter = OPTION_LETTERS[optionIndex] || String(optionIndex + 1);
                    return (
                        <label
                            key={`${question.id}-${optionIndex}`}
                            className={`flex cursor-pointer items-start gap-3 rounded-[16px] border px-4 py-4 transition-colors ${
                                selected
                                    ? 'border-primary bg-primary-subtle'
                                    : 'border-border-default bg-surface hover:bg-surface-soft'
                            }`}
                        >
                            <input
                                type="radio"
                                name={`quiz-question-${question.id}`}
                                className="sr-only"
                                checked={selected}
                                onChange={() => onSelect(optionIndex)}
                            />
                            <span
                                className={`mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-body-sm font-bold transition-colors ${
                                    selected
                                        ? 'bg-cta text-cta-foreground'
                                        : 'bg-surface-soft text-text-secondary'
                                }`}
                            >
                                {letter}
                            </span>
                            <span className="text-body-md text-text-primary">{option}</span>
                            {selected && (
                                <AppIcon
                                    name="check_circle"
                                    className="ml-auto mt-0.5 shrink-0 text-[20px] text-primary"
                                />
                            )}
                        </label>
                    );
                })}
            </div>
        </fieldset>
    );
};

export default QuizQuestion;
