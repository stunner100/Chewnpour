import React from 'react';

const STATUS_CONFIG = {
    ready: {
        label: 'Ready',
        icon: 'check_circle',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-900/25 dark:text-emerald-300 dark:border-emerald-800/40',
    },
    pending: {
        label: 'Queued',
        icon: 'hourglass_top',
        className: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700/40',
    },
    running: {
        label: 'Generating',
        icon: 'graphic_eq',
        className: 'bg-primary-50 text-primary-700 border-primary-200/60 dark:bg-primary-900/25 dark:text-primary-300 dark:border-primary-800/40',
    },
    failed: {
        label: 'Failed',
        icon: 'error',
        className: 'bg-rose-50 text-rose-700 border-rose-200/60 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800/40',
    },
    not_generated: {
        label: 'Not generated',
        icon: 'graphic_eq',
        className: 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800/40 dark:text-zinc-300 dark:border-zinc-700/40',
    },
};

const PodcastStatusBadge = ({ status = 'not_generated', className = '' }) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.not_generated;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${config.className} ${className}`}>
            <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>{config.icon}</span>
            {config.label}
        </span>
    );
};

export default PodcastStatusBadge;
