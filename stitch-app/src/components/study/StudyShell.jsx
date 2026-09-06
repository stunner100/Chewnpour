import React from 'react';
import { AnimatePresence, m as Motion, useReducedMotion } from 'motion/react';

/**
 * Study-mode layout: quiet top bar, a centered reading column (~680-760px),
 * and one contextual rail (notes or AI tutor) docked on the right. The rail
 * takes real layout space, so the lesson shifts left and stays fully visible.
 * On mobile those tools keep their existing full-screen sheets.
 */
const StudyShell = ({
    topBar,
    tutorOpen = false,
    tutor = null,
    notesOpen = false,
    notes = null,
    children,
}) => {
    const reduceMotion = useReducedMotion();
    const rail = notesOpen && notes ? notes : tutorOpen && tutor ? tutor : null;
    const railKey = notesOpen ? 'notes-rail' : 'tutor-rail';
    const railLabel = notesOpen ? 'Notes' : 'AI Tutor';

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
                    {rail ? (
                        <Motion.aside
                            key={railKey}
                            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 32 }}
                            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 32 }}
                            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                            className="sticky top-20 mr-4 hidden h-[calc(100dvh-6rem)] w-[380px] max-w-[38vw] shrink-0 overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-sm md:mr-6 lg:block"
                            aria-label={railLabel}
                        >
                            {rail}
                        </Motion.aside>
                    ) : null}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default StudyShell;
