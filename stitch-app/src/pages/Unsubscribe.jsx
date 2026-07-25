import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PublicShell from '../components/PublicShell';
import AppIcon from '../components/AppIcon';

const LABELS = {
    all: 'all emails',
    streak_reminders: 'streak reminders',
    streak_broken: 'streak broken alerts',
    weekly_summary: 'weekly summaries',
    product_research: 'product research emails',
    winback_offers: 'win-back offers',
};

const normalizeType = (value) => String(value || '').trim().toLowerCase();

/**
 * Unsubscribe is parked during the Supabase hard cutover.
 * Prefer settings email preferences once that surface is restored.
 */
const Unsubscribe = () => {
    const [searchParams] = useSearchParams();
    const [unsubscribeState, setUnsubscribeState] = useState({
        status: 'loading',
        message: '',
    });
    const { status, message } = unsubscribeState;

    const token = String(searchParams.get('token') || '').trim();
    const emailType = normalizeType(searchParams.get('type') || 'all');
    const label = useMemo(() => LABELS[emailType] || LABELS.all, [emailType]);

    useEffect(() => {
        if (!token) {
            setUnsubscribeState({
                status: 'error',
                message: 'This unsubscribe link is missing a token.',
            });
            return;
        }

        setUnsubscribeState({
            status: 'error',
            message:
                `We could not process this unsubscribe link for ${label} yet. ` +
                'Email preferences are being moved to the new backend — manage them from Settings once signed in, or reply to the email for help.',
        });
    }, [emailType, label, token]);

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
                        className="mx-auto flex size-16 items-center justify-center rounded-2xl"
                        style={{ background: iconChip.bg, color: iconChip.fg }}
                    >
                        <AppIcon name={iconChip.icon} className="text-3xl" />
                    </div>
                    <h1 className="mt-5 text-2xl font-semibold">
                        {status === 'loading' ? 'Updating preferences…' : 'Preferences update'}
                    </h1>
                    <p className="mt-3 text-sm text-text-faint-light dark:text-text-faint-dark">
                        {message || 'Working on your request.'}
                    </p>
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                        <Link to="/dashboard/settings" className="btn-primary px-5 py-2.5 text-sm">
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
