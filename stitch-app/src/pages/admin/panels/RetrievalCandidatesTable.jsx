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

export const RetrievalCandidatesTable = ({ title, rows, showPenaltyColumns = false }) => (
    <div className="rounded-2xl border border-border-subtle bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
            <span className="text-xs text-text-muted">{formatNumber(rows?.length || 0)} rows</span>
        </div>
        {!Array.isArray(rows) || rows.length === 0 ? (
            <p className="mt-3 text-sm text-text-muted">No candidates recorded.</p>
        ) : (
            <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-xs">
                    <thead>
                        <tr className="border-b border-border-subtle">
                            <th className="p-2 text-left font-semibold text-text-muted">Passage</th>
                            <th className="p-2 text-left font-semibold text-text-muted">Page</th>
                            <th className="p-2 text-left font-semibold text-text-muted">Source</th>
                            <th className="p-2 text-left font-semibold text-text-muted">Final</th>
                            <th className="p-2 text-left font-semibold text-text-muted">Lexical</th>
                            <th className="p-2 text-left font-semibold text-text-muted">Vector</th>
                            <th className="p-2 text-left font-semibold text-text-muted">Numeric</th>
                            {showPenaltyColumns ? (
                                <>
                                    <th className="p-2 text-left font-semibold text-text-muted">Flag Boost</th>
                                    <th className="p-2 text-left font-semibold text-text-muted">Num Penalty</th>
                                    <th className="p-2 text-left font-semibold text-text-muted">Broad Penalty</th>
                                </>
                            ) : null}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={`${title}-${row.passageId}-${row.page}`} className="border-b border-border-subtle align-top">
                                <td className="p-2">
                                    <p className="font-semibold text-text-primary">{row.passageId}</p>
                                    <p className="mt-1 max-w-xs text-[11px] text-text-muted">{row.sectionHint || 'No section hint'}</p>
                                </td>
                                <td className="p-2 text-text-secondary">{formatNumber(row.page)}</td>
                                <td className="p-2 text-text-secondary uppercase">{row.retrievalSource || 'n/a'}</td>
                                <td className="p-2 text-text-secondary">{formatRatioPercent(row.finalScore)}</td>
                                <td className="p-2 text-text-secondary">{formatRatioPercent(row.lexicalScore)}</td>
                                <td className="p-2 text-text-secondary">{formatRatioPercent(row.vectorScore)}</td>
                                <td className="p-2 text-text-secondary">{formatRatioPercent(row.numericAgreement)}</td>
                                {showPenaltyColumns ? (
                                    <>
                                        <td className="p-2 text-text-secondary">{formatRatioPercent(row.preferFlagBoost)}</td>
                                        <td className="p-2 text-text-secondary">{formatRatioPercent(row.vectorOnlyMissingNumericPenalty)}</td>
                                        <td className="p-2 text-text-secondary">{formatRatioPercent(row.vectorOnlyBroadTopicPenalty)}</td>
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
