import React, { useState } from 'react';
import { cn } from '../../lib/utils';

const generateStyles = (count) =>
    Array.from({ length: count }, () => ({
        top: `${Math.floor(Math.random() * 100)}%`,
        left: `${Math.floor(Math.random() * 100)}%`,
        animationDelay: `${(Math.random() * 5).toFixed(2)}s`,
        animationDuration: `${Math.floor(Math.random() * 8 + 4)}s`,
    }));

export const Meteors = ({
    number = 20,
    className,
}) => {
    const [meteorStyles] = useState(() => generateStyles(number));

    return (
        <div
            aria-hidden="true"
            className={cn('absolute inset-0 overflow-hidden pointer-events-none', className)}
        >
            {meteorStyles.map((style, idx) => (
                <span
                    key={idx}
                    className="absolute size-0.5 rotate-[215deg] animate-meteor rounded-full bg-primary shadow-[0_0_0_1px_#ffffff10]"
                    style={style}
                >
                    <div className="pointer-events-none absolute top-1/2 -z-10 h-px w-[50px] -translate-y-1/2 bg-gradient-to-r from-primary to-transparent" />
                </span>
            ))}
        </div>
    );
};

export default Meteors;
