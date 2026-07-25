import React from 'react';
import AppIcon from './AppIcon';

const Toast = ({ message, onClose, type = 'success' }) => {
    if (!message) return null;

    const icon = type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'check_circle';
    const iconColor = type === 'error'
        ? 'text-red-400 dark:text-red-500'
        : type === 'warning'
            ? 'text-amber-400 dark:text-amber-500'
            : 'text-green-400 dark:text-green-600';

    return (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-slide-up" role="alert" aria-live="assertive">
            <div className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-6 py-3 rounded-full shadow-lg flex items-center gap-2">
                <AppIcon name={icon} />
                <span className="text-sm font-medium">{message}</span>
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="ml-1 rounded-full text-white/70 hover:text-white dark:text-zinc-900/60 dark:hover:text-zinc-900"
                        aria-label="Dismiss notification"
                    >
                        <AppIcon name="close" className="text-[16px]" />
                    </button>
                )}
            </div>
        </div>
    );
};

export default Toast;
