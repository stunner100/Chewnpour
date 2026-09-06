import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { resumeActivityCopy } from '../lib/resumeActivity';
import ContinueLearningCard from '../components/progress/ContinueLearningCard';
import ActivityStatsRow from '../components/progress/ActivityStatsRow';
import CourseProgressList from '../components/progress/CourseProgressList';
import TopicPerformanceList from '../components/progress/TopicPerformanceList';
import ProgressSkeleton from '../components/progress/ProgressSkeleton';

const EMPTY_LIST = [];

/**
 * /dashboard/progress — a calm, truthful view of the learning journey.
 * Sections, in order: continue learning, overall activity, courses, topic performance.
 */
const StudyProgressMastery = () => {
    const { user } = useAuth();
    const [progress, setProgress] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!user?.id) {
            setProgress(null);
            setLoading(false);
            return undefined;
        }

        let cancelled = false;
        setLoading(true);
        setError('');
        (async () => {
            try {
                const response = await fetch('/api/progress', {
                    method: 'GET',
                    credentials: 'include',
                    headers: { Accept: 'application/json' },
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(payload?.error || `Failed to load progress (${response.status})`);
                }
                if (!cancelled) setProgress(payload.progress || null);
            } catch (err) {
                console.error('Failed to load progress:', err);
                if (!cancelled) {
                    setError(err.message || 'Could not load progress.');
                    setProgress(null);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [user?.id]);

    if (loading) return <ProgressSkeleton />;

    const userStats = progress?.stats || null;
    const performanceInsights = progress?.performanceInsights || null;
    const resumeTarget = progress?.resumeTarget || null;
    const resumeCopy = resumeActivityCopy(resumeTarget);
    const courses = progress?.courses || EMPTY_LIST;

    const streakDays = Math.max(0, Math.round(Number(userStats?.streakDays || 0)));
    const topicsPracticed = Math.max(0, Math.round(Number(userStats?.topics || 0)));
    const quizAverage = Math.max(
        0,
        Math.min(
            100,
            Math.round(Number(performanceInsights?.overallPreparedness ?? userStats?.accuracy ?? 0)),
        ),
    );

    return (
        <div className="min-h-[calc(100dvh-4rem)] bg-background-light px-4 py-8 md:px-8 md:py-10">
            <div className="mx-auto flex max-w-3xl flex-col gap-8">
                <header>
                    <h1 className="font-display text-display-md font-bold tracking-[-0.02em] text-text-primary md:text-display-lg">
                        Progress
                    </h1>
                    <p className="mt-2 max-w-2xl text-body-md text-text-secondary">
                        Pick up where you left off and see how your study practice is going.
                    </p>
                    {error ? (
                        <p
                            role="alert"
                            className="mt-3 rounded-[16px] border border-error/30 bg-error-soft px-4 py-3 text-body-sm text-error"
                        >
                            {error}
                        </p>
                    ) : null}
                </header>

                <ContinueLearningCard resumeTarget={resumeTarget} resumeCopy={resumeCopy} />

                <ActivityStatsRow
                    streakDays={streakDays}
                    topicsPracticed={topicsPracticed}
                    quizAverage={quizAverage}
                />

                <CourseProgressList courses={courses} />

                <TopicPerformanceList performanceInsights={performanceInsights} />
            </div>
        </div>
    );
};

export default StudyProgressMastery;
