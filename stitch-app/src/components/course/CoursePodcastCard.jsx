import React from 'react';
import { Link } from 'react-router-dom';
import PodcastStatusBadge from '../dashboard/PodcastStatusBadge';
import AppIcon from '../AppIcon';

const WAVEFORM_BARS = [8, 16, 24, 12, 28, 20, 14, 22, 18, 26, 10, 20].map((height, position) => ({
    id: `bar-${position}-${height}`,
    height,
}));

const formatDuration = (seconds) => {
    if (!seconds) return '';
    const total = Math.max(0, Math.round(Number(seconds)));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
};

const formatRelative = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
    });
};

const WaveformBars = () => (
    <div className="flex items-end gap-[3px] h-8" aria-hidden="true">
        {WAVEFORM_BARS.map((bar) => (
            <span
                key={bar.id}
                className="w-[3px] rounded-full bg-white/80"
                style={{ height: `${bar.height}px` }}
            />
        ))}
    </div>
);

// One canonical card. States: ready / generating / not_generated / not_ready.
const CoursePodcastCard = ({ podcast, courseTitle, generatePath }) => {
    const status = podcast?.status || 'not_generated';
    const isReady = status === 'ready';
    const isInFlight = status === 'pending' || status === 'running';
    const isFailed = status === 'failed';

    return (
        <section className="relative overflow-hidden rounded-3xl border border-border-subtle dark:border-border-subtle-dark bg-gradient-to-br from-[#1c1234] via-[#2c1c4a] to-[#3a1f5e] text-white p-5 md:p-6 shadow-elevated">
            <div
                className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/40 blur-3xl"
                aria-hidden="true"
            />
            <div className="relative flex flex-col gap-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-overline text-white/70">Study this course as a podcast</p>
                        <h3 className="text-display-md font-semibold leading-tight mt-1 line-clamp-2">
                            {isReady && podcast?.topicTitle
                                ? podcast.topicTitle
                                : 'Listen on the go'}
                        </h3>
                        <p className="text-caption text-white/70 mt-1 line-clamp-1">
                            {courseTitle ||
                                'Generate an audio lesson and revise while walking, commuting, or resting.'}
                        </p>
                    </div>
                    <PodcastStatusBadge status={status} className="shrink-0" />
                </div>

                {isReady ? (
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <Link
                                to="/dashboard/podcasts"
                                className="inline-flex items-center justify-center size-12 rounded-full bg-white text-[#2c1c4a] shadow-lg hover:scale-105 transition-transform"
                                aria-label="Open podcast library"
                            >
                                <AppIcon name="play_arrow" className="text-[26px]" />
                            </Link>
                            <WaveformBars />
                        </div>
                        <div className="flex items-center justify-between text-caption text-white/70">
                            <span className="inline-flex items-center gap-1.5">
                                <AppIcon name="schedule" className="text-[14px]" />
                                {formatDuration(podcast.durationSeconds) || '—'}
                            </span>
                            <span>{formatRelative(podcast.createdAt)}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Link
                                to="/dashboard/podcasts"
                                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white text-[#2c1c4a] font-semibold text-body-sm shadow-md hover:shadow-lg active:scale-[0.98] transition-all"
                            >
                                <AppIcon name="headphones" className="text-[16px]" />
                                Continue listening
                            </Link>
                            <Link
                                to={generatePath}
                                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-body-sm transition-colors border border-white/20"
                            >
                                <AppIcon name="graphic_eq" className="text-[16px]" />
                                Refresh audio
                            </Link>
                        </div>
                    </div>
                ) : isInFlight ? (
                    <div className="space-y-2">
                        <div className="h-14 rounded-xl border border-dashed border-white/30 flex items-center justify-center gap-2 text-white/85">
                            <AppIcon name="graphic_eq" className="text-[20px] animate-pulse" />
                            <span className="text-body-sm">
                                {status === 'pending'
                                    ? 'Queued — writing the script…'
                                    : 'Synthesizing audio…'}
                            </span>
                        </div>
                        <Link
                            to="/dashboard/podcasts"
                            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white text-[#2c1c4a] font-semibold text-body-sm shadow-md hover:shadow-lg active:scale-[0.98] transition-all"
                        >
                            <AppIcon name="open_in_new" className="text-[16px]" />
                            Open podcast hub
                        </Link>
                    </div>
                ) : isFailed ? (
                    <div className="space-y-2">
                        <div className="rounded-lg border border-white/20 bg-white/10 text-white/80 text-body-sm px-3 py-2">
                            Podcast is not ready yet.
                        </div>
                        <Link
                            to={generatePath}
                            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white text-[#2c1c4a] font-semibold text-body-sm shadow-md hover:shadow-lg active:scale-[0.98] transition-all"
                        >
                            <AppIcon name="refresh" className="text-[16px]" />
                            Prepare podcast
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <p className="text-body-sm text-white/80">
                            Generate an audio lesson from a topic in this course and listen anywhere.
                        </p>
                        <Link
                            to={generatePath}
                            className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-white text-[#2c1c4a] font-semibold text-body-sm shadow-md hover:shadow-lg active:scale-[0.98] transition-all"
                        >
                            <AppIcon name="graphic_eq" className="text-[18px]" />
                            Generate podcast
                        </Link>
                    </div>
                )}
            </div>
        </section>
    );
};

export default CoursePodcastCard;
