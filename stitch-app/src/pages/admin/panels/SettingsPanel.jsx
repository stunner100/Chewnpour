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

export const SettingsPanel = ({
    adminEmails,
    handleAddAdminEmail,
    handleRemoveAdminEmail,
    newAdminEmail,
    setNewAdminEmail,
    adminActionLoading,
    adminActionError,
    paymentProviderConfig,
    paymentProviderDraft,
    setPaymentProviderDraft,
    handleSavePaymentProvider,
}) => (
    <div className="space-y-4">
        <SectionCard title="Payment Provider" badge="Fallback mode available">
            <p className="text-sm text-text-secondary">
                Choose how checkouts are handled when top-up is started.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {(
                    Array.isArray(paymentProviderConfig?.options) && paymentProviderConfig.options.length > 0
                        ? paymentProviderConfig.options
                        : PAYMENT_PROVIDER_FALLBACK_OPTIONS
                ).map((option) => {
                    const isSelected = paymentProviderDraft === option.id;
                    return (
                        <button
                            key={option.id}
                            type="button"
                            onClick={() => setPaymentProviderDraft(option.id)}
                            className={`rounded-2xl border p-4 text-left transition-colors ${
                                isSelected
                                    ? 'border-primary bg-primary/8'
                                    : 'border-border-subtle bg-surface hover:border-primary/40'
                            }`}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-bold text-text-primary">
                                        {option.label}
                                    </p>
                                    <p className="mt-1 text-xs text-text-muted">
                                        {option.helpText || (option.requiresKey ? 'Requires payment API key.' : 'No API key required.')}
                                    </p>
                                </div>
                                <span
                                    className={`material-symbols-outlined text-xl ${
                                        isSelected
                                            ? 'text-primary'
                                            : 'text-text-muted'
                                    }`}
                                >
                                    {isSelected ? 'radio_button_checked' : 'radio_button_unchecked'}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>
            <form onSubmit={handleSavePaymentProvider} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="grow">
                    <p className="mt-1 text-xs text-text-muted">
                        Current: {paymentProviderConfig?.selectedLabel || paymentProviderConfig?.selected || 'Unknown'}
                        {paymentProviderConfig?.updatedAt ? ` • Updated ${formatDateTime(paymentProviderConfig.updatedAt)}` : null}
                    </p>
                    {!paymentProviderConfig ? (
                        <p className="mt-2 text-xs text-warning">
                            Dashboard settings metadata has not loaded from Convex, so the options above are using client defaults.
                        </p>
                    ) : null}
                </div>
                <button
                    type="submit"
                    disabled={adminActionLoading || !paymentProviderDraft}
                    className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-hover transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {adminActionLoading ? 'Saving...' : 'Save provider'}
                </button>
            </form>
            <p className="mt-3 text-xs text-text-muted">
                Manual mode applies top-up for the current payment amount without calling Paystack and does not require a merchant API key.
            </p>
        </SectionCard>
        <SectionCard title="Admin Access Emails" badge="Bootstrap admin: patrickannor35@gmail.com">
            <form onSubmit={handleAddAdminEmail} className="flex flex-col gap-3 sm:flex-row">
                <input
                    type="email"
                    value={newAdminEmail}
                    onChange={(event) => setNewAdminEmail(event.target.value)}
                    placeholder="admin@example.com"
                    className="w-full rounded-xl border-2 border-border-subtle bg-surface px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary"
                />
                <button
                    type="submit"
                    disabled={adminActionLoading}
                    className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-hover transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {adminActionLoading ? 'Saving...' : 'Add admin'}
                </button>
            </form>
            {adminActionError ? (
                <p className="mt-3 text-sm text-error">{adminActionError}</p>
            ) : null}
            <div className="mt-4 grid gap-2">
                {adminEmails.length === 0 ? (
                    <p className="text-sm text-text-muted">No admin emails configured.</p>
                ) : adminEmails.map((entry) => (
                    <div
                        key={entry.email}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-subtle bg-surface p-3"
                    >
                        <div>
                            <p className="font-semibold text-text-primary">{entry.email}</p>
                            <p className="text-xs text-text-muted">{(entry.sources || []).map(formatAdminSource).join(' • ')}</p>
                        </div>
                        {canRemoveAdminEmail(entry.sources) ? (
                            <button
                                type="button"
                                disabled={adminActionLoading}
                                onClick={() => handleRemoveAdminEmail(entry.email)}
                                className="inline-flex items-center justify-center rounded-lg border border-error/20 px-3 py-1.5 text-xs font-semibold text-error transition-colors hover:bg-error-soft disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                Remove
                            </button>
                        ) : (
                            <span className="text-xs text-text-muted">Managed</span>
                        )}
                    </div>
                ))}
            </div>
        </SectionCard>
    </div>
);
