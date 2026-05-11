import React from 'react';
import { m as Motion } from 'motion/react';
import { cn } from '../../lib/utils';

export const BlurFade = ({
    children,
    className,
    duration = 0.4,
    delay = 0,
    yOffset = 6,
    inView = false,
    inViewMargin = '-50px',
    blur = '6px',
}) => {
    return (
        <Motion.div
            initial={{ opacity: 0, y: yOffset, filter: `blur(${blur})` }}
            whileInView={inView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : undefined}
            animate={!inView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : undefined}
            transition={{
                delay: delay,
                duration: duration,
                ease: [0.16, 1, 0.3, 1],
            }}
            viewport={inView ? { once: true, margin: inViewMargin } : undefined}
            className={cn(className)}
        >
            {children}
        </Motion.div>
    );
};

export default BlurFade;
