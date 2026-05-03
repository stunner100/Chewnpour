import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';

// ── Helpers ──────────────────────────────────────────────────────────────────

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
    return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTimeOfDay(timestamp) {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

const AVATAR_GRADIENTS = [
    'linear-gradient(135deg, #1a73e8 0%, #4285f4 100%)',
    'linear-gradient(135deg, #34a853 0%, #0d9488 100%)',
    'linear-gradient(135deg, #ea4335 0%, #d93025 100%)',
    'linear-gradient(135deg, #fbbc04 0%, #f59e0b 100%)',
    'linear-gradient(135deg, #5f6368 0%, #3c4043 100%)',
];

function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
}

function resolveGradient(avatarGradient) {
    const index = Number(avatarGradient);
    if (Number.isInteger(index) && index >= 0 && index < AVATAR_GRADIENTS.length) {
        return AVATAR_GRADIENTS[index];
    }
    return AVATAR_GRADIENTS[0];
}

const TAG_CONFIG = {
    question: { label: 'Question', classes: 'bg-primary/10 text-primary', dot: 'bg-primary' },
    resource: { label: 'Resource', classes: 'bg-accent-emerald/10 text-accent-emerald', dot: 'bg-accent-emerald' },
    discussion: { label: 'Discussion', classes: 'bg-surface-hover-light dark:bg-surface-hover-dark text-text-sub-light dark:text-text-sub-dark', dot: 'bg-text-faint-light dark:bg-text-faint-dark' },
};
const TAG_OPTIONS = ['discussion', 'question', 'resource'];

// Group consecutive messages by the same author within this window into one cluster.
const GROUPING_WINDOW_MS = 3 * 60 * 1000;

function groupMessages(posts) {
    // posts arrive newest-first; reverse to oldest-first for chat display.
    const oldestFirst = [...posts].reverse();
    const groups = [];
    for (const post of oldestFirst) {
        const last = groups[groups.length - 1];
        const sameAuthor = last && last.userId === post.userId;
        const withinWindow = last && (post._creationTime - last.lastTimestamp) <= GROUPING_WINDOW_MS;
        const sameTag = last && (last.posts[0].tag || 'discussion') === (post.tag || 'discussion');
        if (sameAuthor && withinWindow && sameTag) {
            last.posts.push(post);
            last.lastTimestamp = post._creationTime;
        } else {
            groups.push({
                key: post._id,
                userId: post.userId,
                authorProfile: post.authorProfile,
                firstTimestamp: post._creationTime,
                lastTimestamp: post._creationTime,
                posts: [post],
            });
        }
    }
    return groups;
}

// ── Avatar ───────────────────────────────────────────────────────────────────

const UserAvatar = ({ profile, size = 36 }) => {
    const initials = getInitials(profile?.fullName);
    const gradient = resolveGradient(profile?.avatarGradient);
    if (profile?.avatarUrl) {
        return (
            <img
                src={profile.avatarUrl}
                alt={profile.fullName || 'User'}
                className="rounded-full object-cover shrink-0"
                style={{ width: size, height: size }}
            />
        );
    }
    return (
        <div
            className="rounded-full flex items-center justify-center shrink-0 text-white font-bold select-none"
            style={{ width: size, height: size, background: gradient, fontSize: size * 0.38 }}
            aria-hidden="true"
        >
            {initials}
        </div>
    );
};

