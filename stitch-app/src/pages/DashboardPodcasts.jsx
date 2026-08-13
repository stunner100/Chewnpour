import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AppIcon from '../components/AppIcon';
import PodcastStatusBadge from '../components/dashboard/PodcastStatusBadge';
import PodcastWaveformPlayer from '../components/podcast/PodcastWaveformPlayer';
import { formatCourseTitle } from '../lib/courseTitle';

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

const PodcastListItem = ({ podcast }) => {
    const isInFlight = podcast.status === 'pending' || podcast.status === 'running';
    return (
        <div className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-sm md:p-5">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-2 text-body-base font-semibold text-text-primary md:text-body-lg">
                        {podcast.topicTitle}
                    </h3>
                    {podcast.courseTitle ? (
                        <p className="mt-0.5 line-clamp-1 text-caption text-text-muted">
                            {formatCourseTitle(podcast.courseTitle)}
                        </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-caption text-text-secondary">
                        <span className="inline-flex items-center gap-1">
                            <AppIcon name="schedule" className="text-[14px]" />
                            {formatDuration(podcast.durationSeconds)}
                        </span>
                        <span>{formatDate(podcast.createdAt)}</span>
                    </div>
                </div>
                <PodcastStatusBadge status={podcast.status} className="shrink-0" />
            </div>

            {podcast.status === 'ready' && podcast.audioUrl ? (
                <PodcastWaveformPlayer
                    key={podcast.id}
                    audioUrl={podcast.audioUrl}
                    title={podcast.topicTitle}
                    subtitle={podcast.courseTitle}
                    durationSeconds={podcast.durationSeconds}
                    className="mt-4"
                />
            ) : null}

            {isInFlight ? (
                <div className="mt-4 flex h-14 items-center justify-center gap-2 rounded-xl border border-dashed border-border-subtle text-text-secondary">
                    <AppIcon name="graphic_eq" className="animate-pulse text-[20px]" />
                    <span className="text-body-sm">
                        {podcast.status === 'pending'
                            ? 'Queued — writing the script…'
                            : 'Synthesizing audio…'}
                    </span>
                </div>
            ) : null}

            {podcast.status === 'failed' ? (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-body-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                    Podcast is not ready yet. Generate it again.
                </div>
            ) : null}
        </div>
    );
};

const TopicPickerModal = ({
    open,
    onClose,
    courses,
    onSelectTopic,
    generatingTopicId,
    error,
}) => {
    const [selectedCourseId, setSelectedCourseId] = useState('');
    const [topicState, setTopicState] = useState({ courseId: '', topics: [] });

    const effectiveCourseId = useMemo(() => {
        if (!open) return '';
        if (selectedCourseId && (courses || []).some((course) => course.id === selectedCourseId)) {
            return selectedCourseId;
        }
        return courses?.[0]?.id || '';
    }, [open, courses, selectedCourseId]);

    const topics = topicState.courseId === effectiveCourseId ? topicState.topics : [];
    const topicsLoading = Boolean(open && effectiveCourseId && topicState.courseId !== effectiveCourseId);

    useEffect(() => {
        if (!open || !effectiveCourseId) {
            return undefined;
        }
        let cancelled = false;
        fetch(`/api/courses/${encodeURIComponent(effectiveCourseId)}`, {
            credentials: 'include',
            headers: { Accept: 'application/json' },
        })
            .then((response) => response.json().then((payload) => ({ ok: response.ok, payload })))
            .then(({ ok, payload }) => {
                if (cancelled) return;
                const nextTopics = ok && Array.isArray(payload?.course?.topics)
                    ? payload.course.topics
                    : [];
                setTopicState({ courseId: effectiveCourseId, topics: nextTopics });
            })
            .catch(() => {
                if (!cancelled) setTopicState({ courseId: effectiveCourseId, topics: [] });
            });
        return () => {
            cancelled = true;
        };
    }, [open, effectiveCourseId]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="podcast-picker-title"
        >
            <button
                type="button"
                aria-label="Close podcast picker"
                className="absolute inset-0 border-0 bg-black/40 p-0 backdrop-blur-sm"
                onClick={onClose}
            />
            <div className="relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-3xl border border-border-subtle bg-surface-light shadow-elevated dark:bg-surface-dark sm:max-w-lg sm:rounded-2xl">
                <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
                    <div>
                        <h2
                            id="podcast-picker-title"
                            className="text-body-base font-semibold text-text-primary"
                        >
                            Generate a podcast
                        </h2>
                        <p className="mt-0.5 text-caption text-text-secondary">
                            Pick a course and topic to turn into an audio lesson.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="btn-icon !p-1 shrink-0"
                        aria-label="Close"
                    >
                        <AppIcon name="close" className="text-[20px]" />
                    </button>
                </div>

                <div className="border-b border-border-subtle px-5 py-4">
                    <label htmlFor="podcast-course-select" className="text-caption font-semibold uppercase tracking-wide text-text-secondary">
                        Course
                    </label>
                    {!Array.isArray(courses) || courses.length === 0 ? (
                        <p className="mt-2 text-body-sm text-text-secondary">
                            Upload a document to create your first course, then come back to generate a podcast.
                        </p>
                    ) : (
                        <select
                            id="podcast-course-select"
                            value={effectiveCourseId}
                            onChange={(event) => setSelectedCourseId(event.target.value)}
                            className="mt-2 w-full rounded-xl border border-border-subtle bg-surface-soft px-3 py-2 text-body-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                            {courses.map((course) => (
                                <option key={course.id} value={course.id}>
                                    {formatCourseTitle(course.title)}
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4">
                    <p className="mb-2 text-caption font-semibold uppercase tracking-wide text-text-secondary">
                        Topic
                    </p>
                    {topicsLoading && effectiveCourseId ? (
                        <div className="space-y-2">
                            {Array.from({ length: 3 }).map((_, index) => (
                                <div
                                    key={`topic-skeleton-${index}`}
                                    className="h-12 animate-pulse rounded-xl bg-surface-soft"
                                />
                            ))}
                        </div>
                    ) : topics.length === 0 ? (
                        <p className="text-body-sm text-text-secondary">
                            This course has no topics yet. Once topics finish generating you will be able to create podcasts here.
                        </p>
                    ) : (
                        <ul className="space-y-1.5">
                            {topics.map((topic) => {
                                const topicId = topic.id || topic._id;
                                const isGenerating = generatingTopicId === topicId;
                                return (
                                    <li key={topicId}>
                                        <button
                                            type="button"
                                            onClick={() => onSelectTopic(topicId)}
                                            disabled={Boolean(generatingTopicId)}
                                            className="flex w-full items-center gap-3 rounded-xl border border-transparent p-3 text-left transition-all hover:border-primary/30 hover:bg-primary-soft/40 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                                <AppIcon
                                                    name={isGenerating ? 'hourglass_top' : 'play_arrow'}
                                                    className="text-[18px]"
                                                />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p className="line-clamp-1 text-body-sm font-semibold text-text-primary">
                                                    {topic.title}
                                                </p>
                                                {topic.description ? (
                                                    <p className="line-clamp-1 text-caption text-text-muted">
                                                        {topic.description}
                                                    </p>
                                                ) : null}
                                            </div>
                                            <span className="shrink-0 text-caption font-semibold text-primary">
                                                {isGenerating ? 'Starting…' : 'Generate'}
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                {error ? (
                    <div className="border-t border-border-subtle px-5 py-3">
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-body-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                            {error}
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
};

const DashboardPodcasts = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [podcasts, setPodcasts] = useState(undefined);
    const [courses, setCourses] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [generatingTopicId, setGeneratingTopicId] = useState('');
    const [generateError, setGenerateError] = useState('');

    const loadPodcasts = useCallback(async () => {
        const response = await fetch('/api/podcasts', {
            credentials: 'include',
            headers: { Accept: 'application/json' },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload?.error || 'Could not load podcasts.');
        }
        setPodcasts(Array.isArray(payload.podcasts) ? payload.podcasts : []);
    }, []);

    useEffect(() => {
        let cancelled = false;
        Promise.all([
            loadPodcasts().catch(() => {
                if (!cancelled) setPodcasts([]);
            }),
            fetch('/api/courses', {
                credentials: 'include',
                headers: { Accept: 'application/json' },
            })
                .then((response) => response.json())
                .then((payload) => {
                    if (!cancelled) {
                        setCourses(Array.isArray(payload?.courses) ? payload.courses : []);
                    }
                })
                .catch(() => {
                    if (!cancelled) setCourses([]);
                }),
        ]);
        return () => {
            cancelled = true;
        };
    }, [loadPodcasts]);

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
                const response = await fetch('/api/podcast-generate', {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ topicId }),
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(payload?.error || 'Could not generate this podcast.');
                }
                await loadPodcasts();
                setModalOpen(false);
                if (searchParams.get('generate')) {
                    const next = new URLSearchParams(searchParams);
                    next.delete('generate');
                    setSearchParams(next, { replace: true });
                }
            } catch (error) {
                setGenerateError(error?.message || 'Podcast is still getting ready. Try again shortly.');
            } finally {
                setGeneratingTopicId('');
            }
        },
        [generatingTopicId, loadPodcasts, searchParams, setSearchParams],
    );

    const isLoading = podcasts === undefined;
    const list = useMemo(() => (Array.isArray(podcasts) ? podcasts : []), [podcasts]);
    const hasPodcasts = list.length > 0;
    const hasCourses = Array.isArray(courses) && courses.length > 0;

    return (
        <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8">
            <header className="mb-6 flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="font-display text-display-sm font-bold text-text-primary">
                        Podcasts
                    </h1>
                    <p className="mt-1 text-body-sm text-text-secondary">
                        Listen to audio lessons generated from your topics.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={openModal}
                    disabled={!hasCourses}
                    className="btn-primary shrink-0 text-body-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <AppIcon name="add" className="text-[16px]" />
                    Generate
                </button>
            </header>

            {isLoading ? (
                <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <div
                            key={`podcast-skeleton-${index}`}
                            className="h-32 animate-pulse rounded-2xl border border-border-subtle bg-surface-soft"
                        />
                    ))}
                </div>
            ) : !hasPodcasts ? (
                <div className="rounded-2xl border border-border-subtle bg-surface p-8 text-center shadow-sm md:p-10">
                    <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <AppIcon name="podcasts" className="text-[28px]" />
                    </div>
                    <h2 className="mb-1 text-display-sm text-text-primary">No podcasts yet</h2>
                    <p className="mx-auto max-w-md text-body-sm text-text-secondary">
                        Generate an audio lesson from any topic and listen to it on the go.
                    </p>
                    <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                        <button
                            type="button"
                            onClick={openModal}
                            disabled={!hasCourses}
                            className="btn-primary text-body-sm disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <AppIcon name="graphic_eq" className="text-[16px]" />
                            {hasCourses ? 'Generate your first podcast' : 'Add a course first'}
                        </button>
                        {!hasCourses ? (
                            <Link to="/dashboard/upload" className="btn-secondary text-body-sm">
                                Upload material
                            </Link>
                        ) : null}
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    {list.map((podcast) => (
                        <PodcastListItem key={podcast.id} podcast={podcast} />
                    ))}
                </div>
            )}

            <TopicPickerModal
                open={modalOpen}
                onClose={closeModal}
                courses={courses}
                onSelectTopic={handleSelectTopic}
                generatingTopicId={generatingTopicId}
                error={generateError}
            />
        </div>
    );
};

export default DashboardPodcasts;
