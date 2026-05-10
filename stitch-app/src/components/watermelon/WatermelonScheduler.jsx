import React, { useMemo } from 'react';
import { motion as Motion } from 'motion/react';
import { cn } from '../../lib/utils';

const PRIORITY_DOT = {
    high: 'bg-rose-500',
    medium: 'bg-amber-500',
    low: 'bg-emerald-500',
};

const PRIORITY_BORDER = {
    high: 'border-rose-200 dark:border-rose-800/40',
    medium: 'border-amber-200 dark:border-amber-800/40',
    low: 'border-emerald-200 dark:border-emerald-800/40',
};

const STATUS_ICON = {
    done: 'check_circle',
    in_progress: 'hourglass_empty',
    pending: 'radio_button_unchecked',
};

const STATUS_COLOR = {
    done: 'text-emerald-500',
    in_progress: 'text-primary',
    pending: 'text-text-faint-light dark:text-text-faint-dark',
};

export const WatermelonScheduler = ({
    items = [],
    className,
    onItemClick,
}) => {
    const grouped = useMemo(() => {
        const map = new Map();
        for (const item of items) {
            const time = item.time || 'Anytime';
            if (!map.has(time)) map.set(time, []);
            map.get(time).push(item);
        }
        return Array.from(map.entries());
    }, [items]);

    return (
        <div className={cn('space-y-4', className)}>
            {items.length === 0 ? (
                <div className="text-center py-8">
                    <span className="material-symbols-outlined text-[36px] text-text-faint-light dark:text-text-faint-dark">calendar_month</span>
                    <p className="mt-2 text-body-sm text-text-sub-light dark:text-text-sub-dark">No items scheduled</p>
                </div>
            ) : (
                grouped.map(([time, groupItems], groupIdx) => (
                    <div key={time} className="relative">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="size-8 rounded-lg bg-surface-hover-light dark:bg-surface-hover-dark flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-[16px] text-text-faint-light dark:text-text-faint-dark">schedule</span>
                            </div>
                            <span className="text-caption font-semibold text-text-faint-light dark:text-text-faint-dark uppercase tracking-wider">{time}</span>
                        </div>
                        <div className="relative pl-4 border-l-2 border-border-subtle dark:border-border-subtle-dark space-y-2">
                            {groupItems.map((item, idx) => (
                                <Motion.div
                                    key={item.id}
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: groupIdx * 0.1 + idx * 0.05, duration: 0.3 }}
                                    className={cn(
                                        'group relative flex items-center gap-3 rounded-xl border p-3.5 cursor-pointer transition-all hover:shadow-sm',
                                        item.status === 'done'
                                            ? 'bg-surface-hover-light dark:bg-surface-hover-dark border-border-subtle dark:border-border-subtle-dark opacity-60'
                                            : `bg-surface-light dark:bg-surface-dark ${PRIORITY_BORDER[item.priority] || PRIORITY_BORDER.medium} hover:border-primary/40`,
                                    )}
                                    onClick={() => onItemClick?.(item)}
                                >
                                    <span className={cn('material-symbols-outlined text-[20px] shrink-0', STATUS_COLOR[item.status] || STATUS_COLOR.pending)} style={{ fontVariationSettings: item.status === 'done' ? "'FILL' 1" : undefined }}>
                                        {STATUS_ICON[item.status] || STATUS_ICON.pending}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className={cn(
                                            'text-body-sm font-semibold truncate',
                                            item.status === 'done' ? 'line-through text-text-faint-light dark:text-text-faint-dark' : 'text-text-main-light dark:text-text-main-dark',
                                        )}>
                                            {item.title}
                                        </p>
                                        {item.subtitle && (
                                            <p className="text-caption text-text-sub-light dark:text-text-sub-dark mt-0.5 truncate">{item.subtitle}</p>
                                        )}
                                    </div>
                                    <span className={cn('size-2 rounded-full shrink-0', PRIORITY_DOT[item.priority] || PRIORITY_DOT.medium)} />
                                </Motion.div>
                            ))}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};

export default WatermelonScheduler;
