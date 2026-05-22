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

export const UsersPanel = ({ signedInUsers, recentUsers, premiumUsers, flags, snapshot, activeUsersDays }) => {
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
                <p className="mt-4 text-xs text-text-muted">
                    {historicalLlmEstimate.coverage || 'Historical estimates use old quota counters where provider token tracking did not exist yet.'}
                </p>
            </SectionCard>

            <SectionCard title="All Signed-In Users" badge={flags.activeSessionsTruncated ? 'Partial scan' : undefined}>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead>
                            <tr className="border-b border-border-subtle">
                                <th className="px-3 py-2 text-left font-semibold text-text-muted">User</th>
                                <th className="px-3 py-2 text-left font-semibold text-text-muted">Verified</th>
                                <th className="px-3 py-2 text-left font-semibold text-text-muted">Sessions</th>
                                <th className="px-3 py-2 text-left font-semibold text-text-muted">LLM tokens</th>
                                <th className="px-3 py-2 text-left font-semibold text-text-muted">Last session</th>
                                <th className="px-3 py-2 text-left font-semibold text-text-muted">Joined</th>
                            </tr>
                        </thead>
                        <tbody>
                            {signedInUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-3 py-6 text-center text-text-muted">
                                        No active signed-in users right now.
                                    </td>
                                </tr>
                            ) : signedInUsers.map((record) => (
                                <tr key={record.userId} className="border-b border-border-subtle">
                                    <td className="p-3">
                                        <p className="font-semibold text-text-primary">{record.email || record.fullName || record.userId}</p>
                                        <p className="text-xs text-text-muted">{record.department || ''}</p>
                                    </td>
                                    <td className="p-3 text-text-secondary">{record.emailVerified ? 'Yes' : 'No'}</td>
                                    <td className="p-3 text-text-secondary">{formatNumber(record.activeSessionCount)}</td>
                                    <td className="p-3 text-text-secondary">
                                        <div>{formatNumber(record.llmTokensTotal)}<span className="ml-2 text-xs text-text-muted">Tracked • 7d {formatNumber(record.llmTokensLastWindow)}</span></div>
                                        <div className="mt-1 text-xs text-text-muted">Hist. est. {formatNumber(record.estimatedHistoricalTokensTotal)} • 7d {formatNumber(record.estimatedHistoricalTokensLastWindow)}</div>
                                    </td>
                                    <td className="p-3 text-text-secondary">{formatDateTime(record.lastSessionAt)}</td>
                                    <td className="p-3 text-text-secondary">{formatDateTime(record.createdAt)}</td>
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
                        <tr className="border-b border-border-subtle">
                            <th className="px-3 py-2 text-left font-semibold text-text-muted">User</th>
                            <th className="px-3 py-2 text-left font-semibold text-text-muted">Status</th>
                            <th className="px-3 py-2 text-left font-semibold text-text-muted">Plan amount</th>
                            <th className="px-3 py-2 text-left font-semibold text-text-muted">LLM tokens</th>
                            <th className="px-3 py-2 text-left font-semibold text-text-muted">Last payment</th>
                            <th className="px-3 py-2 text-left font-semibold text-text-muted">Next billing</th>
                        </tr>
                    </thead>
                    <tbody>
                        {premiumUsers.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-3 py-6 text-center text-text-muted">
                                    No premium users yet.
                                </td>
                            </tr>
                        ) : premiumUsers.map((record) => (
                            <tr key={record.userId} className="border-b border-border-subtle">
                                <td className="p-3">
                                    <p className="font-semibold text-text-primary">{record.email || record.fullName || record.userId}</p>
                                    <p className="text-xs text-text-muted">{record.department || ''}</p>
                                </td>
                                <td className="p-3 text-text-secondary capitalize">{record.status || 'unknown'}</td>
                                <td className="p-3 text-text-secondary">{formatMajorCurrency(record.amountMajor, record.currency)}</td>
                                <td className="p-3 text-text-secondary">
                                    <div>{formatNumber(record.llmTokensTotal)}<span className="ml-2 text-xs text-text-muted">Tracked • 7d {formatNumber(record.llmTokensLastWindow)}</span></div>
                                    <div className="mt-1 text-xs text-text-muted">Hist. est. {formatNumber(record.estimatedHistoricalTokensTotal)} • 7d {formatNumber(record.estimatedHistoricalTokensLastWindow)}</div>
                                </td>
                                <td className="p-3 text-text-secondary">{formatDateTime(record.lastPaymentAt)}</td>
                                <td className="p-3 text-text-secondary">{record.nextBillingDate || 'N/A'}</td>
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
                        <tr className="border-b border-border-subtle">
                            <th className="px-3 py-2 text-left font-semibold text-text-muted">User</th>
                            <th className="px-3 py-2 text-left font-semibold text-text-muted">Signed up</th>
                            <th className="px-3 py-2 text-left font-semibold text-text-muted">Last activity</th>
                            <th className="px-3 py-2 text-left font-semibold text-text-muted">Docs</th>
                            <th className="px-3 py-2 text-left font-semibold text-text-muted">LLM tokens</th>
                            <th className="px-3 py-2 text-left font-semibold text-text-muted">Feedback</th>
                        </tr>
                    </thead>
                    <tbody>
                        {recentUsers.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-3 py-6 text-center text-text-muted">No user records yet.</td>
                            </tr>
                        ) : recentUsers.map((record) => (
                            <tr key={record.userId || record.createdAt} className="border-b border-border-subtle">
                                <td className="p-3">
                                    <p className="font-semibold text-text-primary">{record.email || record.fullName || record.userId || 'Unknown'}</p>
                                    <p className="text-xs text-text-muted">{record.department || 'No dept'}{record.educationLevel ? ` • ${record.educationLevel}` : ''}</p>
                                </td>
                                <td className="p-3 text-text-secondary">{formatDateTime(record.createdAt)}</td>
                                <td className="p-3 text-text-secondary">{formatDateTime(record.lastActiveAt)}</td>
                                <td className="p-3 text-text-secondary">{formatNumber(record.documentsProcessed)}</td>
                                <td className="p-3 text-text-secondary">
                                    <div>{formatNumber(record.llmTokensTotal)}<span className="ml-2 text-xs text-text-muted">Tracked • 7d {formatNumber(record.llmTokensLastWindow)}</span></div>
                                    <div className="mt-1 text-xs text-text-muted">Hist. est. {formatNumber(record.estimatedHistoricalTokensTotal)} • 7d {formatNumber(record.estimatedHistoricalTokensLastWindow)}</div>
                                </td>
                                <td className="p-3 text-text-secondary">{formatNumber(record.feedbackCount)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            </SectionCard>
        </div>
    );
};
