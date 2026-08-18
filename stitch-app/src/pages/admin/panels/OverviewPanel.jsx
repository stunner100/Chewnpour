import React from 'react';
import { BarChart, SectionCard, StatCard, StatRow } from '../../../components/admin/AdminUi';
import { formatNumber } from '../../../lib/admin/formatters';

export const OverviewPanel = ({ snapshot }) => {
    const overview = snapshot?.overview || {};
    const daily = Array.isArray(overview.dailyNewUsers) ? overview.dailyNewUsers : [];

    return (
        <div className="space-y-4">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <StatCard
                    label="Students"
                    value={overview.usersTotal}
                    sublabel={`${formatNumber(overview.users7d)} new this week · ${formatNumber(overview.activeUsers7d)} active`}
                    icon="group"
                    color="primary"
                />
                <StatCard
                    label="Uploads"
                    value={overview.uploadsTotal}
                    sublabel={`${formatNumber(overview.coursesTotal)} courses · ${formatNumber(overview.topicsTotal)} lessons`}
                    icon="cloud_upload"
                    color="blue"
                />
                <StatCard
                    label="Tutor sessions"
                    value={overview.tutorSessions}
                    sublabel={`${formatNumber(overview.onboardedUsers)} finished onboarding`}
                    icon="smart_toy"
                    color="emerald"
                />
            </section>

            <SectionCard title="New students" badge="Last 7 days">
                {daily.length ? (
                    <BarChart items={daily} />
                ) : (
                    <p className="text-sm text-text-secondary">No new students in the last 7 days.</p>
                )}
            </SectionCard>

            <SectionCard title="This week">
                <StatRow label="Joined today" value={formatNumber(overview.users1d)} />
                <StatRow label="Joined this week" value={formatNumber(overview.users7d)} />
                <StatRow label="Studied this week" value={formatNumber(overview.activeUsers7d)} />
            </SectionCard>
        </div>
    );
};
