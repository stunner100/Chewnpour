import React from 'react';
import { Link } from 'react-router-dom';
import { buildConceptPracticePath } from '../../lib/conceptReviewLinks';

const CourseWeakConcepts = ({ items = [] }) => {
    return (
        <section className="card-base p-5">
            <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                    <h2 className="text-body-base font-semibold text-text-main-light dark:text-text-main-dark inline-flex items-center gap-2">
                        <span
                            className="material-symbols-outlined text-rose-500 text-[20px]"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                            flash_on
                        </span>
                        Concepts to review
                    </h2>
                    <p className="text-caption text-text-sub-light dark:text-text-sub-dark mt-0.5">
                        Quick spaced-repetition picks based on your recent performance.
                    </p>
                </div>
            </div>

            {items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border-subtle dark:border-border-subtle-dark p-4 text-center">
                    <span
                        className="material-symbols-outlined text-emerald-500 text-[24px]"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                        verified
                    </span>
                    <p className="mt-1.5 text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">
                        You&apos;re all caught up.
                    </p>
                    <p className="text-caption text-text-sub-light dark:text-text-sub-dark mt-0.5">
                        Weak concepts will appear after quizzes or topic reviews in this course.
                    </p>
                </div>
            ) : (
                <ul className="space-y-2">
                    {items.map((item) => {
                        const conceptCount = (item.reviewConceptKeys || []).length || item.dueCount || 1;
                        return (
                            <li key={item.topicId}>
                                <Link
                                    to={buildConceptPracticePath(item.topicId, item.reviewConceptKeys)}
                                    className="flex items-center gap-3 p-3 rounded-xl border border-transparent hover:border-primary/20 hover:bg-primary-50/40 dark:hover:bg-primary-900/10 transition-all group"
                                >
                                    <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-rose-50 text-rose-500 dark:bg-rose-900/20 shrink-0">
                                        <span className="material-symbols-outlined text-[18px]">flash_on</span>
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark line-clamp-1">
                                            {item.topicTitle}
                                        </p>
                                        <p className="text-caption text-text-faint-light dark:text-text-faint-dark line-clamp-1">
                                            {conceptCount} concept{conceptCount === 1 ? '' : 's'} to review
                                        </p>
                                    </div>
                                    <span className="text-caption font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                                        Review
                                    </span>
                                    <span className="material-symbols-outlined text-text-faint-light dark:text-text-faint-dark text-[18px] group-hover:text-primary transition-colors">
                                        arrow_forward
                                    </span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
};

export default CourseWeakConcepts;
