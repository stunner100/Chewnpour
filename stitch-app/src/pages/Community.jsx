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
    <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-card p-5 animate-pulse">
        <div className="h-5 w-3/4 bg-neutral-200 dark:bg-neutral-700 rounded-lg mb-3" />
        <div className="h-4 w-1/2 bg-neutral-100 dark:bg-neutral-800 rounded-lg mb-4" />
        <div className="flex items-center gap-4 mb-4">
            <div className="h-4 w-16 bg-neutral-100 dark:bg-neutral-800 rounded-lg" />
            <div className="h-4 w-16 bg-neutral-100 dark:bg-neutral-800 rounded-lg" />
        </div>
        <div className="h-9 w-full bg-neutral-100 dark:bg-neutral-800 rounded-xl" />
    </div>
);

// ── Channel card component ───────────────────────────────────────────────────

const ChannelCard = ({ channel, isMember }) => {
    const navigate = useNavigate();

    return (
        <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-card p-5 flex flex-col transition-all hover:shadow-card-hover hover:-translate-y-0.5">
            <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5 min-w-0">
                    {channel.icon && (
                        <div className="w-9 h-9 shrink-0 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                            <span className="material-symbols-outlined text-[20px] text-primary">{channel.icon}</span>
                        </div>
                    )}
                    <h3 className="text-base font-bold text-neutral-900 dark:text-white leading-snug line-clamp-2">
                        {channel.title}
                    </h3>
                </div>
                {channel.postsThisWeek > 0 && (
                    <span className="shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/10">
                        {channel.postsThisWeek} this week
                    </span>
                )}
            </div>

            {channel.description && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed line-clamp-2 mb-3">
                    {channel.description}
                </p>
            )}

            <div className="flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400 mb-4 mt-auto">
                <span className="inline-flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">group</span>
                    {channel.memberCount ?? 0} {channel.memberCount === 1 ? 'member' : 'members'}
                </span>
                <span className="inline-flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">chat_bubble</span>
                    {channel.postCount ?? 0} {channel.postCount === 1 ? 'post' : 'posts'}
                </span>
                {channel.lastActivityAt && (
                    <span className="ml-auto text-neutral-400 dark:text-neutral-500">
                        {formatRelativeTime(channel.lastActivityAt)}
                    </span>
                )}
            </div>

            <button
                onClick={() => navigate(`/dashboard/community/${channel._id}`)}
                className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.97] ${
                    isMember
                        ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                        : 'bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20'
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

    const isLoading = allChannels === undefined;

    const userChannelIds = useMemo(() => {
        if (!userChannels) return new Set();
        return new Set(userChannels.map((c) => c._id));
    }, [userChannels]);

    const filteredChannels = useMemo(() => {
        if (!allChannels) return [];
        if (!searchQuery.trim()) return allChannels;
        const q = searchQuery.toLowerCase().trim();
        return allChannels.filter((c) =>
            c.title.toLowerCase().includes(q)
        );
    }, [allChannels, searchQuery]);

    const myChannels = useMemo(
        () => filteredChannels.filter((c) => userChannelIds.has(c._id)),
        [filteredChannels, userChannelIds]
    );

    const discoverChannels = useMemo(
        () => filteredChannels.filter((c) => !userChannelIds.has(c._id)),
        [filteredChannels, userChannelIds]
    );

    const hasNoChannels = !isLoading && (!allChannels || allChannels.length === 0);

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark pb-24">
            {/* Header */}
            <div className="px-4 md:px-6 lg:px-8 pt-6 pb-2 max-w-6xl mx-auto">
                <h1 className="text-2xl md:text-3xl font-display font-bold text-neutral-900 dark:text-white">
                    Community
                </h1>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                    Study together, learn faster
                </p>
            </div>

            {/* Search */}
            <div className="px-4 md:px-6 lg:px-8 py-3 max-w-6xl mx-auto">
                <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-neutral-400 dark:text-neutral-500">
                        search
                    </span>
                    <input
                        type="text"
                        placeholder="Search channels..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 rounded-xl bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/60 text-sm text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
                        aria-label="Search community channels"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                            aria-label="Clear search"
                        >
                            <span className="material-symbols-outlined text-[18px] text-neutral-400">close</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="px-4 md:px-6 lg:px-8 max-w-6xl mx-auto">
                {/* Loading state */}
                {isLoading && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <ChannelCardSkeleton key={i} />
                        ))}
                    </div>
                )}

                {/* Empty state */}
                {hasNoChannels && (
                    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                        <div className="w-20 h-20 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-5">
                            <span className="material-symbols-outlined text-4xl text-neutral-400 dark:text-neutral-500">forum</span>
                        </div>
                        <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">
                            No community channels yet
                        </h2>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6 max-w-xs">
                            Upload a document to start one! Each course gets its own discussion channel.
                        </p>
                        <Link
                            to="/dashboard"
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-[0.97]"
                        >
                            <span className="material-symbols-outlined text-[20px]">upload</span>
                            Go to Dashboard
                        </Link>
                    </div>
                )}

                {/* Channels loaded */}
                {!isLoading && allChannels && allChannels.length > 0 && (
                    <>
                        {/* Your Channels */}
                        {myChannels.length > 0 && (
                            <section className="mb-8">
                                <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
                                    Your Channels
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {myChannels.map((channel) => (
                                        <ChannelCard key={channel._id} channel={channel} isMember />
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Discover */}
                        {discoverChannels.length > 0 && (
                            <section className="mb-8">
                                <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
                                    Discover
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {discoverChannels.map((channel) => (
                                        <ChannelCard key={channel._id} channel={channel} isMember={false} />
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* No results for search */}
                        {searchQuery && filteredChannels.length === 0 && (
                            <div className="flex flex-col items-center py-16 text-center">
                                <span className="material-symbols-outlined text-5xl text-neutral-300 dark:text-neutral-600 mb-3">
                                    search_off
                                </span>
                                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                                    No channels match "<span className="font-semibold">{searchQuery}</span>"
                                </p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default Community;
