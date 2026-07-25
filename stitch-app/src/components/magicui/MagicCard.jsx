import React, { useCallback, useRef } from 'react';
import { m as Motion, useMotionTemplate, useMotionValue } from 'motion/react';
import { cn } from '../../lib/utils';

export const MagicCard = ({
    children,
    className,
    spotlightSize = 240,
    spotlightColor = 'rgba(13, 148, 136, 0.18)',
}) => {
    const cardRef = useRef(null);
    const mouseX = useMotionValue(-spotlightSize);
    const mouseY = useMotionValue(-spotlightSize);

    const handleMouseMove = useCallback(
        (e) => {
            if (!cardRef.current) return;
            const { left, top } = cardRef.current.getBoundingClientRect();
            mouseX.set(e.clientX - left);
            mouseY.set(e.clientY - top);
        },
        [mouseX, mouseY],
    );

    const handleMouseLeave = useCallback(() => {
        mouseX.set(-spotlightSize);
        mouseY.set(-spotlightSize);
    }, [mouseX, mouseY, spotlightSize]);

    const background = useMotionTemplate`radial-gradient(${spotlightSize}px circle at ${mouseX}px ${mouseY}px, ${spotlightColor}, transparent 70%)`;

    return (
        <div
            ref={cardRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className={cn('group relative isolate', className)}
        >
            <Motion.div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{ background }}
            />
            {children}
        </div>
    );
};

export default MagicCard;
