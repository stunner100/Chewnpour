import React from 'react';
import { Link } from 'react-router-dom';
import ExamQuestionCard from './ExamQuestionCard';
import AccessibleProgressBar from './AccessibleProgressBar';
import { WatermelonTabs, WatermelonTabsList, WatermelonTabsTrigger } from './watermelon/WatermelonTabs';
import { isQuestionAnswered } from '../lib/examAttemptSupport';

const ExamQuestionNavigator = ({
    questions,
    currentQuestion,
    examFormat,
    selectedAnswers,
    onNavigateToQuestion,
    className = '',
}) => (
    <WatermelonTabs
        defaultValue={String(currentQuestion)}
        value={String(currentQuestion)}
        onValueChange={(value) => onNavigateToQuestion(Number(value))}
    >
        <WatermelonTabsList className={`flex-wrap gap-1 ${className}`.trim()}>
            {questions.map((question, index) => {
                const answered = isQuestionAnswered(question, selectedAnswers, examFormat);
                return (
                    <WatermelonTabsTrigger
                        key={question._id}
                        value={String(index)}
                        className={`size-9 !flex-none !px-0 !py-0 text-center ${answered ? '!text-success dark:!text-emerald-400' : ''}`}
                    >
                        {index + 1}
                    </WatermelonTabsTrigger>
                );
            })}
        </WatermelonTabsList>
    </WatermelonTabs>
);

