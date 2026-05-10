import React from 'react';
import { motion as Motion } from 'motion/react';
import { cn } from '../../lib/utils';

export const WatermelonChoiceChips = ({
    options = [],
    value,
    onChange,
    multiple = false,
    className,
    size = 'md',
}) => {
    const isSelected = (v) => {
        if (multiple && Array.isArray(value)) return value.includes(v);
        return value === v;
    };

    const handleClick = (v) => {
        if (multiple) {
            const current = Array.isArray(value) ? value : [];
            const next = current.includes(v) ? current.filter((x) => x !== v) : [...current, v];
            onChange?.(next);
        } else {
            onChange?.(v === value ? null : v);
        }
    };

    const sizeClasses = {
        sm: 'px-2.5 py-1 text-xs',
        md: 'px-3.5 py-1.5 text-sm',
        lg: 'px-4 py-2 text-base',
    }[size] || sizeClasses.md;

    return (
        <div className={cn('flex flex-wrap gap-2', className)} role="group">
            {options.map((option) => {
                const selected = isSelected(option.value);
                return (
                    <Motion.button
                        key={option.value}
                        type="button"
                        onClick={() => handleClick(option.value)}
                        whileTap={{ scale: 0.96 }}
                        className={cn(
                            'relative rounded-full border font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                            sizeClasses,
                            selected
                                ? 'bg-primary text-white border-primary shadow-sm'
                                : 'bg-surface-light dark:bg-surface-dark border-border-subtle dark:border-border-subtle-dark text-text-sub-light dark:text-text-sub-dark hover:border-primary/40 hover:text-text-main-light dark:hover:text-text-main-dark',
                        )}
                    >
                        {option.icon && (
                            <span className="material-symbols-outlined text-[16px] mr-1 inline-block align-text-bottom" style={{ fontVariationSettings: selected ? "'FILL' 1" : undefined }}>
                                {option.icon}
                            </span>
                        )}
                        {option.label}
                        {selected && multiple && (
                            <span className="ml-1.5 inline-flex items-center justify-center size-4 rounded-full bg-white/20 text-[10px]">
                                <span className="material-symbols-outlined text-[12px]">close</span>
                            </span>
                        )}
                    </Motion.button>
                );
            })}
        </div>
    );
};

export default WatermelonChoiceChips;
