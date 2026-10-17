import React, { useEffect, useId, useRef } from 'react';
import AppIcon from '../AppIcon';
import { useSidePanelA11y } from '../../hooks/useSidePanelA11y';

// A small modal sheet above the lesson action bar (bottom right from sm up),
// for the lesson's contents and extra study tools. Like the lesson's side
// panels it moves focus in, traps it, and returns it on close; Escape or the
// backdrop closes it.
export default function LessonSheet({ open, onClose, title, closeLabel, className = '', children }) {
    const panelRef = useRef(null);
    const titleId = useId();
    useSidePanelA11y({ open, containerRef: panelRef });

    useEffect(() => {
        if (!open) return undefined;
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') onClose?.();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open, onClose]);

    if (!open) return null;
    return (
        <>
            <div className="fixed inset-0 z-[55] bg-black/40" aria-hidden="true" onClick={onClose} />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className={`fixed inset-x-3 z-[70] max-h-[min(70dvh,32rem)] overflow-y-auto overscroll-contain rounded-2xl border border-border-subtle bg-surface px-3 py-3 shadow-lg sm:inset-x-auto sm:right-4 ${className}`}
                style={{ bottom: 'calc(var(--lesson-action-height) + var(--safe-bottom) + 0.75rem)' }}
            >
                <div className="mb-2 flex items-center justify-between px-2">
                    <h2 id={titleId} className="text-body-sm font-semibold text-text-primary">{title}</h2>
                    <button type="button" className="btn-icon size-11" onClick={onClose} aria-label={closeLabel}>
                        <AppIcon name="close" className="text-[16px]" />
                    </button>
                </div>
                {children}
            </div>
        </>
    );
}
