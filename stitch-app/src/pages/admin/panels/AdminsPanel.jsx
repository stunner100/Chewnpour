import React, { useCallback, useEffect, useState } from 'react';
import { SectionCard } from '../../../components/admin/AdminUi';
import { formatDateTime } from '../../../lib/admin/formatters';
import { ADMIN_SOURCE_LABELS, grantAdminAccess } from '../../../lib/admin/ui';

const confirmUnverified = (message) =>
    window.confirm(`${message}\n\nAdd them as an admin anyway?`);

export const AdminsPanel = () => {
    const [admins, setAdmins] = useState([]);
    const [viewerId, setViewerId] = useState('');
    const [loading, setLoading] = useState(true);
    const [email, setEmail] = useState('');
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/admin/admins', {
                credentials: 'include',
                headers: { Accept: 'application/json' },
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Could not load admins.');
            setAdmins(Array.isArray(payload.admins) ? payload.admins : []);
            setViewerId(payload.viewerId || '');
        } catch (err) {
            setError(err.message || 'Could not load admins.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const add = async (event) => {
        event.preventDefault();
        const target = email.trim();
        if (!target) return;
        setBusy('add');
        setError('');
        setNotice('');
        try {
            const result = await grantAdminAccess({ email: target }, { confirmUnverified });
            if (result.cancelled) return;
            setAdmins(result.admins || []);
            setNotice(`${result.granted?.email || target} is now an admin.`);
            setEmail('');
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy('');
        }
    };

    const remove = async (admin) => {
        if (!window.confirm(`Remove admin access for ${admin.email}?`)) return;
        setBusy(admin.userId);
        setError('');
        setNotice('');
        try {
            const response = await fetch(`/api/admin/admins/${encodeURIComponent(admin.userId)}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: { Accept: 'application/json' },
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Could not remove admin.');
            setAdmins(payload.admins || []);
            setNotice(`${admin.email} is no longer an admin.`);
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy('');
        }
    };

    return (
        <div className="space-y-4">
            <SectionCard title="Add an admin">
                <form onSubmit={add} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <label className="block flex-1 text-sm">
                        <span className="mb-1 block font-medium text-text-secondary">Email of an existing ChewnPour account</span>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder="name@example.com"
                            className="w-full rounded-lg border border-border-default bg-surface-soft px-3 py-2 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft"
                        />
                    </label>
                    <button type="submit" className="btn-primary min-h-11 px-5" disabled={busy === 'add'}>
                        {busy === 'add' ? 'Adding…' : 'Make admin'}
                    </button>
                </form>
                <p className="mt-3 text-xs text-text-muted">
                    They need to have signed up first. You can also make someone an admin from the Users tab.
                </p>
                {error ? <p role="alert" className="mt-3 text-sm text-error">{error}</p> : null}
                {notice ? <p role="status" className="mt-3 text-sm text-success">{notice}</p> : null}
            </SectionCard>

            <SectionCard title="Admins" badge={loading ? 'Loading…' : `${admins.filter((admin) => admin.active).length} active`}>
                {admins.length ? (
                    <ul className="divide-y divide-border-subtle">
                        {admins.map((admin) => (
                            <li key={admin.userId || admin.email} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-text-primary">
                                        {admin.name || admin.email}
                                        {admin.userId && admin.userId === viewerId ? (
                                            <span className="ml-2 text-xs font-normal text-text-muted">(you)</span>
                                        ) : null}
                                    </p>
                                    {admin.name ? <p className="truncate text-xs text-text-secondary">{admin.email}</p> : null}
                                    <p className="mt-1 flex flex-wrap gap-1.5 text-xs">
                                        {admin.sources.map((source) => (
                                            <span key={source} className="rounded-full bg-surface-soft px-2 py-0.5 text-text-secondary">
                                                {ADMIN_SOURCE_LABELS[source] || source}
                                            </span>
                                        ))}
                                        {!admin.active ? (
                                            <span className="rounded-full bg-warning-soft px-2 py-0.5 text-warning">
                                                {admin.userId ? 'Waiting for email verification' : 'No account yet'}
                                            </span>
                                        ) : null}
                                        {admin.addedBy ? (
                                            <span className="text-text-muted">
                                                Added by {admin.addedBy}{admin.grantedAt ? ` · ${formatDateTime(admin.grantedAt)}` : ''}
                                            </span>
                                        ) : null}
                                    </p>
                                </div>
                                {admin.canRemove && admin.userId !== viewerId ? (
                                    <button
                                        type="button"
                                        className="btn-secondary min-h-9 shrink-0 px-3 text-xs"
                                        disabled={busy === admin.userId}
                                        onClick={() => remove(admin)}
                                    >
                                        {busy === admin.userId ? 'Removing…' : 'Remove admin'}
                                    </button>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-text-secondary">{loading ? 'Loading admins…' : 'No admins found.'}</p>
                )}
                <p className="mt-3 text-xs text-text-muted">
                    Owner and environment admins are managed in code and Vercel settings, so they can't be removed here.
                </p>
            </SectionCard>
        </div>
    );
};
