import React from 'react';
import { SectionCard } from '../../../components/admin/AdminUi';
import { formatDateTime } from '../../../lib/admin/formatters';

export const UsersPanel = ({ snapshot }) => {
    const users = Array.isArray(snapshot?.users?.recent) ? snapshot.users.recent : [];

    return (
        <SectionCard title="Recent students" badge={`${users.length} shown`}>
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
                <p className="text-sm text-text-secondary">No students yet.</p>
            )}
        </SectionCard>
    );
};
