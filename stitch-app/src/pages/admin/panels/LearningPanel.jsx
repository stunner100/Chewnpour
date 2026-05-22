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

export const LearningPanel = ({ snapshot, activeUsersDays }) => {
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
                    <div className="divide-y divide-border-subtle">
                        <StatRow label="Objective exams" value={formatNumber(exam.objectiveAttempts)} detail={exam.totalAttempts > 0 ? formatPercent((exam.objectiveAttempts / exam.totalAttempts) * 100) : '0%'} />
                        <StatRow label="Essay exams" value={formatNumber(exam.essayAttempts)} detail={exam.totalAttempts > 0 ? formatPercent((exam.essayAttempts / exam.totalAttempts) * 100) : '0%'} />
                    </div>
                </SectionCard>

                <SectionCard title="Score Distribution">
                    {scoreDistribution.length > 0 ? (
                        <BarChart items={scoreDistribution.map((b) => ({ label: b.label, value: b.count }))} />
                    ) : (
                        <p className="text-sm text-text-muted">No exam data yet.</p>
                    )}
                </SectionCard>
            </section>

            {topExamUsers.length > 0 ? (
                <SectionCard title="Top Exam Users">
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="border-b border-border-subtle">
                                    <th className="px-3 py-2 text-left font-semibold text-text-muted">User</th>
                                    <th className="px-3 py-2 text-left font-semibold text-text-muted">Attempts</th>
                                    <th className="px-3 py-2 text-left font-semibold text-text-muted">Avg Score</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topExamUsers.map((u) => (
                                    <tr key={u.userId} className="border-b border-border-subtle">
                                        <td className="px-3 py-2 font-semibold text-text-primary">{u.fullName || u.userId}</td>
                                        <td className="px-3 py-2 text-text-secondary">{formatNumber(u.attempts)}</td>
                                        <td className="px-3 py-2 text-text-secondary">{formatPercent(u.avgScore)}</td>
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
