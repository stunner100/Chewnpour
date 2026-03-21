import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

const LABELS = {
    all: 'all emails',
    streak_reminders: 'streak reminders',
    streak_broken: 'streak broken alerts',
    weekly_summary: 'weekly summaries',
    product_research: 'product research emails',
    winback_offers: 'win-back offers',
};

const normalizeType = (value) => String(value || '').trim().toLowerCase();

const Unsubscribe = () => {
    const [searchParams] = useSearchParams();
    const unsubscribeByToken = useMutation(api.profiles.unsubscribeByToken);
    const [status, setStatus] = useState('loading');
    const [message, setMessage] = useState('');

    const token = String(searchParams.get('token') || '').trim();
    const emailType = normalizeType(searchParams.get('type') || 'all');
    const label = useMemo(() => LABELS[emailType] || LABELS.all, [emailType]);

    useEffect(() => {
        let disposed = false;

        const run = async () => {
            if (!token) {
                if (!disposed) {
                    setStatus('error');
                    setMessage('This unsubscribe link is missing a token.');
                }
                return;
            }

            try {
                await unsubscribeByToken({
                    token,
                    emailType,
                });
                if (!disposed) {
                    setStatus('success');
                    setMessage(`You have been unsubscribed from ${label}.`);
                }
            } catch (error) {
                if (!disposed) {
                    setStatus('error');
                    setMessage(String(error?.message || error || 'We could not process this unsubscribe link.'));
                }
            }
        };

        void run();

        return () => {
            disposed = true;
        };
    }, [emailType, label, token, unsubscribeByToken]);

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center px-4 py-10">
            <div className="w-full max-w-xl card-base p-6 sm:p-8 text-center">
                <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${
                    status === 'success'
                        ? 'bg-accent-emerald/10 text-accent-emerald'
                        : status === 'error'
                            ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                            : 'bg-surface-hover-light dark:bg-surface-hover-dark text-text-faint-light dark:text-text-faint-dark'
                }`}>
                    <span className="material-symbols-outlined text-[24px]">
                        {status === 'success' ? 'check_circle' : status === 'error' ? 'error' : 'hourglass_top'}
                    </span>
                </div>
                <h1 className="mt-4 text-display-sm text-text-main-light dark:text-text-main-dark">
                    {status === 'success' ? 'Preferences updated' : status === 'error' ? 'Unsubscribe failed' : 'Updating preferences'}
                </h1>
                <p className="mt-2 text-body-sm text-text-sub-light dark:text-text-sub-dark">
                    {status === 'loading' ? 'Please wait while we update your email preferences.' : message}
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    <Link
                        to="/dashboard"
                        className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-body-sm"
                    >
                        <span className="material-symbols-outlined text-[18px]">home</span>
                        Back to dashboard
                    </Link>
                    <Link
                        to="/profile"
                        className="btn-secondary inline-flex items-center gap-2 px-5 py-2.5 text-body-sm"
                    >
                        <span className="material-symbols-outlined text-[18px]">settings</span>
                        Email settings
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default Unsubscribe;
