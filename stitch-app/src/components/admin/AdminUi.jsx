import React from 'react';
import { TABS } from '../../lib/admin/constants';
import { formatNumber } from '../../lib/admin/formatters';
import AppIcon from '../AppIcon';

export const TabBar = ({ activeTab, onTabChange }) => (
    <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface p-1 shadow-sm">
        <div className="flex min-w-max gap-1">
            {TABS.map((tab) => (
                <button
                    key={tab.key}
                    type="button"
                    onClick={() => onTabChange(tab.key)}
                    className={`flex items-center gap-2 rounded-lg px-3.5 py-2.5 font-label-md text-label-md transition-colors whitespace-nowrap ${
                        activeTab === tab.key
                            ? 'bg-primary-soft text-primary shadow-sm'
                            : 'text-text-muted hover:bg-surface-soft hover:text-text-primary'
                    }`}
                >
                    <AppIcon name={tab.icon} className="text-[18px]" />
                    {tab.label}
                </button>
            ))}
        </div>
    </div>
);

export const StatCard = ({ label, value, sublabel, icon, color = 'primary' }) => {
    const bgMap = {
        primary: 'bg-primary-soft text-primary',
        emerald: 'bg-success-soft text-success',
        amber: 'bg-warning-soft text-warning',
        rose: 'bg-error-soft text-error',
        blue: 'bg-info-soft text-info',
    };
    return (
        <div className="rounded-xl border border-border-subtle bg-surface p-space-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <p className="font-label-xs text-label-xs uppercase tracking-wider text-text-muted">
                        {label}
                    </p>
                    <p className="mt-space-2 font-headline-sm text-headline-sm text-text-primary truncate">
                        {typeof value === 'string' ? value : formatNumber(value)}
                    </p>
                    {sublabel ? (
                        <p className="mt-space-1 font-body-sm text-body-sm text-text-muted">{sublabel}</p>
                    ) : null}
                </div>
                <div className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${bgMap[color] || bgMap.primary}`}>
                    <AppIcon name={icon} className="text-[22px]" />
                </div>
            </div>
        </div>
    );
};

export const StatRow = ({ label, value, detail }) => (
    <div className="flex items-center justify-between gap-3 py-2">
        <span className="text-sm text-text-secondary">{label}</span>
        <div className="text-right">
            <span className="text-sm font-bold text-text-primary">{value}</span>
            {detail ? <span className="ml-2 text-xs text-text-muted">{detail}</span> : null}
        </div>
    </div>
);

export const BarChart = ({ items, maxValue }) => {
    const max = maxValue || Math.max(...items.map((i) => Number(i.value) || 0), 1);
    return (
        <div className="flex items-end gap-2" style={{ height: 120 }}>
            {items.map((item) => {
                const pct = Math.max(((Number(item.value) || 0) / max) * 100, 2);
                return (
                    <div key={item.label} className="flex flex-col items-center flex-1 min-w-0">
                        <span className="text-xs font-semibold text-text-primary mb-1">
                            {formatNumber(item.value)}
                        </span>
                        <div
                            className="w-full rounded-t-lg bg-primary/80 transition-all"
                            style={{ height: `${pct}%` }}
                        />
                        <span className="mt-1.5 text-[10px] text-text-muted truncate w-full text-center">
                            {item.label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

export const SectionCard = ({ title, badge, children }) => (
    <section className="rounded-xl border border-border-subtle bg-surface p-space-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="font-body-base text-body-base font-bold text-text-primary">{title}</h2>
            {badge ? (
                <span className="font-label-xs text-label-xs text-text-muted">{badge}</span>
            ) : null}
        </div>
        {children}
    </section>
);
