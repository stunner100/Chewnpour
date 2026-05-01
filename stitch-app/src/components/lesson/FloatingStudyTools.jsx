import React, { useEffect, useRef, useState } from 'react';

const FloatingStudyTools = ({ tools = [], hidden }) => {
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const handleClick = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
        };
        const handleKey = (e) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleKey);
        };
    }, [open]);

    if (hidden || tools.length === 0) return null;

    return (
        <div
            ref={wrapperRef}
            className="fixed z-30 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] right-4 flex flex-col items-end gap-2 lg:hidden"
        >
            {open && (
                <div className="rounded-2xl border border-border-subtle dark:border-border-subtle-dark bg-surface-light dark:bg-surface-dark shadow-elevated p-1.5 w-56 animate-fade-in-up">
                    {tools.map((tool) => (
                        <button
                            key={tool.id}
                            type="button"
                            onClick={() => { tool.onClick?.(); setOpen(false); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-body-sm font-medium text-text-main-light dark:text-text-main-dark hover:bg-surface-hover dark:hover:bg-surface-hover-dark transition-colors text-left"
                        >
                            <span className="material-symbols-outlined text-[18px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>{tool.icon}</span>
                            <span className="flex-1">{tool.label}</span>
                            {tool.hint && <span className="text-caption text-text-faint-light dark:text-text-faint-dark">{tool.hint}</span>}
                        </button>
                    ))}
                </div>
            )}
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="w-12 h-12 rounded-full bg-primary text-white shadow-elevated hover:bg-primary-hover transition-colors flex items-center justify-center active:scale-95"
                aria-label={open ? 'Close study tools' : 'Open study tools'}
                aria-expanded={open}
            >
                <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {open ? 'close' : 'auto_awesome'}
                </span>
            </button>
        </div>
    );
};

export default FloatingStudyTools;
