import React, { useCallback, useEffect, useState } from 'react';
import { SectionCard } from '../../../components/admin/AdminUi';
import { formatDateTime } from '../../../lib/admin/formatters';

const REASON_LABELS = {
    wrong_answer: 'Wrong answer',
    unclear: 'Unclear question',
    not_in_notes: 'Not in their notes',
    other: 'Something else',
};
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

const requestJson = async (url, init) => {
    const response = await fetch(url, {
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        ...init,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Request failed');
    return payload;
};

export const QuestionReportsPanel = () => {
    const [flags, setFlags] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState('');
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const payload = await requestJson('/api/admin/question-flags');
            setFlags(Array.isArray(payload.flags) ? payload.flags : []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const resolve = async (flagId, outcome) => {
        if (outcome === 'removed' && !window.confirm('Delete this question for the student? This cannot be undone.')) return;
        setBusyId(flagId);
        setError('');
        try {
            const payload = await requestJson(`/api/admin/question-flags/${encodeURIComponent(flagId)}/resolve`, {
                method: 'POST',
                body: JSON.stringify({ outcome }),
            });
            setFlags(Array.isArray(payload.flags) ? payload.flags : []);
        } catch (err) {
            setError(err.message);
        } finally {
            setBusyId('');
        }
    };

    return (
        <SectionCard title="Reported questions" badge={loading ? '…' : `${flags.length} open`}>
            {error && <p role="alert" className="mb-3 text-sm text-error">{error}</p>}
            {!loading && flags.length === 0 ? (
                <p className="text-sm text-text-secondary">No open reports.</p>
            ) : (
                <ul className="space-y-3">
                    {flags.map((flag) => (
                        <li key={flag.id} className="rounded-xl border border-border-subtle p-4">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                                <span className="rounded-full bg-error-soft px-2 py-0.5 font-semibold text-error">
                                    {REASON_LABELS[flag.reason] || flag.reason}
                                </span>
                                <span>{flag.courseTitle}{flag.topicTitle ? ` · ${flag.topicTitle}` : ''}</span>
                                <span>{flag.userEmail}</span>
                                <span>{formatDateTime(flag.createdAt)}</span>
                            </div>
                            <p className="mt-2 font-medium text-text-primary [overflow-wrap:anywhere]">{flag.prompt}</p>
                            <ol className="mt-2 space-y-1 text-sm">
                                {flag.options.map((option, index) => (
                                    <li
                                        key={`${flag.id}-${index}`}
                                        className={index === flag.correctIndex ? 'font-semibold text-success' : 'text-text-secondary'}
                                    >
                                        {LETTERS[index] || index + 1}. {option}
                                        {index === flag.correctIndex ? ' (marked correct)' : ''}
                                    </li>
                                ))}
                            </ol>
                            {flag.explanation && <p className="mt-2 text-sm text-text-secondary">{flag.explanation}</p>}
                            {flag.note && (
                                <p className="mt-2 rounded-lg bg-surface-soft px-3 py-2 text-sm text-text-primary">
                                    Student: {flag.note}
                                </p>
                            )}
                            <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    disabled={busyId === flag.id}
                                    onClick={() => resolve(flag.id, 'dismissed')}
                                    className="btn-secondary inline-flex min-h-10 text-sm disabled:opacity-50"
                                >
                                    Keep question
                                </button>
                                <button
                                    type="button"
                                    disabled={busyId === flag.id}
                                    onClick={() => resolve(flag.id, 'removed')}
                                    className="btn-primary inline-flex min-h-10 text-sm disabled:opacity-50"
                                >
                                    Remove question
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </SectionCard>
    );
};
