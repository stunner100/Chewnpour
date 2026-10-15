import React, { useEffect, useState } from 'react';
import { SectionCard } from '../../../components/admin/AdminUi';
import { formatDateTime } from '../../../lib/admin/formatters';

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

    const users = results ?? recent;

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
            {users.length ? (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[36rem] text-left text-sm">
                        <caption className="sr-only">Recent students</caption>
                        <thead>
                            <tr className="border-b border-border-subtle text-text-muted">
                                <th className="py-2 pr-3 font-medium">Name</th>
                                <th className="py-2 pr-3 font-medium">Email</th>
                                <th className="py-2 pr-3 font-medium">Joined</th>
                                <th className="py-2 font-medium">Onboarding</th>
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
                                    <td className="py-2.5 text-text-secondary">
                                        {user.onboarded ? 'Done' : 'Incomplete'}
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
