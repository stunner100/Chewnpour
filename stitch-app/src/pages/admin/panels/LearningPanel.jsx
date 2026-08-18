import React from 'react';
import { SectionCard, StatCard, StatRow } from '../../../components/admin/AdminUi';
import { formatNumber, formatPercent } from '../../../lib/admin/formatters';

export const LearningPanel = ({ snapshot }) => {
    const learning = snapshot?.learning || {};
    const examStatus = learning.examStatus || {};

    return (
        <div className="space-y-4">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <StatCard
                    label="Quiz attempts"
                    value={learning.quizAttempts}
                    sublabel={`Average score ${formatPercent(learning.quizAvgPercent)}`}
                    icon="quiz"
                    color="primary"
                />
                <StatCard
                    label="Timed exams"
                    value={learning.examsTotal}
                    sublabel={`${formatNumber(learning.examsSubmitted)} submitted`}
                    icon="school"
                    color="blue"
                />
                <StatCard
                    label="Lessons completed"
                    value={learning.lessonsCompleted}
                    sublabel={`${formatNumber(learning.progressRows)} in progress rows`}
                    icon="menu_book"
                    color="emerald"
                />
            </section>

            <SectionCard title="Exam status">
                {Object.keys(examStatus).length ? (
                    Object.entries(examStatus).map(([status, count]) => (
                        <StatRow key={status} label={status.replace(/_/g, ' ')} value={formatNumber(count)} />
                    ))
                ) : (
                    <p className="text-sm text-text-secondary">No timed exams yet.</p>
                )}
            </SectionCard>

            <SectionCard title="Study artifacts">
                <StatRow label="Lesson notes" value={formatNumber(learning.notesTotal)} />
                <StatRow label="Lesson progress rows" value={formatNumber(learning.progressRows)} />
            </SectionCard>
        </div>
    );
};
