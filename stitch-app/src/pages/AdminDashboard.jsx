import React from 'react';
import { Link } from 'react-router-dom';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';

const formatNumber = (value) => new Intl.NumberFormat().format(Number(value) || 0);
const formatPercent = (value) => {
    const parsed = Number(value);
    const safe = Number.isFinite(parsed) ? parsed : 0;
    const rounded = Math.round(safe * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
};
const formatRatioPercent = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return '0%';
    const percent = parsed * 100;
    const rounded = Math.round(percent * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
};

const formatDateTime = (timestampMs) => {
    const parsed = Number(timestampMs);
    if (!Number.isFinite(parsed) || parsed <= 0) return 'N/A';
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(parsed);
};

const formatRelativeHours = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return '<1h';
    if (parsed < 24) return `${Math.round(parsed * 10) / 10}h`;
    const days = parsed / 24;
    return `${Math.round(days * 10) / 10}d`;
};

const formatTokenLabel = (value) => {
    const normalized = String(value || '').trim();
    if (!normalized) return 'Unknown';
    return normalized
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatTrend = (currentValue, previousValue) => {
    const current = Number(currentValue) || 0;
    const previous = Number(previousValue) || 0;
    const delta = current - previous;
    if (delta > 0) return `+${delta}`;
    if (delta < 0) return `${delta}`;
    return '0';
};

const formatCurrency = (amountMinor, currency = 'GHS') => {
    const major = (Number(amountMinor) || 0) / 100;
    return `${currency} ${major.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatMajorCurrency = (amountMajor, currency = 'GHS') => {
    const major = Number(amountMajor);
    if (!Number.isFinite(major) || major <= 0) return 'N/A';
    return `${currency} ${major.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDuration = (seconds) => {
    const s = Number(seconds) || 0;
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const remaining = Math.round(s % 60);
    return remaining > 0 ? `${m}m ${remaining}s` : `${m}m`;
};

const formatSignedPercent = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return '0%';
    const rounded = Math.round(parsed * 10) / 10;
    return `${rounded.toFixed(rounded % 1 === 0 ? 0 : 1)}%`;
};

const canRemoveAdminEmail = (sources) => (
    Array.isArray(sources)
    && sources.includes('db')
    && !sources.includes('bootstrap')
    && !sources.includes('env')
);

const formatAdminSource = (source) => {
    if (source === 'bootstrap') return 'Bootstrap';
    if (source === 'env') return 'Environment';
    return 'Dashboard';
};

const formatFileTypeLabel = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized || normalized === 'unknown') return 'Unknown';
    if (normalized === 'image') return 'Image';
    if (normalized === 'pdf') return 'PDF';
    if (normalized === 'docx') return 'DOCX';
    if (normalized === 'pptx') return 'PPTX';
    if (normalized === 'txt') return 'TXT';
    return normalized.toUpperCase();
};

const normalizeFeedbackMessage = (value) => (
    typeof value === 'string' ? value.trim() : ''
);
const formatResearchChoice = (value) => {
    const normalized = normalizeFeedbackMessage(value);
    if (!normalized) return '';
    return normalized
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
};

// ── Reusable Components ──

const TABS = [
    { key: 'overview', label: 'Overview', icon: 'dashboard' },
    { key: 'learning', label: 'Learning', icon: 'school' },
    { key: 'features', label: 'Features', icon: 'analytics' },
    { key: 'revenue', label: 'Revenue', icon: 'payments' },
    { key: 'content', label: 'Content', icon: 'library_books' },
    { key: 'users', label: 'Users', icon: 'group' },
    { key: 'uploads', label: 'Uploads', icon: 'cloud_upload' },
    { key: 'feedback', label: 'Feedback', icon: 'reviews' },
    { key: 'settings', label: 'Settings', icon: 'settings' },
];

const PAYMENT_PROVIDER_FALLBACK_OPTIONS = [
    {
        id: 'paystack',
        label: 'Paystack',
        requiresKey: true,
        helpText: 'Use the live Paystack checkout and webhook flow.',
    },
    {
        id: 'manual',
        label: 'Manual (no API key)',
        requiresKey: false,
        helpText: 'Skip Paystack API calls and grant credits on callback.',
    },
];

