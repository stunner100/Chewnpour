import React, { useState, useEffect } from 'react';

const SourcePanel = ({ open, onClose, passages }) => {
    const [isClosing, setIsClosing] = useState(false);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            setIsClosing(false);
            onClose();
        }, 200);
    };

    useEffect(() => {
        if (!open) setIsClosing(false);
    }, [open]);

    if (!open) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 z-[55] bg-black/30 md:bg-transparent md:pointer-events-none lg:hidden transition-opacity duration-200 ${isClosing ? 'opacity-0' : 'opacity-100'}`}
                onClick={handleClose}
            />

            {/* Panel */}
            <div className={`fixed inset-0 z-[60] md:inset-x-auto md:right-0 md:top-0 md:bottom-0 md:w-[420px] lg:relative lg:z-auto lg:w-80
                bg-surface-light dark:bg-surface-dark border-l border-border-light dark:border-border-dark
                flex flex-col overflow-hidden
                ${isClosing ? 'animate-panel-slide-right md:animate-panel-slide-right' : 'animate-panel-slide-up md:animate-panel-slide-left'}
            `}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 h-14 border-b border-border-light dark:border-border-dark shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-primary">link</span>
                        <h3 className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">Sources</h3>
                    </div>
                    <button onClick={handleClose} className="btn-icon w-8 h-8">
                        <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {!passages || passages.length === 0 ? (
                        <div className="text-center py-12">
                            <span className="material-symbols-outlined text-[32px] text-text-faint-light dark:text-text-faint-dark mb-3 block">source</span>
                            <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">
                                No source passages available for this topic.
                            </p>
                        </div>
                    ) : (
                        passages.map((passage, i) => (
                            <div key={passage.passageId || i} className="card-flat p-4 space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="badge badge-primary gap-1">
                                        <span className="material-symbols-outlined text-[10px]">description</span>
                                        Page {passage.page}
                                    </span>
                                    {passage.sectionHint && (
                                        <span className="text-caption text-text-faint-light dark:text-text-faint-dark truncate">
                                            {passage.sectionHint}
                                        </span>
                                    )}
                                </div>
                                <p className="text-caption text-text-sub-light dark:text-text-sub-dark leading-relaxed">
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
