import React from 'react';
import { cn } from '../../lib/utils';

export const AnimatedCircularProgressBar = ({
    max = 100,
    min = 0,
    value = 0,
    gaugePrimaryColor = '#914bf1',
    gaugeSecondaryColor = 'rgba(145, 75, 241, 0.15)',
    className,
    size = 120,
    strokeWidth = 10,
    showValue = true,
    label,
}) => {
    const safeMax = Math.max(max - min, 1);
    const percent = Math.min(100, Math.max(0, ((value - min) / safeMax) * 100));
    const circumference = 100 * 2 * Math.PI;
    const center = 50;

    return (
        <div
            className={cn(
                'relative size-40 text-2xl font-semibold',
                className,
            )}
            style={{
                width: `${size}px`,
                height: `${size}px`,
                transform: 'translateZ(0)',
            }}
        >
            <svg
                fill="none"
                className="size-full"
                strokeWidth={strokeWidth}
                viewBox="0 0 100 100"
                role="progressbar"
                aria-valuenow={Math.round(percent)}
                aria-valuemin={0}
                aria-valuemax={100}
            >
                {percent <= 90 && (
                    <circle
                        cx={center}
                        cy={center}
                        r="45"
                        strokeWidth={strokeWidth}
                        strokeDashoffset="0"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="opacity-100"
                        style={{
                            stroke: gaugeSecondaryColor,
                            strokeDasharray: `${90 - percent}px ${circumference}px`,
                            transform:
                                `rotate(${90 + (5 * 3.6) + (3.6 * percent)}deg)`,
                            transformOrigin: '50px 50px',
                            transition:
                                'stroke-dasharray 1s ease, transform 1s ease, stroke 1s ease',
                        }}
                    />
                )}
                <circle
                    cx={center}
                    cy={center}
                    r="45"
                    strokeWidth={strokeWidth}
                    strokeDashoffset="0"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="opacity-100"
                    style={{
                        stroke: gaugePrimaryColor,
                        strokeDasharray: `${percent * 2.827}px ${circumference}px`,
                        transition:
                            'stroke-dasharray 1s ease, transform 1s ease, stroke 1s ease',
                        transform:
                            'rotate(-90deg)',
                        transformOrigin: '50px 50px',
                    }}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                {showValue && (
                    <span
                        className="text-2xl font-bold leading-none"
                        style={{
                            color: gaugePrimaryColor,
                            transition: 'color 1s ease',
                        }}
                    >
                        {Math.round(percent)}%
                    </span>
                )}
                {label && (
                    <span className="mt-1 text-[11px] font-medium text-text-faint-light dark:text-text-faint-dark uppercase tracking-wider">
                        {label}
                    </span>
                )}
            </div>
        </div>
    );
};

export default AnimatedCircularProgressBar;
