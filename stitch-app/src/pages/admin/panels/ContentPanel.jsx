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
import { RetrievalCandidatesTable } from './RetrievalCandidatesTable';

export const ContentPanel = ({
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
                        <div className="rounded-xl bg-surface-soft p-3">
                            <p className="text-text-muted">Total</p>
                            <p className="mt-1 text-xl font-bold text-text-primary">{formatNumber(documents.uploads?.total)}</p>
                        </div>
                        <div className="rounded-xl bg-success-soft p-3">
                            <p className="text-success">Ready</p>
                            <p className="mt-1 text-xl font-bold text-success">{formatNumber(documents.uploads?.ready)}</p>
                        </div>
                        <div className="rounded-xl bg-warning-soft p-3">
                            <p className="text-warning">Processing</p>
                            <p className="mt-1 text-xl font-bold text-warning">{formatNumber(documents.uploads?.processing)}</p>
                        </div>
                        <div className="rounded-xl bg-error-soft p-3">
                            <p className="text-error">Errors</p>
                            <p className="mt-1 text-xl font-bold text-error">{formatNumber(documents.uploads?.error)}</p>
                        </div>
                    </div>
                </SectionCard>

                <SectionCard title="Assignments">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-xl bg-surface-soft p-3">
                            <p className="text-text-muted">Total</p>
                            <p className="mt-1 text-xl font-bold text-text-primary">{formatNumber(documents.assignments?.total)}</p>
                        </div>
                        <div className="rounded-xl bg-success-soft p-3">
                            <p className="text-success">Ready</p>
                            <p className="mt-1 text-xl font-bold text-success">{formatNumber(documents.assignments?.ready)}</p>
                        </div>
                        <div className="rounded-xl bg-warning-soft p-3">
                            <p className="text-warning">Processing</p>
                            <p className="mt-1 text-xl font-bold text-warning">{formatNumber(documents.assignments?.processing)}</p>
                        </div>
                        <div className="rounded-xl bg-error-soft p-3">
                            <p className="text-error">Errors</p>
                            <p className="mt-1 text-xl font-bold text-error">{formatNumber(documents.assignments?.error)}</p>
                        </div>
                    </div>
                </SectionCard>
            </section>

            <SectionCard
                title="Question Target Audit"
                badge={latestAudit ? `Latest run ${formatDateTime(latestAudit.finishedAt)}` : 'No audit runs yet'}
            >
                {!latestAudit ? (
                    <p className="text-sm text-text-muted">No target audit has been recorded yet.</p>
                ) : (
                    <div className="space-y-4">
                        <div className="grid gap-4 lg:grid-cols-2">
                            <div className="rounded-2xl border border-border-subtle bg-surface p-4">
                                <div className="flex items-center justify-between gap-2">
                                    <h3 className="text-sm font-semibold text-text-primary">Latest Audit Run</h3>
                                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${latestAudit.dryRun ? 'bg-warning-soft text-warning' : 'bg-success-soft text-success'}`}>
                                        {latestAudit.dryRun ? 'Dry run' : 'Applied'}
                                    </span>
                                </div>
                                <div className="mt-3 divide-y divide-border-subtle">
                                    <StatRow label="Finished" value={formatDateTime(latestAudit.finishedAt)} />
                                    <StatRow label="Stale window" value={`${formatNumber(latestAudit.staleHours)}h`} />
                                    <StatRow label="Max topics/format" value={formatNumber(latestAudit.maxTopicsPerFormat)} />
                                    <StatRow label="Objective rebased" value={formatNumber(latestAudit.mcqSummary?.rebasedTopicCount)} detail={`${formatNumber(latestAudit.mcqSummary?.candidateTopicCount)} candidates`} />
                                    <StatRow label="Essay rebased" value={formatNumber(latestAudit.essaySummary?.rebasedTopicCount)} detail={`${formatNumber(latestAudit.essaySummary?.candidateTopicCount)} candidates`} />
                                    <StatRow label="Total rebased topics" value={formatNumber(latestAudit.totalRebasedTopics)} />
                                </div>
                            </div>

                            <div className="rounded-2xl border border-border-subtle bg-surface p-4">
                                <h3 className="text-sm font-semibold text-text-primary">Most Recent Effective Rebase</h3>
                                {!latestAuditWithRebases || !latestAuditWithRebases.totalRebasedTopics ? (
                                    <p className="mt-3 text-sm text-text-muted">No rebased topics recorded yet.</p>
                                ) : (
                                    <div className="mt-3 divide-y divide-border-subtle">
                                        <StatRow label="Finished" value={formatDateTime(latestAuditWithRebases.finishedAt)} />
                                        <StatRow label="Objective rebased" value={formatNumber(latestAuditWithRebases.mcqSummary?.rebasedTopicCount)} detail={`${formatNumber(latestAuditWithRebases.mcqSummary?.totalTargetReduction)} target reduction`} />
                                        <StatRow label="Essay rebased" value={formatNumber(latestAuditWithRebases.essaySummary?.rebasedTopicCount)} detail={`${formatNumber(latestAuditWithRebases.essaySummary?.totalTargetReduction)} target reduction`} />
                                        <StatRow label="Topics changed" value={formatNumber(latestAuditWithRebases.totalRebasedTopics)} />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="rounded-2xl border border-border-subtle bg-surface p-4">
                            <div className="flex items-center justify-between gap-2">
                                <h3 className="text-sm font-semibold text-text-primary">Rebased Topics</h3>
                                <span className="text-xs text-text-muted">
                                    {latestAuditWithRebases?.totalRebasedTopics
                                        ? `Showing ${Math.min(latestAuditWithRebases.rebasedTopics?.length || 0, latestAuditWithRebases.totalRebasedTopics)} of ${formatNumber(latestAuditWithRebases.totalRebasedTopics)}`
                                        : 'No changed topics'}
                                </span>
                            </div>
                            {!latestAuditWithRebases || !Array.isArray(latestAuditWithRebases.rebasedTopics) || latestAuditWithRebases.rebasedTopics.length === 0 ? (
                                <p className="mt-3 text-sm text-text-muted">The latest effective audit did not include any persisted topic rows.</p>
                            ) : (
                                <div className="mt-3 overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-border-subtle">
                                                <th className="px-3 py-2 text-left font-semibold text-text-muted">Topic</th>
                                                <th className="px-3 py-2 text-left font-semibold text-text-muted">Format</th>
                                                <th className="px-3 py-2 text-left font-semibold text-text-muted">Target</th>
                                                <th className="px-3 py-2 text-left font-semibold text-text-muted">Current Yield</th>
                                                <th className="px-3 py-2 text-left font-semibold text-text-muted">Fill</th>
                                                <th className="px-3 py-2 text-left font-semibold text-text-muted">Scheduled</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {latestAuditWithRebases.rebasedTopics.map((topic) => (
                                                <tr key={`${topic.format}-${topic.topicId}`} className="border-b border-border-subtle">
                                                    <td className="p-3">
                                                        <p className="font-semibold text-text-primary">{topic.topicTitle || topic.topicId}</p>
                                                        <p className="text-xs text-text-muted">{topic.topicId}</p>
                                                    </td>
                                                    <td className="p-3 text-text-secondary uppercase">{topic.format}</td>
                                                    <td className="p-3 text-text-secondary">
                                                        {formatNumber(topic.currentTarget)} → {formatNumber(topic.recalculatedTarget)}
                                                    </td>
                                                    <td className="p-3 text-text-secondary">
                                                        {topic.format === 'essay'
                                                            ? `${formatNumber(topic.usableEssayCount)} essay`
                                                            : `${formatNumber(topic.usableObjectiveCount ?? topic.usableMcqCount)} objective`}
                                                    </td>
                                                    <td className="p-3 text-text-secondary">{formatSignedPercent((Number(topic.fillRatio) || 0) * 100)}</td>
                                                    <td className="p-3 text-text-secondary">{topic.scheduled ? 'Yes' : 'No'}</td>
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
                        <label htmlFor="retrieval-topic-id" className="block text-sm font-semibold text-text-primary">
                            Topic ID
                        </label>
                        <input
                            id="retrieval-topic-id"
                            type="text"
                            value={retrievalTopicId}
                            onChange={(event) => setRetrievalTopicId(event.target.value)}
                            placeholder="k977anw9w94192fzq4kqh5x78x82tqea"
                            className="mt-1 w-full rounded-xl border border-border-subtle bg-surface px-3 py-2.5 text-sm text-text-primary focus:border-primary focus:outline-none"
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
                    <div className="mt-3 rounded-xl border border-error/20 bg-error-soft px-4 py-3 text-sm text-error">
                        {retrievalDiagnosticsError}
                    </div>
                ) : null}

                {!retrievalDiagnostics ? (
                    <p className="mt-4 text-sm text-text-muted">
                        Enter a topic ID to inspect lexical vs hybrid retrieval, weight backoff, and the reranked candidate passages.
                    </p>
                ) : !retrievalDiagnostics.ready ? (
                    <div className="mt-4 rounded-xl border border-warning/20 bg-warning-soft px-4 py-3 text-sm text-warning">
                        {retrievalDiagnostics.reason === 'grounded_index_unavailable'
                            ? 'Grounded evidence index is not available for this topic yet.'
                            : 'Diagnostics are not available for this topic.'}
                    </div>
                ) : (
                    <div className="mt-4 space-y-4">
                        <div className="rounded-2xl border border-border-subtle bg-surface p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <h3 className="text-base font-semibold text-text-primary">{retrievalDiagnostics.topicTitle || retrievalDiagnostics.topicId}</h3>
                                    <p className="mt-1 text-xs text-text-muted">{retrievalDiagnostics.topicId}</p>
                                </div>
                                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${retrievalDiagnostics.hybrid?.diagnostics?.vectorWeightBackoff?.enabled ? 'bg-warning-soft text-warning' : 'bg-info-soft text-info'}`}>
                                    {retrievalDiagnostics.hybrid?.diagnostics?.vectorWeightBackoff?.enabled ? 'Vector backoff enabled' : 'Standard hybrid weighting'}
                                </span>
                            </div>
                            <p className="mt-3 text-sm text-text-secondary">{retrievalDiagnostics.query}</p>
                            <div className="mt-4 grid gap-4 lg:grid-cols-3">
                                <div className="rounded-xl bg-surface-soft p-3 text-sm">
                                    <p className="text-text-muted">Lexical</p>
                                    <p className="mt-1 font-semibold text-text-primary">
                                        {formatRatioPercent(retrievalDiagnostics.lexical?.metrics?.recallAtK)} recall@k
                                    </p>
                                    <p className="mt-1 text-xs text-text-muted">
                                        {formatNumber(retrievalDiagnostics.lexical?.metrics?.matchedCount)} / {formatNumber(retrievalDiagnostics.lexical?.metrics?.targetCount)} target passages
                                    </p>
                                </div>
                                <div className="rounded-xl bg-success-soft p-3 text-sm">
                                    <p className="text-success">Hybrid</p>
                                    <p className="mt-1 font-semibold text-success">
                                        {formatRatioPercent(retrievalDiagnostics.hybrid?.metrics?.recallAtK)} recall@k
                                    </p>
                                    <p className="mt-1 text-xs text-success/80">
                                        {formatNumber(retrievalDiagnostics.hybrid?.metrics?.matchedCount)} / {formatNumber(retrievalDiagnostics.hybrid?.metrics?.targetCount)} target passages
                                    </p>
                                </div>
                                <div className="rounded-xl bg-info-soft p-3 text-sm">
                                    <p className="text-info">Backoff</p>
                                    <p className="mt-1 font-semibold text-info">
                                        {formatRatioPercent(retrievalDiagnostics.hybrid?.diagnostics?.vectorWeightBackoff?.backoff || 0)}
                                    </p>
                                    <p className="mt-1 text-xs text-info/80">
                                        Lexical {formatRatioPercent(retrievalDiagnostics.hybrid?.diagnostics?.vectorWeightBackoff?.lexicalWeight || 0)} • Vector {formatRatioPercent(retrievalDiagnostics.hybrid?.diagnostics?.vectorWeightBackoff?.vectorWeight || 0)}
                                    </p>
                                </div>
                            </div>
                            <div className="mt-4 grid gap-4 lg:grid-cols-2">
                                <div className="rounded-xl border border-border-subtle bg-surface-soft p-3 text-xs text-text-secondary">
                                    <p className="font-semibold text-text-primary">Backoff Diagnostics</p>
                                    <div className="mt-2 space-y-1">
                                        <p>Lexical top coverage: {formatRatioPercent(retrievalDiagnostics.hybrid?.diagnostics?.vectorWeightBackoff?.lexicalTopCoverage || 0)}</p>
                                        <p>Lexical anchor count: {formatNumber(retrievalDiagnostics.hybrid?.diagnostics?.vectorWeightBackoff?.lexicalAnchorCount || 0)}</p>
                                        <p>Prefer-flag anchored count: {formatNumber(retrievalDiagnostics.hybrid?.diagnostics?.vectorWeightBackoff?.preferFlagAnchoredCount || 0)}</p>
                                        <p>Numeric tokens: {(retrievalDiagnostics.hybrid?.diagnostics?.numericTokens || []).join(', ') || 'None'}</p>
                                    </div>
                                </div>
                                <div className="rounded-xl border border-border-subtle bg-surface-soft p-3 text-xs text-text-secondary">
                                    <p className="font-semibold text-text-primary">Target Passages</p>
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
