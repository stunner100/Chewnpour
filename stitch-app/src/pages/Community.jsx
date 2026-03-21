import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';

// ── Relative time formatter ──────────────────────────────────────────────────

function formatRelativeTime(timestamp) {
    if (!timestamp) return '';
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    });
}

// ── Skeleton card for loading state ──────────────────────────────────────────

const ChannelCardSkeleton = () => (
    <div className="card-base p-4 animate-pulse">
        <div className="h-5 w-3/4 bg-border-light dark:bg-border-dark rounded mb-3" />
        <div className="h-4 w-1/2 bg-border-light dark:bg-border-dark rounded mb-4" />
        <div className="flex items-center gap-4 mb-4">
            <div className="h-3 w-16 bg-border-light dark:bg-border-dark rounded" />
            <div className="h-3 w-16 bg-border-light dark:bg-border-dark rounded" />
        </div>
        <div className="h-9 w-full bg-border-light dark:bg-border-dark rounded-lg" />
    </div>
);

// ── Channel card component ───────────────────────────────────────────────────

const ChannelCard = ({ channel, isMember }) => {
    const navigate = useNavigate();

    return (
        <div className="card-base p-4 flex flex-col hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark transition-colors">
            <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5 min-w-0">
                    {channel.icon && (
                        <div className="w-9 h-9 shrink-0 rounded-lg bg-primary/8 dark:bg-primary/15 flex items-center justify-center">
                            <span className="material-symbols-outlined text-[18px] text-primary">{channel.icon}</span>
                        </div>
                    )}
                    <h3 className="text-body-base font-semibold text-text-main-light dark:text-text-main-dark leading-snug line-clamp-2">
                        {channel.title}
                    </h3>
                </div>
                {channel.postsThisWeek > 0 && (
                    <span className="badge badge-primary shrink-0">
                        {channel.postsThisWeek} this week
                    </span>
                )}
            </div>

            {channel.description && (
                <p className="text-caption text-text-sub-light dark:text-text-sub-dark line-clamp-2 mb-3">
                    {channel.description}
                </p>
            )}

            <div className="flex items-center gap-4 text-caption text-text-faint-light dark:text-text-faint-dark mb-4 mt-auto">
                <span className="inline-flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">group</span>
                    {channel.memberCount ?? 0}
                </span>
                <span className="inline-flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">chat_bubble</span>
                    {channel.postCount ?? 0}
                </span>
                {channel.lastActivityAt && (
                    <span className="ml-auto">
                        {formatRelativeTime(channel.lastActivityAt)}
                    </span>
                )}
            </div>

            <button
                onClick={() => navigate(`/dashboard/community/${channel._id}`)}
                className={`w-full py-2 rounded-lg text-body-sm font-semibold transition-colors ${
                    isMember
                        ? 'btn-secondary'
                        : 'btn-primary'
                }`}
            >
                {isMember ? 'Open' : 'Join'}
            </button>
        </div>
    );
};

// ── Main Community page ──────────────────────────────────────────────────────

