import React from 'react';
import { BarChart, SectionCard, StatCard, StatRow } from '../../../components/admin/AdminUi';
import { formatNumber } from '../../../lib/admin/formatters';
import { ACTIVE_DEFINITION, shareOfStudents } from '../../../lib/admin/ui';

const DailyChart = ({ title, items, emptyText }) => (
    <SectionCard title={title} badge="Last 14 days">
        <BarChart items={items} />
        {items.every((day) => !day.value) ? (
            <p className="mt-3 text-sm text-text-secondary">{emptyText}</p>
        ) : null}
    </SectionCard>
);

export const OverviewPanel = ({ snapshot }) => {
    const overview = snapshot?.overview || {};
    const total = overview.usersTotal || 0;
    const dailyNew = Array.isArray(overview.dailyNewUsers) ? overview.dailyNewUsers : [];
    const dailyActive = Array.isArray(overview.dailyActiveUsers) ? overview.dailyActiveUsers : [];

    return (
        <div className="space-y-4">
            <section aria-labelledby="admin-students-heading" className="space-y-3">
                <h2 id="admin-students-heading" className="text-body-base font-bold text-text-primary">
                    Students
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        label="Total students"
                        value={total}
                        sublabel={`+${formatNumber(overview.users7d)} this week`}
                        icon="group"
                        color="primary"
                    />
                    <StatCard
                        label="Active today"
                        value={overview.active1d}
                        sublabel={shareOfStudents(overview.active1d, total)}
                        icon="bolt"
                        color="emerald"
                    />
                    <StatCard
                        label="Active this week"
                        value={overview.active7d}
                        sublabel={shareOfStudents(overview.active7d, total)}
                        icon="calendar_today"
                        color="blue"
                    />
                    <StatCard
                        label="Active this month"
                        value={overview.active30d}
                        sublabel={shareOfStudents(overview.active30d, total)}
                        icon="calendar_month"
                        color="amber"
                    />
                </div>
                <p className="text-xs text-text-muted">{ACTIVE_DEFINITION} Today, week, and month are the last 24 hours, 7 days, and 30 days.</p>
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
                <DailyChart title="Active students per day" items={dailyActive} emptyText="No student activity in the last 14 days." />
                <DailyChart title="New students per day" items={dailyNew} emptyText="No new students in the last 14 days." />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <SectionCard title="Sign-ups">
                    <StatRow label="Joined today" value={formatNumber(overview.users1d)} />
                    <StatRow label="Joined this week" value={formatNumber(overview.users7d)} />
                    <StatRow label="Joined this month" value={formatNumber(overview.users30d)} />
                    <StatRow
                        label="Finished onboarding"
                        value={formatNumber(overview.onboardedUsers)}
                        detail={shareOfStudents(overview.onboardedUsers, total)}
                    />
                </SectionCard>
                <SectionCard title="Usage">
                    <StatRow label="Uploads" value={formatNumber(overview.uploadsTotal)} />
                    <StatRow
                        label="Courses · lessons"
                        value={`${formatNumber(overview.coursesTotal)} · ${formatNumber(overview.topicsTotal)}`}
                    />
                    <StatRow
                        label="Tutor conversations"
                        value={formatNumber(overview.tutorConversations)}
                        detail={`${formatNumber(overview.tutorUsers)} students`}
                    />
                    <StatRow
                        label="Live oral reviews"
                        value={formatNumber(overview.liveSessionsTotal)}
                        detail={`${formatNumber(overview.liveSessions7d)} this week · ${formatNumber(overview.liveSessionsCompleted)} completed · ${formatNumber(overview.liveTutorUsers)} students`}
                    />
                </SectionCard>
            </div>
        </div>
    );
};
