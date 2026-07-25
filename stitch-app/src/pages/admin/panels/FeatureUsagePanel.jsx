import React from 'react';
import { Link } from 'react-router-dom';
/* eslint-disable no-unused-vars -- split admin panel formatter imports */
import {
    formatNumber,
    formatPercent,
    formatRatioPercent,
    formatDateTime,
    formatRelativeHours,
    formatTokenLabel,
    formatTrend,
    formatCurrency,
    formatMajorCurrency,
    formatDuration,
    formatSignedPercent,
    canRemoveAdminEmail,
    formatAdminSource,
    formatFileTypeLabel,
    normalizeFeedbackMessage,
    formatResearchChoice,
} from '../../../lib/admin/formatters';
import { PAYMENT_PROVIDER_FALLBACK_OPTIONS } from '../../../lib/admin/constants';
import { BarChart, SectionCard, StatCard, StatRow } from '../../../components/admin/AdminUi';
import AppIcon from '../../../components/AppIcon';

export const FeatureUsagePanel = ({ snapshot, activeUsersDays }) => {
    const usage = snapshot.featureUsageAnalytics || {};
    const features = Array.isArray(usage.features) ? usage.features : [];
    const topFeature = features[0] || null;
    const maxUses = Math.max(...features.map((feature) => Number(feature.totalUses) || 0), 1);
    const recentFeatures = features.filter((feature) => Number(feature.lastWindowUses) > 0).length;

    return (
        <div className="space-y-4">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    label="Feature events"
                    value={usage.totalUses}
                    sublabel={`${formatNumber(usage.totalLastWindowUses)} in last ${activeUsersDays}d`}
                    icon="analytics"
                />
                <StatCard
                    label="Feature users"
                    value={usage.totalUniqueUsers}
                    sublabel="Users with at least one tracked event"
                    icon="group"
                    color="emerald"
                />
                <StatCard
                    label="Active features"
                    value={recentFeatures}
                    sublabel={`Used in last ${activeUsersDays}d`}
                    icon="bolt"
                    color="blue"
                />
                <StatCard
                    label="Most used"
                    value={topFeature?.label || 'N/A'}
                    sublabel={topFeature ? `${formatNumber(topFeature.totalUses)} events • ${formatPercent(topFeature.sharePercent)}` : 'No feature data yet'}
                    icon={topFeature?.icon || 'insights'}
                    color="amber"
                />
            </section>

            <SectionCard title="Feature Usage" badge={`${formatNumber(features.length)} tracked features`}>
                {features.length > 0 ? (
                    <div className="space-y-3">
                        {features.map((feature) => {
                            const totalUses = Number(feature.totalUses) || 0;
                            const width = maxUses > 0 ? Math.max((totalUses / maxUses) * 100, 2) : 2;
                            const trend = Number(feature.trend) || 0;
                            const trendLabel = trend > 0 ? `+${formatNumber(trend)}` : formatNumber(trend);
                            return (
                                <div key={feature.key} className="rounded-2xl border border-border-subtle p-4">
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                        <div className="flex min-w-0 items-start gap-3">
                                            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                                                <AppIcon name={feature.icon || 'analytics'} className="text-[20px]" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-text-primary">{feature.label}</p>
                                                <p className="mt-1 text-xs text-text-muted">
                                                    Last used {formatDateTime(feature.lastUsedAt)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 text-right sm:grid-cols-5 lg:min-w-[560px]">
                                            <div>
                                                <p className="text-xs text-text-muted">Total</p>
                                                <p className="font-bold text-text-primary">{formatNumber(totalUses)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-text-muted">Last {activeUsersDays}d</p>
                                                <p className="font-bold text-text-primary">{formatNumber(feature.lastWindowUses)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-text-muted">Users</p>
                                                <p className="font-bold text-text-primary">{formatNumber(feature.uniqueUsers)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-text-muted">Share</p>
                                                <p className="font-bold text-text-primary">{formatPercent(feature.sharePercent)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-text-muted">Trend</p>
                                                <p className={`font-bold ${trend >= 0 ? 'text-success' : 'text-error'}`}>{trendLabel}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-soft">
                                        <div
                                            className="h-full rounded-full bg-primary transition-all"
                                            style={{ width: `${Math.max(0, Math.min(width, 100))}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-sm text-text-muted">No feature usage has been tracked yet.</p>
                )}
            </SectionCard>
        </div>
    );
};
