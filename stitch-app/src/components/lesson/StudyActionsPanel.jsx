import React from 'react';
import { Link } from 'react-router-dom';

const ActionButton = ({ icon, label, description, onClick, href, reloadDocument, variant = 'secondary', disabled }) => {
    const palette = {
        primary: 'bg-primary text-white hover:bg-primary-hover shadow-button',
        secondary: 'bg-surface-light dark:bg-surface-dark border border-border-subtle dark:border-border-subtle-dark text-text-main-light dark:text-text-main-dark hover:border-primary/30 hover:bg-primary-50/40 dark:hover:bg-primary-900/15',
        ghost: 'bg-transparent text-text-sub-light dark:text-text-sub-dark hover:bg-surface-hover dark:hover:bg-surface-hover-dark',
    }[variant] || '';
    const Tag = href ? Link : 'button';
    const tagProps = href ? { to: href, reloadDocument } : { type: 'button', onClick };
    return (
        <Tag
            {...tagProps}
            disabled={disabled}
            className={`group w-full flex items-center gap-3 rounded-xl px-3.5 py-3 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed ${palette}`}
        >
            <span className={`material-symbols-outlined text-[20px] ${variant === 'primary' ? 'text-white' : 'text-primary'}`} style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
            <span className="flex-1 text-left">
                <span className="block text-body-sm font-semibold leading-tight">{label}</span>
                {description && (
                    <span className={`block text-[11px] mt-0.5 ${variant === 'primary' ? 'text-white/80' : 'text-text-faint-light dark:text-text-faint-dark'}`}>{description}</span>
                )}
            </span>
            <span className={`material-symbols-outlined text-[16px] opacity-0 group-hover:opacity-100 transition-opacity ${variant === 'primary' ? 'text-white' : 'text-text-faint-light dark:text-text-faint-dark'}`}>arrow_forward</span>
        </Tag>
    );
};

const ProgressRing = ({ progress = 0, completed }) => {
    const dash = (Math.min(100, Math.max(0, progress)) / 100) * 175.9;
    const color = completed ? '#10b981' : '#914bf1';
    return (
        <div className="relative w-16 h-16 shrink-0">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" fill="none" strokeWidth="5" stroke="currentColor" className="text-border-subtle dark:text-border-subtle-dark" />
                <circle cx="32" cy="32" r="28" fill="none" strokeWidth="5" stroke={color} strokeDasharray={`${dash} 175.9`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-body-sm font-bold text-text-main-light dark:text-text-main-dark">
                {completed ? (
                    <span className="material-symbols-outlined text-[22px] text-emerald-600" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                ) : (
                    `${Math.round(progress)}%`
                )}
            </div>
        </div>
    );
};

const StudyActionsPanel = ({
    progress = 0,
    completed,
    primaryAction,
    actions = [],
    secondaryActions = [],
    relatedCourse,
}) => (
    <aside className="space-y-4 sticky top-[110px] max-h-[calc(100vh-7.5rem)] overflow-y-auto pl-1 pr-1 py-1 -mr-1 scrollbar-thin">
        <section className="card-base p-4">
            <div className="flex items-center gap-3 mb-3">
                <ProgressRing progress={progress} completed={completed} />
                <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-faint-light dark:text-text-faint-dark">
                        Lesson progress
                    </p>
                    <p className="text-body-md font-semibold text-text-main-light dark:text-text-main-dark leading-tight mt-0.5">
                        {completed ? 'Lesson complete' : progress >= 75 ? 'Almost done' : progress > 0 ? 'In progress' : 'Just started'}
                    </p>
                </div>
            </div>
            {primaryAction && (
                <ActionButton {...primaryAction} variant="primary" />
            )}
        </section>

        {actions.length > 0 && (
            <section className="card-base p-3 space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-faint-light dark:text-text-faint-dark px-1.5 pt-1">Study tools</p>
                {actions.map((action) => (
                    <ActionButton key={action.id} {...action} />
                ))}
            </section>
        )}

        {secondaryActions.length > 0 && (
            <section className="card-flat p-3 space-y-0.5">
                {secondaryActions.map((action) => (
                    <ActionButton key={action.id} variant="ghost" {...action} />
                ))}
            </section>
        )}

        {relatedCourse && (
            <section className="card-flat p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-faint-light dark:text-text-faint-dark mb-1.5">From the course</p>
                <Link
                    to={relatedCourse.href}
                    className="group flex items-center gap-2.5"
                >
                    <span className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-accent-purple flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-white text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>menu_book</span>
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block text-body-sm font-semibold text-text-main-light dark:text-text-main-dark line-clamp-1 group-hover:text-primary transition-colors">{relatedCourse.title}</span>
                        <span className="block text-caption text-text-faint-light dark:text-text-faint-dark">Back to course</span>
                    </span>
                </Link>
            </section>
        )}
    </aside>
);

export default StudyActionsPanel;
