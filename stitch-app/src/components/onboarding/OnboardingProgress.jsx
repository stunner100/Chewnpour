import React from 'react';
import { motion as Motion } from 'motion/react';

const ACCENT = 'rgb(145, 75, 241)';
const INACTIVE = 'rgba(255,255,255,0.1)';

export const OnboardingProgress = ({ step = 1, total = 3 }) => {
    return (
        <div className="flex gap-2" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={total}>
            {Array.from({ length: total }, (_, i) => {
                const isFilled = i < step;
                return (
                    <div
                        key={i}
                        className="h-1 flex-1 rounded-full overflow-hidden"
                        style={{ background: INACTIVE }}
                    >
                        <Motion.div
                            initial={false}
                            animate={{
                                scaleX: isFilled ? 1 : 0,
                                opacity: isFilled ? 1 : 0,
                            }}
                            transition={{
                                duration: 0.5,
                                ease: [0.16, 1, 0.3, 1],
                                delay: isFilled ? i * 0.08 : 0,
                            }}
                            style={{
                                background: ACCENT,
                                height: '100%',
                                width: '100%',
                                transformOrigin: 'left',
                            }}
                        />
                    </div>
                );
            })}
        </div>
    );
};

export default OnboardingProgress;
