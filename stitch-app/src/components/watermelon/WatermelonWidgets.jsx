import React from 'react';
import { m as Motion } from 'motion/react';
import { cn } from '../../lib/utils';

export const WatermelonWidget = ({
    title,
    value,
    subtitle,
    icon,
    trend,
    trendValue,
    accent = 'primary',
    className,
    children,
}) => {
    const accentMap = {
        primary: 'from-primary-500 to-primary-700 text-primary',
        emerald: 'from-emerald-500 to-emerald-700 text-emerald-500',
        amber: 'from-amber-500 to-orange-500 text-amber-500',
        rose: 'from-rose-500 to-pink-600 text-rose-500',
        indigo: 'from-indigo-500 to-violet-600 text-indigo-500',
        teal: 'from-teal-500 to-cyan-600 text-teal-500',
    }[accent] || accentMap.primary;

    const trendIcon = trend === 'up' ? 'trending_up' : trend === 'down' ? 'trending_down' : null;
    const trendColor = trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-red-500' : 'text-text-faint-light dark:text-text-faint-dark';

    return (
        <Motion.div
            whileHover={{ y: -2 }}
            transition={{ duration: 0.2 }}
            className={cn(
                'relative overflow-hidden rounded-2xl border border-border-subtle dark:border-border-subtle-dark bg-surface-light dark:bg-surface-dark p-5',
                className,
            )}
        >
            <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${accentMap} opacity-[0.07] blur-2xl`} />
            <div className="relative">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <p className="text-caption text-text-faint-light dark:text-text-faint-dark uppercase tracking-wider font-semibold">{title}</p>
                        <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-2xl font-bold text-text-main-light dark:text-text-main-dark">{value}</span>
                            {trend && trendValue && (
                                <span className={cn('inline-flex items-center gap-0.5 text-caption font-semibold', trendColor)}>
                                    <span className="material-symbols-outlined text-[14px]">{trendIcon}</span>
                                    {trendValue}
                                </span>
                            )}
                        </div>
                        {subtitle && <p className="text-caption text-text-sub-light dark:text-text-sub-dark mt-0.5">{subtitle}</p>}
                    </div>
                    {icon && (
                        <div className={cn('w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0 shadow-sm', accentMap)}>
                            <span className="material-symbols-outlined text-white text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                        </div>
                    )}
                </div>
                {children && <div className="mt-3">{children}</div>}
            </div>
        </Motion.div>
    );
};

export const WatermelonWidgetsGrid = ({ children, className, cols = 3 }) => {
    const colClasses = {
        1: 'grid-cols-1',
        2: 'grid-cols-1 sm:grid-cols-2',
        3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    }[cols] || 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

    return (
        <div className={cn('grid gap-3', colClasses, className)}>
            {children}
        </div>
    );
};

export default { WatermelonWidget, WatermelonWidgetsGrid };
