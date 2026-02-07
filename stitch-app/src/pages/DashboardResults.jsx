import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

const DashboardResults = () => {
    const { attemptId } = useParams();
    const attempt = useQuery(
        api.exams.getExamAttempt,
        attemptId ? { attemptId } : 'skip'
    );

    if (!attemptId) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="text-center max-w-md px-6">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No exam selected</h2>
                    <p className="text-slate-500 font-medium mb-6">Return to your dashboard and open a completed exam.</p>
                    <Link to="/dashboard" className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/20">
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    if (attempt === undefined) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-slate-500 font-medium">Loading exam results...</p>
                </div>
            </div>
        );
    }

    if (attempt === null) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="text-center max-w-md px-6">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Results not found</h2>
                    <p className="text-slate-500 font-medium mb-6">We couldn’t find that exam attempt.</p>
                    <Link to="/dashboard" className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/20">
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    const totalQuestions = attempt.totalQuestions || attempt.answers?.length || 0;
    const percentage = typeof attempt.percentage === 'number'
        ? attempt.percentage
        : totalQuestions > 0
            ? Math.round((attempt.score / totalQuestions) * 100)
            : 0;
    const incorrectCount = totalQuestions - (attempt.score || 0);

    const getOptionText = (options, label) => {
        if (!options || !label) return label || '';
        if (Array.isArray(options)) {
            const match = options.find((option) => {
                if (!option || typeof option !== 'object') return false;
                return option.label === label || option.value === label;
            });
            if (match?.text) return match.text;
        }
        return label;
    };

    const answers = attempt.answers || [];

    return (
        <div className="bg-background-light dark:bg-background-dark font-display antialiased text-[#0d161c] dark:text-white min-h-screen flex flex-col">
            <header className="w-full bg-surface-light dark:bg-surface-dark border-b border-gray-100 dark:border-gray-800 sticky top-0 z-30 shadow-sm">
                <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">Exam Results</h1>
                            <span className="text-sm font-medium text-gray-400 dark:text-gray-500">{attempt.topicTitle || 'Study Group Mode'}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link to="/dashboard" className="flex items-center justify-center bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors rounded-full h-10 w-10">
                            <span className="material-symbols-outlined text-gray-600 dark:text-gray-300">close</span>
                        </Link>
                    </div>
                </div>
            </header>

            <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-8 flex flex-col gap-8">
                <section className="w-full flex justify-center">
                    <div className="w-full max-w-2xl bg-surface-light dark:bg-surface-dark border border-gray-100 dark:border-gray-700 rounded-2xl p-8 shadow-soft flex flex-col items-center text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-purple-500 to-primary"></div>
                        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Overall Score</h2>
                        <div className="flex items-baseline justify-center gap-1 mb-2">
                            <span className="text-7xl font-extrabold text-gray-900 dark:text-white tracking-tight">{percentage}</span>
                            <span className="text-3xl text-gray-400 font-bold">/100</span>
                        </div>
                        <div className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                            {attempt.score} correct out of {totalQuestions}
                        </div>
                        <div className="mt-4 flex items-center gap-3 text-xs font-bold text-gray-500">
                            <span className="px-3 py-1 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300">
                                {attempt.score} Correct
                            </span>
                            <span className="px-3 py-1 rounded-full bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">
                                {incorrectCount} Incorrect
                            </span>
                        </div>
                    </div>
                </section>

                <section className="w-full">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="bg-primary/10 p-2 rounded-xl text-primary shadow-sm">
                            <span className="material-symbols-outlined text-[24px]">quiz</span>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Question Review</h3>
                    </div>

                    {answers.length === 0 ? (
                        <div className="bg-surface-light dark:bg-surface-dark border border-gray-100 dark:border-gray-700 rounded-3xl p-6 shadow-card">
                            <p className="text-gray-600 dark:text-gray-400">No answers recorded for this attempt.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {answers.map((answer, index) => {
                                const questionText = answer.questionText || `Question ${index + 1}`;
                                const yourAnswerText = getOptionText(answer.options, answer.selectedAnswer) || 'Not answered';
                                const correctAnswerText = getOptionText(answer.options, answer.correctAnswer) || answer.correctAnswer;
                                const isCorrect = Boolean(answer.isCorrect);
                                return (
                                    <div key={`${answer.questionId}-${index}`} className="bg-surface-light dark:bg-surface-dark border border-gray-100 dark:border-gray-700 rounded-3xl p-6 shadow-card">
                                        <div className="flex justify-between items-center mb-4">
                                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Question {index + 1}</span>
                                            <span className={`text-[11px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-wide border ${isCorrect
                                                ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300 border-green-100 dark:border-green-900/30'
                                                : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 border-red-100 dark:border-red-900/30'
                                                }`}>
                                                {isCorrect ? 'Correct' : 'Incorrect'}
                                            </span>
                                        </div>
                                        <p className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-6 leading-relaxed">
                                            {questionText}
                                        </p>
                                        <div className="space-y-4 mb-6">
                                            <div className={`flex items-start gap-4 p-4 rounded-2xl border ${isCorrect
                                                ? 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-800/30'
                                                : 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-800/30'
                                                }`}>
                                                <span className={`material-symbols-outlined mt-0.5 text-[24px] ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                                                    {isCorrect ? 'check_circle' : 'cancel'}
                                                </span>
                                                <div className="flex-1">
                                                    <span className={`text-xs font-bold uppercase block mb-1 ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                                                        Your Answer
                                                    </span>
                                                    <span className="text-base font-bold text-gray-800 dark:text-white">{yourAnswerText}</span>
                                                </div>
                                            </div>
                                            {!isCorrect && (
                                                <div className="flex items-start gap-4 p-4 rounded-2xl bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800/30">
                                                    <span className="material-symbols-outlined text-green-600 mt-0.5 text-[24px]">check_circle</span>
                                                    <div className="flex-1">
                                                        <span className="text-xs text-green-600 font-bold uppercase block mb-1">Correct Answer</span>
                                                        <span className="text-base font-bold text-gray-800 dark:text-white">{correctAnswerText}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {answer.explanation && (
                                            <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed bg-gray-50 dark:bg-black/20 p-5 rounded-2xl border border-gray-100 dark:border-gray-700/50">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="material-symbols-outlined text-primary text-[20px]">lightbulb</span>
                                                    <span className="font-bold text-gray-900 dark:text-white">Why?</span>
                                                </div>
                                                {answer.explanation}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
};

export default DashboardResults;
