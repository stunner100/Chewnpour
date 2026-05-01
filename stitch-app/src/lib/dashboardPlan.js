// Builds Today's Study Plan from real backend signals where available.
// When no signal exists we fall back to lightweight, clearly-labeled scaffolding
// so the dashboard never looks empty for first-time users.
import { buildConceptPracticePath } from './conceptReviewLinks';

export const buildStudyPlan = ({ courses, conceptReviewQueue, podcasts, userStats }) => {
    const items = [];

    if (conceptReviewQueue && conceptReviewQueue.dueConceptCount > 0) {
        const firstTopic = conceptReviewQueue.items?.[0];
        items.push({
            id: 'review-weak',
            icon: 'flash_on',
            priority: 'high',
            title: `Review ${conceptReviewQueue.dueConceptCount} weak concepts`,
            subtitle: firstTopic?.topicTitle ? `Start with ${firstTopic.topicTitle}` : 'Spaced-repetition review',
            estimatedTime: '10 min',
            cta: 'Review',
            href: firstTopic
                ? buildConceptPracticePath(firstTopic.topicId, firstTopic.reviewConceptKeys)
                : '/dashboard',
        });
    }

    const inProgressCourse = (courses || []).find((c) => (c.status || '').toLowerCase() === 'in_progress');
    if (inProgressCourse) {
        items.push({
            id: `continue-${inProgressCourse._id}`,
            icon: 'play_circle',
            priority: 'medium',
            title: `Continue ${inProgressCourse.title}`,
            subtitle: `${Math.round(inProgressCourse.progress || 0)}% complete`,
            estimatedTime: '15 min',
            cta: 'Resume',
            href: `/dashboard/course/${inProgressCourse._id}`,
        });
    }

    const readyPodcast = (podcasts || []).find((p) => p.status === 'ready');
    if (readyPodcast) {
        items.push({
            id: `podcast-${readyPodcast._id}`,
            icon: 'headphones',
            priority: 'low',
            title: `Listen: ${readyPodcast.topicTitle}`,
            subtitle: readyPodcast.courseTitle || 'AI-generated study podcast',
            estimatedTime: readyPodcast.durationSeconds ? `${Math.round(readyPodcast.durationSeconds / 60)} min` : '12 min',
            cta: 'Play',
            href: `/dashboard/topic/${readyPodcast.topicId}?panel=podcast`,
        });
    } else if ((courses || []).length > 0) {
        const firstCourse = courses[0];
        items.push({
            id: 'generate-podcast',
            icon: 'graphic_eq',
            priority: 'low',
            title: 'Generate a study podcast',
            subtitle: `Try it on ${firstCourse.title}`,
            estimatedTime: '2 min setup',
            cta: 'Create',
            href: '/dashboard/podcasts?generate=1',
        });
    }

    if ((userStats?.streakDays ?? 0) > 0 && items.length < 4) {
        items.push({
            id: 'daily-revision',
            icon: 'whatshot',
            priority: 'medium',
            title: '10-minute daily revision',
            subtitle: `Protect your ${userStats.streakDays}-day streak`,
            estimatedTime: '10 min',
            cta: 'Start',
            href: '/dashboard/analysis',
        });
    }

    return items.slice(0, 4);
};

export const DEFAULT_QUICK_ACTIONS = [
    {
        id: 'generate-quiz',
        icon: 'quiz',
        label: 'Generate Quiz',
        description: 'Make a quiz from any uploaded material.',
        color: 'primary',
        to: '/dashboard',
        courseAction: 'quiz',
    },
    {
        id: 'flashcards',
        icon: 'style',
        label: 'Create Flashcards',
        description: 'Active recall on key terms and ideas.',
        color: 'indigo',
        to: '/dashboard',
        courseAction: 'flashcards',
    },
    {
        id: 'podcast',
        icon: 'podcasts',
        label: 'Generate Podcast',
        description: 'Turn a topic into an audio lesson.',
        color: 'rose',
        to: '/dashboard/podcasts?generate=1',
    },
    {
        id: 'humanizer',
        icon: 'auto_fix_high',
        label: 'Humanize Notes',
        description: 'Polish AI text to sound natural.',
        color: 'teal',
        badge: 'New',
        to: '/dashboard/humanizer',
    },
    {
        id: 'community',
        icon: 'forum',
        label: 'Join Community',
        description: 'Study alongside peers in your courses.',
        color: 'amber',
        to: '/dashboard/community',
    },
];
