import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion as Motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

export const WatermelonCombobox = ({
    options = [],
    value,
    onChange,
    placeholder = 'Search...',
    className,
    icon = 'search',
    emptyMessage = 'No results found.',
}) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const inputRef = useRef(null);
    const containerRef = useRef(null);

    const selectedOption = options.find((o) => o.value === value);

    const filtered = useMemo(() => {
        if (!query.trim()) return options;
        const q = query.toLowerCase();
        return options.filter((o) => o.label.toLowerCase().includes(q) || o.keywords?.some((k) => k.toLowerCase().includes(q)));
    }, [options, query]);

    useEffect(() => {
        if (!open) return undefined;
        const handleClick = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
            }
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

    const handleSelect = (v) => {
        onChange?.(v);
        setQuery('');
        setOpen(false);
    };

    return (
        <div ref={containerRef} className={cn('relative', className)}>
            <button
                type="button"
                onClick={() => {
                    setOpen(!open);
                    if (!open) {
                        setTimeout(() => inputRef.current?.focus(), 50);
                    }
                }}
                className={cn(
                    'w-full flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left transition-colors',
                    open
                        ? 'border-primary bg-primary-50 dark:bg-primary-900/15'
                        : 'border-border-subtle dark:border-border-subtle-dark bg-surface-light dark:bg-surface-dark hover:border-primary/30',
                )}
            >
                <span className="material-symbols-outlined text-[18px] text-text-faint-light dark:text-text-faint-dark">{icon}</span>
                <span className={cn('flex-1 text-sm', selectedOption ? 'text-text-main-light dark:text-text-main-dark font-medium' : 'text-text-faint-light dark:text-text-faint-dark')}>
                    {selectedOption?.label || placeholder}
                </span>
                <Motion.span
                    animate={{ rotate: open ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="material-symbols-outlined text-[18px] text-text-faint-light dark:text-text-faint-dark shrink-0"
                >
                    expand_more
                </Motion.span>
            </button>

            <AnimatePresence>
                {open && (
                    <Motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.2 }}
                        className="absolute z-50 mt-1.5 w-full rounded-xl border border-border-subtle dark:border-border-subtle-dark bg-surface-light dark:bg-surface-dark shadow-elevated overflow-hidden"
                    >
                        <div className="p-2 border-b border-border-subtle dark:border-border-subtle-dark">
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Type to search..."
                                className="w-full rounded-lg bg-surface-hover-light dark:bg-surface-hover-dark px-3 py-2 text-sm text-text-main-light dark:text-text-main-dark placeholder:text-text-faint-light dark:placeholder:text-text-faint-dark focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                        </div>
                        <div className="max-h-[240px] overflow-y-auto py-1">
                            {filtered.length === 0 ? (
                                <p className="px-3 py-2 text-sm text-text-faint-light dark:text-text-faint-dark text-center">{emptyMessage}</p>
                            ) : (
                                filtered.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => handleSelect(option.value)}
                                        className={cn(
                                            'w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors',
                                            option.value === value
                                                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary font-medium'
                                                : 'text-text-sub-light dark:text-text-sub-dark hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark hover:text-text-main-light dark:hover:text-text-main-dark',
                                        )}
                                    >
                                        {option.icon && (
                                            <span className="material-symbols-outlined text-[18px] shrink-0">{option.icon}</span>
                                        )}
                                        <span className="flex-1 truncate">{option.label}</span>
                                        {option.value === value && (
                                            <span className="material-symbols-outlined text-[16px] text-primary shrink-0">check</span>
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                    </Motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default WatermelonCombobox;
