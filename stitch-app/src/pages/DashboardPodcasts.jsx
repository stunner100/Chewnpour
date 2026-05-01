import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useConvexAuth } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';
import PodcastStatusBadge from '../components/dashboard/PodcastStatusBadge';

const formatDuration = (seconds) => {
    if (!seconds) return '—';
    const total = Math.max(0, Math.round(Number(seconds)));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
};

const formatDate = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

const resolveErrorMessage = (error, fallback) => {
    const dataMessage =
        typeof error?.data === 'string'
            ? error.data
            : typeof error?.data?.message === 'string'
                ? error.data.message
                : '';
    const resolved = String(dataMessage || error?.message || fallback || '')
        .replace(/^Uncaught (ConvexError|Error):\s*/i, '')
        .trim();
    return resolved || fallback;
};

const PodcastListItem = ({ podcast }) => {
    const isInFlight = podcast.status === 'pending' || podcast.status === 'running';
    return (
        <div className="card-base p-4 md:p-5">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <h3 className="text-body-base md:text-body-lg font-semibold text-text-main-light dark:text-text-main-dark line-clamp-2">
                        {podcast.topicTitle}
                    </h3>
                    {podcast.courseTitle && (
                        <p className="text-caption text-text-faint-light dark:text-text-faint-dark line-clamp-1 mt-0.5">
                            {podcast.courseTitle}
                        </p>
                    )}
                    <div className="flex items-center flex-wrap gap-3 mt-2 text-caption text-text-sub-light dark:text-text-sub-dark">
                        <span className="inline-flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">schedule</span>
                            {formatDuration(podcast.durationSeconds)}
                        </span>
                        <span>{formatDate(podcast.createdAt)}</span>
                    </div>
                </div>
                <PodcastStatusBadge status={podcast.status} className="shrink-0" />
            </div>

            {podcast.status === 'ready' && podcast.audioUrl && (
                <audio
                    key={podcast._id}
                    src={podcast.audioUrl}
                    controls
                    preload="none"
                    className="mt-4 w-full rounded-xl border border-border-light dark:border-border-dark"
                >
                    <track kind="captions" />
                </audio>
            )}

            {isInFlight && (
                <div className="mt-4 h-14 rounded-xl border border-dashed border-border-light dark:border-border-dark flex items-center justify-center gap-2 text-text-sub-light dark:text-text-sub-dark">
                    <span className="material-symbols-outlined text-[20px] animate-pulse">graphic_eq</span>
                    <span className="text-body-sm">
                        {podcast.status === 'pending'
                            ? 'Queued — writing the script…'
                            : 'Synthesizing audio…'}
                    </span>
                </div>
            )}

            {podcast.status === 'failed' && (
                <div className="mt-4 rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 text-body-sm px-3 py-2">
                    {podcast.errorMessage || 'Podcast generation failed. Try again.'}
                </div>
            )}
        </div>
    );
};

