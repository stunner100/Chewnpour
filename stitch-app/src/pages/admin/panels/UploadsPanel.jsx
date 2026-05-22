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

export const UploadsPanel = ({ snapshot }) => {
    const uploadBreakdown = snapshot.uploadBreakdown || {};
    const uploadChannels = Array.isArray(uploadBreakdown.channels) ? uploadBreakdown.channels : [];
    const uploadFileTypes = Array.isArray(uploadBreakdown.fileTypes) ? uploadBreakdown.fileTypes : [];
    const topUploadUsers = Array.isArray(uploadBreakdown.topUsers) ? uploadBreakdown.topUsers : [];

    return (
        <div className="space-y-4">
            <SectionCard title="Where Uploads Went" badge={`${formatNumber(uploadBreakdown.total)} total tracked`}>
                <div className="grid gap-4 xl:grid-cols-3">
                    <div className="rounded-2xl border border-border-subtle bg-surface p-4">
                        <h3 className="text-sm font-semibold text-text-primary">Destination Split</h3>
                        <div className="mt-3 space-y-3">
                            {uploadChannels.length === 0 ? (
                                <p className="text-sm text-text-muted">No upload activity yet.</p>
                            ) : uploadChannels.map((channel) => (
                                <div key={channel.key} className="space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-semibold text-text-primary">{channel.label}</p>
                                        <p className="text-xs text-text-muted">{formatNumber(channel.count)} ({formatPercent(channel.percent)})</p>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-surface-soft">
                                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(0, Math.min(Number(channel.percent) || 0, 100))}%` }} />
                                    </div>
                                    <p className="text-xs text-text-muted">
                                        Ready {formatNumber(channel.statuses?.ready)} • Processing {formatNumber(channel.statuses?.processing)} • Errors {formatNumber(channel.statuses?.error)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-border-subtle bg-surface p-4">
                        <h3 className="text-sm font-semibold text-text-primary">Top File Types</h3>
                        <div className="mt-3 space-y-2.5">
                            {uploadFileTypes.length === 0 ? (
                                <p className="text-sm text-text-muted">No file types captured yet.</p>
                            ) : uploadFileTypes.map((entry) => (
                                <div key={entry.fileType} className="flex items-center justify-between gap-3 rounded-xl bg-surface-soft px-3 py-2">
                                    <p className="text-sm font-medium text-text-primary">{formatFileTypeLabel(entry.fileType)}</p>
                                    <p className="text-xs text-text-muted">{formatNumber(entry.count)} ({formatPercent(entry.percent)})</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-border-subtle bg-surface p-4">
                        <h3 className="text-sm font-semibold text-text-primary">Top Upload Users</h3>
                        <div className="mt-3 space-y-2.5">
                            {topUploadUsers.length === 0 ? (
                                <p className="text-sm text-text-muted">No user upload activity yet.</p>
                            ) : topUploadUsers.map((entry) => (
                                <div key={entry.userId} className="rounded-xl bg-surface-soft px-3 py-2">
                                    <p className="text-sm font-semibold text-text-primary">{entry.email || entry.fullName || entry.userId}</p>
                                    <p className="text-xs text-text-muted">{entry.department || 'No dept'} • Total {formatNumber(entry.totalUploads)}</p>
                                    <p className="mt-1 text-xs text-text-muted">
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
