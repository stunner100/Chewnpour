import React from 'react';

const VARIANTS = {
    foundational: {
        label: 'Foundational',
        icon: 'foundation',
        className:
            'bg-primary/10 text-primary border-primary/20 dark:bg-primary/15 dark:text-primary',
    },
    'easy-win': {
        label: 'Easy win',
        icon: 'bolt',
        className:
            'bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-900/25 dark:text-emerald-300',
    },
    'needs-review': {
        label: 'Needs review',
        icon: 'flash_on',
        className:
            'bg-rose-50 text-rose-700 border-rose-200/60 dark:bg-rose-900/20 dark:text-rose-300',
    },
    advanced: {
        label: 'Advanced',
        icon: 'trending_up',
        className:
            'bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-900/20 dark:text-amber-300',
    },
    'exam-heavy': {
        label: 'Exam-heavy',
        icon: 'quiz',
        className:
            'bg-violet-50 text-violet-700 border-violet-200/60 dark:bg-violet-900/20 dark:text-violet-300',
    },
};

const MasteryBadge = ({ variant, className = '' }) => {
    const config = VARIANTS[variant];
    if (!config) return null;
    return (
        <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border ${config.className} ${className}`}
        >
            <span
                className="material-symbols-outlined text-[12px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
            >
                {config.icon}
            </span>
            {config.label}
        </span>
    );
};

export default MasteryBadge;
