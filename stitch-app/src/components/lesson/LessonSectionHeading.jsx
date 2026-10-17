import React from 'react';
import AppIcon from '../AppIcon';
import { SECTION_ROLE_LABELS } from '../../lib/lessonView';

// The step title, with a small label naming what the section does
// ("Example", "Common mistake"...). Core sections have no label.
const ROLE_TONE = {
    steps: 'lesson-role-steps',
    example: 'lesson-role-example',
    misconception: 'lesson-role-misconception',
    practice: 'lesson-role-practice',
};

export default function LessonSectionHeading({ id, title, role = 'core' }) {
    const roleLabel = SECTION_ROLE_LABELS[role];
    return (
        <div className="lesson-section-heading">
            {roleLabel ? (
                <p className={`lesson-role-label ${ROLE_TONE[role]}`}>
                    <AppIcon name={roleLabel.icon} className="text-[14px]" aria-hidden="true" />
                    {roleLabel.label}
                </p>
            ) : null}
            <h2
                id={id}
                className="font-display text-display-sm font-bold tracking-[-0.02em] text-text-primary md:text-display-md"
            >
                {title}
            </h2>
        </div>
    );
}
