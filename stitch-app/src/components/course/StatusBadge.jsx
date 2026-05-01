import React from 'react';

const STATUS_CONFIG = {
    not_started: {
        label: 'Not started',
        icon: 'radio_button_unchecked',
        className:
            'bg-zinc-100 text-zinc-600 dark:bg-zinc-800/40 dark:text-zinc-300 border-zinc-200/60 dark:border-zinc-700/40',
    },
    ready: {
        label: 'Ready',
        icon: 'play_arrow',
        className:
            'bg-primary/10 text-primary border-primary/20 dark:bg-primary/15',
    },
    in_progress: {
        label: 'In progress',
        icon: 'pending',
        className:
            'bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-900/20 dark:text-amber-300',
    },
    completed: {
        label: 'Completed',
        icon: 'check_circle',
        className:
            'bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-900/25 dark:text-emerald-300',
    },
    pending: {
        label: 'Generating',
        icon: 'hourglass_top',
        className:
            'bg-slate-100 text-slate-700 border-slate-200/60 dark:bg-slate-800/40 dark:text-slate-300',
    },
};

const StatusBadge = ({ status = 'not_started', className = '' }) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.not_started;
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

export default StatusBadge;
