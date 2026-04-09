import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Ranked "What should I do next?" guidance shown after lessons or exams.
 *
 * Props:
 *  - topicId: string
 *  - topicTitle: string
 *  - percentage: number|null        (exam score %, null if no exam taken)
 *  - completedAt: number|null       (timestamp if lesson marked complete)
 *  - bestScore: number|null         (best exam score from progress)
 *  - hasWordBank: boolean
 *  - onOpenChat: () => void         (open tutor panel)
 *  - variant: 'lesson' | 'exam'     (controls heading)
 */
const NextStepsGuidance = ({
    topicId,
    percentage,
    bestScore,
    hasWordBank,
    onOpenChat,
}) => {
    const score = percentage ?? bestScore;
    const hasExamScore = score != null;
    const isWeak = hasExamScore && score < 60;
    const isMid = hasExamScore && score >= 60 && score < 80;
    const isStrong = hasExamScore && score >= 80;

    // Build ranked actions based on performance
    const actions = [];

    if (isWeak) {
        actions.push({
            key: 'review',
            icon: 'auto_stories',
            label: 'Review the lesson',
            description: 'Go through the material again to strengthen understanding.',
            to: topicId ? `/dashboard/topic/${topicId}` : null,
            priority: 'high',
        });
        actions.push({
            key: 'weak',
            icon: 'school',
            label: 'Practice weak concepts',
            description: 'Focus on the areas you missed.',
            to: topicId ? `/dashboard/concept-intro/${topicId}` : null,
            priority: 'high',
        });
        actions.push({
            key: 'retry',
            icon: 'quiz',
            label: 'Retry the exam',
            description: 'Take the exam again once you feel ready.',
            to: topicId ? `/dashboard/exam/${topicId}` : null,
            reloadDocument: true,
            priority: 'medium',
        });
    } else if (isMid) {
        actions.push({
            key: 'weak',
            icon: 'school',
            label: 'Practice weak concepts',
            description: 'Focus on the concepts you found tricky.',
            to: topicId ? `/dashboard/concept-intro/${topicId}` : null,
            priority: 'high',
        });
        actions.push({
            key: 'retry',
            icon: 'quiz',
            label: 'Retry the exam',
            description: 'Push for a higher score.',
            to: topicId ? `/dashboard/exam/${topicId}` : null,
            reloadDocument: true,
            priority: 'medium',
        });
        actions.push({
            key: 'tutor',
            icon: 'smart_toy',
            label: 'Ask the tutor',
            description: 'Get personalized help on what confused you.',
            onClick: onOpenChat,
            priority: 'medium',
        });
    } else if (isStrong) {
        actions.push({
            key: 'next',
            icon: 'skip_next',
            label: 'Continue to next topic',
            description: 'You\'ve mastered this — keep your momentum going.',
            to: '/dashboard',
            priority: 'high',
        });
        if (hasWordBank) {
            actions.push({
                key: 'flashcards',
                icon: 'style',
                label: 'Study flashcards',
                description: 'Lock in key terms with the Word Bank.',
                to: topicId ? `/dashboard/topic/${topicId}` : null,
                priority: 'low',
            });
        }
        actions.push({
            key: 'tutor',
            icon: 'smart_toy',
            label: 'Ask the tutor',
            description: 'Explore deeper or ask follow-up questions.',
            onClick: onOpenChat,
            priority: 'low',
        });
    } else {
        // No exam score yet
        actions.push({
            key: 'exam',
            icon: 'quiz',
            label: 'Start the exam',
            description: 'Test your understanding with practice questions.',
            to: topicId ? `/dashboard/exam/${topicId}` : null,
            reloadDocument: true,
            priority: 'high',
        });
        actions.push({
            key: 'concepts',
            icon: 'school',
            label: 'Study concepts',
            description: 'Review key ideas before testing yourself.',
            to: topicId ? `/dashboard/concept-intro/${topicId}` : null,
            priority: 'medium',
        });
        actions.push({
            key: 'tutor',
            icon: 'smart_toy',
            label: 'Ask the tutor',
            description: 'Get help with anything you don\'t understand.',
            onClick: onOpenChat,
            priority: 'medium',
        });
    }

    const priorityColors = {
        high: 'bg-primary/10 border-primary/20 hover:bg-primary/15',
        medium: 'bg-surface-hover-light dark:bg-surface-hover-dark border-border-light dark:border-border-dark hover:border-primary/30',
        low: 'bg-transparent border-border-light dark:border-border-dark hover:border-primary/30',
    };

    return (
        <div className="w-full">
            <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-primary text-[18px]">signpost</span>
                <h3 className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">
                    What should I do next?
                </h3>
            </div>
            <div className="space-y-2">
                {actions.map((action) => {
                    const inner = (
                        <>
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                action.priority === 'high' ? 'bg-primary/15' : 'bg-surface-hover-light dark:bg-surface-hover-dark'
                            }`}>
                                <span className={`material-symbols-outlined text-[18px] ${
                                    action.priority === 'high' ? 'text-primary' : 'text-text-sub-light dark:text-text-sub-dark'
                                }`}>{action.icon}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`text-body-sm font-medium leading-tight ${
                                    action.priority === 'high'
                                        ? 'text-text-main-light dark:text-text-main-dark'
                                        : 'text-text-sub-light dark:text-text-sub-dark'
                                }`}>{action.label}</p>
                                <p className="text-caption text-text-faint-light dark:text-text-faint-dark leading-snug mt-0.5">
                                    {action.description}
                                </p>
                            </div>
                            <span className="material-symbols-outlined text-[16px] text-text-faint-light dark:text-text-faint-dark shrink-0">
                                chevron_right
                            </span>
                        </>
                    );

                    const className = `flex items-center gap-3 p-3 rounded-xl border transition-colors cursor-pointer ${priorityColors[action.priority]}`;

                    if (action.to) {
                        return (
                            <Link
                                key={action.key}
                                to={action.to}
                                {...(action.reloadDocument ? { reloadDocument: true } : {})}
                                className={className}
                            >
                                {inner}
                            </Link>
                        );
                    }

                    return (
                        <button
                            key={action.key}
                            onClick={action.onClick}
                            className={`${className} w-full text-left`}
                        >
                            {inner}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default NextStepsGuidance;
