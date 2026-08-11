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
    completed: _completed,
    bestScore,
}) => (
    <section className="border-t border-border-subtle pt-6">
        <div className="mb-4 min-w-0">
            <h3 className="font-display text-display-sm font-bold text-text-primary">{title}</h3>
            {description && (
                <p className="mt-1 text-body-sm text-text-secondary">{description}</p>
            )}
            {bestScore != null && (
                <p className="mt-1.5 text-caption text-text-muted">
                    Best score so far: {bestScore}%
                </p>
            )}
        </div>

        {primaryActions.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
                {primaryActions.map((a) => <ActionButton key={a.id} action={a} tone="primary" />)}
            </div>
        )}
        {secondaryActions.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
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
