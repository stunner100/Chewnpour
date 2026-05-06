import React from 'react';
import { cn } from '../../lib/utils';

export const OrbitingCircles = ({
    className,
    children,
    reverse = false,
    duration = 20,
    delay = 10,
    radius = 80,
    path = true,
    iconSize = 32,
}) => {
    return (
        <>
            {path && (
                <svg
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 size-full"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <circle
                        className="stroke-primary/15 stroke-1 dark:stroke-primary/25"
                        cx="50%"
                        cy="50%"
                        r={radius}
                        fill="none"
                        strokeDasharray="4 4"
                    />
                </svg>
            )}
            <div
                className={cn(
                    'absolute left-1/2 top-1/2 flex items-center justify-center rounded-full border bg-background/60 backdrop-blur-sm shadow-sm',
                    'animate-orbit',
                    className,
                )}
                style={{
                    '--duration': duration,
                    '--radius': radius,
                    '--delay': `-${delay}s`,
                    '--angle': '0',
                    width: `${iconSize}px`,
                    height: `${iconSize}px`,
                    animationDuration: `${duration}s`,
                    animationDelay: `-${delay}s`,
                    animationDirection: reverse ? 'reverse' : 'normal',
                    animationIterationCount: 'infinite',
                    animationTimingFunction: 'linear',
                }}
            >
                {children}
            </div>
        </>
    );
};

export default OrbitingCircles;
