import React, { useEffect, useRef } from 'react';
import { useInView, useMotionValue, useSpring } from 'motion/react';
import { cn } from '../../lib/utils';

export const NumberTicker = ({
    value,
    direction = 'up',
    delay = 0,
    decimalPlaces = 0,
    className,
    suffix = '',
    prefix = '',
}) => {
    const ref = useRef(null);
    const motionValue = useMotionValue(direction === 'down' ? value : 0);
    const springValue = useSpring(motionValue, {
        damping: 60,
        stiffness: 100,
    });
    const isInView = useInView(ref, { once: true, margin: '0px' });

    useEffect(() => {
        if (!isInView) return undefined;
        const timer = window.setTimeout(() => {
            motionValue.set(direction === 'down' ? 0 : value);
        }, delay * 1000);
        return () => window.clearTimeout(timer);
    }, [motionValue, isInView, delay, value, direction]);

    useEffect(() => {
        const node = ref.current;
        if (!node) return undefined;
        const unsubscribe = springValue.on('change', (latest) => {
            node.textContent = `${prefix}${Intl.NumberFormat('en-US', {
                minimumFractionDigits: decimalPlaces,
                maximumFractionDigits: decimalPlaces,
            }).format(Number(latest.toFixed(decimalPlaces)))}${suffix}`;
        });
        return () => unsubscribe();
    }, [springValue, decimalPlaces, prefix, suffix]);

    return (
        <span
            ref={ref}
            className={cn('inline-block tabular-nums tracking-wider', className)}
        >
            {`${prefix}${direction === 'down' ? value : 0}${suffix}`}
        </span>
    );
};

export default NumberTicker;
