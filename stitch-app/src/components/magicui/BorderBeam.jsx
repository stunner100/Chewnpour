import React from 'react';
import { motion as Motion } from 'motion/react';
import { cn } from '../../lib/utils';

export const BorderBeam = ({
    className,
    size = 200,
    duration = 8,
    delay = 0,
    colorFrom = '#9E7AFF',
    colorTo = '#FE8BBB',
    borderWidth = 1.5,
    transition,
}) => {
    return (
        <div
            className={cn(
                'pointer-events-none absolute inset-0 rounded-[inherit] border-transparent [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]',
                className,
            )}
            style={{ borderWidth: `${borderWidth}px` }}
        >
            <Motion.div
                className="absolute aspect-square"
                style={{
                    width: size,
                    offsetPath: `rect(0 auto auto 0 round ${size}px)`,
                    background: `linear-gradient(to left, ${colorFrom}, ${colorTo}, transparent)`,
                }}
                initial={{ offsetDistance: '0%' }}
                animate={{ offsetDistance: '100%' }}
                transition={
                    transition ?? {
                        duration,
                        ease: 'linear',
                        repeat: Infinity,
                        delay: -delay,
                    }
                }
            />
        </div>
    );
};

export default BorderBeam;
