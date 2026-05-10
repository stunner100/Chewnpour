import React, { useState, useCallback, useEffect } from 'react';
import { motion as Motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

export const WatermelonCarousel = ({
    children,
    className,
    autoPlay = false,
    interval = 5000,
    loop = true,
    showDots = true,
    showArrows = true,
}) => {
    const slides = React.Children.toArray(children);
    const [index, setIndex] = useState(0);
    const [direction, setDirection] = useState(0);

    const goTo = useCallback((i, dir = 1) => {
        if (i < 0) {
            setDirection(-1);
            setIndex(loop ? slides.length - 1 : 0);
        } else if (i >= slides.length) {
            setDirection(1);
            setIndex(loop ? 0 : slides.length - 1);
        } else {
            setDirection(dir);
            setIndex(i);
        }
    }, [loop, slides.length]);

    const next = useCallback(() => goTo(index + 1, 1), [goTo, index]);
    const prev = useCallback(() => goTo(index - 1, -1), [goTo, index]);

    useEffect(() => {
        if (!autoPlay || slides.length <= 1) return undefined;
        const timer = setInterval(next, interval);
        return () => clearInterval(timer);
    }, [autoPlay, interval, next, slides.length]);

    if (slides.length === 0) return null;

    const variants = {
        enter: (dir) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
        center: { x: 0, opacity: 1 },
        exit: (dir) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 0 }),
    };

    return (
        <div className={cn('relative overflow-hidden rounded-2xl', className)}>
            <div className="relative aspect-[16/9] overflow-hidden">
                <AnimatePresence initial={false} custom={direction} mode="popLayout">
                    <Motion.div
                        key={index}
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute inset-0"
                    >
                        {slides[index]}
                    </Motion.div>
                </AnimatePresence>
            </div>

            {showArrows && slides.length > 1 && (
                <>
                    <button
                        type="button"
                        onClick={prev}
                        className="absolute left-3 top-1/2 -translate-y-1/2 size-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors backdrop-blur-sm z-10"
                        aria-label="Previous slide"
                    >
                        <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                    </button>
                    <button
                        type="button"
                        onClick={next}
                        className="absolute right-3 top-1/2 -translate-y-1/2 size-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors backdrop-blur-sm z-10"
                        aria-label="Next slide"
                    >
                        <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                    </button>
                </>
            )}

            {showDots && slides.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
                    {slides.map((_, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => goTo(i, i > index ? 1 : -1)}
                            className={cn(
                                'h-1.5 rounded-full transition-all duration-300',
                                i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/70',
                            )}
                            aria-label={`Go to slide ${i + 1}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default WatermelonCarousel;
