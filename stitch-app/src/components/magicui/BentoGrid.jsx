import React from 'react';
import { cn } from '../../lib/utils';

export const BentoGrid = ({ children, className }) => {
    return (
        <div
            className={cn(
                'grid w-full auto-rows-[18rem] grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4',
                className,
            )}
        >
            {children}
        </div>
    );
};

export const BentoCard = ({
    children,
    className,
    colSpan = 1,
    rowSpan = 1,
    background,
}) => {
    const colSpanClasses = {
        1: 'col-span-1',
        2: 'sm:col-span-2',
        3: 'sm:col-span-2 lg:col-span-3',
    }[colSpan] || 'col-span-1';

    const rowSpanClasses = {
        1: 'row-span-1',
        2: 'row-span-2',
    }[rowSpan] || 'row-span-1';

    return (
        <div
            className={cn(
                'group relative flex flex-col overflow-hidden rounded-2xl border border-border-subtle dark:border-border-subtle-dark bg-surface-light dark:bg-surface-dark transition-all duration-300 hover:shadow-elevated',
                colSpanClasses,
                rowSpanClasses,
                className,
            )}
        >
            {background && (
                <div className="absolute inset-0 pointer-events-none opacity-60 group-hover:opacity-100 transition-opacity duration-500">
                    {background}
                </div>
            )}
            <div className="relative z-10 flex h-full flex-col">
                {children}
            </div>
        </div>
    );
};

export default BentoGrid;
