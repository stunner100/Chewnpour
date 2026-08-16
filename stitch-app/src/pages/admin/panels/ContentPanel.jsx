import React from 'react';
import { SectionCard, StatCard, StatRow } from '../../../components/admin/AdminUi';
import { formatNumber } from '../../../lib/admin/formatters';

const StatusList = ({ title, empty, statusMap }) => {
    const entries = Object.entries(statusMap || {});
    return (
        <SectionCard title={title}>
            {entries.length ? (
                entries.map(([status, count]) => (
                    <StatRow key={status} label={status.replace(/_/g, ' ')} value={formatNumber(count)} />
                ))
            ) : (
                <p className="text-sm text-text-secondary">{empty}</p>
            )}
        </SectionCard>
    );
};

export const ContentPanel = ({ snapshot }) => {
    const content = snapshot?.content || {};

    return (
        <div className="space-y-4">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Courses" value={content.coursesTotal} icon="auto_stories" />
                <StatCard label="Lessons" value={content.topicsTotal} icon="menu_book" color="blue" />
                <StatCard label="Quiz questions" value={content.questionsTotal} icon="quiz" color="emerald" />
                <StatCard label="Podcasts" value={content.podcastsTotal} icon="podcasts" color="amber" />
            </section>

            <div className="grid gap-4 lg:grid-cols-3">
                <StatusList title="Course status" empty="No courses yet." statusMap={content.courseStatus} />
                <StatusList title="Upload status" empty="No uploads yet." statusMap={content.uploadStatus} />
                <StatusList title="Podcast status" empty="No podcasts yet." statusMap={content.podcastStatus} />
            </div>
        </div>
    );
};
