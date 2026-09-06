import React from 'react';
import { AnimatePresence, m as Motion, useReducedMotion } from 'motion/react';

/**
 * Study-mode layout: quiet top bar, a centered reading column (~680-760px),
 * and an optional contextual AI tutor rail docked on the right of a full-width
 * row. When the rail opens it takes real layout space, so the centered lesson
 * shifts slightly left and stays fully visible. On mobile the tutor keeps its
 * existing full-screen sheet (rendered by TopicChatPanel).
 */
const StudyShell = ({
    topBar,
    tutorOpen = false,
    tutor = null,
    children,
}) => {
    const reduceMotion = useReducedMotion();

    return (
        <div className="min-h-[calc(100dvh-4rem)] bg-background-light text-text-primary">
            {topBar}
            <div className="flex items-start">
                <div className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-10">
                    <div className="mx-auto w-full max-w-[720px]">
                        {children}
                    </div>
                </div>

                <AnimatePresence initial={false}>
                    {tutorOpen && tutor ? (
                        <Motion.aside
                            key="tutor-rail"
                            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 32 }}
                            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 32 }}
                            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                            className="sticky top-20 mr-4 hidden h-[calc(100dvh-6rem)] w-[380px] max-w-[38vw] shrink-0 overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-sm md:mr-6 lg:block"
                            aria-label="AI Tutor"
                        >
                            {tutor}
                        </Motion.aside>
                    ) : null}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default StudyShell;
