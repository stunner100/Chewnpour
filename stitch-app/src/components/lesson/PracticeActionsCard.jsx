import React from 'react';
import { Link } from 'react-router-dom';

const ActionButton = ({ action, tone }) => {
    const Tag = action.href ? Link : 'button';
    const tagProps = action.href ? { to: action.href, reloadDocument: action.reloadDocument } : { type: 'button', onClick: action.onClick };
    const className = tone === 'primary'
        ? 'btn-primary text-body-sm gap-2'
        : tone === 'tertiary'
            ? 'btn-ghost text-body-sm gap-2'
            : 'btn-secondary text-body-sm gap-2';
    return (
        <Tag {...tagProps} disabled={action.disabled} className={`${className} disabled:opacity-50 disabled:cursor-not-allowed`}>
            <span className="material-symbols-outlined text-[18px]" style={tone === 'primary' ? { fontVariationSettings: "'FILL' 1" } : undefined}>{action.icon}</span>
            {action.label}
        </Tag>
    );
};

const PracticeActionsCard = ({
    title,
    description,
    primaryActions = [],
    secondaryActions = [],
    tertiaryActions = [],
    completed,
    bestScore,
}) => (
    <section className="rounded-3xl border border-border-subtle dark:border-border-subtle-dark bg-gradient-to-br from-primary-50 via-surface-light to-surface-light dark:from-primary-900/15 dark:via-surface-dark dark:to-surface-dark p-6 md:p-7 shadow-soft">
        <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>{completed ? 'emoji_events' : 'rocket_launch'}</span>
            </div>
            <div className="flex-1 min-w-0">
                <h3 className="text-display-sm text-text-main-light dark:text-text-main-dark">{title}</h3>
                {description && (
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mt-1">{description}</p>
                )}
                {bestScore != null && (
                    <p className="text-caption text-text-faint-light dark:text-text-faint-dark mt-1.5 inline-flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">emoji_events</span>
                        Best score so far: {bestScore}%
                    </p>
                )}
            </div>
        </div>

        {primaryActions.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
                {primaryActions.map((a) => <ActionButton key={a.id} action={a} tone="primary" />)}
            </div>
        )}
        {secondaryActions.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
                {secondaryActions.map((a) => <ActionButton key={a.id} action={a} tone="secondary" />)}
            </div>
        )}
        {tertiaryActions.length > 0 && (
            <div className="flex flex-wrap gap-2">
                {tertiaryActions.map((a) => <ActionButton key={a.id} action={a} tone="tertiary" />)}
            </div>
        )}
    </section>
);

export default PracticeActionsCard;