const TabBar = ({ activeTab, onTabChange }) => (
    <div className="card-base overflow-x-auto">
        <div className="flex min-w-max">
            {TABS.map((tab) => (
                <button
                    key={tab.key}
                    type="button"
                    onClick={() => onTabChange(tab.key)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                        activeTab === tab.key
                            ? 'border-primary text-primary'
                            : 'border-transparent text-text-faint-light dark:text-text-faint-dark hover:text-text-main-light dark:hover:text-text-main-dark'
                    }`}
                >
                    <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                    {tab.label}
                </button>
            ))}
        </div>
    </div>
);

const StatCard = ({ label, value, sublabel, icon, color = 'primary' }) => {
    const bgMap = {
        primary: 'bg-primary/8 text-primary',
        emerald: 'bg-accent-emerald/10 text-accent-emerald',
        amber: 'bg-accent-amber/10 text-accent-amber',
        rose: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
        blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    };
    return (
        <div className="card-base p-5">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-text-faint-light dark:text-text-faint-dark">
                        {label}
                    </p>
                    <p className="mt-2 text-3xl font-black text-text-main-light dark:text-text-main-dark truncate">
                        {typeof value === 'string' ? value : formatNumber(value)}
                    </p>
                    {sublabel ? (
                        <p className="mt-1 text-sm text-text-faint-light dark:text-text-faint-dark">{sublabel}</p>
                    ) : null}
                </div>
                <div className={`h-11 w-11 shrink-0 rounded-2xl flex items-center justify-center ${bgMap[color] || bgMap.primary}`}>
                    <span className="material-symbols-outlined">{icon}</span>
                </div>
            </div>
        </div>
    );
};

const StatRow = ({ label, value, detail }) => (
    <div className="flex items-center justify-between gap-3 py-2">
        <span className="text-sm text-text-sub-light dark:text-text-sub-dark">{label}</span>
        <div className="text-right">
            <span className="text-sm font-bold text-text-main-light dark:text-text-main-dark">{value}</span>
            {detail ? <span className="ml-2 text-xs text-text-faint-light dark:text-text-faint-dark">{detail}</span> : null}
        </div>
    </div>
);

const BarChart = ({ items, maxValue }) => {
    const max = maxValue || Math.max(...items.map((i) => Number(i.value) || 0), 1);
    return (
        <div className="flex items-end gap-2" style={{ height: 120 }}>
            {items.map((item) => {
                const pct = Math.max(((Number(item.value) || 0) / max) * 100, 2);
                return (
                    <div key={item.label} className="flex flex-col items-center flex-1 min-w-0">
                        <span className="text-xs font-semibold text-text-main-light dark:text-text-main-dark mb-1">
                            {formatNumber(item.value)}
                        </span>
                        <div
                            className="w-full rounded-t-lg bg-primary/80 transition-all"
                            style={{ height: `${pct}%` }}
                        />
                        <span className="mt-1.5 text-[10px] text-text-faint-light dark:text-text-faint-dark truncate w-full text-center">
                            {item.label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

const SectionCard = ({ title, badge, children }) => (
    <div className="card-base p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-lg font-bold text-text-main-light dark:text-text-main-dark">{title}</h2>
            {badge ? (
                <span className="text-xs text-text-faint-light dark:text-text-faint-dark">{badge}</span>
            ) : null}
        </div>
        {children}
    </div>
);

const DeniedCard = ({ reason, signedInEmail, signedInUserId }) => {
    const reasonMessage = (() => {
        if (reason === 'not_configured') {
            return 'Admin access is not configured yet. Set ADMIN_EMAILS or ADMIN_USER_IDS in environment variables.';
        }
        if (reason === 'forbidden') {
            return 'Your account is signed in but does not have admin access.';
        }
        return 'You must be signed in to access the admin dashboard.';
    })();

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark px-4 py-8 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-3xl card-base p-6 sm:p-8">
                <div className="flex items-center gap-3 text-amber-600">
                    <span className="material-symbols-outlined">lock</span>
                    <h1 className="text-xl font-bold text-text-main-light dark:text-text-main-dark">Admin access required</h1>
                </div>
                <p className="mt-3 text-sm text-text-sub-light dark:text-text-sub-dark">{reasonMessage}</p>
                <div className="mt-4 rounded-2xl border border-border-light dark:border-border-dark bg-surface-hover-light dark:bg-surface-hover-dark p-4 text-sm">
                    <p className="text-text-sub-light dark:text-text-sub-dark">
                        Signed in as: <span className="font-semibold text-text-main-light dark:text-text-main-dark">{signedInEmail || signedInUserId || 'Unknown user'}</span>
                    </p>
                </div>
                <div className="mt-6">
                    <Link
                        to="/dashboard"
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-hover transition-colors"
                    >
                        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                        Back to dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
};

// ── Tab Panels ──

const OverviewPanel = ({ snapshot, totals, activeUsersDays, newUsersDays, flags }) => {
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
                    <div className="divide-y divide-border-light dark:divide-border-dark">
                        <StatRow label="Total users" value={formatNumber(totals.userProfiles)} />
                        <StatRow label="Concept practice attempts" value={formatNumber(concept.totalAttempts)} detail={`Avg ${formatPercent(concept.averageScorePercent)}`} />
                        <StatRow label="Voice mode users" value={formatNumber(engagement.voiceModeEnabledCount)} />
                        <StatRow label="Avg study hours" value={engagement.averageTotalStudyHours || '0'} />
                        <StatRow label="Avg streak days" value={engagement.averageStreakDays || '0'} />
                        <StatRow label="Humanizer uses" value={formatNumber(engagement.totalHumanizerUsage)} detail={`${formatNumber(engagement.humanizerUsageLastWindow)} last ${activeUsersDays}d`} />
                    </div>
                </SectionCard>

                <SectionCard title="Feedback Overview">
                    <div className="divide-y divide-border-light dark:divide-border-dark">
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

const LearningPanel = ({ snapshot, activeUsersDays }) => {
    const exam = snapshot.examAnalytics || {};
    const concept = snapshot.conceptAnalytics || {};
    const scoreDistribution = Array.isArray(exam.scoreDistribution) ? exam.scoreDistribution : [];
    const topExamUsers = Array.isArray(exam.topExamUsers) ? exam.topExamUsers : [];

    return (
        <div className="space-y-4">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    label="Exam attempts"
                    value={exam.totalAttempts}
                    sublabel={`${formatNumber(exam.attemptsLastWindow)} in last ${activeUsersDays}d`}
                    icon="quiz"
                />
                <StatCard
                    label="Avg exam score"
                    value={formatPercent(exam.averageScorePercent)}
                    sublabel={`Avg time: ${formatDuration(exam.averageTimeTakenSeconds)}`}
                    icon="grade"
                    color="emerald"
                />
                <StatCard
                    label="Concept attempts"
                    value={concept.totalAttempts}
                    sublabel={`${formatNumber(concept.attemptsLastWindow)} in last ${activeUsersDays}d`}
                    icon="psychology"
                    color="blue"
                />
                <StatCard
                    label="Avg concept score"
                    value={formatPercent(concept.averageScorePercent)}
                    sublabel={`Avg time: ${formatDuration(concept.averageTimeTakenSeconds)}`}
                    icon="analytics"
                    color="amber"
                />
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
                <SectionCard title="Exam Format Split">
                    <div className="divide-y divide-border-light dark:divide-border-dark">
                        <StatRow label="Objective exams" value={formatNumber(exam.objectiveAttempts)} detail={exam.totalAttempts > 0 ? formatPercent((exam.objectiveAttempts / exam.totalAttempts) * 100) : '0%'} />
                        <StatRow label="Essay exams" value={formatNumber(exam.essayAttempts)} detail={exam.totalAttempts > 0 ? formatPercent((exam.essayAttempts / exam.totalAttempts) * 100) : '0%'} />
                    </div>
                </SectionCard>

                <SectionCard title="Score Distribution">
                    {scoreDistribution.length > 0 ? (
                        <BarChart items={scoreDistribution.map((b) => ({ label: b.label, value: b.count }))} />
                    ) : (
                        <p className="text-sm text-text-faint-light dark:text-text-faint-dark">No exam data yet.</p>
                    )}
                </SectionCard>
            </section>

            {topExamUsers.length > 0 ? (
                <SectionCard title="Top Exam Users">
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="border-b border-border-light dark:border-border-dark">
                                    <th className="px-3 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">User</th>
                                    <th className="px-3 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">Attempts</th>
                                    <th className="px-3 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">Avg Score</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topExamUsers.map((u) => (
                                    <tr key={u.userId} className="border-b border-border-light dark:border-border-dark">
                                        <td className="px-3 py-2 font-semibold text-text-main-light dark:text-text-main-dark">{u.fullName || u.userId}</td>
                                        <td className="px-3 py-2 text-text-sub-light dark:text-text-sub-dark">{formatNumber(u.attempts)}</td>
                                        <td className="px-3 py-2 text-text-sub-light dark:text-text-sub-dark">{formatPercent(u.avgScore)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </SectionCard>
            ) : null}
        </div>
    );
};

const FeatureUsagePanel = ({ snapshot, activeUsersDays }) => {
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
                                <div key={feature.key} className="rounded-2xl border border-border-light dark:border-border-dark p-4">
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                        <div className="flex min-w-0 items-start gap-3">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                                                <span className="material-symbols-outlined text-[20px]">{feature.icon || 'analytics'}</span>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-text-main-light dark:text-text-main-dark">{feature.label}</p>
                                                <p className="mt-1 text-xs text-text-faint-light dark:text-text-faint-dark">
                                                    Last used {formatDateTime(feature.lastUsedAt)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 text-right sm:grid-cols-5 lg:min-w-[560px]">
                                            <div>
                                                <p className="text-xs text-text-faint-light dark:text-text-faint-dark">Total</p>
                                                <p className="font-bold text-text-main-light dark:text-text-main-dark">{formatNumber(totalUses)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-text-faint-light dark:text-text-faint-dark">Last {activeUsersDays}d</p>
                                                <p className="font-bold text-text-main-light dark:text-text-main-dark">{formatNumber(feature.lastWindowUses)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-text-faint-light dark:text-text-faint-dark">Users</p>
                                                <p className="font-bold text-text-main-light dark:text-text-main-dark">{formatNumber(feature.uniqueUsers)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-text-faint-light dark:text-text-faint-dark">Share</p>
                                                <p className="font-bold text-text-main-light dark:text-text-main-dark">{formatPercent(feature.sharePercent)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-text-faint-light dark:text-text-faint-dark">Trend</p>
                                                <p className={`font-bold ${trend >= 0 ? 'text-accent-emerald' : 'text-rose-600 dark:text-rose-400'}`}>{trendLabel}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-hover-light dark:bg-surface-hover-dark">
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
                    <p className="text-sm text-text-faint-light dark:text-text-faint-dark">No feature usage has been tracked yet.</p>
                )}
            </SectionCard>
        </div>
    );
};

const RevenuePanel = ({
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
                                        <span className="text-sm font-semibold text-text-main-light dark:text-text-main-dark capitalize">{p.plan}</span>
                                        <span className="text-xs text-text-faint-light dark:text-text-faint-dark">{formatNumber(p.count)} ({formatPercent(p.percent)})</span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-surface-hover-light dark:bg-surface-hover-dark">
                                        <div
                                            className="h-full rounded-full bg-primary transition-all"
                                            style={{ width: `${Math.max(0, Math.min(Number(p.percent) || 0, 100))}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-text-faint-light dark:text-text-faint-dark">No subscription data yet.</p>
                    )}
                </SectionCard>

                <SectionCard title="Upload Credits">
                    <div className="divide-y divide-border-light dark:divide-border-dark">
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
                    <div className="divide-y divide-border-light dark:divide-border-dark">
                        <StatRow label="Unresolved payments" value={formatNumber(billing.unresolvedCount)} detail={`${formatNumber(billing.verifyErrorCount)} verify errors`} />
                        <StatRow label="Awaiting retry" value={formatNumber(billing.unresolvedInitializedCount)} detail={`${formatNumber(billing.alertedCount)} alerted`} />
                        <StatRow label="Recovered payments" value={formatNumber(billing.recoveredPaymentsTotal)} detail={`${formatNumber(billing.recoveredPaymentsLastWindow)} last ${activeUsersDays}d`} />
                    </div>
                </SectionCard>

                <SectionCard title="Billing Ops">
                    {billingActionMessage ? (
                        <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                            {billingActionMessage}
                        </p>
                    ) : null}
                    {billingActionError ? (
                        <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
                            {billingActionError}
                        </p>
                    ) : null}
                    <p className="text-sm text-text-sub-light dark:text-text-sub-dark">
                        Successful stale Paystack payments are auto-reconciled. Anything still listed below can be retried from here.
                    </p>
                </SectionCard>
            </section>

            <SectionCard title="Unresolved Payments" badge={`${formatNumber(unresolvedPayments.length)} shown`}>
                {unresolvedPayments.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="border-b border-border-light dark:border-border-dark">
                                    <th className="px-3 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">Email</th>
                                    <th className="px-3 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">Reference</th>
                                    <th className="px-3 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">Amount</th>
                                    <th className="px-3 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">State</th>
                                    <th className="px-3 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">Age</th>
                                    <th className="px-3 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">Verified</th>
                                    <th className="px-3 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {unresolvedPayments.map((payment) => {
                                    const isLoading = Boolean(reconcilingReferences[payment.reference]);
                                    return (
                                        <tr key={payment.reference} className="border-b border-border-light dark:border-border-dark">
                                            <td className="px-3 py-3 text-text-main-light dark:text-text-main-dark">
                                                <div className="font-semibold">{payment.customerEmail || 'Unknown user'}</div>
                                                {payment.userId ? (
                                                    <div className="text-xs text-text-faint-light dark:text-text-faint-dark">{payment.userId}</div>
                                                ) : null}
                                            </td>
                                            <td className="px-3 py-3 text-text-sub-light dark:text-text-sub-dark">
                                                <div className="max-w-[260px] truncate" title={payment.reference}>{payment.reference}</div>
                                                {payment.verificationMessage ? (
                                                    <div className="mt-1 text-xs text-text-faint-light dark:text-text-faint-dark">{payment.verificationMessage}</div>
                                                ) : null}
                                            </td>
                                            <td className="px-3 py-3 text-text-sub-light dark:text-text-sub-dark">{formatCurrency(payment.amountMinor, payment.currency)}</td>
                                            <td className="px-3 py-3">
                                                <div className="flex flex-col gap-1">
                                                    <span className="inline-flex w-fit rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                                        {formatTokenLabel(payment.status)}
                                                    </span>
                                                    <span className="text-xs text-text-faint-light dark:text-text-faint-dark">
                                                        {formatTokenLabel(payment.verificationStatus)} • {formatNumber(payment.verificationAttempts)} tries
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 text-text-sub-light dark:text-text-sub-dark">{formatRelativeHours(payment.ageHours)}</td>
                                            <td className="px-3 py-3 text-text-sub-light dark:text-text-sub-dark">{formatDateTime(payment.lastVerifiedAt)}</td>
                                            <td className="px-3 py-3">
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
                    <p className="text-sm text-text-faint-light dark:text-text-faint-dark">No unresolved payment references right now.</p>
                )}
            </SectionCard>
        </div>
    );
};

