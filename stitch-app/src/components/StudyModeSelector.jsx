import React from 'react';

const MODES = [
    {
        id: 'quick_revision',
        title: 'Quick Revision',
        description: 'Big idea, key points, and a quick self-check',
        icon: 'flash_on',
        color: 'text-accent-amber',
    },
    {
        id: 'full',
        title: 'Full Lesson',
        description: 'Complete lesson with all sections',
        icon: 'auto_stories',
        color: 'text-primary',
    },
    {
        id: 'exam_prep',
        title: 'Exam Prep',
        description: 'Key ideas, common mistakes, and practice',
        icon: 'school',
        color: 'text-accent-emerald',
    },
    {
        id: 'practice_only',
        title: 'Practice Only',
        description: 'Jump straight to quick check and exams',
        icon: 'quiz',
        color: 'text-accent-purple',
    },
];

const StudyModeSelector = ({ topicTitle, onSelect, onSkip }) => {
    return (
        <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
            <div className="w-full max-w-lg">
                <div className="text-center mb-8">
                    <span className="material-symbols-outlined text-[32px] text-primary mb-3 block">menu_book</span>
                    <h2 className="text-display-sm text-text-main-light dark:text-text-main-dark mb-2">
                        How do you want to study?
                    </h2>
                    {topicTitle && (
                        <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark line-clamp-1">
                            {topicTitle}
                        </p>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {MODES.map((mode) => (
                        <button
                            key={mode.id}
                            onClick={() => onSelect(mode.id)}
                            className="card-interactive p-5 text-left flex flex-col gap-2"
                        >
                            <span className={`material-symbols-outlined text-[24px] ${mode.color}`}>
                                {mode.icon}
                            </span>
                            <span className="text-body-base font-semibold text-text-main-light dark:text-text-main-dark">
                                {mode.title}
                            </span>
                            <span className="text-caption text-text-sub-light dark:text-text-sub-dark">
                                {mode.description}
                            </span>
                        </button>
                    ))}
                </div>

                <div className="text-center mt-5">
                    <button
                        onClick={onSkip}
                        className="btn-ghost text-caption text-text-faint-light dark:text-text-faint-dark"
                    >
                        Skip — view full lesson
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StudyModeSelector;