const ExamActiveSession = ({
    topicId,
    topicTitle,
    examFormat,
    questions,
    currentQuestion,
    selectedAnswers,
    attemptId,
    startExamError,
    submitError,
    examQualityTier,
    formattedTime,
    isLowTime,
    progress,
    answeredQuestionCount,
    isEssaySubmitBlocked,
    finalOptions,
    currentQuestionData,
    onAnswerSelect,
    onPrevious,
    onNext,
    onSubmit,
    onNavigateToQuestion,
    sessionExpiredMessage,
}) => (
    <div className="min-h-screen cp-theme bg-[#FAF8F3] flex flex-col md:flex-row">
        <main className="flex-1 flex flex-col min-h-screen">
            <header className="sticky top-0 z-40 bg-surface-light/90 dark:bg-surface-dark/90 backdrop-blur-md border-b border-border-light dark:border-border-dark">
                <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link
                            to={topicId ? `/dashboard/topic/${topicId}` : '/dashboard'}
                            className="btn-icon size-9"
                            aria-label="Close quiz and return to topic"
                        >
                            <span className="material-symbols-outlined text-lg">close</span>
                        </Link>
                        <div>
                            <h1 className="text-body-base font-semibold text-text-main-light dark:text-text-main-dark">Exam</h1>
                            <p className="text-caption text-text-faint-light dark:text-text-faint-dark truncate max-w-[120px] sm:max-w-xs">{topicTitle}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-body-sm text-text-sub-light dark:text-text-sub-dark">
                            {currentQuestion + 1} <span className="text-text-faint-light dark:text-text-faint-dark">/ {questions.length}</span>
                        </span>
                        <div
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono font-semibold text-body-sm ${isLowTime ? 'bg-error-soft dark:bg-red-950/30 text-error dark:text-red-400' : 'bg-surface-hover-light dark:bg-surface-hover-dark text-text-main-light dark:text-text-main-dark'}`}
                            role="status"
                            aria-live="polite"
                            aria-label={`Time remaining, ${formattedTime}`}
                        >
                            <span className="material-symbols-outlined text-[16px]">timer</span>
                            {formattedTime}
                        </div>
                    </div>
                </div>
                <AccessibleProgressBar
                    value={progress}
                    label="Quiz progress"
                    valueText={`${answeredQuestionCount} of ${questions.length} questions answered`}
                    trackClassName="h-1.5 bg-border-light dark:bg-border-dark"
                    barClassName="h-full bg-primary transition-all duration-300"
                />
            </header>

            <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 pb-32">
                {startExamError ? (
                    <div className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
                        <p className="text-body-sm text-amber-800 dark:text-amber-300">{startExamError}</p>
                    </div>
                ) : null}
                {submitError ? (
                    <div className="mb-4 p-3 rounded-xl bg-error-soft dark:bg-red-950/25 border border-error/20 dark:border-red-900/35">
                        <p className="text-body-sm text-error dark:text-red-300">
                            {submitError}
                            {submitError === sessionExpiredMessage ? (
                                <Link to="/login" className="ml-2 font-semibold underline">Sign in</Link>
                            ) : null}
                        </p>
                    </div>
                ) : null}
                {examQualityTier === 'premium' ? (
                    <div className="mb-4 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30">
                        <p className="text-body-sm text-blue-800 dark:text-blue-300">Premium quiz ready. This set met the higher university-level quality targets.</p>
                    </div>
                ) : null}
                <ExamQuestionCard
                    question={currentQuestionData}
                    questionIndex={currentQuestion}
                    totalQuestions={questions.length}
                    examFormat={examFormat}
                    selectedAnswer={selectedAnswers[currentQuestionData?._id]}
                    finalOptions={finalOptions}
                    onAnswerSelect={onAnswerSelect}
                    onPrevious={onPrevious}
                    onNext={onNext}
                    onSubmit={onSubmit}
                    attemptId={attemptId}
                    isEssaySubmitBlocked={isEssaySubmitBlocked}
                    submitError={submitError}
                    startExamError={startExamError}
                    sessionExpiredMessage={sessionExpiredMessage}
                />

                <div className="md:hidden card-base p-4">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-body-sm text-text-sub-light dark:text-text-sub-dark">Question Navigator</span>
                        <span className="text-caption text-text-faint-light dark:text-text-faint-dark">{answeredQuestionCount} of {questions.length} answered</span>
                    </div>
                    <ExamQuestionNavigator
                        questions={questions}
                        currentQuestion={currentQuestion}
                        examFormat={examFormat}
                        selectedAnswers={selectedAnswers}
                        onNavigateToQuestion={onNavigateToQuestion}
                    />
                </div>
            </div>

            <div className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-surface-light dark:bg-surface-dark border-t border-border-light dark:border-border-dark p-4 safe-area-bottom">
                <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
                    <button
                        type="button"
                        onClick={onPrevious}
                        disabled={currentQuestion === 0}
                        className="btn-ghost px-4 py-2.5 flex items-center gap-1 disabled:opacity-30"
                    >
                        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                        <span className="hidden sm:inline text-body-sm">Prev</span>
                    </button>

                    <div className="flex-1 text-center">
                        <span className="text-body-sm text-text-sub-light dark:text-text-sub-dark">
                            {answeredQuestionCount} <span className="text-text-faint-light dark:text-text-faint-dark">/ {questions.length}</span> answered
                        </span>
                    </div>

                    {currentQuestion === questions.length - 1 ? (
                        <button
                            type="button"
                            onClick={onSubmit}
                            disabled={!attemptId || isEssaySubmitBlocked}
                            className="btn-primary px-6 py-2.5 flex items-center gap-1 disabled:opacity-60"
                        >
                            <span>Submit</span>
                            <span className="material-symbols-outlined text-[18px]">check</span>
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={onNext}
                            className="btn-primary px-6 py-2.5 flex items-center gap-1"
                        >
                            <span>Next</span>
                            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                        </button>
                    )}
                </div>
            </div>
        </main>

        <aside className="hidden md:flex w-72 bg-surface-light dark:bg-surface-dark border-l border-border-light dark:border-border-dark flex-col h-screen sticky top-0">
            <div className="p-5 flex-1 overflow-y-auto">
                <div className="card-base p-5 text-center mb-5">
                    <span className="text-overline text-text-faint-light dark:text-text-faint-dark block mb-2">Time Remaining</span>
                    <div
                        className={`text-display-lg font-mono tabular-nums ${isLowTime ? 'text-error' : 'text-text-main-light dark:text-text-main-dark'}`}
                        role="status"
                        aria-live="polite"
                        aria-label={`Time remaining, ${formattedTime}`}
                    >
                        {formattedTime}
                    </div>
                    {isLowTime ? (
                        <p className="text-caption text-error mt-1">Less than 5 minutes!</p>
                    ) : null}
                </div>

                <div className="mb-5">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-body-sm text-text-sub-light dark:text-text-sub-dark">Answered</span>
                        <span className="text-body-sm font-semibold text-primary">{Math.round(progress)}%</span>
                    </div>
                    <AccessibleProgressBar
                        value={progress}
                        label="Answered progress"
                        valueText={`${answeredQuestionCount} of ${questions.length} questions answered`}
                        trackClassName="w-full bg-border-light dark:bg-border-dark rounded-full h-1.5"
                        barClassName="bg-primary h-full rounded-full transition-all duration-300"
                    />
                </div>

                <div className="mb-5">
                    <span className="text-overline text-text-faint-light dark:text-text-faint-dark block mb-3">Questions</span>
                    <ExamQuestionNavigator
                        questions={questions}
                        currentQuestion={currentQuestion}
                        examFormat={examFormat}
                        selectedAnswers={selectedAnswers}
                        onNavigateToQuestion={onNavigateToQuestion}
                    />
                </div>
            </div>

            <div className="p-5 border-t border-border-light dark:border-border-dark">
                <button
                    type="button"
                    onClick={onSubmit}
                    disabled={!attemptId || isEssaySubmitBlocked}
                    className="w-full btn-primary py-3 disabled:opacity-60"
                >
                    Submit Quiz
                </button>
            </div>
        </aside>
    </div>
);

export default ExamActiveSession;
