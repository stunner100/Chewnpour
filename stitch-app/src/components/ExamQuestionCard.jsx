import React, { memo } from 'react';

const MIN_ESSAY_SUBMIT_CHAR_COUNT = 20;

/**
 * Memoized exam question card.
 * Isolated from timer ticks and other parent state changes.
 * Only re-renders when the current question or selected answer changes.
 */
const ExamQuestionCard = memo(function ExamQuestionCard({
    question,
    questionIndex,
    totalQuestions,
    examFormat,
    selectedAnswer,
    finalOptions,
    onAnswerSelect,
    onPrevious,
    onNext,
    onSubmit,
    attemptId,
    isEssaySubmitBlocked,
    submitError,
    startExamError,
    sessionExpiredMessage,
}) {
    if (!question) return null;

    const isLastQuestion = questionIndex === totalQuestions - 1;
    const isFirstQuestion = questionIndex === 0;

    return (
        <div className="card-base p-5 md:p-8 mb-4">
            <div className="mb-5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/8 text-primary text-caption font-semibold mb-3">
                    <span className="material-symbols-outlined text-[14px]">quiz</span>
                    <span>Question {questionIndex + 1}</span>
                </span>
                <h2 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark leading-relaxed">
                    {question.questionText}
                </h2>
            </div>

            {/* Options / Essay Textarea */}
            <div className="space-y-2">
                {examFormat === 'essay' ? (
                    <div>
                        <textarea
                            value={selectedAnswer || ''}
                            onChange={(e) => {
                                const val = e.target.value.slice(0, 1500);
                                onAnswerSelect(question._id, val);
                            }}
                            placeholder="Write your answer here..."
                            rows={6}
                            className="input-field resize-y text-body-sm"
                            style={{ minHeight: '120px', fontSize: '16px' }}
                        />
                        <div className="flex justify-end mt-1">
                            <span className={`text-caption ${(selectedAnswer || '').length >= 1400
                                ? 'text-red-500'
                                : 'text-text-faint-light dark:text-text-faint-dark'
                                }`}>
                                {(selectedAnswer || '').length}/1500
                            </span>
                        </div>
                    </div>
                ) : finalOptions.length === 0 ? (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
                        <p className="text-body-sm text-amber-800 dark:text-amber-300">No options available for this question.</p>
                    </div>
                ) : (
                    finalOptions.map((option, index) => {
                        const { label, value, text } = option;
                        const isSelected = selectedAnswer === value;

                        return (
                            <button
                                key={index}
                                onClick={() => onAnswerSelect(question._id, value)}
                                className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-center gap-3 ${isSelected
                                    ? 'border-primary bg-primary/5 dark:bg-primary/10'
                                    : 'border-border-light dark:border-border-dark hover:border-primary/30 hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark'
                                    }`}
                            >
                                <span className={`flex-shrink-0 w-8 h-8 rounded-lg font-semibold text-body-sm flex items-center justify-center transition-all ${isSelected
                                    ? 'bg-primary text-white'
                                    : 'bg-surface-hover-light dark:bg-surface-hover-dark text-text-faint-light dark:text-text-faint-dark'
                                    }`}>
                                    {label}
                                </span>
                                <span className={`flex-1 text-body-sm ${isSelected ? 'text-text-main-light dark:text-text-main-dark font-medium' : 'text-text-sub-light dark:text-text-sub-dark'}`}>
                                    {text}
                                </span>
                                {isSelected && (
                                    <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>
                                )}
                            </button>
                        );
                    })
                )}
            </div>

            {/* Navigation Buttons */}
            <div className="hidden md:flex items-center justify-between mt-6 pt-5 border-t border-border-light dark:border-border-dark">
                <button
                    onClick={onPrevious}
                    disabled={isFirstQuestion}
                    className="btn-ghost px-5 py-2.5 flex items-center gap-2 disabled:opacity-30"
                >
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                    <span className="text-body-sm">Previous</span>
                </button>

                {isLastQuestion ? (
                    <button
                        onClick={onSubmit}
                        disabled={!attemptId || isEssaySubmitBlocked}
                        className="px-6 py-2.5 rounded-xl bg-accent-emerald text-white text-body-sm font-semibold hover:brightness-110 transition-all flex items-center gap-2 disabled:opacity-60"
                    >
                        <span>Submit Exam</span>
                        <span className="material-symbols-outlined text-[18px]">check</span>
                    </button>
                ) : (
                    <button
                        onClick={onNext}
                        className={`px-6 py-2.5 rounded-xl text-body-sm font-semibold transition-all flex items-center gap-2 ${selectedAnswer
                            ? 'btn-primary'
                            : 'bg-surface-hover-light dark:bg-surface-hover-dark text-text-faint-light dark:text-text-faint-dark'
                            }`}
                    >
                        <span>Next</span>
                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </button>
                )}
            </div>
        </div>
    );
});

export default ExamQuestionCard;
