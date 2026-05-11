import React, { useMemo } from 'react';
import { AnimatePresence, LazyMotion, domAnimation, m } from 'motion/react';
import { cn } from '../../lib/utils';

const MotionDiv = m.div;

export const AnimatedList = ({
    children,
    className,
}) => {
    const childrenArray = useMemo(
        () => React.Children.toArray(children),
        [children],
    );

    return (
        <div className={cn(className)}>
            <LazyMotion features={domAnimation}>
                <AnimatePresence>
                    {childrenArray.map((item, index) => (
                        <MotionDiv
                            key={item.key}
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{
                                duration: 0.4,
                                delay: index * 0.08,
                                ease: [0.16, 1, 0.3, 1],
                            }}
                            className="w-full"
                        >
                            {item}
                        </MotionDiv>
                    ))}
                </AnimatePresence>
            </LazyMotion>
        </div>
    );
};

export const AnimatedListItem = ({ children, className }) => {
    return (
        <div className={cn('w-full', className)}>
            {children}
        </div>
    );
};

export default AnimatedList;
