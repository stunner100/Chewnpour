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
        <div className="min-h-screen bg-background-light dark:bg-background-dark px-4 py-10 sm:px-6">
            <div className="mx-auto w-full max-w-xl card-base p-6 sm:p-8 text-center">
                <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${
                    status === 'success'
                        ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300'
                        : status === 'error'
                            ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'
                }`}>
                    <span className="material-symbols-outlined">
                        {status === 'success' ? 'check_circle' : status === 'error' ? 'error' : 'hourglass_top'}
                    </span>
                </div>
                <h1 className="mt-4 text-2xl font-black text-slate-900 dark:text-white">
                    {status === 'success' ? 'Preferences updated' : status === 'error' ? 'Unsubscribe failed' : 'Updating preferences'}
                </h1>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                    {status === 'loading' ? 'Please wait while we update your email preferences.' : message}
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    <Link
                        to="/dashboard"
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-hover transition-colors"
                    >
                        <span className="material-symbols-outlined text-[18px]">home</span>
                        Back to dashboard
                    </Link>
                    <Link
                        to="/profile"
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-primary/40 transition-colors dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
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
