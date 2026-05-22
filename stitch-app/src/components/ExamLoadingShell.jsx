import React from 'react';
import { Link } from 'react-router-dom';

const SHELL_CLASS = 'cp-theme bg-[#FAF8F3] min-h-screen flex items-center justify-center';

const IconBadge = ({ icon }) => (
    <div className="size-14 rounded-2xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark flex items-center justify-center mx-auto mb-4">
        <span className="material-symbols-outlined text-2xl text-text-faint-light dark:text-text-faint-dark">{icon}</span>
    </div>
);

const LoadingSpinner = () => (
    <div className="animate-spin rounded-full size-10 border-2 border-border-light dark:border-border-dark border-t-primary mx-auto mb-4" />
);

const ExamLoadingShell = ({
    variant = 'loading',
    icon,
    title,
    message,
    action,
    children,
    padded = false,
}) => {
    if (variant === 'custom') {
        return (
            <div className={`${SHELL_CLASS}${padded ? ' p-4' : ''}`}>
                {children}
            </div>
        );
    }

    if (variant === 'loading') {
        return (
            <div className={SHELL_CLASS}>
                <div className="text-center">
                    <LoadingSpinner />
                    {message ? (
                        <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">{message}</p>
                    ) : null}
                </div>
            </div>
        );
    }

    return (
        <div className={SHELL_CLASS}>
            <div className="text-center max-w-md px-6">
                {icon ? <IconBadge icon={icon} /> : null}
                {title ? (
                    <h2 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-2">{title}</h2>
                ) : null}
                {message ? (
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mb-6">{message}</p>
                ) : null}
                {action?.type === 'link' ? (
                    <Link to={action.to} className="btn-primary text-body-sm px-5 py-2.5 inline-flex items-center gap-2">
                        {action.label}
                    </Link>
                ) : null}
                {action?.type === 'button' ? (
                    <button
                        type="button"
                        onClick={action.onClick}
                        className="btn-primary text-body-sm px-5 py-2.5 inline-flex items-center gap-2"
                    >
                        {action.label}
                    </button>
                ) : null}
                {children}
            </div>
        </div>
    );
};

export default ExamLoadingShell;
