import React from 'react';
import { m as Motion, useReducedMotion } from 'motion/react';

const EMPTY_OBJECT = {};

const ACCENT = 'rgb(145, 75, 241)';
const BASE = 'rgba(255,255,255,0.05)';
const HIGHLIGHT = 'rgba(255,255,255,0.10)';

const shimmerStyle = {
    background: `linear-gradient(90deg, ${BASE} 0%, ${HIGHLIGHT} 50%, ${BASE} 100%)`,
    backgroundSize: '200% 100%',
};

const shimmerAnimate = {
    backgroundPosition: ['200% 0%', '-200% 0%'],
};

const shimmerTransition = {
    duration: 1.6,
    ease: 'linear',
    repeat: Infinity,
};

export const WatermelonSkeleton = ({
    width = '100%',
    height = 16,
    rounded = 8,
    className = '',
    style = EMPTY_OBJECT,
}) => {
    const shouldReduceMotion = useReducedMotion();

    return (
        <Motion.div
            className={className}
            style={{
                width,
                height,
                borderRadius: rounded,
                ...shimmerStyle,
                backgroundPosition: shouldReduceMotion ? '0% 0%' : undefined,
                ...style,
            }}
            animate={shouldReduceMotion ? undefined : shimmerAnimate}
            transition={shouldReduceMotion ? undefined : shimmerTransition}
        />
    );
};

export const WatermelonSkeletonCard = ({ children, className = '', style = EMPTY_OBJECT }) => (
    <div
        className={className}
        style={{
            background: 'rgba(39,40,41,0.6)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 16,
            padding: 20,
            ...style,
        }}
    >
        {children}
    </div>
);

export const WatermelonSkeletonStat = ({ label }) => (
    <WatermelonSkeletonCard>
        <WatermelonSkeleton width={88} height={11} rounded={6} />
        <div style={{ height: 10 }} />
        <WatermelonSkeleton width={120} height={28} rounded={8} />
        {label && (
            <>
                <div style={{ height: 8 }} />
                <WatermelonSkeleton width={64} height={10} rounded={6} />
            </>
        )}
    </WatermelonSkeletonCard>
);

export const WatermelonSkeletonList = ({ rows = 4 }) => (
    <div className="flex flex-col gap-3">
        {Array.from({ length: rows }, (_, row) => `row-${row}`).map((rowKey) => (
            <WatermelonSkeletonCard key={rowKey} style={{ padding: 16 }}>
                <div className="flex items-center gap-3">
                    <WatermelonSkeleton width={42} height={42} rounded={12} />
                    <div className="flex-1">
                        <WatermelonSkeleton width="60%" height={13} />
                        <div style={{ height: 8 }} />
                        <WatermelonSkeleton width="40%" height={11} />
                    </div>
                    <WatermelonSkeleton width={56} height={22} rounded={11} />
                </div>
            </WatermelonSkeletonCard>
        ))}
    </div>
);

export const WatermelonSkeletonGrid = ({ tiles = 4, columns = 'sm:grid-cols-2 lg:grid-cols-4' }) => (
    <div className={`grid grid-cols-1 ${columns} gap-3`}>
        {Array.from({ length: tiles }, (_, tile) => `tile-${tile}`).map((tileKey) => (
            <WatermelonSkeletonStat key={tileKey} label />
        ))}
    </div>
);

export const WatermelonSkeletonPulse = ({ size = 12, color = ACCENT }) => {
    const shouldReduceMotion = useReducedMotion();

    return (
        <Motion.span
            style={{
                display: 'inline-block',
                width: size,
                height: size,
                borderRadius: '50%',
                background: color,
            }}
            animate={shouldReduceMotion ? undefined : { scale: [1, 1.4, 1], opacity: [0.7, 1, 0.7] }}
            transition={shouldReduceMotion ? undefined : { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        />
    );
};

export default WatermelonSkeleton;
