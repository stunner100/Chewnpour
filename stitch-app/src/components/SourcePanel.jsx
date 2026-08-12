import React, { useCallback, useEffect, useRef, useState } from 'react';
import AppIcon from './AppIcon';
import { useSidePanelA11y } from '../hooks/useSidePanelA11y';

const SourcePanel = ({ open, onClose, passages }) => {
    const [isClosing, setIsClosing] = useState(false);
    const panelRef = useRef(null);
    const closeButtonRef = useRef(null);
    useSidePanelA11y({
        open: open || isClosing,
        containerRef: panelRef,
        initialFocusRef: closeButtonRef,
    });

    const handleClose = useCallback(() => {
        setIsClosing(true);
        setTimeout(() => {
            setIsClosing(false);
            onClose();
        }, 200);
    }, [onClose]);

    useEffect(() => {
        if (!open) return undefined;
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') handleClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open, handleClose]);

    if (!open && !isClosing) return null;

    return (
        <>
            <button
                type="button"
                aria-label="Close sources panel"
                className={`fixed inset-0 z-[55] border-0 bg-black/30 p-0 md:bg-transparent md:pointer-events-none lg:hidden transition-opacity duration-200 ${isClosing ? 'opacity-0' : 'opacity-100'}`}
                onClick={handleClose}
            />

            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="topic-sources-title"
                className={`fixed inset-0 z-[60] md:inset-x-auto md:right-0 md:top-0 md:bottom-0 md:w-[420px]
                bg-surface-light dark:bg-surface-dark border-l border-border-light dark:border-border-dark
                flex flex-col overflow-hidden
                ${isClosing ? 'animate-panel-slide-right md:animate-panel-slide-right' : 'animate-panel-slide-up md:animate-panel-slide-left'}
            `}
            >
                <div className="flex h-14 shrink-0 items-center justify-between border-b border-border-light px-4 dark:border-border-dark">
                    <div className="flex items-center gap-2">
                        <AppIcon name="link" className="text-[18px] text-primary" />
                        <h3 id="topic-sources-title" className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">Sources</h3>
                    </div>
                    <button
                        ref={closeButtonRef}
                        type="button"
                        onClick={handleClose}
                        className="btn-icon size-8"
                        aria-label="Close sources panel"
                    >
                        <AppIcon name="close" className="text-[18px]" />
                    </button>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                    {!passages || passages.length === 0 ? (
                        <div className="py-12 text-center">
                            <AppIcon name="source" className="mb-3 block text-[32px] text-text-faint-light dark:text-text-faint-dark" />
                            <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">
                                No source passages available for this topic.
                            </p>
                        </div>
                    ) : (
                        passages.map((passage, i) => (
                            <div key={passage.passageId || i} className="card-flat space-y-2 p-4">
                                <div className="flex items-center gap-2">
                                    <span className="badge badge-primary gap-1">
                                        <AppIcon name="description" className="text-[10px]" />
                                        Page {passage.page}
                                    </span>
                                    {passage.sectionHint && (
                                        <span className="truncate text-caption text-text-faint-light dark:text-text-faint-dark">
                                            {passage.sectionHint}
                                        </span>
                                    )}
                                </div>
                                <p className="text-caption leading-relaxed text-text-sub-light dark:text-text-sub-dark">
                                    {passage.text}
                                </p>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </>
    );
};

export default SourcePanel;
