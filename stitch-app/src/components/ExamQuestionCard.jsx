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
        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800 p-6 md:p-8 mb-6">
            <div className="mb-6">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary text-xs font-medium mb-3">
                    <span className="material-symbols-outlined text-sm">quiz</span>
                    <span>Question {questionIndex + 1}</span>
                </span>
                <h2 className="text-lg md:text-xl font-bold text-neutral-900 dark:text-white leading-relaxed">
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
                            className="w-full p-4 rounded-xl border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-y transition-all text-sm md:text-base"
                            style={{ minHeight: '120px', fontSize: '16px' }}
                        />
                        <div className="flex justify-end mt-1">
                            <span className={`text-xs font-medium ${(selectedAnswer || '').length >= 1400
                                ? 'text-red-500'
                                : 'text-neutral-400'
                                }`}>
                                {(selectedAnswer || '').length}/1500
                            </span>
                        </div>
                    </div>
                ) : finalOptions.length === 0 ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        No options available for this question.
                    </div>
                ) : (
                    finalOptions.map((option, index) => {
                        const { label, value, text } = option;
                        const isSelected = selectedAnswer === value;

                        return (
                            <button
                                key={index}
                                onClick={() => onAnswerSelect(question._id, value)}
                                className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 flex items-center gap-3 ${isSelected
                                    ? 'border-primary bg-primary/5 dark:bg-primary/10'
                                    : 'border-neutral-200 dark:border-neutral-700 hover:border-primary/30 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                                    }`}
                            >
                                <span className={`flex-shrink-0 w-8 h-8 rounded-lg font-bold text-sm flex items-center justify-center transition-all ${isSelected
                                    ? 'bg-primary text-white'
                                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
                                    }`}>
                                    {label}
                                </span>
                                <span className={`flex-1 text-sm md:text-base ${isSelected ? 'text-neutral-900 dark:text-white font-medium' : 'text-neutral-600 dark:text-neutral-300'}`}>
                                    {text}
                                </span>
                                {isSelected && (
                                    <span className="material-symbols-outlined text-primary">check_circle</span>
                                )}
                            </button>
                        );
                    })
                )}
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-neutral-100 dark:border-neutral-800">
                <button
                    onClick={onPrevious}
                    disabled={isFirstQuestion}
                    className="px-5 py-2.5 rounded-xl text-neutral-600 dark:text-neutral-400 font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors flex items-center gap-2"
                >
                    <span className="material-symbols-outlined text-lg">arrow_back</span>
                    <span>Previous</span>
                </button>

                {isLastQuestion ? (
                    <button
                        onClick={onSubmit}
                        disabled={!attemptId || isEssaySubmitBlocked}
                        className="px-6 py-2.5 rounded-xl bg-accent-emerald text-white font-semibold shadow-md shadow-accent-emerald/20 hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-60"
                    >
                        <span>Submit Exam</span>
                        <span className="material-symbols-outlined text-lg">check</span>
                    </button>
                ) : (
                    <button
                        onClick={onNext}
                        className={`px-6 py-2.5 rounded-xl font-semibold shadow-md transition-all flex items-center gap-2 ${selectedAnswer
                            ? 'bg-primary text-white shadow-primary/20 hover:shadow-lg animate-[pulse_2s_ease-in-out_1]'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 shadow-none'
                            }`}
                    >
                        <span>Next</span>
                        <span className="material-symbols-outlined text-lg">arrow_forward</span>
                    </button>
                )}
            </div>
        </div>
    );
});

export default ExamQuestionCard;
