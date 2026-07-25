import React, { useState, useRef } from 'react';
import { m as Motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import AppIcon from '../AppIcon';

export const WatermelonDisclosure = ({
    title,
    children,
    defaultOpen = false,
    open: controlledOpen,
    onOpenChange,
    className,
    headerClassName,
    contentClassName,
    icon = 'expand_more',
}) => {
    const [internalOpen, setInternalOpen] = useState(() => defaultOpen);
    const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
    const contentRef = useRef(null);

    const toggle = () => {
        const next = !isOpen;
        setInternalOpen(next);
        onOpenChange?.(next);
    };

    return (
        <div className={cn('rounded-2xl border border-border-subtle dark:border-border-subtle-dark bg-surface-light dark:bg-surface-dark overflow-hidden', className)}>
            <div
                role="button"
                tabIndex={0}
                onClick={toggle}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        toggle();
                    }
                }}
                className={cn(
                    'w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark',
                    headerClassName,
                )}
                aria-expanded={isOpen}
            >
                <span className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">{title}</span>
                <Motion.span
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="inline-flex shrink-0"
                >
                    <AppIcon name={icon} className="text-text-faint-light dark:text-text-faint-dark text-[20px]" />
                </Motion.span>
            </div>
            <AnimatePresence initial={false}>
                {isOpen && (
                    <Motion.div
                        initial={{ opacity: 0, scaleY: 0.98 }}
                        animate={{ opacity: 1, scaleY: 1 }}
                        exit={{ opacity: 0, scaleY: 0.98 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className="origin-top overflow-hidden"
                    >
                        <div ref={contentRef} className={cn('px-4 pb-4', contentClassName)}>
                            {children}
                        </div>
                    </Motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default WatermelonDisclosure;
