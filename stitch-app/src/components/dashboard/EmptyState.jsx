import React from 'react';

const EmptyState = ({
    icon = 'inbox',
    title,
    description,
    actionLabel,
    onAction,
    actionHref,
    secondaryActionLabel,
    onSecondaryAction,
    className = '',
}) => {
    const ActionTag = actionHref ? 'a' : 'button';
    return (
        <div className={`card-flat p-6 md:p-8 text-center ${className}`}>
            <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center mx-auto mb-3">
                <span className="material-symbols-outlined text-primary text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
            </div>
            <h3 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-1">{title}</h3>
            {description && <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark max-w-md mx-auto">{description}</p>}
            {(actionLabel || secondaryActionLabel) && (
                <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                    {actionLabel && (
                        <ActionTag
                            href={actionHref}
                            onClick={onAction}
                            type={actionHref ? undefined : 'button'}
                            className="btn-primary text-body-sm"
                        >
                            {actionLabel}
                        </ActionTag>
                    )}
                    {secondaryActionLabel && (
                        <button type="button" onClick={onSecondaryAction} className="btn-ghost text-body-sm">
                            {secondaryActionLabel}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default EmptyState;
