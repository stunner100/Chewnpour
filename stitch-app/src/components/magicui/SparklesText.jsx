import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

const Sparkle = ({ delay, duration, x, y, size }) => (
    <Motion.svg
        initial={{ opacity: 0, scale: 0.95, rotate: 0 }}
        animate={{ opacity: [0, 1, 0], scale: [0.95, 1, 0.95], rotate: [0, 180, 360] }}
        transition={{ duration, delay, repeat: Infinity, repeatDelay: duration * 1.5 }}
        className="absolute pointer-events-none"
        style={{ left: x, top: y, width: size, height: size }}
        viewBox="0 0 24 24"
        fill="none"
    >
        <path
            d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z"
            fill="currentColor"
            className="text-primary"
        />
    </Motion.svg>
);

export const SparklesText = ({
    children,
    className,
    sparklesCount = 4,
}) => {
    const ref = useRef(null);
    const [sparkles, setSparkles] = useState([]);

    const generateSparkles = useCallback(() => {
        if (!ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        const newSparkles = Array.from({ length: sparklesCount }, (_, i) => ({
            id: `${Date.now()}-${i}`,
            x: Math.random() * rect.width,
            y: Math.random() * rect.height * 0.8,
            size: Math.random() * 8 + 6,
            delay: Math.random() * 2,
            duration: Math.random() * 1.5 + 1,
        }));
        setSparkles(newSparkles);
    }, [sparklesCount]);

    useEffect(() => {
        generateSparkles();
        const interval = setInterval(generateSparkles, 4000);
        return () => clearInterval(interval);
    }, [generateSparkles]);

    return (
        <span ref={ref} className={cn('relative inline-block', className)}>
            {sparkles.map((s) => (
                <Sparkle key={s.id} {...s} />
            ))}
            <span className="relative z-10">{children}</span>
        </span>
    );
};

export default SparklesText;