const TagBadge = ({ tag }) => {
    if (!tag || tag === 'discussion') return null;
    const config = TAG_CONFIG[tag] || TAG_CONFIG.discussion;
    return (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${config.classes}`}>
            <span className={`w-1 h-1 rounded-full ${config.dot}`} aria-hidden="true" />
            {config.label}
        </span>
    );
};

// ── Reply panel ──────────────────────────────────────────────────────────────

const ReplyThread = ({ postId, channelId, userId }) => {
    const replies = useQuery(api.community.listReplies, { parentPostId: postId });
    const createPost = useMutation(api.community.createPost);
    const [replyText, setReplyText] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = useCallback(async () => {
        const text = replyText.trim();
        if (!text || submitting || !channelId || !userId) return;
        setSubmitting(true);
        try {
            await createPost({ channelId, userId, content: text, tag: 'discussion', parentPostId: postId });
            setReplyText('');
        } finally {
            setSubmitting(false);
        }
    }, [replyText, submitting, createPost, postId, channelId, userId]);

    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    }, [handleSubmit]);

    return (
        <div className="mt-1.5 pl-12 pr-3 pb-1 space-y-2">
            {replies?.map((reply) => (
                <div key={reply._id} className="flex gap-2 items-start">
                    <UserAvatar profile={reply.authorProfile} size={22} />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                            <span className="text-caption font-semibold text-text-main-light dark:text-text-main-dark">
                                {reply.authorProfile?.fullName || 'Anonymous'}
                            </span>
                            <span className="text-[10px] text-text-faint-light dark:text-text-faint-dark">
                                {formatRelativeTime(reply._creationTime)}
                            </span>
                        </div>
                        <p className="text-caption text-text-sub-light dark:text-text-sub-dark whitespace-pre-wrap break-words leading-relaxed">
                            {reply.content}
                        </p>
                    </div>
                </div>
            ))}
            {userId && (
                <div className="flex items-center gap-1.5 pt-1">
                    <input
                        type="text"
                        placeholder="Reply in thread..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={submitting}
                        className="input-field flex-1 min-w-0 text-caption py-1.5 h-8"
                        aria-label="Reply"
                    />
                    <button
                        onClick={handleSubmit}
                        disabled={!replyText.trim() || submitting}
                        className="btn-primary p-1.5 h-8 w-8 disabled:opacity-40 inline-flex items-center justify-center"
                        aria-label="Send reply"
                    >
                        <span className="material-symbols-outlined text-[14px]">send</span>
                    </button>
                </div>
            )}
        </div>
    );
};

// ── Single message row (groups multiple consecutive posts from same author) ──

const MessageGroup = ({ group, channelId, userId }) => {
    const flagPost = useMutation(api.community.flagPost);
    const [openThreadId, setOpenThreadId] = useState(null);
    const [reportedIds, setReportedIds] = useState(() => new Set());

    const handleReport = useCallback(async (postId) => {
        if (reportedIds.has(postId) || !userId) return;
        setReportedIds((prev) => new Set(prev).add(postId));
        try {
            await flagPost({ postId, userId, reason: 'inappropriate' });
        } catch {
            setReportedIds((prev) => {
                const next = new Set(prev);
                next.delete(postId);
                return next;
            });
        }
    }, [flagPost, userId, reportedIds]);

    return (
        <div className="group/group hover:bg-surface-hover-light/40 dark:hover:bg-surface-hover-dark/40 transition-colors px-3 py-2 -mx-3 rounded-lg">
            {group.posts.map((post, idx) => {
                const isFirst = idx === 0;
                const isThreadOpen = openThreadId === post._id;
                const replyCount = post.replyCount ?? 0;
                const isReported = reportedIds.has(post._id);

                return (
                    <div key={post._id} className="relative group/msg">
                        <div className="flex gap-3">
                            {/* Avatar slot — only show for first message in group */}
                            <div className="w-9 shrink-0 flex justify-center">
                                {isFirst ? (
                                    <UserAvatar profile={group.authorProfile} size={36} />
                                ) : (
                                    <span className="opacity-0 group-hover/msg:opacity-100 text-[10px] text-text-faint-light dark:text-text-faint-dark mt-1 font-medium tabular-nums" aria-hidden="true">
                                        {formatTimeOfDay(post._creationTime)}
                                    </span>
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                {isFirst && (
                                    <div className="flex items-baseline gap-2 mb-0.5 flex-wrap">
                                        <span className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">
                                            {group.authorProfile?.fullName || 'Anonymous'}
                                        </span>
                                        <span className="text-[11px] text-text-faint-light dark:text-text-faint-dark">
                                            {formatTimeOfDay(post._creationTime)}
                                        </span>
                                        <TagBadge tag={post.tag} />
                                    </div>
                                )}

                                <p className="text-body-sm text-text-main-light dark:text-text-main-dark whitespace-pre-wrap break-words leading-relaxed">
                                    {post.content}
                                </p>

                                {replyCount > 0 && !isThreadOpen && (
                                    <button
                                        onClick={() => setOpenThreadId(post._id)}
                                        className="mt-1 inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-semibold text-primary hover:bg-primary/8 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[12px]">forum</span>
                                        {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
                                    </button>
                                )}
                            </div>

                            {/* Hover-reveal action toolbar */}
                            <div className="absolute -top-3 right-1 opacity-0 group-hover/msg:opacity-100 focus-within:opacity-100 transition-opacity bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg shadow-sm flex items-center">
                                <button
                                    onClick={() => setOpenThreadId(isThreadOpen ? null : post._id)}
                                    className="p-1.5 text-text-sub-light dark:text-text-sub-dark hover:text-text-main-light dark:hover:text-text-main-dark hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark transition-colors"
                                    aria-label={replyCount > 0 ? 'Toggle thread' : 'Reply in thread'}
                                    title={replyCount > 0 ? 'View thread' : 'Reply'}
                                >
                                    <span className="material-symbols-outlined text-[16px]">forum</span>
                                </button>
                                <button
                                    onClick={() => handleReport(post._id)}
                                    disabled={isReported}
                                    className="p-1.5 text-text-sub-light dark:text-text-sub-dark hover:text-red-500 hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    aria-label={isReported ? 'Already reported' : 'Report message'}
                                    title={isReported ? 'Reported' : 'Report'}
                                >
                                    <span className="material-symbols-outlined text-[16px]">flag</span>
                                </button>
                            </div>
                        </div>

                        {isThreadOpen && (
                            <ReplyThread postId={post._id} channelId={channelId} userId={userId} />
                        )}
                    </div>
                );
            })}
        </div>
    );
};

// ── Always-visible bottom composer ───────────────────────────────────────────

const Composer = ({ channelId, userId, isMember, onJoin }) => {
    const createPost = useMutation(api.community.createPost);
    const [content, setContent] = useState('');
    const [tag, setTag] = useState('discussion');
    const [submitting, setSubmitting] = useState(false);
    const textareaRef = useRef(null);

    // Auto-grow the textarea up to 6 rows.
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        const lineHeight = 22;
        const maxHeight = lineHeight * 6 + 12;
        el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    }, [content]);

    const handleSubmit = useCallback(async () => {
        const text = content.trim();
        if (!text || submitting || !userId || !isMember) return;
        setSubmitting(true);
        try {
            await createPost({ channelId, userId, content: text, tag });
            setContent('');
            setTag('discussion');
            textareaRef.current?.focus();
        } finally {
            setSubmitting(false);
        }
    }, [content, submitting, createPost, channelId, userId, tag, isMember]);

    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    }, [handleSubmit]);

    if (!isMember) {
        return (
            <div className="border-t border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark px-4 py-3 flex items-center justify-between gap-3">
                <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">
                    Join this channel to send messages
                </p>
                <button onClick={onJoin} className="btn-primary text-body-sm px-4 py-1.5 shrink-0">
                    Join
                </button>
            </div>
        );
    }

    const placeholder = tag === 'question' ? 'Ask a question...'
        : tag === 'resource' ? 'Share a resource...'
        : 'Send a message...';

    return (
        <div className="border-t border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark px-3 py-3">
            <div className="rounded-xl border border-border-light dark:border-border-dark focus-within:border-primary/50 transition-colors">
                <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    rows={1}
                    className="w-full resize-none bg-transparent px-3.5 py-2.5 text-body-sm text-text-main-light dark:text-text-main-dark placeholder:text-text-faint-light dark:placeholder:text-text-faint-dark focus:outline-none"
                    aria-label="Message"
                />
                <div className="flex items-center justify-between gap-2 px-2 pb-2">
                    <div className="flex items-center gap-1" role="radiogroup" aria-label="Message type">
                        {TAG_OPTIONS.map((t) => {
                            const config = TAG_CONFIG[t];
                            const isSelected = tag === t;
                            return (
                                <button
                                    key={t}
                                    onClick={() => setTag(t)}
                                    role="radio"
                                    aria-checked={isSelected}
                                    className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                                        isSelected
                                            ? config.classes
                                            : 'text-text-faint-light dark:text-text-faint-dark hover:text-text-sub-light dark:hover:text-text-sub-dark hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark'
                                    }`}
                                >
                                    {config.label}
                                </button>
                            );
                        })}
                    </div>
                    <button
                        onClick={handleSubmit}
                        disabled={!content.trim() || submitting}
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                            content.trim() && !submitting
                                ? 'bg-primary text-white hover:bg-primary-hover'
                                : 'bg-surface-hover-light dark:bg-surface-hover-dark text-text-faint-light dark:text-text-faint-dark cursor-not-allowed'
                        }`}
                        aria-label="Send message"
                    >
                        <span className="material-symbols-outlined text-[16px]">send</span>
                    </button>
                </div>
            </div>
            <p className="text-[10px] text-text-faint-light dark:text-text-faint-dark mt-1.5 px-1">
                <kbd className="font-sans">Enter</kbd> to send · <kbd className="font-sans">Shift + Enter</kbd> for newline
            </p>
        </div>
    );
};

// ── Weekly leaderboard (desktop sidebar) ─────────────────────────────────────

const WeeklyLeaderboard = ({ channelId }) => {
    const leaderboard = useQuery(api.community.getWeeklyLeaderboard, { channelId });
    if (!leaderboard || leaderboard.length === 0) return null;
    return (
        <div className="card-base p-4">
            <h3 className="text-overline text-text-faint-light dark:text-text-faint-dark mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-accent-amber">emoji_events</span>
                Top Contributors
            </h3>
            <div className="space-y-3">
                {leaderboard.map((entry, index) => (
                    <div key={entry.userId} className="flex items-center gap-3">
                        <span className="w-5 text-center text-caption font-semibold text-text-faint-light dark:text-text-faint-dark">
                            {index + 1}
                        </span>
                        <UserAvatar profile={entry.profile} size={28} />
                        <span className="flex-1 min-w-0 text-body-sm font-semibold text-text-main-light dark:text-text-main-dark truncate">
                            {entry.profile?.fullName || 'Anonymous'}
                        </span>
                        <span className="text-caption text-text-faint-light dark:text-text-faint-dark tabular-nums">
                            {entry.postCount}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ── Filter tab bar ───────────────────────────────────────────────────────────

const FILTER_TABS = [
    { key: 'all', label: 'All' },
    { key: 'question', label: 'Questions' },
    { key: 'resource', label: 'Resources' },
];

const FilterTabBar = ({ activeFilter, onChange }) => (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark" role="tablist" aria-label="Filter messages">
        {FILTER_TABS.map((tab) => {
            const isActive = activeFilter === tab.key;
            return (
                <button
                    key={tab.key}
                    onClick={() => onChange(tab.key)}
                    role="tab"
                    aria-selected={isActive}
                    className={`flex-1 py-1 px-3 rounded-md text-caption font-semibold transition-colors ${
                        isActive
                            ? 'bg-surface-light dark:bg-surface-dark text-text-main-light dark:text-text-main-dark shadow-sm'
                            : 'text-text-faint-light dark:text-text-faint-dark hover:text-text-sub-light dark:hover:text-text-sub-dark'
                    }`}
                >
                    {tab.label}
                </button>
            );
        })}
    </div>
);

// ── Loading skeleton ─────────────────────────────────────────────────────────

const MessageSkeleton = () => (
    <div className="px-3 py-2 animate-pulse">
        <div className="flex gap-3">
            <div className="w-9 h-9 rounded-full bg-border-light dark:bg-border-dark shrink-0" />
            <div className="flex-1 space-y-2 min-w-0">
                <div className="h-3 w-24 bg-border-light dark:bg-border-dark rounded" />
                <div className="h-3 w-3/4 bg-border-light dark:bg-border-dark rounded" />
            </div>
        </div>
    </div>
);

// ── Main channel detail page ─────────────────────────────────────────────────

const CommunityChannel = () => {
    const { channelId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const userId = user?.id;

    const [activeFilter, setActiveFilter] = useState('all');

    const channel = useQuery(api.community.getChannel, channelId ? { channelId } : 'skip');
    const userChannels = useQuery(api.community.getUserChannels, userId ? { userId } : 'skip');
    const posts = useQuery(api.community.listPosts, channelId ? { channelId } : 'skip');
    const joinChannel = useMutation(api.community.joinChannel);

    const feedRef = useRef(null);
    const lastSeenIdRef = useRef(null);

    const isMember = useMemo(() => {
        if (!userChannels || !channelId) return false;
        return userChannels.some((c) => c._id === channelId);
    }, [userChannels, channelId]);

    const filteredPosts = useMemo(() => {
        if (!posts) return [];
        if (activeFilter === 'all') return posts;
        return posts.filter((p) => p.tag === activeFilter);
    }, [posts, activeFilter]);

    const groupedMessages = useMemo(() => groupMessages(filteredPosts), [filteredPosts]);

    const isLoading = channel === undefined || posts === undefined;

    // Auto-scroll the feed to the bottom when a new message arrives, but only
    // if the user is already near the bottom (don't yank them out of scroll-back).
    useEffect(() => {
        const feed = feedRef.current;
        if (!feed || filteredPosts.length === 0) return;
        const newestId = filteredPosts[0]?._id;
        if (newestId === lastSeenIdRef.current) return;
        const wasNearBottom =
            lastSeenIdRef.current === null
            || feed.scrollHeight - feed.scrollTop - feed.clientHeight < 200;
        lastSeenIdRef.current = newestId;
        if (wasNearBottom) {
            requestAnimationFrame(() => {
                feed.scrollTop = feed.scrollHeight;
            });
        }
    }, [filteredPosts]);

    const handleJoin = useCallback(async () => {
        if (!channelId || !userId) return;
        try {
            await joinChannel({ channelId, userId });
        } catch {
            // UI updates reactively
        }
    }, [channelId, userId, joinChannel]);

    if (channel === null) {
        return (
            <div className="w-full max-w-5xl mx-auto px-4 md:px-8 py-8 text-center">
                <div className="py-16">
                    <div className="w-14 h-14 rounded-2xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-2xl text-text-faint-light dark:text-text-faint-dark">forum</span>
                    </div>
                    <h1 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-1">Channel not found</h1>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mb-5">
                        This channel may have been removed or the link is invalid.
                    </p>
                    <Link to="/dashboard/community" className="btn-secondary text-body-sm px-5 py-2 inline-flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                        Back to Community
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div
            className="w-full max-w-5xl mx-auto h-[calc(100dvh-4rem)] md:h-[calc(100dvh-2rem)] flex flex-col"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
            <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* Main column */}
                <div className="flex-1 min-w-0 flex flex-col px-4 md:px-6 pt-4">
                    {/* Channel header */}
                    <div className="flex items-center gap-3 pb-3 border-b border-border-light dark:border-border-dark">
                        <button
                            onClick={() => navigate('/dashboard/community')}
                            className="btn-icon w-9 h-9"
                            aria-label="Back to community"
                        >
                            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                        </button>
                        <div className="flex-1 min-w-0">
                            {isLoading ? (
                                <div className="h-5 w-40 bg-border-light dark:bg-border-dark rounded animate-pulse" />
                            ) : (
                                <div className="flex items-center gap-2">
                                    <span className="text-text-faint-light dark:text-text-faint-dark text-[20px] font-semibold">#</span>
                                    <h1 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark truncate">
                                        {channel?.title}
                                    </h1>
                                </div>
                            )}
                            {!isLoading && channel && (
                                <p className="text-caption text-text-faint-light dark:text-text-faint-dark">
                                    {channel.memberCount ?? 0} {(channel.memberCount ?? 0) === 1 ? 'member' : 'members'}
                                    {channel.description ? <span className="hidden sm:inline"> · {channel.description}</span> : null}
                                </p>
                            )}
                        </div>
                        {!isLoading && !isMember && userId && (
                            <button onClick={handleJoin} className="btn-primary text-body-sm px-4 py-1.5">
                                Join
                            </button>
                        )}
                    </div>

                    {/* Filter tabs */}
                    <div className="pt-3 pb-2">
                        <FilterTabBar activeFilter={activeFilter} onChange={setActiveFilter} />
                    </div>

                    {/* Scrollable feed */}
                    <div
                        ref={feedRef}
                        className="flex-1 min-h-0 overflow-y-auto -mx-1"
                    >
                        {isLoading && (
                            <div className="space-y-1">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <MessageSkeleton key={i} />
                                ))}
                            </div>
                        )}

                        {!isLoading && groupedMessages.length > 0 && (
                            <div className="space-y-0.5 py-2">
                                {groupedMessages.map((group) => (
                                    <MessageGroup
                                        key={group.key}
                                        group={group}
                                        channelId={channelId}
                                        userId={userId}
                                    />
                                ))}
                            </div>
                        )}

                        {!isLoading && posts && groupedMessages.length === 0 && (
                            <div className="text-center py-16">
                                <div className="w-12 h-12 rounded-xl bg-surface-hover-light dark:bg-surface-hover-dark flex items-center justify-center mx-auto mb-3">
                                    <span className="material-symbols-outlined text-xl text-text-faint-light dark:text-text-faint-dark">
                                        {activeFilter === 'all' ? 'chat_bubble_outline' : activeFilter === 'question' ? 'help_outline' : 'link'}
                                    </span>
                                </div>
                                <p className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark mb-1">
                                    {activeFilter === 'all'
                                        ? 'No messages yet'
                                        : `No ${activeFilter === 'question' ? 'questions' : 'resources'} yet`}
                                </p>
                                <p className="text-caption text-text-faint-light dark:text-text-faint-dark">
                                    {isMember ? 'Send the first message below.' : 'Join this channel to start chatting.'}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Always-visible composer */}
                    <Composer
                        channelId={channelId}
                        userId={userId}
                        isMember={isMember}
                        onJoin={handleJoin}
                    />
                </div>

                {/* Desktop sidebar */}
                <div className="hidden lg:block w-64 shrink-0 px-4 pt-4 pb-4 space-y-4 border-l border-border-light dark:border-border-dark overflow-y-auto">
                    {channel && (
                        <div className="card-base p-4">
                            <h3 className="text-overline text-text-faint-light dark:text-text-faint-dark mb-2">About</h3>
                            <p className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark mb-1.5">
                                #{channel.title}
                            </p>
                            {channel.description && (
                                <p className="text-caption text-text-sub-light dark:text-text-sub-dark mb-2 leading-relaxed">
                                    {channel.description}
                                </p>
                            )}
                            <div className="flex items-center gap-3 text-caption text-text-faint-light dark:text-text-faint-dark">
                                <span className="inline-flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[14px]">group</span>
                                    {channel.memberCount ?? 0}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[14px]">chat_bubble</span>
                                    {channel.postCount ?? 0}
                                </span>
                            </div>
                        </div>
                    )}
                    {channelId && <WeeklyLeaderboard channelId={channelId} />}
                </div>
            </div>
        </div>
    );
};

export default CommunityChannel;
