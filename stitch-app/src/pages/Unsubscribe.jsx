import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import PublicShell from '../components/PublicShell';

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
                await unsubscribeByToken({ token, emailType });
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

    const iconChip = status === 'success'
        ? { bg: '#B39DFF', fg: '#0A0A0A', icon: 'check_circle' }
        : status === 'error'
            ? { bg: '#E8651B', fg: '#fff', icon: 'error' }
            : { bg: '#F3C64A', fg: '#0A0A0A', icon: 'hourglass_top' };

    return (
        <PublicShell>
            <div className="max-w-xl mx-auto">
                <div className="cp-card text-center">
                    <div
                        className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl"
                        style={{ background: iconChip.bg, color: iconChip.fg }}
                    >
                        <span className="material-symbols-outlined text-[28px]">{iconChip.icon}</span>
                    </div>
                    <h1 className="mt-5 text-2xl font-bold">
                        {status === 'success' ? 'Preferences updated' : status === 'error' ? 'Unsubscribe failed' : 'Updating preferences'}
                    </h1>
                    <p className="mt-2 text-sm text-white/60">
                        {status === 'loading' ? 'Please wait while we update your email preferences.' : message}
                    </p>
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                        <Link to="/dashboard" className="cp-btn-primary w-auto px-5">
                            <span className="material-symbols-outlined text-[18px]">home</span>
                            Back to dashboard
                        </Link>
                        <Link to="/profile" className="cp-btn-secondary w-auto px-5">
                            <span className="material-symbols-outlined text-[18px]">settings</span>
                            Email settings
                        </Link>
                    </div>
                </div>
            </div>
        </PublicShell>
    );
};

export default Unsubscribe;
