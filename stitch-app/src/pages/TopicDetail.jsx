import React from 'react';
import { Link } from 'react-router-dom';
import { useTopicDetail } from '../hooks/useTopicDetail';
import {
    TopicEmptyState,
    TopicLessonShell,
    TopicLoadingState,
    TopicStudyModeView,
} from '../components/topic/TopicLessonViews';

const TopicDetail = () => {
    const controller = useTopicDetail();

    if (!controller.routeTopicId) {
        return (
            <TopicEmptyState
                title="Topic not found"
                description="Please return to your dashboard and select a topic."
                action={<Link to="/dashboard" className="btn-primary px-5 py-2.5 text-body-sm">Back to Dashboard</Link>}
            />
        );
    }

    if (controller.isLoadingRouteTopic) {
        return <TopicLoadingState />;
    }

    if (controller.isMissingRouteTopic) {
        return (
            <TopicEmptyState
                title="This topic link is stale"
                description="Reload the dashboard, reopen the course, and start from the topic card again."
                action={<button type="button" onClick={controller.reloadDashboard} className="btn-primary px-5 py-2.5 text-body-sm">Reload Dashboard</button>}
            />
        );
    }

    if (controller.studyMode === null) {
        return (
            <TopicStudyModeView
                courseId={controller.courseId}
                headerTopicTitle={controller.headerTopicTitle}
                onSelect={controller.handleStudyModeSelect}
                onSkip={controller.handleStudyModeSkip}
                onStartExam={controller.handleStartExam}
                timedExamAvailable={controller.timedExamAvailable}
            />
        );
    }

    return <TopicLessonShell controller={controller} />;
};

export default TopicDetail;
