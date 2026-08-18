import React, { useCallback, useState, useRef, useEffect } from 'react';
import { m as Motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import AppIcon from '../AppIcon';

const ICONS = {
    success: 'check_circle',
    error: 'error',
    warning: 'warning',
    info: 'info',
};

const COLORS = {
    success: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300',
    error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-300',
    warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-300',
    info: 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800/40 text-primary-700 dark:text-primary-300',
};

const ICON_COLORS = {
    success: 'text-emerald-500',
    error: 'text-red-500',
    warning: 'text-amber-500',
    info: 'text-primary',
};

export const WatermelonToaster = ({ position = 'bottom-center', className }) => {
    const [toasts, setToasts] = useState([]);
    const timersRef = useRef(new Map());

    const removeToast = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        const timer = timersRef.current.get(id);
        if (timer) {
            clearTimeout(timer);
            timersRef.current.delete(id);
        }
    }, []);

    const addToast = useCallback((toast) => {
        const id = Math.random().toString(36).slice(2);
        const newToast = { ...toast, id, duration: toast.duration ?? 4000 };
        setToasts((prev) => [...prev.slice(-4), newToast]);

        const timer = setTimeout(() => removeToast(id), newToast.duration);
        timersRef.current.set(id, timer);
        return id;
    }, [removeToast]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.__watermelonAddToast = addToast;
        }
        return () => {
            if (typeof window !== 'undefined') {
                window.__watermelonAddToast = null;
            }
        };
    }, [addToast]);

    const positionClasses = {
        'top-left': 'top-4 left-4 items-start',
        'top-center': 'top-4 left-1/2 -translate-x-1/2 items-center',
        'top-right': 'top-4 right-4 items-end',
        'bottom-left': 'bottom-4 left-4 items-start',
        'bottom-center': 'bottom-6 left-1/2 -translate-x-1/2 items-center',
        'bottom-right': 'bottom-4 right-4 items-end',
    }[position] || 'bottom-6 left-1/2 -translate-x-1/2 items-center';

    return (
        <div
                className={cn(
                    'fixed z-[100] flex flex-col gap-2 pointer-events-none',
                    positionClasses,
                    className,
                )}
                aria-live="polite"
                aria-atomic="true"
            >
                <AnimatePresence mode="popLayout">
                    {toasts.map((toast) => (
                        <Motion.div
                            key={toast.id}
                            layout
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, x: toast.position === 'top-right' || toast.position === 'bottom-right' ? 20 : toast.position === 'top-left' || toast.position === 'bottom-left' ? -20 : 0, scale: 0.95 }}
                            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                            className={cn(
                                'pointer-events-auto min-w-[min(320px,calc(100vw-2rem))] max-w-[420px] rounded-2xl border px-4 py-3.5 shadow-elevated flex items-start gap-3',
                                COLORS[toast.type] || COLORS.info,
                                className,
                            )}
                        >
                            <AppIcon name={ICONS[toast.type] || ICONS.info} />
                            <div className="flex-1 min-w-0">
                                {toast.title && (
                                    <p className="text-sm font-semibold text-text-main-light dark:text-text-main-dark">{toast.title}</p>
                                )}
                                <p className={cn('text-sm', toast.title ? 'text-text-sub-light dark:text-text-sub-dark mt-0.5' : 'text-text-main-light dark:text-text-main-dark')}>
                                    {toast.message}
                                </p>
                                {toast.action && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            toast.action.onClick?.();
                                            removeToast(toast.id);
                                        }}
                                        className="mt-2 text-xs font-semibold text-primary hover:text-primary-hover transition-colors"
                                    >
                                        {toast.action.label}
                                    </button>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => removeToast(toast.id)}
                                className="shrink-0 text-text-faint-light dark:text-text-faint-dark hover:text-text-sub-light dark:hover:text-text-sub-dark transition-colors"
                                aria-label="Dismiss"
                            >
                                <AppIcon name="close" className="text-[18px]" />
                            </button>
                        </Motion.div>
                    ))}
                </AnimatePresence>
            </div>
    );
};

export default WatermelonToaster;
