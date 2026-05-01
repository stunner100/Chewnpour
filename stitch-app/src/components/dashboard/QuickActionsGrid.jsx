import React from 'react';
import { Link } from 'react-router-dom';

const ACTION_GRADIENTS = {
    primary: 'from-primary-500 to-primary-700',
    teal: 'from-teal-500 to-cyan-600',
    amber: 'from-amber-500 to-orange-500',
    emerald: 'from-emerald-500 to-emerald-700',
    rose: 'from-rose-500 to-pink-600',
    indigo: 'from-indigo-500 to-violet-600',
};

const QuickActionCard = ({ action }) => {
    const Tag = action.onClick ? 'button' : Link;
    const tagProps = action.onClick
        ? { type: 'button', onClick: action.onClick }
        : { to: action.to };

    return (
        <Tag
            {...tagProps}
            className="group relative overflow-hidden rounded-2xl border border-border-subtle dark:border-border-subtle-dark bg-surface-light dark:bg-surface-dark p-4 text-left hover:border-primary/30 hover:shadow-card-hover transition-all"
        >
            <div className={`absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${ACTION_GRADIENTS[action.color] || ACTION_GRADIENTS.primary} opacity-10 group-hover:opacity-20 transition-opacity`} aria-hidden="true" />
            <div className="relative flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${ACTION_GRADIENTS[action.color] || ACTION_GRADIENTS.primary} flex items-center justify-center shrink-0 shadow-md`}>
                    <span className="material-symbols-outlined text-white text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>{action.icon}</span>
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">{action.label}</span>
                        {action.badge && <span className="text-[10px] font-bold uppercase tracking-wider text-primary">{action.badge}</span>}
                    </div>
                    <p className="text-caption text-text-faint-light dark:text-text-faint-dark mt-0.5 line-clamp-2 hidden sm:block">{action.description}</p>
                </div>
                <span className="material-symbols-outlined text-[18px] text-text-faint-light dark:text-text-faint-dark group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0">
                    arrow_forward
                </span>
            </div>
        </Tag>
    );
};

const QuickActionsGrid = ({ actions = [] }) => {
    if (actions.length === 0) return null;
    return (
        <section className="space-y-3 animate-fade-in-up animate-delay-250">
            <h2 className="text-display-sm text-text-main-light dark:text-text-main-dark">Quick actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {actions.map((action) => (
                    <QuickActionCard key={action.id} action={action} />
                ))}
            </div>
        </section>
    );
};

export { QuickActionCard };
export default QuickActionsGrid;
