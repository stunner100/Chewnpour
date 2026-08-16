import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import DeniedCard from '../../components/admin/DeniedCard';
import { TabBar } from '../../components/admin/AdminUi';
import { TABS } from '../../lib/admin/constants';
import { OverviewPanel } from './panels/OverviewPanel';
import { LearningPanel } from './panels/LearningPanel';
import { ContentPanel } from './panels/ContentPanel';
import { UsersPanel } from './panels/UsersPanel';
import { UploadsPanel } from './panels/UploadsPanel';

const TAB_KEYS = new Set(TABS.map((tab) => tab.key));

const tabFromHash = (hash) => {
    const key = String(hash || '').replace(/^#/, '');
    return TAB_KEYS.has(key) ? key : 'overview';
};

export default function AdminDashboard() {
    const { user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [snapshot, setSnapshot] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [deniedReason, setDeniedReason] = useState('');

    const activeTab = tabFromHash(location.hash);

    const loadSnapshot = useCallback(async () => {
        setLoading(true);
        setError('');
        setDeniedReason('');
        try {
            const response = await fetch('/api/admin/snapshot', {
                credentials: 'include',
                headers: { Accept: 'application/json' },
            });
            const payload = await response.json().catch(() => ({}));
            if (response.status === 401) {
                setDeniedReason('unauthenticated');
                setSnapshot(null);
                return;
            }
            if (response.status === 403) {
                setDeniedReason('forbidden');
                setSnapshot(null);
                return;
            }
            if (!response.ok) {
                throw new Error(payload.error || 'Could not load admin data.');
            }
            setSnapshot(payload.snapshot || null);
        } catch (err) {
            setError(err.message || 'Could not load admin data.');
            setSnapshot(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadSnapshot();
    }, [loadSnapshot]);

    const onTabChange = (key) => {
        navigate({ pathname: '/admin', hash: key === 'overview' ? '' : key }, { replace: true });
    };

    const panel = useMemo(() => {
        if (!snapshot) return null;
        if (activeTab === 'learning') return <LearningPanel snapshot={snapshot} />;
        if (activeTab === 'content') return <ContentPanel snapshot={snapshot} />;
        if (activeTab === 'users') return <UsersPanel snapshot={snapshot} />;
        if (activeTab === 'uploads') return <UploadsPanel snapshot={snapshot} />;
        return <OverviewPanel snapshot={snapshot} />;
    }, [activeTab, snapshot]);

    if (deniedReason) {
        return (
            <DeniedCard
                reason={deniedReason}
                signedInEmail={user?.email}
                signedInUserId={user?.id}
            />
        );
    }

    return (
        <div className="mx-auto w-full max-w-6xl px-space-6 py-space-8">
            <header className="mb-6">
                <h1 className="font-display text-display-sm font-bold text-text-primary text-balance">
                    Admin dashboard
                </h1>
                <p className="mt-2 max-w-2xl text-body-md text-text-secondary text-pretty">
                    Counts for students, uploads, lessons, quizzes, and tutor chat.
                </p>
            </header>

            <TabBar activeTab={activeTab} onTabChange={onTabChange} />

            <div
                role="tabpanel"
                aria-labelledby={`admin-tab-${activeTab}`}
                className="mt-6"
            >
                {loading ? (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {[0, 1, 2].map((key) => (
                            <div
                                key={key}
                                className="h-28 animate-pulse rounded-xl border border-border-subtle bg-surface-soft"
                            />
                        ))}
                    </div>
                ) : error ? (
                    <div role="alert" className="rounded-xl border border-border-subtle bg-surface p-6">
                        <h2 className="font-semibold text-text-primary">We couldn't load admin data</h2>
                        <p className="mt-2 text-sm text-text-secondary">This is usually temporary.</p>
                        <button type="button" className="btn-primary mt-4 min-h-11" onClick={loadSnapshot}>
                            Try again
                        </button>
                    </div>
                ) : (
                    panel
                )}
            </div>

            <p className="mt-8 text-xs text-text-muted">
                Bootstrap admin includes patrickannor35@gmail.com. Extra allowlist emails go in ADMIN_EMAILS.
            </p>
        </div>
    );
}
