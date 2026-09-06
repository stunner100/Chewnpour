import React from 'react';
import { m as Motion, useReducedMotion } from 'motion/react';

/**
 * Study-mode layout: quiet top bar, a centered reading column (~680-760px),
 * and an optional contextual AI tutor rail on desktop. When the rail opens,
 * the lesson column shifts left instead of being covered. On mobile the tutor
 * keeps its existing full-screen sheet (rendered by TopicChatPanel).
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
            <div className="flex items-start justify-center gap-10 px-4 py-6 md:px-6 md:py-10">
                <Motion.div
                    className="w-full max-w-[720px] min-w-0"
                    initial={false}
                    animate={{ opacity: 1 }}
                    transition={{ duration: reduceMotion ? 0 : 0.2 }}
                >
                    {children}
                </Motion.div>
                {tutorOpen && tutor ? (
                    <Motion.aside
                        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 24 }}
                        animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}
                        className="sticky top-20 hidden h-[calc(100dvh-6.5rem)] w-[380px] max-w-[40vw] shrink-0 overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-sm lg:block"
                        aria-label="AI Tutor"
                    >
                        {tutor}
                    </Motion.aside>
                ) : null}
            </div>
        </div>
    );
};

export default StudyShell;
