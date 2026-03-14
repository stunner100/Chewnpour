import React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';

const formatNumber = (value) => new Intl.NumberFormat().format(Number(value) || 0);
const formatPercent = (value) => {
    const parsed = Number(value);
    const safe = Number.isFinite(parsed) ? parsed : 0;
    const rounded = Math.round(safe * 10) / 10;
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

// ── Reusable Components ──

const TABS = [
    { key: 'overview', label: 'Overview', icon: 'dashboard' },
    { key: 'learning', label: 'Learning', icon: 'school' },
    { key: 'revenue', label: 'Revenue', icon: 'payments' },
    { key: 'content', label: 'Content', icon: 'library_books' },
    { key: 'users', label: 'Users', icon: 'group' },
    { key: 'uploads', label: 'Uploads', icon: 'cloud_upload' },
    { key: 'feedback', label: 'Feedback', icon: 'reviews' },
    { key: 'settings', label: 'Settings', icon: 'settings' },
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
                            : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
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
        primary: 'bg-primary/10 text-primary',
        emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
        amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
        rose: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
        blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    };
    return (
        <div className="card-base p-5">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {label}
                    </p>
                    <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white truncate">
                        {typeof value === 'string' ? value : formatNumber(value)}
                    </p>
                    {sublabel ? (
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{sublabel}</p>
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
        <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
        <div className="text-right">
            <span className="text-sm font-bold text-slate-900 dark:text-white">{value}</span>
            {detail ? <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{detail}</span> : null}
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
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                            {formatNumber(item.value)}
                        </span>
                        <div
                            className="w-full rounded-t-lg bg-primary/80 transition-all"
                            style={{ height: `${pct}%` }}
                        />
                        <span className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-400 truncate w-full text-center">
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
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
            {badge ? (
                <span className="text-xs text-slate-500 dark:text-slate-400">{badge}</span>
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
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white">Admin access required</h1>
                </div>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{reasonMessage}</p>
                <div className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/50 p-4 text-sm">
                    <p className="text-slate-600 dark:text-slate-300">
                        Signed in as: <span className="font-semibold text-slate-900 dark:text-white">{signedInEmail || signedInUserId || 'Unknown user'}</span>
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
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        <StatRow label="Total users" value={formatNumber(totals.userProfiles)} />
                        <StatRow label="Concept practice attempts" value={formatNumber(concept.totalAttempts)} detail={`Avg ${formatPercent(concept.averageScorePercent)}`} />
                        <StatRow label="Voice mode users" value={formatNumber(engagement.voiceModeEnabledCount)} />
                        <StatRow label="Avg study hours" value={engagement.averageTotalStudyHours || '0'} />
                        <StatRow label="Avg streak days" value={engagement.averageStreakDays || '0'} />
                        <StatRow label="Humanizer uses" value={formatNumber(engagement.totalHumanizerUsage)} detail={`${formatNumber(engagement.humanizerUsageLastWindow)} last ${activeUsersDays}d`} />
                    </div>
                </SectionCard>

                <SectionCard title="Feedback Overview">
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
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
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        <StatRow label="MCQ exams" value={formatNumber(exam.mcqAttempts)} detail={exam.totalAttempts > 0 ? formatPercent((exam.mcqAttempts / exam.totalAttempts) * 100) : '0%'} />
                        <StatRow label="Essay exams" value={formatNumber(exam.essayAttempts)} detail={exam.totalAttempts > 0 ? formatPercent((exam.essayAttempts / exam.totalAttempts) * 100) : '0%'} />
                    </div>
                </SectionCard>

                <SectionCard title="Score Distribution">
                    {scoreDistribution.length > 0 ? (
                        <BarChart items={scoreDistribution.map((b) => ({ label: b.label, value: b.count }))} />
                    ) : (
                        <p className="text-sm text-slate-500 dark:text-slate-400">No exam data yet.</p>
                    )}
                </SectionCard>
            </section>

            {topExamUsers.length > 0 ? (
                <SectionCard title="Top Exam Users">
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-700">
                                    <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">User</th>
                                    <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Attempts</th>
                                    <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Avg Score</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topExamUsers.map((u) => (
                                    <tr key={u.userId} className="border-b border-slate-100 dark:border-slate-800/80">
                                        <td className="px-3 py-2 font-semibold text-slate-900 dark:text-white">{u.fullName || u.userId}</td>
                                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{formatNumber(u.attempts)}</td>
                                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{formatPercent(u.avgScore)}</td>
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

const RevenuePanel = ({ snapshot, activeUsersDays }) => {
    const revenue = snapshot.revenueAnalytics || {};
    const sub = snapshot.subscriptionAnalytics || {};
    const planBreakdown = Array.isArray(sub.planBreakdown) ? sub.planBreakdown : [];

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
                                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 capitalize">{p.plan}</span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400">{formatNumber(p.count)} ({formatPercent(p.percent)})</span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                        <div
                                            className="h-full rounded-full bg-primary transition-all"
                                            style={{ width: `${Math.max(0, Math.min(Number(p.percent) || 0, 100))}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-500 dark:text-slate-400">No subscription data yet.</p>
                    )}
                </SectionCard>

                <SectionCard title="Upload Credits">
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        <StatRow label="Purchased credits" value={formatNumber(sub.totalPurchasedCredits)} />
                        <StatRow label="Consumed credits" value={formatNumber(sub.totalConsumedCredits)} />
                        <StatRow
                            label="Utilization"
                            value={sub.totalPurchasedCredits > 0 ? formatPercent((sub.totalConsumedCredits / sub.totalPurchasedCredits) * 100) : '0%'}
                        />
                    </div>
                </SectionCard>
            </section>
        </div>
    );
};

const ContentPanel = ({ snapshot }) => {
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
                    value={`${content.averageMcqPerTopic || 0} MCQ / ${content.averageEssayPerTopic || 0} Essay`}
                    icon="help"
                    color="emerald"
                />
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
                <SectionCard title="Uploads">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-xl bg-slate-100/80 dark:bg-slate-900/70 p-3">
                            <p className="text-slate-500 dark:text-slate-400">Total</p>
                            <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{formatNumber(documents.uploads?.total)}</p>
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
                        <div className="rounded-xl bg-slate-100/80 dark:bg-slate-900/70 p-3">
                            <p className="text-slate-500 dark:text-slate-400">Total</p>
                            <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{formatNumber(documents.assignments?.total)}</p>
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
                    <p className="text-sm text-slate-500 dark:text-slate-400">No target audit has been recorded yet.</p>
                ) : (
                    <div className="space-y-4">
                        <div className="grid gap-4 lg:grid-cols-2">
                            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/40 p-4">
                                <div className="flex items-center justify-between gap-2">
                                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Latest Audit Run</h3>
                                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${latestAudit.dryRun ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'}`}>
                                        {latestAudit.dryRun ? 'Dry run' : 'Applied'}
                                    </span>
                                </div>
                                <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                                    <StatRow label="Finished" value={formatDateTime(latestAudit.finishedAt)} />
                                    <StatRow label="Stale window" value={`${formatNumber(latestAudit.staleHours)}h`} />
                                    <StatRow label="Max topics/format" value={formatNumber(latestAudit.maxTopicsPerFormat)} />
                                    <StatRow label="MCQ rebased" value={formatNumber(latestAudit.mcqSummary?.rebasedTopicCount)} detail={`${formatNumber(latestAudit.mcqSummary?.candidateTopicCount)} candidates`} />
                                    <StatRow label="Essay rebased" value={formatNumber(latestAudit.essaySummary?.rebasedTopicCount)} detail={`${formatNumber(latestAudit.essaySummary?.candidateTopicCount)} candidates`} />
                                    <StatRow label="Total rebased topics" value={formatNumber(latestAudit.totalRebasedTopics)} />
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/40 p-4">
                                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Most Recent Effective Rebase</h3>
                                {!latestAuditWithRebases || !latestAuditWithRebases.totalRebasedTopics ? (
                                    <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No rebased topics recorded yet.</p>
                                ) : (
                                    <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                                        <StatRow label="Finished" value={formatDateTime(latestAuditWithRebases.finishedAt)} />
                                        <StatRow label="MCQ rebased" value={formatNumber(latestAuditWithRebases.mcqSummary?.rebasedTopicCount)} detail={`${formatNumber(latestAuditWithRebases.mcqSummary?.totalTargetReduction)} target reduction`} />
                                        <StatRow label="Essay rebased" value={formatNumber(latestAuditWithRebases.essaySummary?.rebasedTopicCount)} detail={`${formatNumber(latestAuditWithRebases.essaySummary?.totalTargetReduction)} target reduction`} />
                                        <StatRow label="Topics changed" value={formatNumber(latestAuditWithRebases.totalRebasedTopics)} />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/40 p-4">
                            <div className="flex items-center justify-between gap-2">
                                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Rebased Topics</h3>
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                    {latestAuditWithRebases?.totalRebasedTopics
                                        ? `Showing ${Math.min(latestAuditWithRebases.rebasedTopics?.length || 0, latestAuditWithRebases.totalRebasedTopics)} of ${formatNumber(latestAuditWithRebases.totalRebasedTopics)}`
                                        : 'No changed topics'}
                                </span>
                            </div>
                            {!latestAuditWithRebases || !Array.isArray(latestAuditWithRebases.rebasedTopics) || latestAuditWithRebases.rebasedTopics.length === 0 ? (
                                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">The latest effective audit did not include any persisted topic rows.</p>
                            ) : (
                                <div className="mt-3 overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-200 dark:border-slate-700">
                                                <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Topic</th>
                                                <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Format</th>
                                                <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Target</th>
                                                <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Current Yield</th>
                                                <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Fill</th>
                                                <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Scheduled</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {latestAuditWithRebases.rebasedTopics.map((topic) => (
                                                <tr key={`${topic.format}-${topic.topicId}`} className="border-b border-slate-100 dark:border-slate-800/80">
                                                    <td className="px-3 py-3">
                                                        <p className="font-semibold text-slate-900 dark:text-white">{topic.topicTitle || topic.topicId}</p>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">{topic.topicId}</p>
                                                    </td>
                                                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300 uppercase">{topic.format}</td>
                                                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                                                        {formatNumber(topic.currentTarget)} → {formatNumber(topic.recalculatedTarget)}
                                                    </td>
                                                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                                                        {topic.format === 'essay'
                                                            ? `${formatNumber(topic.usableEssayCount)} essay`
                                                            : `${formatNumber(topic.usableMcqCount)} MCQ`}
                                                    </td>
                                                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{formatSignedPercent((Number(topic.fillRatio) || 0) * 100)}</td>
                                                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{topic.scheduled ? 'Yes' : 'No'}</td>
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
                <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                    {historicalLlmEstimate.coverage || 'Historical estimates use old quota counters where provider token tracking did not exist yet.'}
                </p>
            </SectionCard>

            <SectionCard title="All Signed-In Users" badge={flags.activeSessionsTruncated ? 'Partial scan' : undefined}>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700">
                                <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">User</th>
                                <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Verified</th>
                                <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Sessions</th>
                                <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">LLM tokens</th>
                                <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Last session</th>
                                <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Joined</th>
                            </tr>
                        </thead>
                        <tbody>
                            {signedInUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-3 py-6 text-center text-slate-500 dark:text-slate-400">
                                        No active signed-in users right now.
                                    </td>
                                </tr>
                            ) : signedInUsers.map((record) => (
                                <tr key={record.userId} className="border-b border-slate-100 dark:border-slate-800/80">
                                    <td className="px-3 py-3">
                                        <p className="font-semibold text-slate-900 dark:text-white">{record.email || record.fullName || record.userId}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{record.department || ''}</p>
                                    </td>
                                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{record.emailVerified ? 'Yes' : 'No'}</td>
                                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{formatNumber(record.activeSessionCount)}</td>
                                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                                        <div>{formatNumber(record.llmTokensTotal)}<span className="ml-2 text-xs text-slate-500 dark:text-slate-400">Tracked • 7d {formatNumber(record.llmTokensLastWindow)}</span></div>
                                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Hist. est. {formatNumber(record.estimatedHistoricalTokensTotal)} • 7d {formatNumber(record.estimatedHistoricalTokensLastWindow)}</div>
                                    </td>
                                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{formatDateTime(record.lastSessionAt)}</td>
                                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{formatDateTime(record.createdAt)}</td>
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
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                            <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">User</th>
                            <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Status</th>
                            <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Plan amount</th>
                            <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">LLM tokens</th>
                            <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Last payment</th>
                            <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Next billing</th>
                        </tr>
                    </thead>
                    <tbody>
                        {premiumUsers.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-3 py-6 text-center text-slate-500 dark:text-slate-400">
                                    No premium users yet.
                                </td>
                            </tr>
                        ) : premiumUsers.map((record) => (
                            <tr key={record.userId} className="border-b border-slate-100 dark:border-slate-800/80">
                                <td className="px-3 py-3">
                                    <p className="font-semibold text-slate-900 dark:text-white">{record.email || record.fullName || record.userId}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{record.department || ''}</p>
                                </td>
                                <td className="px-3 py-3 text-slate-600 dark:text-slate-300 capitalize">{record.status || 'unknown'}</td>
                                <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{formatMajorCurrency(record.amountMajor, record.currency)}</td>
                                <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                                    <div>{formatNumber(record.llmTokensTotal)}<span className="ml-2 text-xs text-slate-500 dark:text-slate-400">Tracked • 7d {formatNumber(record.llmTokensLastWindow)}</span></div>
                                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Hist. est. {formatNumber(record.estimatedHistoricalTokensTotal)} • 7d {formatNumber(record.estimatedHistoricalTokensLastWindow)}</div>
                                </td>
                                <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{formatDateTime(record.lastPaymentAt)}</td>
                                <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{record.nextBillingDate || 'N/A'}</td>
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
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                            <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">User</th>
                            <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Signed up</th>
                            <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Last activity</th>
                            <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Docs</th>
                            <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">LLM tokens</th>
                            <th className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">Feedback</th>
                        </tr>
                    </thead>
                    <tbody>
                        {recentUsers.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-3 py-6 text-center text-slate-500 dark:text-slate-400">No user records yet.</td>
                            </tr>
                        ) : recentUsers.map((record) => (
                            <tr key={record.userId || record.createdAt} className="border-b border-slate-100 dark:border-slate-800/80">
                                <td className="px-3 py-3">
                                    <p className="font-semibold text-slate-900 dark:text-white">{record.email || record.fullName || record.userId || 'Unknown'}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{record.department || 'No dept'}{record.educationLevel ? ` • ${record.educationLevel}` : ''}</p>
                                </td>
                                <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{formatDateTime(record.createdAt)}</td>
                                <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{formatDateTime(record.lastActiveAt)}</td>
                                <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{formatNumber(record.documentsProcessed)}</td>
                                <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                                    <div>{formatNumber(record.llmTokensTotal)}<span className="ml-2 text-xs text-slate-500 dark:text-slate-400">Tracked • 7d {formatNumber(record.llmTokensLastWindow)}</span></div>
                                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Hist. est. {formatNumber(record.estimatedHistoricalTokensTotal)} • 7d {formatNumber(record.estimatedHistoricalTokensLastWindow)}</div>
                                </td>
                                <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{formatNumber(record.feedbackCount)}</td>
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
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/40 p-4">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Destination Split</h3>
                        <div className="mt-3 space-y-3">
                            {uploadChannels.length === 0 ? (
                                <p className="text-sm text-slate-500 dark:text-slate-400">No upload activity yet.</p>
                            ) : uploadChannels.map((channel) => (
                                <div key={channel.key} className="space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{channel.label}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{formatNumber(channel.count)} ({formatPercent(channel.percent)})</p>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(0, Math.min(Number(channel.percent) || 0, 100))}%` }} />
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Ready {formatNumber(channel.statuses?.ready)} • Processing {formatNumber(channel.statuses?.processing)} • Errors {formatNumber(channel.statuses?.error)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/40 p-4">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Top File Types</h3>
                        <div className="mt-3 space-y-2.5">
                            {uploadFileTypes.length === 0 ? (
                                <p className="text-sm text-slate-500 dark:text-slate-400">No file types captured yet.</p>
                            ) : uploadFileTypes.map((entry) => (
                                <div key={entry.fileType} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 px-3 py-2">
                                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{formatFileTypeLabel(entry.fileType)}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{formatNumber(entry.count)} ({formatPercent(entry.percent)})</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/40 p-4">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Top Upload Users</h3>
                        <div className="mt-3 space-y-2.5">
                            {topUploadUsers.length === 0 ? (
                                <p className="text-sm text-slate-500 dark:text-slate-400">No user upload activity yet.</p>
                            ) : topUploadUsers.map((entry) => (
                                <div key={entry.userId} className="rounded-xl bg-slate-50/80 dark:bg-slate-800/60 px-3 py-2">
                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{entry.email || entry.fullName || entry.userId}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{entry.department || 'No dept'} • Total {formatNumber(entry.totalUploads)}</p>
                                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
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

const FeedbackPanel = ({ recentFeedback, totals, activeUsersDays }) => {
    const feedbackWithMessages = recentFeedback.filter((entry) => Boolean(normalizeFeedbackMessage(entry?.message)));
    const feedbackPreview = feedbackWithMessages.slice(0, 15);
    const feedbackWithMessagesTotal = Number(totals.feedbackWithMessageTotal) || feedbackWithMessages.length;

    return (
        <div className="space-y-4">
            <section className="grid gap-4 sm:grid-cols-3">
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
            </section>

            <SectionCard title="User Feedback" badge={`Showing ${feedbackPreview.length} of ${formatNumber(feedbackWithMessagesTotal)}`}>
                <div className="space-y-3">
                    {feedbackPreview.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">No text feedback submitted yet.</p>
                    ) : feedbackPreview.map((entry) => (
                        <article key={entry.feedbackId} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/50 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <p className="font-semibold text-slate-900 dark:text-white">{entry.email || entry.fullName || entry.userId || 'Unknown user'}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{entry.department || ''}</p>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary font-semibold">
                                        {Number(entry.rating) > 0 ? `${entry.rating}/5` : 'No rating'}
                                    </span>
                                    <span className="text-slate-500 dark:text-slate-400">{formatDateTime(entry.createdAt)}</span>
                                </div>
                            </div>
                            <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-200">
                                {normalizeFeedbackMessage(entry.message)}
                            </p>
                        </article>
                    ))}
                </div>
            </SectionCard>
        </div>
    );
};

const SettingsPanel = ({ adminEmails, handleAddAdminEmail, handleRemoveAdminEmail, newAdminEmail, setNewAdminEmail, adminActionLoading, adminActionError }) => (
    <div className="space-y-4">
        <SectionCard title="Admin Access Emails" badge="Bootstrap admin: patrickannor35@gmail.com">
            <form onSubmit={handleAddAdminEmail} className="flex flex-col gap-3 sm:flex-row">
                <input
                    type="email"
                    value={newAdminEmail}
                    onChange={(event) => setNewAdminEmail(event.target.value)}
                    placeholder="admin@example.com"
                    className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary"
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
                    <p className="text-sm text-slate-500 dark:text-slate-400">No admin emails configured.</p>
                ) : adminEmails.map((entry) => (
                    <div
                        key={entry.email}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/50 p-3"
                    >
                        <div>
                            <p className="font-semibold text-slate-900 dark:text-white">{entry.email}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{(entry.sources || []).map(formatAdminSource).join(' • ')}</p>
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
                            <span className="text-xs text-slate-500 dark:text-slate-400">Managed</span>
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
    const addAdminEmail = useMutation(api.admin.addAdminEmail);
    const removeAdminEmail = useMutation(api.admin.removeAdminEmail);
    const [newAdminEmail, setNewAdminEmail] = React.useState('');
    const [adminActionLoading, setAdminActionLoading] = React.useState(false);
    const [adminActionError, setAdminActionError] = React.useState('');
    const [activeTab, setActiveTab] = React.useState('overview');

    if (snapshot === undefined) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Loading admin dashboard...</p>
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
    const recentUsers = Array.isArray(snapshot.recentUsers) ? snapshot.recentUsers : [];
    const recentFeedback = Array.isArray(snapshot.recentFeedback) ? snapshot.recentFeedback : [];
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

    const renderActivePanel = () => {
        switch (activeTab) {
            case 'overview':
                return <OverviewPanel snapshot={snapshot} totals={totals} activeUsersDays={activeUsersDays} newUsersDays={newUsersDays} flags={flags} />;
            case 'learning':
                return <LearningPanel snapshot={snapshot} activeUsersDays={activeUsersDays} />;
            case 'revenue':
                return <RevenuePanel snapshot={snapshot} activeUsersDays={activeUsersDays} />;
            case 'content':
                return <ContentPanel snapshot={snapshot} />;
            case 'users':
                return <UsersPanel signedInUsers={signedInUsers} recentUsers={recentUsers} premiumUsers={premiumUsers} flags={flags} snapshot={snapshot} activeUsersDays={activeUsersDays} />;
            case 'uploads':
                return <UploadsPanel snapshot={snapshot} />;
            case 'feedback':
                return <FeedbackPanel recentFeedback={recentFeedback} totals={totals} activeUsersDays={activeUsersDays} />;
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
                            <h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
                                Stitch Operations Dashboard
                            </h1>
                            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                                Updated {formatDateTime(snapshot.generatedAt)}
                            </p>
                        </div>
                        <Link
                            to="/dashboard"
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:border-primary/40 transition-colors"
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
