import React, { useState } from 'react';
import AppIcon from '../AppIcon';

const REASONS = [
    { value: 'wrong_answer', label: 'Wrong answer' },
    { value: 'unclear', label: 'Unclear question' },
    { value: 'not_in_notes', label: 'Not in my notes' },
    { value: 'other', label: 'Something else' },
];

/** Lets a student report a generated question to the admins. */
const ReportQuestionButton = ({ questionId }) => {
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [note, setNote] = useState('');
    const [state, setState] = useState('idle'); // idle | sending | sent
    const [error, setError] = useState('');

    if (!questionId) return null;
    if (state === 'sent') {
        return (
            <p role="status" className="mt-3 inline-flex items-center gap-1.5 text-caption font-semibold text-text-secondary">
                <AppIcon name="check_circle" className="text-[16px] text-success" aria-hidden="true" />
                Thanks. We'll review this question.
            </p>
        );
    }
    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-caption font-semibold text-text-secondary hover:text-text-primary"
            >
                <AppIcon name="flag" className="text-[16px]" aria-hidden="true" />
                Report a problem
            </button>
        );
    }

    const send = async (event) => {
        event.preventDefault();
        if (!reason) return;
        setState('sending');
        setError('');
        try {
            const response = await fetch(`/api/questions/${encodeURIComponent(questionId)}/flag`, {
                method: 'POST',
                credentials: 'include',
                headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason, note }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Could not send the report');
            setState('sent');
        } catch (err) {
            setError(err.message || 'Could not send the report');
            setState('idle');
        }
    };

    return (
        <form onSubmit={send} className="mt-3 rounded-[16px] border border-border-subtle bg-surface p-3">
            <fieldset className="border-0 p-0">
                <legend className="text-caption font-semibold text-text-primary">What's wrong with this question?</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                    {REASONS.map((item) => (
                        <label
                            key={item.value}
                            className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border px-3 text-caption font-semibold transition-colors focus-within:ring-2 focus-within:ring-primary/30 ${
                                reason === item.value
                                    ? 'border-primary bg-primary-subtle text-primary'
                                    : 'border-border-default bg-surface text-text-secondary hover:bg-surface-soft'
                            }`}
                        >
                            <input
                                type="radio"
                                name={`report-${questionId}`}
                                value={item.value}
                                checked={reason === item.value}
                                onChange={() => setReason(item.value)}
                                className="sr-only"
                            />
                            {item.label}
                        </label>
                    ))}
                </div>
            </fieldset>
            <label className="mt-3 block text-caption font-semibold text-text-primary" htmlFor={`report-note-${questionId}`}>
                Details (optional)
            </label>
            <textarea
                id={`report-note-${questionId}`}
                value={note}
                maxLength={500}
                rows={2}
                onChange={(event) => setNote(event.target.value)}
                className="mt-1 w-full rounded-xl border border-border-subtle bg-surface-soft px-3 py-2 text-body-sm text-text-primary"
            />
            {error && <p role="alert" className="mt-2 text-caption text-error">{error}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
                <button type="submit" disabled={!reason || state === 'sending'} className="btn-primary inline-flex min-h-11 text-body-sm disabled:opacity-50">
                    {state === 'sending' ? 'Sending…' : 'Send report'}
                </button>
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary inline-flex min-h-11 text-body-sm">
                    Cancel
                </button>
            </div>
        </form>
    );
};

export default ReportQuestionButton;
