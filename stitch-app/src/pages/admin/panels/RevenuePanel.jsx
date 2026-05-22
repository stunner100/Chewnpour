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

export const RevenuePanel = ({
    snapshot,
    activeUsersDays,
    handleReconcilePayment,
    billingActionError,
    billingActionMessage,
    reconcilingReferences,
}) => {
    const revenue = snapshot.revenueAnalytics || {};
    const sub = snapshot.subscriptionAnalytics || {};
    const billing = snapshot.billingRecovery || {};
    const planBreakdown = Array.isArray(sub.planBreakdown) ? sub.planBreakdown : [];
    const unresolvedPayments = Array.isArray(billing.unresolvedPayments) ? billing.unresolvedPayments : [];

    return (
        <div className="space-y-4">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    label="Total revenue"
                    value={formatCurrency(revenue.totalRevenueMinor, revenue.currency)}
                    sublabel={`${formatNumber(revenue.totalSuccessfulPayments)} successful payments`}
                    icon="payments"
                    color="emerald"
                />
                <StatCard
                    label={`Revenue (${activeUsersDays}d)`}
                    value={formatCurrency(revenue.revenueLastWindowMinor, revenue.currency)}
                    sublabel={`${formatNumber(revenue.paymentsLastWindow)} payments`}
                    icon="trending_up"
                />
                <StatCard
                    label="Conversion rate"
                    value={formatPercent(revenue.conversionRate)}
                    sublabel={`${formatNumber(revenue.failedPayments)} failed payments`}
                    icon="conversion_path"
                    color="amber"
                />
                <StatCard
                    label="Voice generations"
                    value={formatNumber(sub.totalVoiceGenerations)}
                    sublabel="Total AI voice uses"
                    icon="graphic_eq"
                    color="blue"
                />
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
                <SectionCard title="Plan Breakdown">
                    {planBreakdown.length > 0 ? (
                        <div className="space-y-3">
                            {planBreakdown.map((p) => (
                                <div key={p.plan} className="space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-sm font-semibold text-text-primary capitalize">{p.plan}</span>
                                        <span className="text-xs text-text-muted">{formatNumber(p.count)} ({formatPercent(p.percent)})</span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-surface-soft">
                                        <div
                                            className="h-full rounded-full bg-primary transition-all"
                                            style={{ width: `${Math.max(0, Math.min(Number(p.percent) || 0, 100))}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-text-muted">No subscription data yet.</p>
                    )}
                </SectionCard>

                <SectionCard title="Upload Credits">
                    <div className="divide-y divide-border-subtle">
                        <StatRow label="Purchased credits" value={formatNumber(sub.totalPurchasedCredits)} />
                        <StatRow label="Consumed credits" value={formatNumber(sub.totalConsumedCredits)} />
                        <StatRow
                            label="Utilization"
                            value={sub.totalPurchasedCredits > 0 ? formatPercent((sub.totalConsumedCredits / sub.totalPurchasedCredits) * 100) : '0%'}
                        />
                    </div>
                </SectionCard>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
                <SectionCard title="Billing Recovery">
                    <div className="divide-y divide-border-subtle">
                        <StatRow label="Unresolved payments" value={formatNumber(billing.unresolvedCount)} detail={`${formatNumber(billing.verifyErrorCount)} verify errors`} />
                        <StatRow label="Awaiting retry" value={formatNumber(billing.unresolvedInitializedCount)} detail={`${formatNumber(billing.alertedCount)} alerted`} />
                        <StatRow label="Recovered payments" value={formatNumber(billing.recoveredPaymentsTotal)} detail={`${formatNumber(billing.recoveredPaymentsLastWindow)} last ${activeUsersDays}d`} />
                    </div>
                </SectionCard>

                <SectionCard title="Billing Ops">
                    {billingActionMessage ? (
                        <p className="mb-3 rounded-xl border border-success/20 bg-success-soft px-3 py-2 text-sm text-success">
                            {billingActionMessage}
                        </p>
                    ) : null}
                    {billingActionError ? (
                        <p className="mb-3 rounded-xl border border-error/20 bg-error-soft px-3 py-2 text-sm text-error">
                            {billingActionError}
                        </p>
                    ) : null}
                    <p className="text-sm text-text-secondary">
                        Successful stale Paystack payments are auto-reconciled. Anything still listed below can be retried from here.
                    </p>
                </SectionCard>
            </section>

            <SectionCard title="Unresolved Payments" badge={`${formatNumber(unresolvedPayments.length)} shown`}>
                {unresolvedPayments.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="border-b border-border-subtle">
                                    <th className="px-3 py-2 text-left font-semibold text-text-muted">Email</th>
                                    <th className="px-3 py-2 text-left font-semibold text-text-muted">Reference</th>
                                    <th className="px-3 py-2 text-left font-semibold text-text-muted">Amount</th>
                                    <th className="px-3 py-2 text-left font-semibold text-text-muted">State</th>
                                    <th className="px-3 py-2 text-left font-semibold text-text-muted">Age</th>
                                    <th className="px-3 py-2 text-left font-semibold text-text-muted">Verified</th>
                                    <th className="px-3 py-2 text-left font-semibold text-text-muted">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {unresolvedPayments.map((payment) => {
                                    const isLoading = Boolean(reconcilingReferences[payment.reference]);
                                    return (
                                        <tr key={payment.reference} className="border-b border-border-subtle">
                                            <td className="p-3 text-text-primary">
                                                <div className="font-semibold">{payment.customerEmail || 'Unknown user'}</div>
                                                {payment.userId ? (
                                                    <div className="text-xs text-text-muted">{payment.userId}</div>
                                                ) : null}
                                            </td>
                                            <td className="p-3 text-text-secondary">
                                                <div className="max-w-[260px] truncate" title={payment.reference}>{payment.reference}</div>
                                                {payment.verificationMessage ? (
                                                    <div className="mt-1 text-xs text-text-muted">{payment.verificationMessage}</div>
                                                ) : null}
                                            </td>
                                            <td className="p-3 text-text-secondary">{formatCurrency(payment.amountMinor, payment.currency)}</td>
                                            <td className="p-3">
                                                <div className="flex flex-col gap-1">
                                                    <span className="inline-flex w-fit rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning">
                                                        {formatTokenLabel(payment.status)}
                                                    </span>
                                                    <span className="text-xs text-text-muted">
                                                        {formatTokenLabel(payment.verificationStatus)} • {formatNumber(payment.verificationAttempts)} tries
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-3 text-text-secondary">{formatRelativeHours(payment.ageHours)}</td>
                                            <td className="p-3 text-text-secondary">{formatDateTime(payment.lastVerifiedAt)}</td>
                                            <td className="p-3">
                                                <button
                                                    type="button"
                                                    onClick={() => handleReconcilePayment(payment.reference)}
                                                    disabled={isLoading}
                                                    className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50"
                                                >
                                                    {isLoading ? 'Reconciling...' : 'Reconcile now'}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-sm text-text-muted">No unresolved payment references right now.</p>
                )}
            </SectionCard>
        </div>
    );
};
