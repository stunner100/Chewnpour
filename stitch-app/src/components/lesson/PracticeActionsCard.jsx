import React from 'react';
import { Link } from 'react-router-dom';
import AppIcon from '../AppIcon';

const EMPTY_ARRAY = [];

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
            <AppIcon name={action.icon} className="text-[18px]" />
            {action.label}
        </Tag>
    );
};

const PracticeActionsCard = ({
    title,
    description,
    primaryActions = EMPTY_ARRAY,
    secondaryActions = EMPTY_ARRAY,
    tertiaryActions = EMPTY_ARRAY,
    completed,
    bestScore,
}) => (
    <section className="rounded-[24px] border border-border-subtle bg-surface p-6 shadow-sm md:p-7">
        <div className="mb-4 flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-subtle">
                <AppIcon name={completed ? 'emoji_events' : 'rocket_launch'} className="text-[20px] text-primary" />
            </div>
            <div className="min-w-0 flex-1">
                <h3 className="font-display text-display-sm font-bold text-text-primary">{title}</h3>
                {description && (
                    <p className="mt-1 text-body-sm text-text-secondary">{description}</p>
                )}
                {bestScore != null && (
                    <p className="mt-1.5 inline-flex items-center gap-1 text-caption text-text-muted">
                        <AppIcon name="emoji_events" className="text-[14px]" />
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
