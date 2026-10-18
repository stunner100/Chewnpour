import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PublicShell from '../components/PublicShell';
import AppIcon from '../components/AppIcon';

const CHIPS = {
    success: { bg: '#B39DFF', fg: '#0A0A0A', icon: 'check_circle' },
    error: { bg: '#E8651B', fg: '#fff', icon: 'error' },
    loading: { bg: '#F3C64A', fg: '#0A0A0A', icon: 'hourglass_top' },
};

/** One-click unsubscribe from review reminder emails (signed token, no sign-in). */
const Unsubscribe = () => {
    const [searchParams] = useSearchParams();
    const token = String(searchParams.get('token') || '').trim();
    const [status, setStatus] = useState(token ? 'loading' : 'error');
    const [message, setMessage] = useState(token ? '' : 'This unsubscribe link is missing its token.');

    useEffect(() => {
        if (!token) return undefined;
        let cancelled = false;
        fetch('/api/email/unsubscribe', {
            method: 'POST',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
        })
            .then(async (response) => {
                const payload = await response.json().catch(() => ({}));
                if (cancelled) return;
                if (!response.ok) throw new Error(payload.error || 'We could not process this link.');
                setStatus('success');
                setMessage('You will not get review reminder emails any more. You can turn them back on in Settings.');
            })
            .catch((error) => {
                if (cancelled) return;
                setStatus('error');
                setMessage(`${error.message} You can turn reminders off in Settings after signing in.`);
            });
        return () => {
            cancelled = true;
        };
    }, [token]);

    const chip = CHIPS[status];

    return (
        <PublicShell>
            <div className="max-w-xl mx-auto">
                <div className="cp-card text-center">
                    <div
                        className="mx-auto flex size-16 items-center justify-center rounded-2xl"
                        style={{ background: chip.bg, color: chip.fg }}
                    >
                        <AppIcon name={chip.icon} className="text-3xl" />
                    </div>
                    <h1 className="mt-5 text-2xl font-semibold">
                        {status === 'loading' ? 'Updating preferences…' : status === 'success' ? 'Unsubscribed' : 'Preferences update'}
                    </h1>
                    <p role="status" className="mt-3 text-sm text-text-faint-light dark:text-text-faint-dark">
                        {message || 'Working on your request.'}
                    </p>
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                        <Link to="/dashboard/settings#notifications" className="btn-primary px-5 py-2.5 text-sm">
                            Open settings
                        </Link>
                        <Link to="/" className="btn-secondary px-5 py-2.5 text-sm">
                            Back to home
                        </Link>
                    </div>
                </div>
            </div>
        </PublicShell>
    );
};

export default Unsubscribe;
