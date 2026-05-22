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

export const OverviewPanel = ({ snapshot, totals, activeUsersDays, newUsersDays, flags }) => {
    const exam = snapshot.examAnalytics || {};
    const concept = snapshot.conceptAnalytics || {};
    const revenue = snapshot.revenueAnalytics || {};
    const engagement = snapshot.engagementAnalytics || {};
    const content = snapshot.contentAnalytics || {};
    const llmUsage = snapshot.llmUsageAnalytics || {};
    const llmTrackedSince = llmUsage.firstTrackedAt
        ? `Tracked since ${formatDateTime(llmUsage.firstTrackedAt)}`
        : 'Tracked from first qualifying AI request';

    return (
        <div className="space-y-4">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
                <StatCard
                    label={`New users (${newUsersDays}d)`}
                    value={totals.newUsersLastWindow}
                    sublabel={`Trend: ${formatTrend(totals.newUsersLastWindow, totals.newUsersPrevWindow)}`}
                    icon="person_add"
                />
                <StatCard
                    label={`Active users (${activeUsersDays}d)`}
                    value={totals.activeUsersLastWindow}
                    sublabel={`Trend: ${formatTrend(totals.activeUsersLastWindow, totals.activeUsersPrevWindow)}`}
                    icon="bolt"
                />
                <StatCard
                    label="Active (5m)"
                    value={totals.activeUsersLast5Minutes}
                    sublabel={flags.activeSessionsTruncated ? 'Heartbeat in last 5m (sessions partial)' : 'Heartbeat in last 5m'}
                    icon="group"
                    color="emerald"
                />
                <StatCard
                    label="Premium users"
                    value={totals.premiumUsersActive}
                    sublabel={`${formatNumber(totals.premiumUsersTotal)} premium total`}
                    icon="workspace_premium"
                    color="amber"
                />
                <StatCard
                    label="Docs processed"
                    value={totals.documentsProcessedTotal}
                    sublabel={`${formatNumber(totals.documentsProcessedLastWindow)} in last ${activeUsersDays}d`}
                    icon="description"
                    color="blue"
                />
                <StatCard
                    label={`LLM tokens (${activeUsersDays}d)`}
                    value={totals.llmTokensLastWindow}
                    sublabel={`${formatNumber(totals.llmTrackedUsers)} users • ${llmTrackedSince}`}
                    icon="token"
                    color="blue"
                />
                <StatCard
                    label="Hist. token est."
                    value={totals.llmHistoricalEstimatedTokensTotal}
                    sublabel={`${formatNumber(totals.llmHistoricalEstimatedTokensLastWindow)} in last ${activeUsersDays}d • ${formatNumber(totals.llmHistoricalEstimatedUsers)} users`}
                    icon="history"
                    color="amber"
                />
            </section>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    label="Total revenue"
                    value={formatCurrency(revenue.totalRevenueMinor, revenue.currency)}
                    sublabel={`${formatNumber(revenue.totalSuccessfulPayments)} payments`}
                    icon="payments"
                    color="emerald"
                />
                <StatCard
                    label="Exam attempts"
                    value={exam.totalAttempts}
                    sublabel={`Avg score: ${formatPercent(exam.averageScorePercent)}`}
                    icon="quiz"
                />
                <StatCard
                    label="Courses created"
                    value={content.totalCourses}
                    sublabel={`${formatNumber(content.totalTopics)} topics`}
                    icon="library_books"
                    color="blue"
                />
                <StatCard
                    label="Onboarding rate"
                    value={formatPercent(engagement.onboardingCompletionRate)}
                    sublabel={`${formatNumber(engagement.onboardingCompletedCount)} of ${formatNumber(totals.userProfiles)} completed`}
                    icon="check_circle"
                    color="emerald"
                />
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
                <SectionCard title="Quick Stats">
                    <div className="divide-y divide-border-subtle">
                        <StatRow label="Total users" value={formatNumber(totals.userProfiles)} />
                        <StatRow label="Concept practice attempts" value={formatNumber(concept.totalAttempts)} detail={`Avg ${formatPercent(concept.averageScorePercent)}`} />
                        <StatRow label="Voice mode users" value={formatNumber(engagement.voiceModeEnabledCount)} />
                        <StatRow label="Avg study hours" value={engagement.averageTotalStudyHours || '0'} />
                        <StatRow label="Avg streak days" value={engagement.averageStreakDays || '0'} />
                        <StatRow label="Humanizer uses" value={formatNumber(engagement.totalHumanizerUsage)} detail={`${formatNumber(engagement.humanizerUsageLastWindow)} last ${activeUsersDays}d`} />
                    </div>
                </SectionCard>

                <SectionCard title="Feedback Overview">
                    <div className="divide-y divide-border-subtle">
                        <StatRow label="Total feedback" value={formatNumber(totals.feedbackTotal)} detail={`${formatNumber(totals.feedbackLastWindow)} last ${activeUsersDays}d`} />
                        <StatRow label="With messages" value={formatNumber(totals.feedbackWithMessageTotal)} detail={`${formatNumber(totals.feedbackWithMessageLastWindow)} last ${activeUsersDays}d`} />
                        <StatRow label="Average rating" value={`${totals.averageFeedbackRating || 0}/5`} />
                        <StatRow label="Payment conversion" value={formatPercent(revenue.conversionRate)} detail={`${formatNumber(revenue.failedPayments)} failed`} />
                    </div>
                </SectionCard>
            </section>
        </div>
    );
};
