import React, { useReducer, useEffect } from 'react';
import { AnimatePresence, LazyMotion, domAnimation, m } from 'motion/react';
import { cn } from '../../lib/utils';
import AppIcon from '../AppIcon';

const MotionDiv = m.div;

const getSlideKey = (slide) => String(slide?.key || 'slide');

const carouselReducer = (state, action) => {
    const maxIndex = Math.max(0, action.slideCount - 1);

    if (action.type === 'goTo') {
        if (action.index < 0) {
            return {
                direction: -1,
                index: action.loop ? maxIndex : 0,
            };
        }
        if (action.index > maxIndex) {
            return {
                direction: 1,
                index: action.loop ? 0 : maxIndex,
            };
        }
        return {
            direction: action.direction,
            index: action.index,
        };
    }

    return state;
};

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
    const slideKeys = slides.map(getSlideKey);
    const [{ direction, index }, dispatchCarousel] = useReducer(carouselReducer, {
        direction: 0,
        index: 0,
    });

    const goTo = (i, dir = 1) => {
        dispatchCarousel({
            direction: dir,
            index: i,
            loop,
            slideCount: slides.length,
            type: 'goTo',
        });
    };

    const next = () => goTo(index + 1, 1);
    const prev = () => goTo(index - 1, -1);

    useEffect(() => {
        if (!autoPlay || slides.length <= 1) return undefined;
        const timer = setInterval(() => {
            dispatchCarousel({
                direction: 1,
                index: index + 1,
                loop,
                slideCount: slides.length,
                type: 'goTo',
            });
        }, interval);
        return () => clearInterval(timer);
    }, [autoPlay, index, interval, loop, slides.length]);

    if (slides.length === 0) return null;

    const variants = {
        enter: (dir) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
        center: { x: 0, opacity: 1 },
        exit: (dir) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 0 }),
    };

    return (
        <div className={cn('relative overflow-hidden rounded-2xl', className)}>
            <div className="relative aspect-[16/9] overflow-hidden">
                <LazyMotion features={domAnimation}>
                    <AnimatePresence initial={false} custom={direction} mode="popLayout">
                        <MotionDiv
                            key={slideKeys[index]}
                            custom={direction}
                            variants={variants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                            className="absolute inset-0"
                        >
                            {slides[index]}
                        </MotionDiv>
                    </AnimatePresence>
                </LazyMotion>
            </div>

            {showArrows && slides.length > 1 && (
                <>
                    <button
                        type="button"
                        onClick={prev}
                        className="absolute left-3 top-1/2 -translate-y-1/2 size-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors backdrop-blur-sm z-10"
                        aria-label="Previous slide"
                    >
                        <AppIcon name="chevron_left" className="text-[18px]" />
                    </button>
                    <button
                        type="button"
                        onClick={next}
                        className="absolute right-3 top-1/2 -translate-y-1/2 size-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors backdrop-blur-sm z-10"
                        aria-label="Next slide"
                    >
                        <AppIcon name="chevron_right" className="text-[18px]" />
                    </button>
                </>
            )}

            {showDots && slides.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
                    {slideKeys.map((slideKey, i) => (
                        <button
                            key={slideKey}
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
