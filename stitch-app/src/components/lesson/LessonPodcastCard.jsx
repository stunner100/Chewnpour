import React, { useCallback, useEffect, useState } from 'react';
import AppIcon from '../AppIcon';
import PodcastWaveformPlayer from '../podcast/PodcastWaveformPlayer';
import { recordStudyActivity } from '../../lib/resumeActivity';

const LessonPodcastCard = ({ topicId, topicTitle = '' }) => {
    const [podcast, setPodcast] = useState(null);
    const [loading, setLoading] = useState(Boolean(topicId));
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState('');

    const loadPodcast = useCallback(async () => {
        if (!topicId) return;
        const response = await fetch(`/api/podcasts?topicId=${encodeURIComponent(topicId)}`, {
            credentials: 'include',
            headers: { Accept: 'application/json' },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload?.error || 'Could not load this podcast.');
        }
        const list = Array.isArray(payload.podcasts) ? payload.podcasts : [];
        setPodcast(list[0] || null);
    }, [topicId]);

    useEffect(() => {
        let cancelled = false;
        if (!topicId) return undefined;
        setLoading(true);
        loadPodcast()
            .catch(() => {
                if (!cancelled) setPodcast(null);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [loadPodcast, topicId]);

    useEffect(() => {
        const inFlight = podcast?.status === 'pending' || podcast?.status === 'running';
        if (!topicId || !inFlight) return undefined;
        const timer = setInterval(() => {
            loadPodcast().catch(() => {});
        }, 8000);
        return () => clearInterval(timer);
    }, [loadPodcast, podcast?.status, topicId]);

    const isReady = podcast?.status === 'ready' && podcast?.audioUrl;
    const isInFlight = generating || podcast?.status === 'pending' || podcast?.status === 'running';

    const handleGenerate = async () => {
        if (!topicId || generating) return;
        setError('');
        setGenerating(true);
        try {
            const response = await fetch('/api/podcast-generate', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ topicId, force: Boolean(isReady) }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload?.error || 'Could not generate this podcast.');
            }
            setPodcast(payload.podcast || null);
        } catch (generateError) {
            setError(generateError?.message || 'Could not generate this podcast.');
        } finally {
            setGenerating(false);
        }
    };

    return (
        <section
            id="topic-podcast"
            className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm"
        >
            <h3 className="min-w-0 text-body-lg font-semibold text-text-primary [overflow-wrap:anywhere]">
                {topicTitle || 'Listen on the go'}
            </h3>

            {error ? (
                <p className="mt-3 text-caption text-error">{error}</p>
            ) : null}

            {isReady ? (
                <>
                    <PodcastWaveformPlayer
                        key={podcast.id}
                        audioUrl={podcast.audioUrl}
                        title={podcast.topicTitle || topicTitle}
                        durationSeconds={podcast.durationSeconds}
                        className="mt-4"
                        onPlay={() => recordStudyActivity(topicId, 'podcast')}
                    />
                    <button
                        type="button"
                        onClick={handleGenerate}
                        disabled={isInFlight || loading}
                        className="mt-3 inline-flex min-h-11 items-center text-body-sm font-semibold text-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-primary-soft disabled:opacity-60 [@media(hover:hover)_and_(pointer:fine)]:hover:text-text-primary"
                    >
                        {isInFlight ? 'Generating…' : 'Regenerate'}
                    </button>
                </>
            ) : (
                <>
                    <p className="mt-1 text-body-sm text-text-secondary">
                        {isInFlight
                            ? 'Writing the script and synthesizing audio. This can take about a minute.'
                            : 'Turn this lesson into a two-host audio recap you can play while commuting or revising.'}
                    </p>
                    <button
                        type="button"
                        onClick={handleGenerate}
                        disabled={isInFlight || loading}
                        className="btn-secondary mt-4 inline-flex min-h-11 shrink-0 text-caption disabled:opacity-60"
                    >
                        <AppIcon name={isInFlight ? 'hourglass_top' : 'graphic_eq'} className="text-[16px]" />
                        {isInFlight ? 'Generating…' : 'Generate podcast'}
                    </button>
                </>
            )}
        </section>
    );
};

export default LessonPodcastCard;
