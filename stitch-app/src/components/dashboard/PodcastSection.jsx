import React from 'react';
import { Link } from 'react-router-dom';
import PodcastStatusBadge from './PodcastStatusBadge';

const formatDuration = (seconds) => {
    if (!seconds) return '—';
    const total = Math.max(0, Math.round(Number(seconds)));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
};

const formatDate = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const WaveformBars = () => (
    <div className="flex items-end gap-[3px] h-8" aria-hidden="true">
        {[8, 16, 24, 12, 28, 20, 14, 22, 18, 26, 10, 20].map((h, i) => (
            <span
                key={i}
                className="w-[3px] rounded-full bg-white/80"
                style={{ height: `${h}px` }}
            />
        ))}
    </div>
);

const PodcastSection = ({ podcasts = [], onGeneratePodcast, generateDisabled = false }) => {
    const hasPodcasts = podcasts.length > 0;
    const featured = hasPodcasts ? podcasts[0] : null;
    const rest = hasPodcasts ? podcasts.slice(1, 4) : [];

    return (
        <section className="space-y-4 animate-fade-in-up animate-delay-200">
            <div className="flex items-end justify-between gap-3">
                <div>
                    <h2 className="text-display-sm text-text-main-light dark:text-text-main-dark">Study podcasts</h2>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mt-0.5">
                        Turn your slides into an audio lesson and revise on the go.
                    </p>
                </div>
                {hasPodcasts && (
                    <button
                        type="button"
                        onClick={onGeneratePodcast}
                        disabled={generateDisabled}
                        className="btn-ghost text-caption disabled:opacity-50"
                    >
                        <span className="material-symbols-outlined text-[16px]">add</span>
                        New podcast
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
                {/* Player / Hero card */}
                {featured ? (
                    <Link
                        to={`/dashboard/topic/${featured.topicId}?panel=podcast`}
                        className="group relative overflow-hidden rounded-3xl border border-border-subtle dark:border-border-subtle-dark bg-gradient-to-br from-[#1c1234] via-[#2c1c4a] to-[#3a1f5e] text-white p-5 md:p-6 shadow-elevated hover:shadow-modal transition-all"
                    >
                        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/40 blur-3xl" aria-hidden="true" />
                        <div className="relative flex flex-col h-full gap-5">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-overline text-white/70">Continue listening</p>
                                    <h3 className="text-display-md font-semibold leading-tight mt-1 line-clamp-2">{featured.topicTitle}</h3>
                                    {featured.courseTitle && (
                                        <p className="text-caption text-white/60 mt-0.5 line-clamp-1">{featured.courseTitle}</p>
                                    )}
                                </div>
                                <PodcastStatusBadge status={featured.status} className="shrink-0" />
                            </div>

                            <div className="mt-auto space-y-3">
                                <div className="flex items-center gap-3">
                                    <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white text-[#2c1c4a] shadow-lg group-hover:scale-105 transition-transform">
                                        <span className="material-symbols-outlined text-[26px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                                            {featured.status === 'ready' ? 'play_arrow' : 'graphic_eq'}
                                        </span>
                                    </span>
                                    <WaveformBars />
                                </div>
                                <div className="flex items-center justify-between text-caption text-white/70">
                                    <span className="inline-flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                                        {formatDuration(featured.durationSeconds)}
                                    </span>
                                    <span>{formatDate(featured.createdAt)}</span>
                                </div>
                            </div>
                        </div>
                    </Link>
                ) : (
                    <div className="relative overflow-hidden rounded-3xl border border-border-subtle dark:border-border-subtle-dark bg-gradient-to-br from-[#1c1234] via-[#2c1c4a] to-[#3a1f5e] text-white p-6 md:p-8 shadow-elevated">
                        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/40 blur-3xl" aria-hidden="true" />
                        <div className="relative space-y-4 max-w-md">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-white text-[10px] font-bold uppercase tracking-wide">
                                <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                                AI Audio
                            </span>
                            <h3 className="text-display-md font-semibold leading-tight">Turn your slides into a study podcast</h3>
                            <p className="text-body-sm text-white/75">Generate an audio lesson from your uploaded materials and revise while walking, commuting, or resting.</p>
                            <button
                                type="button"
                                onClick={onGeneratePodcast}
                                disabled={generateDisabled}
                                className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-white text-[#2c1c4a] font-semibold text-body-sm shadow-md hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>graphic_eq</span>
                                Generate Podcast
                            </button>
                        </div>
                    </div>
                )}

                {/* Recent list */}
                <div className="card-base p-4 md:p-5">
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <h4 className="text-body-md font-semibold text-text-main-light dark:text-text-main-dark">Recent podcasts</h4>
                    </div>
                    {rest.length === 0 ? (
                        <div className="text-center py-6 px-2">
                            <span className="material-symbols-outlined text-[32px] text-text-faint-light dark:text-text-faint-dark">podcasts</span>
                            <p className="mt-2 text-body-sm text-text-sub-light dark:text-text-sub-dark">
                                Generate your first study podcast from a PDF, slide deck, or document.
                            </p>
                        </div>
                    ) : (
                        <ul className="space-y-2">
                            {rest.map((p) => (
                                <li key={p._id}>
                                    <Link
                                        to={`/dashboard/topic/${p.topicId}?panel=podcast`}
                                        className="flex items-center gap-3 p-2.5 rounded-xl border border-transparent hover:border-primary/20 hover:bg-primary-50/40 dark:hover:bg-primary-900/10 transition-all group"
                                    >
                                        <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                                            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark line-clamp-1">{p.topicTitle}</p>
                                            <p className="text-caption text-text-faint-light dark:text-text-faint-dark line-clamp-1">
                                                {formatDuration(p.durationSeconds)} · {formatDate(p.createdAt)}
                                            </p>
                                        </div>
                                        <PodcastStatusBadge status={p.status} className="shrink-0" />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </section>
    );
};

export default PodcastSection;
