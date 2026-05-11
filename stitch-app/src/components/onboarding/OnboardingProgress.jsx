import React from 'react';
import { m as Motion } from 'motion/react';

const ACCENT = 'rgb(145, 75, 241)';
const INACTIVE = 'rgba(255,255,255,0.1)';

export const OnboardingProgress = ({ step = 1, total = 3 }) => {
    const parsedTotal = Number(total);
    const totalSegments = Number.isFinite(parsedTotal) ? Math.floor(parsedTotal) : 1;
    const normalizedTotal = Math.max(1, totalSegments);
    const parsedStep = Number(step);
    const currentStep = Number.isFinite(parsedStep) ? Math.floor(parsedStep) : 1;
    const normalizedStep = Math.min(Math.max(1, currentStep), normalizedTotal);

    return (
        <div
            className="flex gap-2"
            role="progressbar"
            aria-label="Onboarding progress"
            aria-valuenow={normalizedStep}
            aria-valuemin={1}
            aria-valuemax={normalizedTotal}
        >
            {Array.from({ length: normalizedTotal }, (_, stepIndex) => {
                const stepKey = `step-${stepIndex + 1}`;
                const isFilled = stepIndex < normalizedStep;
                return (
                    <div
                        key={stepKey}
                        className="h-1 flex-1 rounded-full overflow-hidden"
                        style={{ background: INACTIVE }}
                    >
                        <Motion.div
                            initial={{ scaleX: 0, opacity: 0 }}
                            animate={{
                                scaleX: isFilled ? 1 : 0,
                                opacity: isFilled ? 1 : 0,
                            }}
                            transition={{
                                duration: 0.5,
                                ease: [0.16, 1, 0.3, 1],
                                delay: isFilled ? stepIndex * 0.08 : 0,
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
