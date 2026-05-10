import React, { use, useState, createContext } from 'react';
import { motion as Motion } from 'motion/react';
import { cn } from '../../lib/utils';

const TabsContext = createContext(null);

export const WatermelonTabs = ({
    children,
    defaultValue,
    value: controlledValue,
    onValueChange,
    className,
    orientation = 'horizontal',
}) => {
    const [internalValue, setInternalValue] = useState(() => defaultValue);
    const activeValue = controlledValue !== undefined ? controlledValue : internalValue;

    const setValue = (v) => {
        setInternalValue(v);
        onValueChange?.(v);
    };

    return (
        <TabsContext.Provider value={{ value: activeValue, setValue, orientation }}>
            <div className={cn('w-full', className)} data-orientation={orientation}>
                {children}
            </div>
        </TabsContext.Provider>
    );
};

export const WatermelonTabsList = ({ children, className }) => {
    return (
        <div
            className={cn(
                'relative flex items-center gap-1 rounded-xl bg-surface-hover-light dark:bg-surface-hover-dark p-1.5',
                className,
            )}
            role="tablist"
        >
            {children}
        </div>
    );
};

export const WatermelonTabsTrigger = ({ children, value, className }) => {
    const ctx = use(TabsContext);
    if (!ctx) throw new Error('WatermelonTabsTrigger must be inside WatermelonTabs');
    const { value: activeValue, setValue } = ctx;
    const isActive = activeValue === value;

    return (
        <button
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => setValue(value)}
            className={cn(
                'relative z-10 flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                isActive
                    ? 'text-text-main-light dark:text-text-main-dark'
                    : 'text-text-faint-light dark:text-text-faint-dark hover:text-text-sub-light dark:hover:text-text-sub-dark',
                className,
            )}
        >
            {isActive && (
                <Motion.div
                    layoutId="watermelon-tab-indicator"
                    className="absolute inset-0 rounded-lg bg-surface-light dark:bg-surface-dark shadow-sm border border-border-subtle dark:border-border-subtle-dark"
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
                />
            )}
            <span className="relative z-10">{children}</span>
        </button>
    );
};

export const WatermelonTabsContent = ({ children, value, className }) => {
    const ctx = use(TabsContext);
    if (!ctx) throw new Error('WatermelonTabsContent must be inside WatermelonTabs');
    const { value: activeValue } = ctx;
    const isActive = activeValue === value;

    if (!isActive) return null;

    return (
        <Motion.div
            role="tabpanel"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className={cn('mt-4', className)}
        >
            {children}
        </Motion.div>
    );
};

export default WatermelonTabs;
