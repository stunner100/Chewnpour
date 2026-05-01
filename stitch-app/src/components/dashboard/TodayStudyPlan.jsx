import React from 'react';
import { Link } from 'react-router-dom';

const PRIORITY_STYLES = {
    high: 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 border-rose-200/60 dark:border-rose-800/40',
    medium: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/40',
    low: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/40',
};

const TodayStudyPlan = ({ items = [], completedToday = 0 }) => {
    const total = items.length;

    return (
        <section className="card-base p-5 md:p-6 animate-fade-in-up animate-delay-100">
            <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                    <h2 className="text-display-sm text-text-main-light dark:text-text-main-dark">Today's study plan</h2>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mt-0.5">
                        {total === 0
                            ? "You're all set. Upload material or start a quick review."
                            : `${completedToday} of ${total} done · stay on track today`}
                    </p>
                </div>
                <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary text-caption font-semibold">
                    <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>today</span>
                    Today
                </span>
            </div>

            {items.length === 0 ? (
                <div className="text-center py-8">
                    <span className="material-symbols-outlined text-[36px] text-text-faint-light dark:text-text-faint-dark">task_alt</span>
                    <p className="mt-2 text-body-sm text-text-sub-light dark:text-text-sub-dark">No study items for today yet — upload a doc or finish a quiz to populate your plan.</p>
                </div>
            ) : (
                <ul className="space-y-2">
                    {items.map((item) => {
                        const Tag = item.href ? Link : 'div';
                        const tagProps = item.href ? { to: item.href } : {};
                        return (
                            <li key={item.id}>
                                <Tag
                                    {...tagProps}
                                    className="group flex items-center gap-3 rounded-2xl border border-border-subtle dark:border-border-subtle-dark bg-surface-light dark:bg-surface-dark hover:border-primary/40 hover:bg-primary-50/40 dark:hover:bg-primary-900/10 transition-all p-3.5"
                                >
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${PRIORITY_STYLES[item.priority] || PRIORITY_STYLES.medium} border`}>
                                        <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>{item.icon}</span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark truncate">{item.title}</p>
                                        <p className="text-caption text-text-faint-light dark:text-text-faint-dark mt-0.5 flex items-center gap-1.5 flex-wrap">
                                            <span className="inline-flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[13px]">schedule</span>
                                                {item.estimatedTime}
                                            </span>
                                            {item.subtitle && (
                                                <>
                                                    <span aria-hidden="true">·</span>
                                                    <span className="truncate">{item.subtitle}</span>
                                                </>
                                            )}
                                        </p>
                                    </div>
                                    <span className="inline-flex text-caption font-semibold text-primary group-hover:translate-x-0.5 transition-transform items-center gap-1 shrink-0">
                                        <span className="hidden sm:inline">{item.cta || 'Start'}</span>
                                        <span className="material-symbols-outlined text-[16px] sm:text-[14px]">arrow_forward</span>
                                    </span>
                                </Tag>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
};

export default TodayStudyPlan;
