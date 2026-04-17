import React, { memo, useMemo, useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

const STATUS_COPY = {
    pending: 'Queued — starting generation…',
    running: 'Generating your explainer video…',
    ready: 'Your explainer video is ready.',
    failed: 'Video generation failed.',
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

const formatDuration = (startedAt) => {
    if (!startedAt) return '';
    const seconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
    if (seconds < 60) return `${seconds}s elapsed`;
    const minutes = Math.floor(seconds / 60);
    const rem = seconds % 60;
    return `${minutes}m ${rem}s elapsed`;
};

const TopicVideoPanel = memo(function TopicVideoPanel({ topicId }) {
    const videos = useQuery(api.videos.listTopicVideos, topicId ? { topicId } : 'skip');
    const requestVideo = useMutation(api.videos.requestTopicVideo);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');

    const latest = useMemo(() => (Array.isArray(videos) && videos.length > 0 ? videos[0] : null), [videos]);
    const loading = videos === undefined;
    const inFlight = latest?.status === 'pending' || latest?.status === 'running';

    const handleGenerate = async () => {
        if (submitting || inFlight) return;
        setSubmitError('');
        setSubmitting(true);
        try {
            await requestVideo({ topicId });
        } catch (error) {
            setSubmitError(resolveErrorMessage(error, 'Could not start video generation.'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-5">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-body-sm text-text-sub-light dark:text-text-sub-dark">
                        <span className="material-symbols-outlined text-[18px]">movie</span>
                        <span>Explainer video</span>
                        <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-caption px-2 py-0.5">
                            Staging preview
                        </span>
                    </div>
                    <h3 className="mt-1 text-body font-semibold text-text-light dark:text-text-dark">
                        Turn this concept into a short video
                    </h3>
                    <p className="mt-1 text-body-sm text-text-sub-light dark:text-text-sub-dark">
                        Generates a ~5-second classroom-style clip from this topic's content.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={submitting || inFlight || loading}
                    className="btn-primary px-4 py-2 text-body-sm gap-2 shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    <span className="material-symbols-outlined text-[18px]">
                        {inFlight ? 'hourglass_top' : 'play_arrow'}
                    </span>
                    {inFlight ? 'Generating…' : 'Generate video'}
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
                            <span className="ml-2 opacity-70">{formatDuration(latest.createdAt)}</span>
                        )}
                    </div>

                    {latest.status === 'ready' && latest.videoUrl && (
                        <video
                            key={latest._id}
                            src={latest.videoUrl}
                            controls
                            playsInline
                            className="w-full rounded-xl border border-border-light dark:border-border-dark"
                        />
                    )}

                    {latest.status === 'failed' && (
                        <div className="rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 text-body-sm px-3 py-2">
                            {latest.errorMessage || 'Unknown error. Try again.'}
                        </div>
                    )}

                    {inFlight && (
                        <div className="aspect-[9/16] sm:aspect-video max-h-64 w-full rounded-xl border border-dashed border-border-light dark:border-border-dark flex items-center justify-center">
                            <span className="material-symbols-outlined text-[28px] text-text-sub-light dark:text-text-sub-dark animate-pulse">
                                movie
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

export default TopicVideoPanel;
