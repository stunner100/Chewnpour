import React from 'react';
import { motion as Motion } from 'motion/react';

const ACCENT = 'rgb(145, 75, 241)';
const INACTIVE = 'rgba(255,255,255,0.1)';

export const OnboardingProgress = ({ step = 1, total = 3 }) => {
    const normalizedTotal = Math.max(1, Number(total) || 1);
    const normalizedStep = Math.min(Math.max(1, Number(step) || 1), normalizedTotal);

    return (
        <div
            className="flex gap-2"
            role="progressbar"
            aria-label="Onboarding progress"
            aria-valuenow={normalizedStep}
            aria-valuemin={1}
            aria-valuemax={normalizedTotal}
        >
            {Array.from({ length: normalizedTotal }, (_, i) => {
                const isFilled = i < normalizedStep;
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