const RetrievalCandidatesTable = ({ title, rows, showPenaltyColumns = false }) => (
    <div className="rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4">
        <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-text-main-light dark:text-text-main-dark">{title}</h3>
            <span className="text-xs text-text-faint-light dark:text-text-faint-dark">{formatNumber(rows?.length || 0)} rows</span>
        </div>
        {!Array.isArray(rows) || rows.length === 0 ? (
            <p className="mt-3 text-sm text-text-faint-light dark:text-text-faint-dark">No candidates recorded.</p>
        ) : (
            <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-xs">
                    <thead>
                        <tr className="border-b border-border-light dark:border-border-dark">
                            <th className="px-2 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">Passage</th>
                            <th className="px-2 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">Page</th>
                            <th className="px-2 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">Source</th>
                            <th className="px-2 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">Final</th>
                            <th className="px-2 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">Lexical</th>
                            <th className="px-2 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">Vector</th>
                            <th className="px-2 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">Numeric</th>
                            {showPenaltyColumns ? (
                                <>
                                    <th className="px-2 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">Flag Boost</th>
                                    <th className="px-2 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">Num Penalty</th>
                                    <th className="px-2 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">Broad Penalty</th>
                                </>
                            ) : null}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={`${title}-${row.passageId}-${row.page}`} className="border-b border-border-light dark:border-border-dark align-top">
                                <td className="px-2 py-2">
                                    <p className="font-semibold text-text-main-light dark:text-text-main-dark">{row.passageId}</p>
                                    <p className="mt-1 max-w-xs text-[11px] text-text-faint-light dark:text-text-faint-dark">{row.sectionHint || 'No section hint'}</p>
                                </td>
                                <td className="px-2 py-2 text-text-sub-light dark:text-text-sub-dark">{formatNumber(row.page)}</td>
                                <td className="px-2 py-2 text-text-sub-light dark:text-text-sub-dark uppercase">{row.retrievalSource || 'n/a'}</td>
                                <td className="px-2 py-2 text-text-sub-light dark:text-text-sub-dark">{formatRatioPercent(row.finalScore)}</td>
                                <td className="px-2 py-2 text-text-sub-light dark:text-text-sub-dark">{formatRatioPercent(row.lexicalScore)}</td>
                                <td className="px-2 py-2 text-text-sub-light dark:text-text-sub-dark">{formatRatioPercent(row.vectorScore)}</td>
                                <td className="px-2 py-2 text-text-sub-light dark:text-text-sub-dark">{formatRatioPercent(row.numericAgreement)}</td>
                                {showPenaltyColumns ? (
                                    <>
                                        <td className="px-2 py-2 text-text-sub-light dark:text-text-sub-dark">{formatRatioPercent(row.preferFlagBoost)}</td>
                                        <td className="px-2 py-2 text-text-sub-light dark:text-text-sub-dark">{formatRatioPercent(row.vectorOnlyMissingNumericPenalty)}</td>
                                        <td className="px-2 py-2 text-text-sub-light dark:text-text-sub-dark">{formatRatioPercent(row.vectorOnlyBroadTopicPenalty)}</td>
                                    </>
                                ) : null}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
    </div>
);

const ContentPanel = ({
    snapshot,
    retrievalTopicId,
    setRetrievalTopicId,
    retrievalDiagnostics,
    retrievalDiagnosticsError,
    retrievalDiagnosticsLoading,
    handleDiagnoseRetrieval,
}) => {
    const content = snapshot.contentAnalytics || {};
    const documents = snapshot.documents || {};
    const questionTargetAudit = snapshot.questionTargetAudit || {};
    const latestAudit = questionTargetAudit.latestRun || null;
    const latestAuditWithRebases = questionTargetAudit.latestRunWithRebases || null;

    return (
        <div className="space-y-4">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    label="Total courses"
                    value={content.totalCourses}
                    sublabel={`${formatNumber(content.completedCourses)} completed`}
                    icon="library_books"
                />
                <StatCard
                    label="In-progress courses"
                    value={content.inProgressCourses}
                    icon="pending"
                    color="amber"
                />
                <StatCard
                    label="Topics"
                    value={content.totalTopics}
                    sublabel={`${formatNumber(content.examReadyTopics)} exam-ready`}
                    icon="topic"
                    color="blue"
                />
                <StatCard
                    label="Questions/topic"
                    value={`${content.averageObjectivePerTopic || 0} Objective / ${content.averageEssayPerTopic || 0} Essay`}
                    icon="help"
                    color="emerald"
                />
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
                <SectionCard title="Uploads">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-xl bg-surface-hover-light dark:bg-surface-hover-dark p-3">
                            <p className="text-text-faint-light dark:text-text-faint-dark">Total</p>
                            <p className="mt-1 text-xl font-bold text-text-main-light dark:text-text-main-dark">{formatNumber(documents.uploads?.total)}</p>
                        </div>
                        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3">
                            <p className="text-emerald-700 dark:text-emerald-300">Ready</p>
                            <p className="mt-1 text-xl font-bold text-emerald-700 dark:text-emerald-300">{formatNumber(documents.uploads?.ready)}</p>
                        </div>
                        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3">
                            <p className="text-amber-700 dark:text-amber-300">Processing</p>
                            <p className="mt-1 text-xl font-bold text-amber-700 dark:text-amber-300">{formatNumber(documents.uploads?.processing)}</p>
                        </div>
                        <div className="rounded-xl bg-rose-50 dark:bg-rose-900/20 p-3">
                            <p className="text-rose-700 dark:text-rose-300">Errors</p>
                            <p className="mt-1 text-xl font-bold text-rose-700 dark:text-rose-300">{formatNumber(documents.uploads?.error)}</p>
                        </div>
                    </div>
                </SectionCard>

                <SectionCard title="Assignments">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-xl bg-surface-hover-light dark:bg-surface-hover-dark p-3">
                            <p className="text-text-faint-light dark:text-text-faint-dark">Total</p>
                            <p className="mt-1 text-xl font-bold text-text-main-light dark:text-text-main-dark">{formatNumber(documents.assignments?.total)}</p>
                        </div>
                        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3">
                            <p className="text-emerald-700 dark:text-emerald-300">Ready</p>
                            <p className="mt-1 text-xl font-bold text-emerald-700 dark:text-emerald-300">{formatNumber(documents.assignments?.ready)}</p>
                        </div>
                        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3">
                            <p className="text-amber-700 dark:text-amber-300">Processing</p>
                            <p className="mt-1 text-xl font-bold text-amber-700 dark:text-amber-300">{formatNumber(documents.assignments?.processing)}</p>
                        </div>
                        <div className="rounded-xl bg-rose-50 dark:bg-rose-900/20 p-3">
                            <p className="text-rose-700 dark:text-rose-300">Errors</p>
                            <p className="mt-1 text-xl font-bold text-rose-700 dark:text-rose-300">{formatNumber(documents.assignments?.error)}</p>
                        </div>
                    </div>
                </SectionCard>
            </section>

            <SectionCard
                title="Question Target Audit"
                badge={latestAudit ? `Latest run ${formatDateTime(latestAudit.finishedAt)}` : 'No audit runs yet'}
            >
                {!latestAudit ? (
                    <p className="text-sm text-text-faint-light dark:text-text-faint-dark">No target audit has been recorded yet.</p>
                ) : (
                    <div className="space-y-4">
                        <div className="grid gap-4 lg:grid-cols-2">
                            <div className="rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4">
                                <div className="flex items-center justify-between gap-2">
                                    <h3 className="text-sm font-semibold text-text-main-light dark:text-text-main-dark">Latest Audit Run</h3>
                                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${latestAudit.dryRun ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'}`}>
                                        {latestAudit.dryRun ? 'Dry run' : 'Applied'}
                                    </span>
                                </div>
                                <div className="mt-3 divide-y divide-border-light dark:divide-border-dark">
                                    <StatRow label="Finished" value={formatDateTime(latestAudit.finishedAt)} />
                                    <StatRow label="Stale window" value={`${formatNumber(latestAudit.staleHours)}h`} />
                                    <StatRow label="Max topics/format" value={formatNumber(latestAudit.maxTopicsPerFormat)} />
                                    <StatRow label="Objective rebased" value={formatNumber(latestAudit.mcqSummary?.rebasedTopicCount)} detail={`${formatNumber(latestAudit.mcqSummary?.candidateTopicCount)} candidates`} />
                                    <StatRow label="Essay rebased" value={formatNumber(latestAudit.essaySummary?.rebasedTopicCount)} detail={`${formatNumber(latestAudit.essaySummary?.candidateTopicCount)} candidates`} />
                                    <StatRow label="Total rebased topics" value={formatNumber(latestAudit.totalRebasedTopics)} />
                                </div>
                            </div>

                            <div className="rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4">
                                <h3 className="text-sm font-semibold text-text-main-light dark:text-text-main-dark">Most Recent Effective Rebase</h3>
                                {!latestAuditWithRebases || !latestAuditWithRebases.totalRebasedTopics ? (
                                    <p className="mt-3 text-sm text-text-faint-light dark:text-text-faint-dark">No rebased topics recorded yet.</p>
                                ) : (
                                    <div className="mt-3 divide-y divide-border-light dark:divide-border-dark">
                                        <StatRow label="Finished" value={formatDateTime(latestAuditWithRebases.finishedAt)} />
                                        <StatRow label="Objective rebased" value={formatNumber(latestAuditWithRebases.mcqSummary?.rebasedTopicCount)} detail={`${formatNumber(latestAuditWithRebases.mcqSummary?.totalTargetReduction)} target reduction`} />
                                        <StatRow label="Essay rebased" value={formatNumber(latestAuditWithRebases.essaySummary?.rebasedTopicCount)} detail={`${formatNumber(latestAuditWithRebases.essaySummary?.totalTargetReduction)} target reduction`} />
                                        <StatRow label="Topics changed" value={formatNumber(latestAuditWithRebases.totalRebasedTopics)} />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4">
                            <div className="flex items-center justify-between gap-2">
                                <h3 className="text-sm font-semibold text-text-main-light dark:text-text-main-dark">Rebased Topics</h3>
                                <span className="text-xs text-text-faint-light dark:text-text-faint-dark">
                                    {latestAuditWithRebases?.totalRebasedTopics
                                        ? `Showing ${Math.min(latestAuditWithRebases.rebasedTopics?.length || 0, latestAuditWithRebases.totalRebasedTopics)} of ${formatNumber(latestAuditWithRebases.totalRebasedTopics)}`
                                        : 'No changed topics'}
                                </span>
                            </div>
                            {!latestAuditWithRebases || !Array.isArray(latestAuditWithRebases.rebasedTopics) || latestAuditWithRebases.rebasedTopics.length === 0 ? (
                                <p className="mt-3 text-sm text-text-faint-light dark:text-text-faint-dark">The latest effective audit did not include any persisted topic rows.</p>
                            ) : (
                                <div className="mt-3 overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-border-light dark:border-border-dark">
                                                <th className="px-3 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">Topic</th>
                                                <th className="px-3 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">Format</th>
                                                <th className="px-3 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">Target</th>
                                                <th className="px-3 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">Current Yield</th>
                                                <th className="px-3 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">Fill</th>
                                                <th className="px-3 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">Scheduled</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {latestAuditWithRebases.rebasedTopics.map((topic) => (
                                                <tr key={`${topic.format}-${topic.topicId}`} className="border-b border-border-light dark:border-border-dark">
                                                    <td className="px-3 py-3">
                                                        <p className="font-semibold text-text-main-light dark:text-text-main-dark">{topic.topicTitle || topic.topicId}</p>
                                                        <p className="text-xs text-text-faint-light dark:text-text-faint-dark">{topic.topicId}</p>
                                                    </td>
                                                    <td className="px-3 py-3 text-text-sub-light dark:text-text-sub-dark uppercase">{topic.format}</td>
                                                    <td className="px-3 py-3 text-text-sub-light dark:text-text-sub-dark">
                                                        {formatNumber(topic.currentTarget)} → {formatNumber(topic.recalculatedTarget)}
                                                    </td>
                                                    <td className="px-3 py-3 text-text-sub-light dark:text-text-sub-dark">
                                                        {topic.format === 'essay'
                                                            ? `${formatNumber(topic.usableEssayCount)} essay`
                                                            : `${formatNumber(topic.usableObjectiveCount ?? topic.usableMcqCount)} objective`}
                                                    </td>
                                                    <td className="px-3 py-3 text-text-sub-light dark:text-text-sub-dark">{formatSignedPercent((Number(topic.fillRatio) || 0) * 100)}</td>
                                                    <td className="px-3 py-3 text-text-sub-light dark:text-text-sub-dark">{topic.scheduled ? 'Yes' : 'No'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </SectionCard>

            <SectionCard title="Retrieval Diagnostics" badge="Per-topic grounded retrieval inspector">
                <form onSubmit={handleDiagnoseRetrieval} className="flex flex-col gap-3 lg:flex-row lg:items-end">
                    <div className="flex-1">
                        <label htmlFor="retrieval-topic-id" className="block text-sm font-semibold text-text-main-light dark:text-text-main-dark">
                            Topic ID
                        </label>
                        <input
                            id="retrieval-topic-id"
                            type="text"
                            value={retrievalTopicId}
                            onChange={(event) => setRetrievalTopicId(event.target.value)}
                            placeholder="k977anw9w94192fzq4kqh5x78x82tqea"
                            className="mt-1 w-full rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark px-3 py-2.5 text-sm text-text-main-light dark:text-text-main-dark focus:border-primary focus:outline-none"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={retrievalDiagnosticsLoading || !retrievalTopicId.trim()}
                        className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {retrievalDiagnosticsLoading ? 'Inspecting...' : 'Inspect Topic Retrieval'}
                    </button>
                </form>

                {retrievalDiagnosticsError ? (
                    <div className="mt-3 rounded-xl border border-rose-200 dark:border-rose-700 bg-rose-50 dark:bg-rose-900/20 px-4 py-3 text-sm text-rose-700 dark:text-rose-200">
                        {retrievalDiagnosticsError}
                    </div>
                ) : null}

                {!retrievalDiagnostics ? (
                    <p className="mt-4 text-sm text-text-faint-light dark:text-text-faint-dark">
                        Enter a topic ID to inspect lexical vs hybrid retrieval, weight backoff, and the reranked candidate passages.
                    </p>
                ) : !retrievalDiagnostics.ready ? (
                    <div className="mt-4 rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-200">
                        {retrievalDiagnostics.reason === 'grounded_index_unavailable'
                            ? 'Grounded evidence index is not available for this topic yet.'
                            : 'Diagnostics are not available for this topic.'}
                    </div>
                ) : (
                    <div className="mt-4 space-y-4">
                        <div className="rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <h3 className="text-base font-semibold text-text-main-light dark:text-text-main-dark">{retrievalDiagnostics.topicTitle || retrievalDiagnostics.topicId}</h3>
                                    <p className="mt-1 text-xs text-text-faint-light dark:text-text-faint-dark">{retrievalDiagnostics.topicId}</p>
                                </div>
                                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${retrievalDiagnostics.hybrid?.diagnostics?.vectorWeightBackoff?.enabled ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                                    {retrievalDiagnostics.hybrid?.diagnostics?.vectorWeightBackoff?.enabled ? 'Vector backoff enabled' : 'Standard hybrid weighting'}
                                </span>
                            </div>
                            <p className="mt-3 text-sm text-text-sub-light dark:text-text-sub-dark">{retrievalDiagnostics.query}</p>
                            <div className="mt-4 grid gap-4 lg:grid-cols-3">
                                <div className="rounded-xl bg-surface-hover-light dark:bg-surface-hover-dark p-3 text-sm">
                                    <p className="text-text-faint-light dark:text-text-faint-dark">Lexical</p>
                                    <p className="mt-1 font-semibold text-text-main-light dark:text-text-main-dark">
                                        {formatRatioPercent(retrievalDiagnostics.lexical?.metrics?.recallAtK)} recall@k
                                    </p>
                                    <p className="mt-1 text-xs text-text-faint-light dark:text-text-faint-dark">
                                        {formatNumber(retrievalDiagnostics.lexical?.metrics?.matchedCount)} / {formatNumber(retrievalDiagnostics.lexical?.metrics?.targetCount)} target passages
                                    </p>
                                </div>
                                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3 text-sm">
                                    <p className="text-emerald-700 dark:text-emerald-300">Hybrid</p>
                                    <p className="mt-1 font-semibold text-emerald-700 dark:text-emerald-300">
                                        {formatRatioPercent(retrievalDiagnostics.hybrid?.metrics?.recallAtK)} recall@k
                                    </p>
                                    <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-300/80">
                                        {formatNumber(retrievalDiagnostics.hybrid?.metrics?.matchedCount)} / {formatNumber(retrievalDiagnostics.hybrid?.metrics?.targetCount)} target passages
                                    </p>
                                </div>
                                <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-3 text-sm">
                                    <p className="text-blue-700 dark:text-blue-300">Backoff</p>
                                    <p className="mt-1 font-semibold text-blue-700 dark:text-blue-300">
                                        {formatRatioPercent(retrievalDiagnostics.hybrid?.diagnostics?.vectorWeightBackoff?.backoff || 0)}
                                    </p>
                                    <p className="mt-1 text-xs text-blue-700/80 dark:text-blue-300/80">
                                        Lexical {formatRatioPercent(retrievalDiagnostics.hybrid?.diagnostics?.vectorWeightBackoff?.lexicalWeight || 0)} • Vector {formatRatioPercent(retrievalDiagnostics.hybrid?.diagnostics?.vectorWeightBackoff?.vectorWeight || 0)}
                                    </p>
                                </div>
                            </div>
                            <div className="mt-4 grid gap-4 lg:grid-cols-2">
                                <div className="rounded-xl border border-border-light dark:border-border-dark bg-surface-hover-light dark:bg-surface-hover-dark p-3 text-xs text-text-sub-light dark:text-text-sub-dark">
                                    <p className="font-semibold text-text-main-light dark:text-text-main-dark">Backoff Diagnostics</p>
                                    <div className="mt-2 space-y-1">
                                        <p>Lexical top coverage: {formatRatioPercent(retrievalDiagnostics.hybrid?.diagnostics?.vectorWeightBackoff?.lexicalTopCoverage || 0)}</p>
                                        <p>Lexical anchor count: {formatNumber(retrievalDiagnostics.hybrid?.diagnostics?.vectorWeightBackoff?.lexicalAnchorCount || 0)}</p>
                                        <p>Prefer-flag anchored count: {formatNumber(retrievalDiagnostics.hybrid?.diagnostics?.vectorWeightBackoff?.preferFlagAnchoredCount || 0)}</p>
                                        <p>Numeric tokens: {(retrievalDiagnostics.hybrid?.diagnostics?.numericTokens || []).join(', ') || 'None'}</p>
                                    </div>
                                </div>
                                <div className="rounded-xl border border-border-light dark:border-border-dark bg-surface-hover-light dark:bg-surface-hover-dark p-3 text-xs text-text-sub-light dark:text-text-sub-dark">
                                    <p className="font-semibold text-text-main-light dark:text-text-main-dark">Target Passages</p>
                                    <p className="mt-2 break-all">
                                        {Array.isArray(retrievalDiagnostics.targetPassageIds) && retrievalDiagnostics.targetPassageIds.length > 0
                                            ? retrievalDiagnostics.targetPassageIds.join(', ')
                                            : 'None'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-3">
                            <RetrievalCandidatesTable
                                title="Lexical Top"
                                rows={retrievalDiagnostics.hybrid?.diagnostics?.lexicalTop || []}
                            />
                            <RetrievalCandidatesTable
                                title="Vector Top"
                                rows={retrievalDiagnostics.hybrid?.diagnostics?.vectorTop || []}
                            />
                            <RetrievalCandidatesTable
                                title="Reranked Top"
                                rows={retrievalDiagnostics.hybrid?.diagnostics?.rerankedTop || []}
                                showPenaltyColumns
                            />
                        </div>
                    </div>
                )}
            </SectionCard>
        </div>
    );
};

const UsersPanel = ({ signedInUsers, recentUsers, premiumUsers, flags, snapshot, activeUsersDays }) => {
    const llmUsage = snapshot.llmUsageAnalytics || {};
    const historicalLlmEstimate = snapshot.historicalLlmEstimateAnalytics || {};
    return (
        <div className="space-y-4">
            <SectionCard title="LLM Usage">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <StatRow
                        label="Tracked users"
                        value={formatNumber(llmUsage.trackedUsers)}
                        detail={llmUsage.firstTrackedAt ? `Since ${formatDateTime(llmUsage.firstTrackedAt)}` : 'Waiting for tracked usage'}
                    />
                    <StatRow
                        label="Token total"
                        value={formatNumber(llmUsage.totalTokens)}
                        detail={`${formatNumber(llmUsage.promptTokensTotal)} prompt • ${formatNumber(llmUsage.completionTokensTotal)} completion`}
                    />
                    <StatRow
                        label={`Tokens (${activeUsersDays}d)`}
                        value={formatNumber(llmUsage.totalTokensLastWindow)}
                        detail={`${formatNumber(llmUsage.requestCountLastWindow)} requests`}
                    />
                    <StatRow
                        label="Requests total"
                        value={formatNumber(llmUsage.requestCountTotal)}
                        detail={llmUsage.lastTrackedAt ? `Last tracked ${formatDateTime(llmUsage.lastTrackedAt)}` : 'No tracked requests yet'}
                    />
                    <StatRow
                        label="Historical est. total"
                        value={formatNumber(historicalLlmEstimate.totalTokens)}
                        detail={`${formatNumber(historicalLlmEstimate.requestCountTotal)} historical requests`}
                    />
                    <StatRow
                        label={`Historical est. (${activeUsersDays}d)`}
                        value={formatNumber(historicalLlmEstimate.totalTokensLastWindow)}
                        detail={`${formatNumber(historicalLlmEstimate.requestCountLastWindow)} requests`}
                    />
                    <StatRow
                        label="Historical AI messages"
                        value={formatNumber(historicalLlmEstimate.aiMessageCountTotal)}
                        detail={`${formatNumber(historicalLlmEstimate.aiMessageCountLastWindow)} last ${activeUsersDays}d • ~${formatNumber(historicalLlmEstimate.estimatedAiMessageTokensPerRequest)} tokens each`}
                    />
                    <StatRow
                        label="Historical humanizer"
                        value={formatNumber(historicalLlmEstimate.humanizerCountTotal)}
                        detail={`${formatNumber(historicalLlmEstimate.humanizerCountLastWindow)} last ${activeUsersDays}d • ~${formatNumber(historicalLlmEstimate.estimatedHumanizerTokensPerRequest)} tokens each`}
                    />
                </div>
                <p className="mt-4 text-xs text-text-faint-light dark:text-text-faint-dark">
                    {historicalLlmEstimate.coverage || 'Historical estimates use old quota counters where provider token tracking did not exist yet.'}
                </p>
            </SectionCard>

            <SectionCard title="All Signed-In Users" badge={flags.activeSessionsTruncated ? 'Partial scan' : undefined}>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead>
                            <tr className="border-b border-border-light dark:border-border-dark">
                                <th className="px-3 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">User</th>
                                <th className="px-3 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">Verified</th>
                                <th className="px-3 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">Sessions</th>
                                <th className="px-3 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">LLM tokens</th>
                                <th className="px-3 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">Last session</th>
                                <th className="px-3 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">Joined</th>
                            </tr>
                        </thead>
                        <tbody>
                            {signedInUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-3 py-6 text-center text-text-faint-light dark:text-text-faint-dark">
                                        No active signed-in users right now.
                                    </td>
                                </tr>
                            ) : signedInUsers.map((record) => (
                                <tr key={record.userId} className="border-b border-border-light dark:border-border-dark">
                                    <td className="px-3 py-3">
                                        <p className="font-semibold text-text-main-light dark:text-text-main-dark">{record.email || record.fullName || record.userId}</p>
                                        <p className="text-xs text-text-faint-light dark:text-text-faint-dark">{record.department || ''}</p>
                                    </td>
                                    <td className="px-3 py-3 text-text-sub-light dark:text-text-sub-dark">{record.emailVerified ? 'Yes' : 'No'}</td>
                                    <td className="px-3 py-3 text-text-sub-light dark:text-text-sub-dark">{formatNumber(record.activeSessionCount)}</td>
                                    <td className="px-3 py-3 text-text-sub-light dark:text-text-sub-dark">
                                        <div>{formatNumber(record.llmTokensTotal)}<span className="ml-2 text-xs text-text-faint-light dark:text-text-faint-dark">Tracked • 7d {formatNumber(record.llmTokensLastWindow)}</span></div>
                                        <div className="mt-1 text-xs text-text-faint-light dark:text-text-faint-dark">Hist. est. {formatNumber(record.estimatedHistoricalTokensTotal)} • 7d {formatNumber(record.estimatedHistoricalTokensLastWindow)}</div>
                                    </td>
                                    <td className="px-3 py-3 text-text-sub-light dark:text-text-sub-dark">{formatDateTime(record.lastSessionAt)}</td>
                                    <td className="px-3 py-3 text-text-sub-light dark:text-text-sub-dark">{formatDateTime(record.createdAt)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </SectionCard>

            <SectionCard title="Premium Users">
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead>
                        <tr className="border-b border-border-light dark:border-border-dark">
                            <th className="px-3 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">User</th>
                            <th className="px-3 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">Status</th>
                            <th className="px-3 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">Plan amount</th>
                            <th className="px-3 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">LLM tokens</th>
                            <th className="px-3 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">Last payment</th>
                            <th className="px-3 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">Next billing</th>
                        </tr>
                    </thead>
                    <tbody>
                        {premiumUsers.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-3 py-6 text-center text-text-faint-light dark:text-text-faint-dark">
                                    No premium users yet.
                                </td>
                            </tr>
                        ) : premiumUsers.map((record) => (
                            <tr key={record.userId} className="border-b border-border-light dark:border-border-dark">
                                <td className="px-3 py-3">
                                    <p className="font-semibold text-text-main-light dark:text-text-main-dark">{record.email || record.fullName || record.userId}</p>
                                    <p className="text-xs text-text-faint-light dark:text-text-faint-dark">{record.department || ''}</p>
                                </td>
                                <td className="px-3 py-3 text-text-sub-light dark:text-text-sub-dark capitalize">{record.status || 'unknown'}</td>
                                <td className="px-3 py-3 text-text-sub-light dark:text-text-sub-dark">{formatMajorCurrency(record.amountMajor, record.currency)}</td>
                                <td className="px-3 py-3 text-text-sub-light dark:text-text-sub-dark">
                                    <div>{formatNumber(record.llmTokensTotal)}<span className="ml-2 text-xs text-text-faint-light dark:text-text-faint-dark">Tracked • 7d {formatNumber(record.llmTokensLastWindow)}</span></div>
                                    <div className="mt-1 text-xs text-text-faint-light dark:text-text-faint-dark">Hist. est. {formatNumber(record.estimatedHistoricalTokensTotal)} • 7d {formatNumber(record.estimatedHistoricalTokensLastWindow)}</div>
                                </td>
                                <td className="px-3 py-3 text-text-sub-light dark:text-text-sub-dark">{formatDateTime(record.lastPaymentAt)}</td>
                                <td className="px-3 py-3 text-text-sub-light dark:text-text-sub-dark">{record.nextBillingDate || 'N/A'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </SectionCard>

            <SectionCard title="Recent Users">
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead>
                        <tr className="border-b border-border-light dark:border-border-dark">
                            <th className="px-3 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">User</th>
                            <th className="px-3 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">Signed up</th>
                            <th className="px-3 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">Last activity</th>
                            <th className="px-3 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">Docs</th>
                            <th className="px-3 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">LLM tokens</th>
                            <th className="px-3 py-2 text-left font-semibold text-text-faint-light dark:text-text-faint-dark">Feedback</th>
                        </tr>
                    </thead>
                    <tbody>
                        {recentUsers.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-3 py-6 text-center text-text-faint-light dark:text-text-faint-dark">No user records yet.</td>
                            </tr>
                        ) : recentUsers.map((record) => (
                            <tr key={record.userId || record.createdAt} className="border-b border-border-light dark:border-border-dark">
                                <td className="px-3 py-3">
                                    <p className="font-semibold text-text-main-light dark:text-text-main-dark">{record.email || record.fullName || record.userId || 'Unknown'}</p>
                                    <p className="text-xs text-text-faint-light dark:text-text-faint-dark">{record.department || 'No dept'}{record.educationLevel ? ` • ${record.educationLevel}` : ''}</p>
                                </td>
                                <td className="px-3 py-3 text-text-sub-light dark:text-text-sub-dark">{formatDateTime(record.createdAt)}</td>
                                <td className="px-3 py-3 text-text-sub-light dark:text-text-sub-dark">{formatDateTime(record.lastActiveAt)}</td>
                                <td className="px-3 py-3 text-text-sub-light dark:text-text-sub-dark">{formatNumber(record.documentsProcessed)}</td>
                                <td className="px-3 py-3 text-text-sub-light dark:text-text-sub-dark">
                                    <div>{formatNumber(record.llmTokensTotal)}<span className="ml-2 text-xs text-text-faint-light dark:text-text-faint-dark">Tracked • 7d {formatNumber(record.llmTokensLastWindow)}</span></div>
                                    <div className="mt-1 text-xs text-text-faint-light dark:text-text-faint-dark">Hist. est. {formatNumber(record.estimatedHistoricalTokensTotal)} • 7d {formatNumber(record.estimatedHistoricalTokensLastWindow)}</div>
                                </td>
                                <td className="px-3 py-3 text-text-sub-light dark:text-text-sub-dark">{formatNumber(record.feedbackCount)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            </SectionCard>
        </div>
    );
};

const UploadsPanel = ({ snapshot }) => {
    const uploadBreakdown = snapshot.uploadBreakdown || {};
    const uploadChannels = Array.isArray(uploadBreakdown.channels) ? uploadBreakdown.channels : [];
    const uploadFileTypes = Array.isArray(uploadBreakdown.fileTypes) ? uploadBreakdown.fileTypes : [];
    const topUploadUsers = Array.isArray(uploadBreakdown.topUsers) ? uploadBreakdown.topUsers : [];

    return (
        <div className="space-y-4">
            <SectionCard title="Where Uploads Went" badge={`${formatNumber(uploadBreakdown.total)} total tracked`}>
                <div className="grid gap-4 xl:grid-cols-3">
                    <div className="rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4">
                        <h3 className="text-sm font-semibold text-text-main-light dark:text-text-main-dark">Destination Split</h3>
                        <div className="mt-3 space-y-3">
                            {uploadChannels.length === 0 ? (
                                <p className="text-sm text-text-faint-light dark:text-text-faint-dark">No upload activity yet.</p>
                            ) : uploadChannels.map((channel) => (
                                <div key={channel.key} className="space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-semibold text-text-main-light dark:text-text-main-dark">{channel.label}</p>
                                        <p className="text-xs text-text-faint-light dark:text-text-faint-dark">{formatNumber(channel.count)} ({formatPercent(channel.percent)})</p>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-surface-hover-light dark:bg-surface-hover-dark">
                                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(0, Math.min(Number(channel.percent) || 0, 100))}%` }} />
                                    </div>
                                    <p className="text-xs text-text-faint-light dark:text-text-faint-dark">
                                        Ready {formatNumber(channel.statuses?.ready)} • Processing {formatNumber(channel.statuses?.processing)} • Errors {formatNumber(channel.statuses?.error)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4">
                        <h3 className="text-sm font-semibold text-text-main-light dark:text-text-main-dark">Top File Types</h3>
                        <div className="mt-3 space-y-2.5">
                            {uploadFileTypes.length === 0 ? (
                                <p className="text-sm text-text-faint-light dark:text-text-faint-dark">No file types captured yet.</p>
                            ) : uploadFileTypes.map((entry) => (
                                <div key={entry.fileType} className="flex items-center justify-between gap-3 rounded-xl bg-surface-hover-light dark:bg-surface-hover-dark px-3 py-2">
                                    <p className="text-sm font-medium text-text-main-light dark:text-text-main-dark">{formatFileTypeLabel(entry.fileType)}</p>
                                    <p className="text-xs text-text-faint-light dark:text-text-faint-dark">{formatNumber(entry.count)} ({formatPercent(entry.percent)})</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4">
                        <h3 className="text-sm font-semibold text-text-main-light dark:text-text-main-dark">Top Upload Users</h3>
                        <div className="mt-3 space-y-2.5">
                            {topUploadUsers.length === 0 ? (
                                <p className="text-sm text-text-faint-light dark:text-text-faint-dark">No user upload activity yet.</p>
                            ) : topUploadUsers.map((entry) => (
                                <div key={entry.userId} className="rounded-xl bg-surface-hover-light dark:bg-surface-hover-dark px-3 py-2">
                                    <p className="text-sm font-semibold text-text-main-light dark:text-text-main-dark">{entry.email || entry.fullName || entry.userId}</p>
                                    <p className="text-xs text-text-faint-light dark:text-text-faint-dark">{entry.department || 'No dept'} • Total {formatNumber(entry.totalUploads)}</p>
                                    <p className="mt-1 text-xs text-text-faint-light dark:text-text-faint-dark">
                                        Study {formatNumber(entry.studyUploads)} • Assignment {formatNumber(entry.assignmentUploads)} • Ready {formatNumber(entry.readyUploads)} • Errors {formatNumber(entry.errorUploads)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </SectionCard>
        </div>
    );
};

const FeedbackPanel = ({
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
                        <p className="text-sm text-text-faint-light dark:text-text-faint-dark">No campaign send data yet.</p>
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
                                className="rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4"
                            >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <p className="font-semibold text-text-main-light dark:text-text-main-dark break-all">{campaignId}</p>
                                        <p className="mt-1 text-xs text-text-faint-light dark:text-text-faint-dark">
                                            First sent {formatDateTime(report?.firstSentAt)} • Last sent {formatDateTime(report?.lastSentAt)}
                                        </p>
                                    </div>
                                    <span className="rounded-full bg-surface-hover-light dark:bg-surface-hover-dark px-2.5 py-1 text-xs font-semibold text-text-main-light dark:text-text-main-dark">
                                        {formatNumber(sentCount)} sent
                                    </span>
                                </div>

                                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                                    <div className="rounded-xl bg-surface-hover-light dark:bg-surface-hover-dark px-3 py-3">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-faint-light dark:text-text-faint-dark">Sent</p>
                                        <p className="mt-1 text-xl font-black text-text-main-light dark:text-text-main-dark">{formatNumber(sentCount)}</p>
                                    </div>
                                    <div className="rounded-xl bg-surface-hover-light dark:bg-surface-hover-dark px-3 py-3">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-faint-light dark:text-text-faint-dark">Returned</p>
                                        <p className="mt-1 text-xl font-black text-text-main-light dark:text-text-main-dark">{formatNumber(returnedCount)}</p>
                                        <p className="mt-1 text-xs text-text-faint-light dark:text-text-faint-dark">{formatRatioPercent(rates?.returned)}</p>
                                    </div>
                                    <div className="rounded-xl bg-surface-hover-light dark:bg-surface-hover-dark px-3 py-3">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-faint-light dark:text-text-faint-dark">Uploaded</p>
                                        <p className="mt-1 text-xl font-black text-text-main-light dark:text-text-main-dark">{formatNumber(uploadedCount)}</p>
                                        <p className="mt-1 text-xs text-text-faint-light dark:text-text-faint-dark">{formatRatioPercent(rates?.uploaded)}</p>
                                    </div>
                                    <div className="rounded-xl bg-surface-hover-light dark:bg-surface-hover-dark px-3 py-3">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-faint-light dark:text-text-faint-dark">Activated</p>
                                        <p className="mt-1 text-xl font-black text-text-main-light dark:text-text-main-dark">{formatNumber(activatedCount)}</p>
                                        <p className="mt-1 text-xs text-text-faint-light dark:text-text-faint-dark">{formatRatioPercent(rates?.activated)}</p>
                                    </div>
                                    <div className="rounded-xl bg-surface-hover-light dark:bg-surface-hover-dark px-3 py-3">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-faint-light dark:text-text-faint-dark">Paid</p>
                                        <p className="mt-1 text-xl font-black text-text-main-light dark:text-text-main-dark">{formatNumber(paidCount)}</p>
                                        <p className="mt-1 text-xs text-text-faint-light dark:text-text-faint-dark">{formatRatioPercent(rates?.paid)}</p>
                                    </div>
                                </div>

                                <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/70 px-3 py-3 dark:border-indigo-900/40 dark:bg-indigo-950/20">
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
                        <p className="text-sm text-text-faint-light dark:text-text-faint-dark">No text feedback submitted yet.</p>
                    ) : feedbackPreview.map((entry) => (
                        <article key={entry.feedbackId} className="rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <p className="font-semibold text-text-main-light dark:text-text-main-dark">{entry.email || entry.fullName || entry.userId || 'Unknown user'}</p>
                                    <p className="text-xs text-text-faint-light dark:text-text-faint-dark">{entry.department || ''}</p>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary font-semibold">
                                        {Number(entry.rating) > 0 ? `${entry.rating}/5` : 'No rating'}
                                    </span>
                                    <span className="text-text-faint-light dark:text-text-faint-dark">{formatDateTime(entry.createdAt)}</span>
                                </div>
                            </div>
                            <p className="mt-3 whitespace-pre-wrap break-words text-sm text-text-main-light dark:text-text-main-dark">
                                {normalizeFeedbackMessage(entry.message)}
                            </p>
                        </article>
                    ))}
                </div>
            </SectionCard>

            <SectionCard title="Product Research Responses" badge={`Showing ${researchPreview.length} of ${formatNumber(researchResponsesTotal)}`}>
                <div className="space-y-3">
                    {researchPreview.length === 0 ? (
                        <p className="text-sm text-text-faint-light dark:text-text-faint-dark">No product research responses yet.</p>
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
                            <article key={researchId} className="rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <p className="font-semibold text-text-main-light dark:text-text-main-dark">{userLabel}</p>
                                        <p className="text-xs text-text-faint-light dark:text-text-faint-dark">{entry?.department || ''}</p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                        {campaign ? (
                                            <span className="rounded-full bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200">
                                                Campaign: {campaign}
                                            </span>
                                        ) : null}
                                        {cohort ? (
                                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                                                Cohort: {cohort}
                                            </span>
                                        ) : null}
                                        <span className="text-text-faint-light dark:text-text-faint-dark">{formatDateTime(createdAt)}</span>
                                    </div>
                                </div>
                                <div className="mt-3 space-y-1.5 text-sm text-text-main-light dark:text-text-main-dark">
                                    <p>
                                        <span className="font-semibold text-text-main-light dark:text-text-main-dark">How using app:</span>{' '}
                                        {howUsing || 'N/A'}
                                    </p>
                                    <p>
                                        <span className="font-semibold text-text-main-light dark:text-text-main-dark">Wanted next:</span>{' '}
                                        {wantedFeatures || 'N/A'}
                                    </p>
                                    {notes ? (
                                        <p className="whitespace-pre-wrap break-words">
                                            <span className="font-semibold text-text-main-light dark:text-text-main-dark">Notes:</span>{' '}
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

const SettingsPanel = ({
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
            <p className="text-sm text-text-sub-light dark:text-text-faint-dark">
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
                                    : 'border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark hover:border-primary/40'
                            }`}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-bold text-text-main-light dark:text-text-main-dark">
                                        {option.label}
                                    </p>
                                    <p className="mt-1 text-xs text-text-faint-light dark:text-text-faint-dark">
                                        {option.helpText || (option.requiresKey ? 'Requires payment API key.' : 'No API key required.')}
                                    </p>
                                </div>
                                <span
                                    className={`material-symbols-outlined text-xl ${
                                        isSelected
                                            ? 'text-primary'
                                            : 'text-text-faint-light dark:text-text-faint-dark'
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
                    <p className="mt-1 text-xs text-text-faint-light dark:text-text-faint-dark">
                        Current: {paymentProviderConfig?.selectedLabel || paymentProviderConfig?.selected || 'Unknown'}
                        {paymentProviderConfig?.updatedAt ? ` • Updated ${new Date(paymentProviderConfig.updatedAt).toLocaleString()}` : null}
                    </p>
                    {!paymentProviderConfig ? (
                        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
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
            <p className="mt-3 text-xs text-text-faint-light dark:text-text-faint-dark">
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
                    className="w-full rounded-xl border-2 border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark px-4 py-2.5 text-sm text-text-main-light dark:text-text-main-dark focus:outline-none focus:border-primary"
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
                <p className="mt-3 text-sm text-rose-600 dark:text-rose-300">{adminActionError}</p>
            ) : null}
            <div className="mt-4 grid gap-2">
                {adminEmails.length === 0 ? (
                    <p className="text-sm text-text-faint-light dark:text-text-faint-dark">No admin emails configured.</p>
                ) : adminEmails.map((entry) => (
                    <div
                        key={entry.email}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-3"
                    >
                        <div>
                            <p className="font-semibold text-text-main-light dark:text-text-main-dark">{entry.email}</p>
                            <p className="text-xs text-text-faint-light dark:text-text-faint-dark">{(entry.sources || []).map(formatAdminSource).join(' • ')}</p>
                        </div>
                        {canRemoveAdminEmail(entry.sources) ? (
                            <button
                                type="button"
                                disabled={adminActionLoading}
                                onClick={() => handleRemoveAdminEmail(entry.email)}
                                className="inline-flex items-center justify-center rounded-lg border border-rose-200 dark:border-rose-700 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-200 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                Remove
                            </button>
                        ) : (
                            <span className="text-xs text-text-faint-light dark:text-text-faint-dark">Managed</span>
                        )}
                    </div>
                ))}
            </div>
        </SectionCard>
    </div>
);

// ── Main Component ──

const AdminDashboard = () => {
    const { user } = useAuth();
    const snapshot = useQuery(api.admin.getDashboardSnapshot, {});
    const diagnoseRetrievalForTopic = useAction(api.admin.diagnoseRetrievalForTopic);
    const reconcilePaymentReference = useAction(api.admin.reconcilePaymentReference);
    const addAdminEmail = useMutation(api.admin.addAdminEmail);
    const removeAdminEmail = useMutation(api.admin.removeAdminEmail);
    const setPaymentProvider = useMutation(api.admin.setPaymentProvider);
    const [newAdminEmail, setNewAdminEmail] = React.useState('');
    const [adminActionLoading, setAdminActionLoading] = React.useState(false);
    const [adminActionError, setAdminActionError] = React.useState('');
    const [billingActionError, setBillingActionError] = React.useState('');
    const [billingActionMessage, setBillingActionMessage] = React.useState('');
    const [reconcilingReferences, setReconcilingReferences] = React.useState({});
    const [paymentProviderDraft, setPaymentProviderDraft] = React.useState('paystack');
    const [retrievalTopicId, setRetrievalTopicId] = React.useState('');
    const [retrievalDiagnostics, setRetrievalDiagnostics] = React.useState(null);
    const [retrievalDiagnosticsLoading, setRetrievalDiagnosticsLoading] = React.useState(false);
    const [retrievalDiagnosticsError, setRetrievalDiagnosticsError] = React.useState('');
    const [activeTab, setActiveTab] = React.useState('overview');

    React.useEffect(() => {
        const selectedProvider = String(snapshot?.paymentProviderConfig?.selected || '').trim() || 'paystack';
        setPaymentProviderDraft(selectedProvider);
    }, [snapshot?.paymentProviderConfig?.selected]);

    if (snapshot === undefined) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                    <p className="text-text-faint-light dark:text-text-faint-dark text-sm font-medium">Loading admin dashboard...</p>
                </div>
            </div>
        );
    }

    if (!snapshot.allowed) {
        return (
            <DeniedCard
                reason={snapshot.reason}
                signedInEmail={snapshot.signedInAs?.email || user?.email || ''}
                signedInUserId={snapshot.signedInAs?.userId || user?.id || ''}
            />
        );
    }

    const newUsersDays = Number(snapshot.windows?.newUsersDays) || 7;
    const activeUsersDays = Number(snapshot.windows?.activeUsersDays) || 7;
    const totals = snapshot.totals || {};
    const flags = snapshot.flags || {};
    const adminEmails = Array.isArray(snapshot.adminEmails) ? snapshot.adminEmails : [];
    const paymentProviderConfig = snapshot.paymentProviderConfig || null;
    const recentUsers = Array.isArray(snapshot.recentUsers) ? snapshot.recentUsers : [];
    const recentFeedback = Array.isArray(snapshot.recentFeedback) ? snapshot.recentFeedback : [];
    const recentProductResearchResponses = Array.isArray(snapshot.recentProductResearchResponses)
        ? snapshot.recentProductResearchResponses
        : (Array.isArray(snapshot.recentResearchResponses) ? snapshot.recentResearchResponses : []);
    const campaignPerformanceReports = Array.isArray(snapshot.campaignPerformanceReports)
        ? snapshot.campaignPerformanceReports
        : [];
    const signedInUsers = Array.isArray(snapshot.signedInUsers) ? snapshot.signedInUsers : [];
    const premiumUsers = Array.isArray(snapshot.premiumUsers) ? snapshot.premiumUsers : [];

    const handleAddAdminEmail = async (event) => {
        event.preventDefault();
        if (!newAdminEmail.trim()) return;
        setAdminActionError('');
        setAdminActionLoading(true);
        try {
            await addAdminEmail({ email: newAdminEmail.trim() });
            setNewAdminEmail('');
        } catch (error) {
            setAdminActionError(String(error?.message || error || 'Failed to add admin email.'));
        } finally {
            setAdminActionLoading(false);
        }
    };

    const handleRemoveAdminEmail = async (email) => {
        setAdminActionError('');
        setAdminActionLoading(true);
        try {
            await removeAdminEmail({ email });
        } catch (error) {
            setAdminActionError(String(error?.message || error || 'Failed to remove admin email.'));
        } finally {
            setAdminActionLoading(false);
        }
    };

    const handleSavePaymentProvider = async (event) => {
        event.preventDefault();
        if (!paymentProviderDraft.trim()) return;
        setAdminActionError('');
        setAdminActionLoading(true);
        try {
            await setPaymentProvider({ provider: paymentProviderDraft });
        } catch (error) {
            setAdminActionError(String(error?.message || error || 'Failed to update payment provider.'));
        } finally {
            setAdminActionLoading(false);
        }
    };

    const handleReconcilePayment = async (reference) => {
        const normalizedReference = String(reference || '').trim();
        if (!normalizedReference) return;
        setBillingActionError('');
        setBillingActionMessage('');
        setReconcilingReferences((current) => ({
            ...current,
            [normalizedReference]: true,
        }));
        try {
            const result = await reconcilePaymentReference({ reference: normalizedReference });
            const baseMessage = `Reconciliation finished: ${formatTokenLabel(result?.result)}.`;
            const creditsMessage = Number(result?.grantedCredits) > 0
                ? ` ${formatNumber(result.grantedCredits)} credit${Number(result.grantedCredits) === 1 ? '' : 's'} granted.`
                : '';
            setBillingActionMessage(`${baseMessage}${creditsMessage}`);
        } catch (error) {
            setBillingActionError(String(error?.message || error || 'Failed to reconcile payment reference.'));
        } finally {
            setReconcilingReferences((current) => {
                const next = { ...current };
                delete next[normalizedReference];
                return next;
            });
        }
    };

    const handleDiagnoseRetrieval = async (event) => {
        event.preventDefault();
        if (!retrievalTopicId.trim()) return;
        setRetrievalDiagnosticsError('');
        setRetrievalDiagnosticsLoading(true);
        try {
            const diagnostics = await diagnoseRetrievalForTopic({ topicId: retrievalTopicId.trim() });
            setRetrievalDiagnostics(diagnostics);
        } catch (error) {
            setRetrievalDiagnostics(null);
            setRetrievalDiagnosticsError(String(error?.message || error || 'Failed to inspect topic retrieval.'));
        } finally {
            setRetrievalDiagnosticsLoading(false);
        }
    };

    const renderActivePanel = () => {
        switch (activeTab) {
            case 'overview':
                return <OverviewPanel snapshot={snapshot} totals={totals} activeUsersDays={activeUsersDays} newUsersDays={newUsersDays} flags={flags} />;
            case 'learning':
                return <LearningPanel snapshot={snapshot} activeUsersDays={activeUsersDays} />;
            case 'features':
                return <FeatureUsagePanel snapshot={snapshot} activeUsersDays={activeUsersDays} />;
            case 'revenue':
                return (
                    <RevenuePanel
                        snapshot={snapshot}
                        activeUsersDays={activeUsersDays}
                        handleReconcilePayment={handleReconcilePayment}
                        billingActionError={billingActionError}
                        billingActionMessage={billingActionMessage}
                        reconcilingReferences={reconcilingReferences}
                    />
                );
            case 'content':
                return (
                    <ContentPanel
                        snapshot={snapshot}
                        retrievalTopicId={retrievalTopicId}
                        setRetrievalTopicId={setRetrievalTopicId}
                        retrievalDiagnostics={retrievalDiagnostics}
                        retrievalDiagnosticsError={retrievalDiagnosticsError}
                        retrievalDiagnosticsLoading={retrievalDiagnosticsLoading}
                        handleDiagnoseRetrieval={handleDiagnoseRetrieval}
                    />
                );
            case 'users':
                return <UsersPanel signedInUsers={signedInUsers} recentUsers={recentUsers} premiumUsers={premiumUsers} flags={flags} snapshot={snapshot} activeUsersDays={activeUsersDays} />;
            case 'uploads':
                return <UploadsPanel snapshot={snapshot} />;
            case 'feedback':
                return (
                    <FeedbackPanel
                        recentFeedback={recentFeedback}
                        recentProductResearchResponses={recentProductResearchResponses}
                        campaignPerformanceReports={campaignPerformanceReports}
                        totals={totals}
                        activeUsersDays={activeUsersDays}
                    />
                );
            case 'settings':
                return (
                    <SettingsPanel
                        adminEmails={adminEmails}
                        handleAddAdminEmail={handleAddAdminEmail}
                        handleRemoveAdminEmail={handleRemoveAdminEmail}
                        newAdminEmail={newAdminEmail}
                        setNewAdminEmail={setNewAdminEmail}
                        adminActionLoading={adminActionLoading}
                        adminActionError={adminActionError}
                        paymentProviderConfig={paymentProviderConfig}
                        paymentProviderDraft={paymentProviderDraft}
                        setPaymentProviderDraft={setPaymentProviderDraft}
                        handleSavePaymentProvider={handleSavePaymentProvider}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl space-y-4">
                <div className="card-base p-5 sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Admin</p>
                            <h1 className="mt-1 text-2xl font-black text-text-main-light dark:text-text-main-dark">
                                Stitch Operations Dashboard
                            </h1>
                            <p className="mt-2 text-sm text-text-faint-light dark:text-text-faint-dark">
                                Updated {formatDateTime(snapshot.generatedAt)}
                            </p>
                        </div>
                        <Link
                            to="/dashboard"
                            className="inline-flex items-center gap-2 rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark px-4 py-2.5 text-sm font-semibold text-text-main-light dark:text-text-main-dark hover:border-primary/40 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                            Main dashboard
                        </Link>
                    </div>
                </div>

                <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

                {renderActivePanel()}
            </div>
        </div>
    );
};

export default AdminDashboard;
