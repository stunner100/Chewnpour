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
    const hidden = { opacity: 0 };
    const visible = { opacity: 1 };
    if (yOffset) {
        hidden.y = yOffset;
        visible.y = 0;
    }
    if (blur && blur !== '0px') {
        hidden.filter = `blur(${blur})`;
        visible.filter = 'blur(0px)';
    }

    return (
        <Motion.div
            initial={hidden}
            whileInView={inView ? visible : undefined}
            animate={!inView ? visible : undefined}
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
