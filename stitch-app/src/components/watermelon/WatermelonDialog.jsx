import React, { useEffect } from 'react';
import { motion as Motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

export const WatermelonDialog = ({
    open,
    onOpenChange,
    children,
    className,
}) => {
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [open]);

    useEffect(() => {
        if (!open) return undefined;
        const handleKey = (e) => {
            if (e.key === 'Escape') onOpenChange?.(false);
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [open, onOpenChange]);

    return (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
                    <Motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => onOpenChange?.(false)}
                    />
                    <Motion.div
                        initial={{ opacity: 0, scale: 0.96, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 8 }}
                        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                        className={cn(
                            'relative z-10 w-full max-w-lg rounded-2xl border border-border-subtle dark:border-border-subtle-dark bg-surface-light dark:bg-surface-dark shadow-elevated p-6',
                            className,
                        )}
                    >
                        {children}
                    </Motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export const WatermelonDialogHeader = ({ children, className }) => (
    <div className={cn('mb-4', className)}>{children}</div>
);

export const WatermelonDialogTitle = ({ children, className }) => (
    <h2 className={cn('text-body-lg font-semibold text-text-main-light dark:text-text-main-dark', className)}>
        {children}
    </h2>
);

export const WatermelonDialogDescription = ({ children, className }) => (
    <p className={cn('text-body-sm text-text-sub-light dark:text-text-sub-dark mt-1', className)}>
        {children}
    </p>
);

export const WatermelonDialogFooter = ({ children, className }) => (
    <div className={cn('flex items-center justify-end gap-3 mt-6 pt-4 border-t border-border-subtle dark:border-border-subtle-dark', className)}>
        {children}
    </div>
);

export default WatermelonDialog;
