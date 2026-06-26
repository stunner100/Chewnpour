import React, { useEffect, useId, useRef, useContext, createContext } from 'react';
import { m as Motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

// Lets WatermelonDialogTitle adopt the dialog's generated id so the panel's
// aria-labelledby resolves to the visible title.
const DialogTitleIdContext = createContext(null);

const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const WatermelonDialog = ({
    open,
    onOpenChange,
    children,
    className,
    'aria-label': ariaLabel,
}) => {
    const panelRef = useRef(null);
    const previouslyFocusedRef = useRef(null);
    // Keep the latest onOpenChange without re-subscribing the key listener and
    // without depending on the experimental useEffectEvent hook.
    const onOpenChangeRef = useRef(onOpenChange);
    const titleId = useId();

    useEffect(() => {
        onOpenChangeRef.current = onOpenChange;
    });

    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [open]);

    // Escape-to-close + focus containment. Focus moves into the dialog on open
    // and returns to the trigger on close.
    useEffect(() => {
        if (!open) return undefined;

        previouslyFocusedRef.current =
            typeof document !== 'undefined' ? document.activeElement : null;
        const panel = panelRef.current;

        const focusFrame = requestAnimationFrame(() => {
            const target = panel?.querySelector(FOCUSABLE_SELECTOR) || panel;
            target?.focus?.();
        });

        const handleKey = (e) => {
            if (e.key === 'Escape') {
                onOpenChangeRef.current?.(false);
                return;
            }
            if (e.key !== 'Tab' || !panel) return;

            const focusable = Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR))
                .filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1);
            if (focusable.length === 0) {
                e.preventDefault();
                panel.focus();
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const active = document.activeElement;
            if (e.shiftKey && (active === first || active === panel)) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && active === last) {
                e.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleKey);
        return () => {
            cancelAnimationFrame(focusFrame);
            document.removeEventListener('keydown', handleKey);
            const toRestore = previouslyFocusedRef.current;
            if (toRestore && typeof toRestore.focus === 'function') {
                toRestore.focus();
            }
        };
    }, [open]);

    return (
        <AnimatePresence>
            {open && (
                <DialogTitleIdContext.Provider value={titleId}>
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <Motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                            onClick={() => onOpenChange?.(false)}
                        />
                        <Motion.div
                            ref={panelRef}
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby={titleId}
                            aria-label={ariaLabel || undefined}
                            tabIndex={-1}
                            initial={{ opacity: 0, scale: 0.96, y: 8 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: 8 }}
                            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                            className={cn(
                                'relative z-10 w-full max-w-lg rounded-2xl border border-border-subtle dark:border-border-subtle-dark bg-surface-light dark:bg-surface-dark shadow-elevated p-6 focus:outline-none',
                                className,
                            )}
                        >
                            {children}
                        </Motion.div>
                    </div>
                </DialogTitleIdContext.Provider>
            )}
        </AnimatePresence>
    );
};

export const WatermelonDialogHeader = ({ children, className }) => (
    <div className={cn('mb-4', className)}>{children}</div>
);

export const WatermelonDialogTitle = ({ children, className }) => {
    const titleId = useContext(DialogTitleIdContext);
    return (
        <h2 id={titleId || undefined} className={cn('text-body-lg font-semibold text-text-main-light dark:text-text-main-dark', className)}>
            {children}
        </h2>
    );
};

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
