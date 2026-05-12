import React from 'react';
import { cn } from '../../lib/utils';

export const Marquee = ({
    children,
    className,
    reverse = false,
    pauseOnHover = false,
    vertical = false,
    repeat = 4,
    duration = 30,
}) => {
    return (
        <div
            className={cn(
                'group flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,white_5%,white_95%,transparent)]',
                vertical && 'flex-col [mask-image:linear-gradient(to_bottom,transparent,white_5%,white_95%,transparent)]',
                className,
            )}
        >
            {Array.from({ length: repeat }).map((_, i) => (
                <div
                    key={i}
                    className={cn(
                        'flex shrink-0 items-center justify-around gap-4',
                        vertical && 'flex-col',
                        !pauseOnHover && 'animate-marquee',
                        pauseOnHover && 'animate-marquee group-hover:[animation-play-state:paused]',
                        reverse && 'direction-reverse',
                    )}
                    style={{
                        animationDuration: `${duration}s`,
                        animationDirection: reverse ? 'reverse' : 'normal',
                    }}
                >
                    {children}
                </div>
            ))}
        </div>
    );
};

export default Marquee;
