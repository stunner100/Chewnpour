import React from 'react';
import { m as Motion } from 'motion/react';
import { cn } from '../../lib/utils';

const EMPTY_ARRAY = [];

export const WatermelonFilterGroup = ({
    label,
    options = EMPTY_ARRAY,
    value,
    onChange,
    multiple = false,
    className,
}) => {
    const isSelected = (v) => {
        if (multiple && Array.isArray(value)) return value.includes(v);
        return value === v;
    };

    const handleToggle = (v) => {
        if (multiple) {
            const current = Array.isArray(value) ? value : [];
            const next = current.includes(v) ? current.filter((x) => x !== v) : [...current, v];
            onChange?.(next);
        } else {
            onChange?.(v === value ? null : v);
        }
    };

    return (
        <div className={cn('space-y-2', className)}>
            <p className="text-caption font-semibold text-text-faint-light dark:text-text-faint-dark uppercase tracking-wider">{label}</p>
            <div className="flex flex-wrap gap-1.5">
                {options.map((option) => {
                    const selected = isSelected(option.value);
                    return (
                        <Motion.button
                            key={option.value}
                            type="button"
                            onClick={() => handleToggle(option.value)}
                            whileTap={{ scale: 0.95 }}
                            className={cn(
                                'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                                selected
                                    ? 'bg-primary text-white'
                                    : 'bg-surface-hover-light dark:bg-surface-hover-dark text-text-sub-light dark:text-text-sub-dark hover:text-text-main-light dark:hover:text-text-main-dark',
                            )}
                        >
                            {option.count !== undefined && (
                                <span className={cn('inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold', selected ? 'bg-white/20 text-white' : 'bg-border-subtle dark:bg-border-subtle-dark text-text-faint-light dark:text-text-faint-dark')}>
                                    {option.count}
                                </span>
                            )}
                            {option.label}
                        </Motion.button>
                    );
                })}
            </div>
        </div>
    );
};

export const WatermelonFilterBar = ({ children, className, onClear, hasActive }) => {
    return (
        <div className={cn('rounded-2xl border border-border-subtle dark:border-border-subtle-dark bg-surface-light dark:bg-surface-dark p-4 space-y-4', className)}>
            <div className="flex items-center justify-between">
                <p className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">Filters</p>
                {hasActive && (
                    <button
                        type="button"
                        onClick={onClear}
                        className="text-caption font-semibold text-primary hover:text-primary-hover transition-colors"
                    >
                        Clear all
                    </button>
                )}
            </div>
            {children}
        </div>
    );
};

export default { WatermelonFilterGroup, WatermelonFilterBar };
