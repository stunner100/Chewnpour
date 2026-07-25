import React from 'react';
import { cn } from '../../lib/utils';

export const ShimmerButton = ({
    children,
    className,
    onClick,
    disabled,
    type = 'button',
    shimmerColor = '#0D9488',
    shimmerDuration = '2.5s',
    borderRadius = '12px',
}) => {
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={cn(
                'group relative inline-flex items-center justify-center overflow-hidden',
                'cursor-pointer transition-transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed',
                className,
            )}
            style={{ borderRadius }}
        >
            {/* Shimmer gradient overlay */}
            <div
                className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_2s_infinite]"
                style={{
                    background: `linear-gradient(90deg, transparent, ${shimmerColor}40, transparent)`,
                    backgroundSize: '200% 100%',
                }}
            />
            {/* Border shimmer */}
            <div
                className="absolute inset-0 rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                    background: `linear-gradient(90deg, transparent 0%, ${shimmerColor}60 50%, transparent 100%)`,
                    backgroundSize: '200% 100%',
                    animation: `shimmer ${shimmerDuration} linear infinite`,
                    mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                    maskComposite: 'exclude',
                    WebkitMaskComposite: 'xor',
                    padding: '1.5px',
                }}
            />
            <span className="relative z-10 flex items-center gap-2">
                {children}
            </span>
        </button>
    );
};

export default ShimmerButton;
