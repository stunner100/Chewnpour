import React, { memo, useMemo, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

const STATUS_COPY = {
    pending: 'Queued — writing your script…',
    running: 'Synthesizing audio…',
    ready: 'Your podcast is ready.',
    failed: 'Podcast generation failed.',
};

const resolveErrorMessage = (error, fallback) => {
    const dataMessage = typeof error?.data === 'string'
        ? error.data
        : typeof error?.data?.message === 'string'
            ? error.data.message
            : '';
    const resolved = String(dataMessage || error?.message || fallback || '')
        .replace(/^Uncaught (ConvexError|Error):\s*/i, '')
        .trim();
    return resolved || fallback;
};

const formatElapsed = (startedAt) => {
    if (!startedAt) return '';
    const seconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
    if (seconds < 60) return `${seconds}s elapsed`;
    const minutes = Math.floor(seconds / 60);
    const rem = seconds % 60;
    return `${minutes}m ${rem}s elapsed`;
};

const formatDuration = (durationSeconds) => {
    if (!durationSeconds || durationSeconds <= 0) return '';
    const total = Math.round(durationSeconds);
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
};

const TopicPodcastPanel = memo(function TopicPodcastPanel({ topicId }) {
    const podcasts = useQuery(api.podcasts.listTopicPodcasts, topicId ? { topicId } : 'skip');
    const requestPodcast = useMutation(api.podcasts.requestTopicPodcast);
    const retryPodcast = useMutation(api.podcasts.retryTopicPodcast);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');

    const latest = useMemo(
        () => (Array.isArray(podcasts) && podcasts.length > 0 ? podcasts[0] : null),
        [podcasts],
    );
    const loading = podcasts === undefined;
    const inFlight = latest?.status === 'pending' || latest?.status === 'running';

    const handleGenerate = async () => {
        if (submitting || inFlight) return;
        setSubmitError('');
        setSubmitting(true);
        try {
            await requestPodcast({ topicId });
        } catch (error) {
            setSubmitError(resolveErrorMessage(error, 'Could not start podcast generation.'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleRetry = async () => {
        if (!latest?._id || submitting) return;
        setSubmitError('');
        setSubmitting(true);
        try {
            await retryPodcast({ podcastId: latest._id });
        } catch (error) {
            setSubmitError(resolveErrorMessage(error, 'Could not retry podcast generation.'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-5">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-body-sm text-text-sub-light dark:text-text-sub-dark">
                        <span className="material-symbols-outlined text-[18px]">mic</span>
                        <span>Explainer podcast</span>
                        <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-caption px-2 py-0.5">
                            Staging preview
                        </span>
                    </div>
                    <h3 className="mt-1 text-body font-semibold text-text-light dark:text-text-dark">
                        Listen to this topic as a podcast
                    </h3>
                    <p className="mt-1 text-body-sm text-text-sub-light dark:text-text-sub-dark">
                        Generates an ~8-minute single-narrator audio explainer from this topic's content.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={submitting || inFlight || loading}
                    className="btn-primary px-4 py-2 text-body-sm gap-2 shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    <span className="material-symbols-outlined text-[18px]">
                        {inFlight ? 'hourglass_top' : 'graphic_eq'}
                    </span>
                    {inFlight ? 'Generating…' : 'Generate podcast'}
                </button>
            </div>

            {submitError && (
                <div className="mt-3 rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 text-body-sm px-3 py-2">
                    {submitError}
                </div>
            )}

            {latest && (
                <div className="mt-4">
                    <div className="text-caption text-text-sub-light dark:text-text-sub-dark mb-2">
                        {STATUS_COPY[latest.status] ?? latest.status}
                        {inFlight && (
                            <span className="ml-2 opacity-70">{formatElapsed(latest.createdAt)}</span>
                        )}
                        {latest.status === 'ready' && latest.durationSeconds ? (
                            <span className="ml-2 opacity-70">{formatDuration(latest.durationSeconds)}</span>
                        ) : null}
                    </div>

                    {latest.status === 'ready' && latest.audioUrl && (
                        <audio
                            key={latest._id}
                            src={latest.audioUrl}
                            controls
                            preload="none"
                            className="w-full rounded-xl border border-border-light dark:border-border-dark"
                        >
                            <track kind="captions" />
                        </audio>
                    )}

                    {latest.status === 'failed' && (
                        <div className="space-y-2">
                            <div className="rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 text-body-sm px-3 py-2">
                                {latest.errorMessage || 'Unknown error. Try again.'}
                            </div>
                            <button
                                type="button"
                                onClick={handleRetry}
                                disabled={submitting}
                                className="btn-secondary px-3 py-1.5 text-body-sm gap-2 disabled:opacity-60"
                            >
                                <span className="material-symbols-outlined text-[16px]">refresh</span>
                                Retry
                            </button>
                        </div>
                    )}

                    {inFlight && (
                        <div className="h-16 w-full rounded-xl border border-dashed border-border-light dark:border-border-dark flex items-center justify-center">
                            <span className="material-symbols-outlined text-[24px] text-text-sub-light dark:text-text-sub-dark animate-pulse">
                                graphic_eq
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

export default TopicPodcastPanel;
