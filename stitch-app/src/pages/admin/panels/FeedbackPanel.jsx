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

export const FeedbackPanel = ({
    recentFeedback,
    recentProductResearchResponses,
    campaignPerformanceReports,
    totals,
    activeUsersDays,
}) => {
    const feedbackWithMessages = recentFeedback.filter((entry) => Boolean(normalizeFeedbackMessage(entry?.message)));
    const feedbackPreview = feedbackWithMessages.slice(0, 15);
    const feedbackWithMessagesTotal = Number(totals.feedbackWithMessageTotal) || feedbackWithMessages.length;
    const researchPreview = recentProductResearchResponses.slice(0, 15);
    const campaignReports = Array.isArray(campaignPerformanceReports)
        ? campaignPerformanceReports
        : [];
    const totalCampaignSent = campaignReports.reduce(
        (sum, report) => sum + (Number(report?.sentCount) || 0),
        0,
    );
    const researchResponsesTotal = Number(
        totals.productResearchResponseTotal
        ?? totals.productResearchResponsesTotal
        ?? totals.researchResponsesTotal
    ) || recentProductResearchResponses.length;
    const researchResponsesLastWindow = Number(
        totals.productResearchResponseLastWindow
        ?? totals.productResearchResponsesLastWindow
        ?? totals.researchResponsesLastWindow
    ) || 0;

    return (
        <div className="space-y-4">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    label="Total feedback"
                    value={totals.feedbackTotal}
                    sublabel={`${formatNumber(totals.feedbackLastWindow)} in last ${activeUsersDays}d`}
                    icon="reviews"
                />
                <StatCard
                    label="With messages"
                    value={feedbackWithMessagesTotal}
                    sublabel={`${formatNumber(totals.feedbackWithMessageLastWindow)} in last ${activeUsersDays}d`}
                    icon="chat"
                    color="blue"
                />
                <StatCard
                    label="Average rating"
                    value={`${totals.averageFeedbackRating || 0}/5`}
                    icon="star"
                    color="amber"
                />
                <StatCard
                    label="Research responses"
                    value={researchResponsesTotal}
                    sublabel={`${formatNumber(researchResponsesLastWindow)} in last ${activeUsersDays}d`}
                    icon="analytics"
                    color="emerald"
                />
            </section>

            <SectionCard
                title="Campaign Performance"
                badge={`${formatNumber(campaignReports.length)} campaigns • ${formatNumber(totalCampaignSent)} sent`}
            >
                <div className="space-y-3">
                    {campaignReports.length === 0 ? (
                        <p className="text-sm text-text-muted">No campaign send data yet.</p>
                    ) : campaignReports.map((report) => {
                        const campaignId = normalizeFeedbackMessage(report?.campaignId) || 'unknown_campaign';
                        const sentCount = Number(report?.sentCount) || 0;
                        const returnedCount = Number(report?.returnedCount) || 0;
                        const uploadedCount = Number(report?.uploadedCount) || 0;
                        const activatedCount = Number(report?.activatedCount) || 0;
                        const paidCount = Number(report?.paidCount) || 0;
                        const attributedLandingCount = Number(report?.attributedLandingCount) || 0;
                        const totalAttributedLandings = Number(report?.totalAttributedLandings) || attributedLandingCount;
                        const rates = report?.rates || {};

                        return (
                            <article
                                key={campaignId}
                                className="rounded-2xl border border-border-subtle bg-surface p-4"
                            >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <p className="font-semibold text-text-primary break-all">{campaignId}</p>
                                        <p className="mt-1 text-xs text-text-muted">
                                            First sent {formatDateTime(report?.firstSentAt)} • Last sent {formatDateTime(report?.lastSentAt)}
                                        </p>
                                    </div>
                                    <span className="rounded-full bg-surface-soft px-2.5 py-1 text-xs font-semibold text-text-primary">
                                        {formatNumber(sentCount)} sent
                                    </span>
                                </div>

                                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                                    <div className="rounded-xl bg-surface-soft p-3">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Sent</p>
                                        <p className="mt-1 text-xl font-black text-text-primary">{formatNumber(sentCount)}</p>
                                    </div>
                                    <div className="rounded-xl bg-surface-soft p-3">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Returned</p>
                                        <p className="mt-1 text-xl font-black text-text-primary">{formatNumber(returnedCount)}</p>
                                        <p className="mt-1 text-xs text-text-muted">{formatRatioPercent(rates?.returned)}</p>
                                    </div>
                                    <div className="rounded-xl bg-surface-soft p-3">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Uploaded</p>
                                        <p className="mt-1 text-xl font-black text-text-primary">{formatNumber(uploadedCount)}</p>
                                        <p className="mt-1 text-xs text-text-muted">{formatRatioPercent(rates?.uploaded)}</p>
                                    </div>
                                    <div className="rounded-xl bg-surface-soft p-3">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Activated</p>
                                        <p className="mt-1 text-xl font-black text-text-primary">{formatNumber(activatedCount)}</p>
                                        <p className="mt-1 text-xs text-text-muted">{formatRatioPercent(rates?.activated)}</p>
                                    </div>
                                    <div className="rounded-xl bg-surface-soft p-3">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Paid</p>
                                        <p className="mt-1 text-xl font-black text-text-primary">{formatNumber(paidCount)}</p>
                                        <p className="mt-1 text-xs text-text-muted">{formatRatioPercent(rates?.paid)}</p>
                                    </div>
                                </div>

                                <div className="mt-4 rounded-xl border border-primary/20 bg-primary-soft p-3">
                                    <StatRow
                                        label="Attributed CTA landings"
                                        value={formatNumber(attributedLandingCount)}
                                        detail={`${formatRatioPercent(rates?.attributedLanding)} • ${formatNumber(totalAttributedLandings)} total landings`}
                                    />
                                    <StatRow
                                        label="Most recent attributed landing"
                                        value={formatDateTime(report?.lastAttributedLandingAt)}
                                    />
                                </div>
                            </article>
                        );
                    })}
                </div>
            </SectionCard>

            <SectionCard title="User Feedback" badge={`Showing ${feedbackPreview.length} of ${formatNumber(feedbackWithMessagesTotal)}`}>
                <div className="space-y-3">
                    {feedbackPreview.length === 0 ? (
                        <p className="text-sm text-text-muted">No text feedback submitted yet.</p>
                    ) : feedbackPreview.map((entry) => (
                        <article key={entry.feedbackId} className="rounded-2xl border border-border-subtle bg-surface p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <p className="font-semibold text-text-primary">{entry.email || entry.fullName || entry.userId || 'Unknown user'}</p>
                                    <p className="text-xs text-text-muted">{entry.department || ''}</p>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary font-semibold">
                                        {Number(entry.rating) > 0 ? `${entry.rating}/5` : 'No rating'}
                                    </span>
                                    <span className="text-text-muted">{formatDateTime(entry.createdAt)}</span>
                                </div>
                            </div>
                            <p className="mt-3 whitespace-pre-wrap break-words text-sm text-text-primary">
                                {normalizeFeedbackMessage(entry.message)}
                            </p>
                        </article>
                    ))}
                </div>
            </SectionCard>

            <SectionCard title="Product Research Responses" badge={`Showing ${researchPreview.length} of ${formatNumber(researchResponsesTotal)}`}>
                <div className="space-y-3">
                    {researchPreview.length === 0 ? (
                        <p className="text-sm text-text-muted">No product research responses yet.</p>
                    ) : researchPreview.map((entry, index) => {
                        const howUsing = formatResearchChoice(
                            entry?.howUsingApp
                            || entry?.howUsing
                            || entry?.usage
                        );
                        const wantedFeatures = formatResearchChoice(
                            entry?.wantedFeatures
                            || entry?.wantedFeature
                            || entry?.featureRequest
                        );
                        const notes = normalizeFeedbackMessage(
                            entry?.additionalNotes
                            || entry?.additionalNote
                            || entry?.notes
                            || entry?.note
                            || entry?.message
                        );
                        const createdAt = Number(entry?.createdAt) || 0;
                        const campaign = normalizeFeedbackMessage(entry?.campaign);
                        const cohort = normalizeFeedbackMessage(entry?.cohort);
                        const researchId = String(entry?.responseId || entry?._id || `${entry?.userId || 'unknown'}-${createdAt}-${index}`);
                        const userLabel = entry?.email || entry?.fullName || entry?.userId || 'Unknown user';

                        return (
                            <article key={researchId} className="rounded-2xl border border-border-subtle bg-surface p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <p className="font-semibold text-text-primary">{userLabel}</p>
                                        <p className="text-xs text-text-muted">{entry?.department || ''}</p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                        {campaign ? (
                                            <span className="rounded-full bg-primary-soft px-2.5 py-1 font-semibold text-primary">
                                                Campaign: {campaign}
                                            </span>
                                        ) : null}
                                        {cohort ? (
                                            <span className="rounded-full bg-success-soft px-2.5 py-1 font-semibold text-success">
                                                Cohort: {cohort}
                                            </span>
                                        ) : null}
                                        <span className="text-text-muted">{formatDateTime(createdAt)}</span>
                                    </div>
                                </div>
                                <div className="mt-3 space-y-1.5 text-sm text-text-primary">
                                    <p>
                                        <span className="font-semibold text-text-primary">How using app:</span>{' '}
                                        {howUsing || 'N/A'}
                                    </p>
                                    <p>
                                        <span className="font-semibold text-text-primary">Wanted next:</span>{' '}
                                        {wantedFeatures || 'N/A'}
                                    </p>
                                    {notes ? (
                                        <p className="whitespace-pre-wrap break-words">
                                            <span className="font-semibold text-text-primary">Notes:</span>{' '}
                                            {notes}
                                        </p>
                                    ) : null}
                                </div>
                            </article>
                        );
                    })}
                </div>
            </SectionCard>
        </div>
    );
};
