import React from 'react';
import { Link } from 'react-router-dom';
import { buildConceptPracticePath } from '../../lib/conceptReviewLinks';

const MASTERY_STYLES = {
    due: {
        label: 'Due today',
        className: 'bg-rose-50 text-rose-700 border-rose-200/60 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800/40',
    },
    shaky: {
        label: 'Shaky',
        className: 'bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/40',
    },
    progressing: {
        label: 'Progressing',
        className: 'bg-primary-50 text-primary-700 border-primary-200/60 dark:bg-primary-900/25 dark:text-primary-300 dark:border-primary-800/40',
    },
    strong: {
        label: 'Strong',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/40',
    },
    mastered: {
        label: 'Mastered',
        className: 'bg-emerald-100 text-emerald-800 border-emerald-300/60 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-700/40',
    },
};

const resolveMastery = (item) => {
    if (item.dueCount > 0) return 'due';
    if (item.weakCount > item.strongCount) return 'shaky';
    if (item.shakyCount > 0) return 'progressing';
    if (item.strongCount > 0) return 'strong';
    return 'progressing';
};

const WeakConceptsCard = ({ queue }) => {
    if (!queue || !Array.isArray(queue.items) || queue.items.length === 0) {
        return (
            <section className="card-base p-5 md:p-6 animate-fade-in-up animate-delay-200">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-emerald-600 text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    </div>
                    <div>
                        <h3 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark">You're all caught up</h3>
                        <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mt-1">
                            New weak concepts will appear after you complete quizzes or lessons.
                        </p>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="space-y-4 animate-fade-in-up animate-delay-200">
            <div className="flex items-end justify-between gap-3">
                <div>
                    <h2 className="text-display-sm text-text-main-light dark:text-text-main-dark">Review weak concepts</h2>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mt-0.5">
                        {queue.dueConceptCount > 0
                            ? `${queue.dueConceptCount} concepts are due across ${queue.dueTopicCount} topics.`
                            : 'Stay ahead by revisiting concepts before they fade.'}
                    </p>
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {queue.items.map((item) => {
                    const mastery = resolveMastery(item);
                    const styles = MASTERY_STYLES[mastery];
                    return (
                        <Link
                            key={item.topicId}
                            to={buildConceptPracticePath(item.topicId, item.reviewConceptKeys)}
                            className="group card-interactive p-4"
                        >
                            <div className="flex items-start justify-between gap-3 mb-2">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${styles.className}`}>
                                    <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                                    {styles.label}
                                </span>
                                <span className="text-caption text-text-faint-light dark:text-text-faint-dark shrink-0">
                                    {item.weakCount + item.shakyCount + item.strongCount} concepts
                                </span>
                            </div>
                            <h3 className="text-body-md font-semibold text-text-main-light dark:text-text-main-dark line-clamp-1 group-hover:text-primary transition-colors">
                                {item.topicTitle}
                            </h3>
                            <p className="mt-2 text-caption text-text-sub-light dark:text-text-sub-dark line-clamp-2">
                                {Array.isArray(item.concepts) && item.concepts.length > 0
                                    ? item.concepts.map((c) => c.conceptLabel).join(' · ')
                                    : 'Open a focused review session for this topic.'}
                            </p>
                            <div className="mt-3 flex items-center justify-between">
                                <span className="inline-flex items-center gap-3 text-caption text-text-faint-light dark:text-text-faint-dark">
                                    <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-400" />{item.weakCount}</span>
                                    <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />{item.shakyCount}</span>
                                    <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{item.strongCount}</span>
                                </span>
                                <span className="inline-flex items-center gap-1 text-caption font-semibold text-primary group-hover:translate-x-0.5 transition-transform">
                                    Review
                                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                                </span>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </section>
    );
};

export default WeakConceptsCard;