const Community = () => {
    const { user } = useAuth();
    const userId = user?.id;
    const [searchQuery, setSearchQuery] = useState('');
    const hasRequestedDefaultChannels = useRef(false);

    const seedDefaultChannels = useMutation(api.community.seedDefaultChannels);
    const allChannels = useQuery(api.community.listChannels, {});
    const userChannels = useQuery(
        api.community.getUserChannels,
        userId ? { userId } : 'skip'
    );

    useEffect(() => {
        if (!userId || hasRequestedDefaultChannels.current) return;
        hasRequestedDefaultChannels.current = true;

        void seedDefaultChannels({}).catch(() => {
            hasRequestedDefaultChannels.current = false;
        });
    }, [seedDefaultChannels, userId]);

    const isLoading = allChannels === undefined || (userId ? userChannels === undefined : false);

    const userChannelIds = useMemo(() => {
        if (!userChannels) return new Set();
        return new Set(userChannels.map((c) => c._id));
    }, [userChannels]);

    const combinedChannels = useMemo(() => {
        const deduped = new Map();
        for (const channel of userChannels ?? []) {
            deduped.set(channel._id, channel);
        }
        for (const channel of allChannels ?? []) {
            deduped.set(channel._id, { ...deduped.get(channel._id), ...channel });
        }
        return Array.from(deduped.values()).sort((a, b) => b.lastActivityAt - a.lastActivityAt);
    }, [allChannels, userChannels]);

    const filteredChannels = useMemo(() => {
        if (!combinedChannels.length) return [];
        if (!searchQuery.trim()) return combinedChannels;
        const q = searchQuery.toLowerCase().trim();
        return combinedChannels.filter((c) =>
            c.title.toLowerCase().includes(q)
        );
    }, [combinedChannels, searchQuery]);

    const myChannels = useMemo(
        () => filteredChannels.filter((c) => userChannelIds.has(c._id)),
        [filteredChannels, userChannelIds]
    );

    const everyoneChannels = useMemo(
        () => filteredChannels.filter((c) => c.isSeeded && !userChannelIds.has(c._id)),
        [filteredChannels, userChannelIds]
    );

    const discoverChannels = useMemo(
        () => filteredChannels.filter((c) => !c.isSeeded && !userChannelIds.has(c._id)),
        [filteredChannels, userChannelIds]
    );

    const hasNoChannels = !isLoading && combinedChannels.length === 0;

    return (
        <div className="w-full max-w-5xl mx-auto px-4 md:px-8 py-8 pb-24 md:pb-12 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-display-sm text-text-main-light dark:text-text-main-dark">Community</h1>
                <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mt-1">Study together, learn faster</p>
            </div>

            {/* Search */}
            <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-text-faint-light dark:text-text-faint-dark">
                    search
                </span>
                <input
                    type="text"
                    placeholder="Search channels..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input-field pl-10 text-body-sm"
                    aria-label="Search community channels"
                />
                {searchQuery && (
                    <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 btn-icon w-6 h-6"
                        aria-label="Clear search"
                    >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                )}
            </div>

            {/* Loading */}
            {isLoading && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <ChannelCardSkeleton key={i} />
                    ))}
                </div>
            )}

            {/* Empty */}
            {hasNoChannels && (
                <div className="text-center py-16">
                    <div className="w-14 h-14 rounded-2xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-2xl text-text-faint-light dark:text-text-faint-dark">forum</span>
                    </div>
                    <h3 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-1">No community channels yet</h3>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark max-w-xs mx-auto mb-5">
                        Upload a document to start one! Each course gets its own discussion channel.
                    </p>
                    <Link to="/dashboard" className="btn-primary text-body-sm px-5 py-2 inline-flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">upload</span>
                        Go to Dashboard
                    </Link>
                </div>
            )}

            {/* Channels */}
            {!isLoading && allChannels && allChannels.length > 0 && (
                <>
                    {myChannels.length > 0 && (
                        <section>
                            <h2 className="text-overline text-text-faint-light dark:text-text-faint-dark mb-3">Your Channels</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {myChannels.map((channel) => (
                                    <ChannelCard key={channel._id} channel={channel} isMember />
                                ))}
                            </div>
                        </section>
                    )}

                    {everyoneChannels.length > 0 && (
                        <section>
                            <h2 className="text-overline text-text-faint-light dark:text-text-faint-dark mb-3">Available to Everyone</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {everyoneChannels.map((channel) => (
                                    <ChannelCard key={channel._id} channel={channel} isMember={false} />
                                ))}
                            </div>
                        </section>
                    )}

                    {discoverChannels.length > 0 && (
                        <section>
                            <h2 className="text-overline text-text-faint-light dark:text-text-faint-dark mb-3">Discover</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {discoverChannels.map((channel) => (
                                    <ChannelCard key={channel._id} channel={channel} isMember={false} />
                                ))}
                            </div>
                        </section>
                    )}

                    {searchQuery && filteredChannels.length === 0 && (
                        <div className="text-center py-16">
                            <span className="material-symbols-outlined text-4xl text-text-faint-light dark:text-text-faint-dark mb-3">search_off</span>
                            <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">
                                No channels match &ldquo;{searchQuery}&rdquo;
                            </p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default Community;
