import React, { useEffect, useState } from 'react';
import { SectionCard } from '../../../components/admin/AdminUi';
import { formatDateTime } from '../../../lib/admin/formatters';
import { grantAdminAccess } from '../../../lib/admin/ui';

const ACTIVITY_STEPS = [
    { key: 'uploaded', label: 'Uploaded' },
    { key: 'studied', label: 'Studied a lesson' },
    { key: 'quizzed', label: 'Took a quiz or exam' },
];

// What the student has done so far; replaces the retired onboarding flag.
const StudentActivity = ({ activity }) => {
    const done = ACTIVITY_STEPS.filter((step) => activity?.[step.key]);
    if (!done.length) return <span className="text-text-muted">No activity yet</span>;
    return (
        <ul className="flex flex-wrap gap-1.5" aria-label="Student activity">
            {done.map((step) => (
                <li key={step.key} className="rounded-full bg-surface-soft px-2 py-0.5 text-xs font-medium text-text-secondary">
                    {step.label}
                </li>
            ))}
        </ul>
    );
};

export const UsersPanel = ({ snapshot }) => {
    const recent = Array.isArray(snapshot?.users?.recent) ? snapshot.users.recent : [];
    const [query, setQuery] = useState('');
    const [results, setResults] = useState(null);
    const [searchError, setSearchError] = useState('');
    const term = query.trim();

    useEffect(() => {
        if (!term) {
            setResults(null);
            setSearchError('');
            return undefined;
        }
        let cancelled = false;
        const timer = setTimeout(async () => {
            try {
                const response = await fetch(`/api/admin/users?q=${encodeURIComponent(term)}`, {
                    credentials: 'include',
                    headers: { Accept: 'application/json' },
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(payload.error || 'Search failed.');
                if (!cancelled) {
                    setResults(Array.isArray(payload.users) ? payload.users : []);
                    setSearchError('');
                }
            } catch (err) {
                if (!cancelled) setSearchError(err.message || 'Search failed.');
            }
        }, 250);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [term]);

    const [adminIds, setAdminIds] = useState(() => new Set());
    const [granting, setGranting] = useState('');
    const [grantMessage, setGrantMessage] = useState('');

    const users = (results ?? recent).map((user) => (adminIds.has(user.id) ? { ...user, isAdmin: true } : user));

    const makeAdmin = async (user) => {
        if (!window.confirm(`Make ${user.email} an admin? They'll be able to see all students and manage past questions.`)) return;
        setGranting(user.id);
        setGrantMessage('');
        try {
            const result = await grantAdminAccess(
                { userId: user.id },
                { confirmUnverified: (message) => window.confirm(`${message}\n\nAdd them as an admin anyway?`) },
            );
            if (result.cancelled) return;
            setAdminIds((current) => new Set(current).add(user.id));
            setGrantMessage(`${user.email} is now an admin.`);
        } catch (err) {
            setGrantMessage(err.message || 'Could not add admin.');
        } finally {
            setGranting('');
        }
    };

    return (
        <SectionCard title={results ? 'Matching students' : 'Recent students'} badge={`${users.length} shown`}>
            <label className="mb-4 block max-w-sm">
                <span className="sr-only">Search students by name or email</span>
                <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search by name or email"
                    className="w-full rounded-lg border border-border-default bg-surface-soft px-3 py-2 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft"
                />
            </label>
            {searchError ? <p role="alert" className="mb-3 text-sm text-error">{searchError}</p> : null}
            {grantMessage ? <p role="status" className="mb-3 text-sm text-text-secondary">{grantMessage}</p> : null}
            {users.length ? (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[44rem] text-left text-sm">
                        <caption className="sr-only">Recent students</caption>
                        <thead>
                            <tr className="border-b border-border-subtle text-text-muted">
                                <th className="py-2 pr-3 font-medium">Name</th>
                                <th className="py-2 pr-3 font-medium">Email</th>
                                <th className="py-2 pr-3 font-medium">Joined</th>
                                <th className="py-2 pr-3 font-medium">Activity</th>
                                <th className="py-2 font-medium">Access</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((user) => (
                                <tr key={user.id} className="border-b border-border-subtle last:border-0">
                                    <td className="py-2.5 pr-3 font-medium text-text-primary">
                                        {user.name || 'Unnamed'}
                                    </td>
                                    <td className="py-2.5 pr-3 text-text-secondary">{user.email}</td>
                                    <td className="py-2.5 pr-3 text-text-secondary">
                                        {formatDateTime(user.createdAt)}
                                    </td>
                                    <td className="py-2.5 pr-3">
                                        <StudentActivity activity={user.activity} />
                                    </td>
                                    <td className="py-2.5 whitespace-nowrap">
                                        {user.isAdmin ? (
                                            <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">Admin</span>
                                        ) : (
                                            <button
                                                type="button"
                                                className="btn-secondary min-h-9 px-3 text-xs"
                                                disabled={granting === user.id}
                                                onClick={() => makeAdmin(user)}
                                            >
                                                {granting === user.id ? 'Adding…' : 'Make admin'}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="text-sm text-text-secondary">{results ? 'No students match.' : 'No students yet.'}</p>
            )}
        </SectionCard>
    );
};