const TopicPickerModal = ({ open, onClose, courses, onSelectTopic, generatingTopicId, error }) => {
    const [selectedCourseId, setSelectedCourseId] = useState('');

    const effectiveCourseId = useMemo(() => {
        if (!open) return '';
        if (selectedCourseId) {
            const stillExists = (courses || []).some((c) => c._id === selectedCourseId);
            if (stillExists) return selectedCourseId;
        }
        return courses?.[0]?._id || '';
    }, [open, courses, selectedCourseId]);

    const courseQueryArg = open && effectiveCourseId ? { courseId: effectiveCourseId } : 'skip';
    const courseData = useQuery(api.courses.getCourseWithTopics, courseQueryArg);
    const topics = Array.isArray(courseData?.topics) ? courseData.topics : [];

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="podcast-picker-title"
        >
            <div
                className="w-full sm:max-w-lg bg-surface-light dark:bg-surface-dark rounded-t-3xl sm:rounded-2xl shadow-elevated overflow-hidden flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border-subtle dark:border-border-subtle-dark">
                    <div>
                        <h2
                            id="podcast-picker-title"
                            className="text-body-base font-semibold text-text-main-light dark:text-text-main-dark"
                        >
                            Generate a podcast
                        </h2>
                        <p className="text-caption text-text-sub-light dark:text-text-sub-dark mt-0.5">
                            Pick a course and topic to turn into an audio lesson.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="btn-icon !p-1 shrink-0"
                        aria-label="Close"
                    >
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                <div className="px-5 py-4 border-b border-border-subtle dark:border-border-subtle-dark">
                    <label className="text-caption font-semibold text-text-sub-light dark:text-text-sub-dark uppercase tracking-wide">
                        Course
                    </label>
                    {!Array.isArray(courses) || courses.length === 0 ? (
                        <p className="mt-2 text-body-sm text-text-sub-light dark:text-text-sub-dark">
                            Upload a document to create your first course, then come back to generate a podcast.
                        </p>
                    ) : (
                        <select
                            value={effectiveCourseId}
                            onChange={(e) => setSelectedCourseId(e.target.value)}
                            className="mt-2 w-full px-3 py-2 rounded-xl border border-border-subtle dark:border-border-subtle-dark bg-surface-hover dark:bg-surface-hover-dark text-body-sm text-text-main-light dark:text-text-main-dark focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                            {courses.map((course) => (
                                <option key={course._id} value={course._id}>
                                    {course.title}
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4">
                    <p className="text-caption font-semibold text-text-sub-light dark:text-text-sub-dark uppercase tracking-wide mb-2">
                        Topic
                    </p>
                    {courseData === undefined && effectiveCourseId ? (
                        <div className="space-y-2">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="h-12 rounded-xl bg-surface-hover-light dark:bg-surface-hover-dark animate-pulse"
                                />
                            ))}
                        </div>
                    ) : topics.length === 0 ? (
                        <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">
                            This course has no topics yet. Once topics finish generating you'll be able to create podcasts here.
                        </p>
                    ) : (
                        <ul className="space-y-1.5">
                            {topics.map((topic) => {
                                const isGenerating = generatingTopicId === topic._id;
                                return (
                                    <li key={topic._id}>
                                        <button
                                            type="button"
                                            onClick={() => onSelectTopic(topic._id)}
                                            disabled={Boolean(generatingTopicId)}
                                            className="w-full flex items-center gap-3 p-3 rounded-xl border border-transparent hover:border-primary/30 hover:bg-primary-50/40 dark:hover:bg-primary-900/10 transition-all text-left disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                            <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary shrink-0">
                                                <span className="material-symbols-outlined text-[18px]">
                                                    {isGenerating ? 'hourglass_top' : 'play_arrow'}
                                                </span>
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark line-clamp-1">
                                                    {topic.title}
                                                </p>
                                                {topic.description && (
                                                    <p className="text-caption text-text-faint-light dark:text-text-faint-dark line-clamp-1">
                                                        {topic.description}
                                                    </p>
                                                )}
                                            </div>
                                            <span className="text-caption font-semibold text-primary shrink-0">
                                                {isGenerating ? 'Starting…' : 'Generate'}
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                {error && (
                    <div className="px-5 py-3 border-t border-border-subtle dark:border-border-subtle-dark">
                        <div className="rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 text-body-sm px-3 py-2">
                            {error}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const DashboardPodcasts = () => {
    const { user } = useAuth();
    const userId = user?.id;
    const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    const podcasts = useQuery(
        api.podcasts.listRecentUserPodcasts,
        isConvexAuthenticated ? { limit: 20 } : 'skip',
    );
    const courses = useQuery(api.courses.getUserCourses, userId ? { userId } : 'skip');
    const requestPodcast = useMutation(api.podcasts.requestTopicPodcast);

    const [modalOpen, setModalOpen] = useState(false);
    const [generatingTopicId, setGeneratingTopicId] = useState('');
    const [generateError, setGenerateError] = useState('');

    const openModal = useCallback(() => {
        setGenerateError('');
        setModalOpen(true);
    }, []);

    const closeModal = useCallback(() => {
        setModalOpen(false);
        setGenerateError('');
        if (searchParams.get('generate')) {
            const next = new URLSearchParams(searchParams);
            next.delete('generate');
            setSearchParams(next, { replace: true });
        }
    }, [searchParams, setSearchParams]);

    useEffect(() => {
        if (searchParams.get('generate')) {
            setModalOpen(true);
        }
    }, [searchParams]);

    const handleSelectTopic = useCallback(
        async (topicId) => {
            if (!topicId || generatingTopicId) return;
            setGenerateError('');
            setGeneratingTopicId(topicId);
            try {
                await requestPodcast({ topicId });
                setModalOpen(false);
                if (searchParams.get('generate')) {
                    const next = new URLSearchParams(searchParams);
                    next.delete('generate');
                    setSearchParams(next, { replace: true });
                }
            } catch (error) {
                setGenerateError(
                    resolveErrorMessage(error, 'Could not start podcast generation.'),
                );
            } finally {
                setGeneratingTopicId('');
            }
        },
        [requestPodcast, generatingTopicId, searchParams, setSearchParams],
    );

    const isLoading = podcasts === undefined;
    const list = useMemo(() => (Array.isArray(podcasts) ? podcasts : []), [podcasts]);
    const hasPodcasts = list.length > 0;
    const hasCourses = Array.isArray(courses) && courses.length > 0;

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark">
            <header className="sticky top-0 z-30 w-full bg-surface-light/90 dark:bg-surface-dark/90 backdrop-blur-md border-b border-border-light dark:border-border-dark">
                <div className="max-w-4xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <button
                            type="button"
                            onClick={() => navigate('/dashboard')}
                            aria-label="Back to dashboard"
                            className="btn-icon w-10 h-10 shrink-0"
                        >
                            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                        </button>
                        <div className="min-w-0">
                            <h1 className="text-body-base font-semibold text-text-main-light dark:text-text-main-dark leading-tight">
                                Podcasts
                            </h1>
                            <p className="text-caption text-text-faint-light dark:text-text-faint-dark line-clamp-1">
                                Listen to your generated study podcasts.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={openModal}
                        disabled={!hasCourses}
                        className="btn-primary text-body-sm shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        <span className="material-symbols-outlined text-[16px]">add</span>
                        Generate
                    </button>
                </div>
            </header>

            <main className="w-full max-w-4xl mx-auto px-4 md:px-8 py-6 pb-24 md:pb-12">
                {isLoading ? (
                    <div className="space-y-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div
                                key={i}
                                className="card-base h-32 animate-pulse bg-surface-hover-light dark:bg-surface-hover-dark"
                            />
                        ))}
                    </div>
                ) : !hasPodcasts ? (
                    <div className="card-base p-8 md:p-10 text-center">
                        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                            <span className="material-symbols-outlined text-[28px]">podcasts</span>
                        </div>
                        <h2 className="text-display-sm text-text-main-light dark:text-text-main-dark mb-1">
                            No podcasts yet
                        </h2>
                        <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark max-w-md mx-auto">
                            Generate an audio lesson from any topic and listen to it on the go.
                            They'll show up here.
                        </p>
                        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                            <button
                                type="button"
                                onClick={openModal}
                                disabled={!hasCourses}
                                className="btn-primary text-body-sm disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                <span className="material-symbols-outlined text-[16px]">graphic_eq</span>
                                {hasCourses ? 'Generate your first podcast' : 'Add a course first'}
                            </button>
                            {!hasCourses && (
                                <Link to="/dashboard" className="btn-secondary text-body-sm">
                                    Go to dashboard
                                </Link>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {list.map((podcast) => (
                            <PodcastListItem key={podcast._id} podcast={podcast} />
                        ))}
                    </div>
                )}
            </main>

            <TopicPickerModal
                open={modalOpen}
                onClose={closeModal}
                courses={courses || []}
                onSelectTopic={handleSelectTopic}
                generatingTopicId={generatingTopicId}
                error={generateError}
            />
        </div>
    );
};

export default DashboardPodcasts;
