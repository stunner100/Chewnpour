import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from 'convex/react';
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

// ── Avatar gradients (matches Profile.jsx) ───────────────────────────────────

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

// ── Tag config ───────────────────────────────────────────────────────────────

const TAG_CONFIG = {
    question: {
        label: 'Question',
        classes: 'bg-primary/10 text-primary',
    },
    resource: {
        label: 'Resource',
        classes: 'bg-accent-emerald/10 text-accent-emerald',
    },
    discussion: {
        label: 'Discussion',
        classes: 'bg-surface-hover-light dark:bg-surface-hover-dark text-text-sub-light dark:text-text-sub-dark',
    },
};

const TAG_OPTIONS = ['question', 'resource', 'discussion'];

const CONVEX_ID_PATTERN = /^[a-z0-9]{32}$/;

const slugifyChannelKey = (value) =>
    String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');

// ── User avatar component ────────────────────────────────────────────────────

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
            style={{
                width: size,
                height: size,
                background: gradient,
                fontSize: size * 0.38,
            }}
            aria-hidden="true"
        >
            {initials}
        </div>
    );
};

// ── Tag badge ────────────────────────────────────────────────────────────────

const TagBadge = ({ tag }) => {
    const config = TAG_CONFIG[tag] || TAG_CONFIG.discussion;
    return (
        <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${config.classes}`}>
            {config.label}
        </span>
    );
};

// ── Skeleton post for loading ────────────────────────────────────────────────

const PostSkeleton = () => (
    <div className="card-base p-4 animate-pulse">
        <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-border-light dark:bg-border-dark" />
            <div>
                <div className="h-4 w-24 bg-border-light dark:bg-border-dark rounded mb-1" />
                <div className="h-3 w-16 bg-border-light dark:bg-border-dark rounded" />
            </div>
        </div>
        <div className="h-4 w-full bg-border-light dark:bg-border-dark rounded mb-2" />
        <div className="h-4 w-2/3 bg-border-light dark:bg-border-dark rounded" />
    </div>
);

// ── Reply section for a post ─────────────────────────────────────────────────

const ReplySection = ({ postId, channelId, userId }) => {
    const replies = useQuery(api.community.listReplies, { parentPostId: postId });
    const createPost = useMutation(api.community.createPost);
    const [replyText, setReplyText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSubmitReply = useCallback(async () => {
        const text = replyText.trim();
        if (!text || submitting || !channelId || !userId) return;
        setSubmitting(true);
        try {
            await createPost({
                channelId,
                userId,
                content: text,
                tag: 'discussion',
                parentPostId: postId,
            });
            setReplyText('');
        } finally {
            setSubmitting(false);
        }
    }, [replyText, submitting, createPost, postId, channelId, userId]);

    const handleKeyDown = useCallback(
        (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmitReply();
            }
        },
        [handleSubmitReply]
    );

    return (
        <div className="mt-3 ml-11 space-y-3">
            {replies?.map((reply) => (
                <div key={reply._id} className="flex gap-2.5">
                    <UserAvatar profile={reply.authorProfile} size={28} />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-caption font-semibold text-text-main-light dark:text-text-main-dark truncate">
                                {reply.authorProfile?.fullName || 'Anonymous'}
                            </span>
                            <span className="text-[11px] text-text-faint-light dark:text-text-faint-dark shrink-0">
                                {formatRelativeTime(reply._creationTime)}
                            </span>
                        </div>
                        <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark whitespace-pre-wrap break-words">
                            {reply.content}
                        </p>
                    </div>
                </div>
            ))}

            {userId && (
                <div className="flex items-center gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Write a reply..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={submitting}
                        className="input-field flex-1 min-w-0 text-body-sm py-2"
                        aria-label="Write a reply"
                    />
                    <button
                        onClick={handleSubmitReply}
                        disabled={!replyText.trim() || submitting}
                        className="btn-primary p-2 disabled:opacity-40"
                        aria-label="Send reply"
                    >
                        <span className="material-symbols-outlined text-[16px]">send</span>
                    </button>
                </div>
            )}
        </div>
    );
};

// ── Single post component ────────────────────────────────────────────────────

const PostCard = ({ post, channelId, userId }) => {
    const [showReplies, setShowReplies] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef(null);

    // Close menu when clicking outside
    useEffect(() => {
        if (!showMenu) return;
        const handler = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setShowMenu(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showMenu]);

    const replyCount = post.replyCount ?? 0;

    return (
        <div className="card-base p-4">
            <div className="flex items-center gap-3 mb-2.5">
                <UserAvatar profile={post.authorProfile} size={36} />
                <div className="flex-1 min-w-0">
                    <p className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark truncate">
                        {post.authorProfile?.fullName || 'Anonymous'}
                    </p>
                    <p className="text-[11px] text-text-faint-light dark:text-text-faint-dark">
                        {formatRelativeTime(post._creationTime)}
                    </p>
                </div>
                <TagBadge tag={post.tag} />

                <div className="relative" ref={menuRef}>
                    <button
                        onClick={() => setShowMenu(!showMenu)}
                        className="btn-icon w-8 h-8"
                        aria-label="Post options"
                    >
                        <span className="material-symbols-outlined text-[18px]">more_vert</span>
                    </button>
                    {showMenu && (
                        <div className="absolute right-0 top-full mt-1 w-40 py-1 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-lg z-20">
                            <button
                                onClick={() => setShowMenu(false)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-body-sm text-text-sub-light dark:text-text-sub-dark hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark transition-colors"
                            >
                                <span className="material-symbols-outlined text-[16px]">flag</span>
                                Report post
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <p className="text-body-sm text-text-main-light dark:text-text-main-dark whitespace-pre-wrap break-words leading-relaxed mb-3">
                {post.content}
            </p>

            <div className="flex items-center gap-1">
                <button
                    onClick={() => setShowReplies(!showReplies)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-caption font-semibold text-text-faint-light dark:text-text-faint-dark hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark transition-colors"
                    aria-expanded={showReplies}
                    aria-label={`${replyCount} replies, toggle replies`}
                >
                    <span className="material-symbols-outlined text-[14px]">chat_bubble_outline</span>
                    {replyCount > 0 ? `${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}` : 'Reply'}
                </button>
            </div>

            {showReplies && <ReplySection postId={post._id} channelId={channelId} userId={userId} />}
        </div>
    );
};

// ── Compose modal ────────────────────────────────────────────────────────────

const ComposeModal = ({ channelId, userId, onClose }) => {
    const createPost = useMutation(api.community.createPost);
    const [content, setContent] = useState('');
    const [tag, setTag] = useState('discussion');
    const [submitting, setSubmitting] = useState(false);
    const textareaRef = useRef(null);

    useEffect(() => {
        textareaRef.current?.focus();
    }, []);

    // Prevent background scroll when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    const handleSubmit = useCallback(async () => {
        const text = content.trim();
        if (!text || submitting || !userId) return;
        setSubmitting(true);
        try {
            await createPost({ channelId, userId, content: text, tag });
            onClose();
        } finally {
            setSubmitting(false);
        }
    }, [content, submitting, createPost, channelId, userId, tag, onClose]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
            role="dialog"
            aria-modal="true"
            aria-label="Create a new post"
        >
            <div
                className="absolute inset-0 bg-black/20"
                onClick={onClose}
                aria-hidden="true"
            />

            <div className="relative w-full sm:max-w-lg bg-surface-light dark:bg-surface-dark rounded-t-2xl sm:rounded-xl border border-border-light dark:border-border-dark shadow-lg max-h-[85vh] flex flex-col">
                <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border-light dark:border-border-dark">
                    <h2 className="text-body-base font-semibold text-text-main-light dark:text-text-main-dark">New Post</h2>
                    <button onClick={onClose} className="btn-icon w-8 h-8" aria-label="Close">
                        <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                    <div className="flex items-center gap-2" role="radiogroup" aria-label="Post type">
                        {TAG_OPTIONS.map((t) => {
                            const config = TAG_CONFIG[t];
                            const isSelected = tag === t;
                            return (
                                <button
                                    key={t}
                                    onClick={() => setTag(t)}
                                    role="radio"
                                    aria-checked={isSelected}
                                    className={`px-3 py-1.5 rounded-lg text-caption font-semibold transition-colors ${
                                        isSelected
                                            ? `${config.classes}`
                                            : 'bg-background-light dark:bg-background-dark text-text-faint-light dark:text-text-faint-dark hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark'
                                    }`}
                                >
                                    {config.label}
                                </button>
                            );
                        })}
                    </div>

                    <textarea
                        ref={textareaRef}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder={
                            tag === 'question'
                                ? 'Ask a question...'
                                : tag === 'resource'
                                ? 'Share a resource...'
                                : 'Start a discussion...'
                        }
                        rows={5}
                        className="input-field w-full resize-none text-body-sm"
                        aria-label="Post content"
                    />
                </div>

                <div className="px-4 pb-4 pt-2 border-t border-border-light dark:border-border-dark">
                    <button
                        onClick={handleSubmit}
                        disabled={!content.trim() || submitting}
                        className="w-full btn-primary text-body-sm py-2.5"
                    >
                        {submitting ? 'Posting...' : 'Post'}
                    </button>
                </div>
            </div>
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
    <div className="flex items-center gap-1 p-1 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark" role="tablist" aria-label="Filter posts by type">
        {FILTER_TABS.map((tab) => {
            const isActive = activeFilter === tab.key;
            return (
                <button
                    key={tab.key}
                    onClick={() => onChange(tab.key)}
                    role="tab"
                    aria-selected={isActive}
                    className={`flex-1 py-1.5 px-3 rounded-md text-caption font-semibold transition-colors ${
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

// ── Main channel detail page ─────────────────────────────────────────────────

const CommunityChannel = () => {
    const { channelId: routeChannelId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const userId = user?.id;

    const [activeFilter, setActiveFilter] = useState('all');
    const [showCompose, setShowCompose] = useState(false);

    const allChannels = useQuery(api.community.listChannels, {});
    const isDirectChannelId = CONVEX_ID_PATTERN.test(routeChannelId || '');
    const resolvedChannelId = useMemo(() => {
        if (!routeChannelId) return null;
        if (isDirectChannelId) return routeChannelId;
        if (allChannels === undefined) return undefined;
        const matchedChannel = allChannels.find(
            (candidate) => slugifyChannelKey(candidate.title) === slugifyChannelKey(routeChannelId)
        );
        return matchedChannel?._id ?? null;
    }, [allChannels, isDirectChannelId, routeChannelId]);

    // Queries
    const channel = useQuery(
        api.community.getChannel,
        resolvedChannelId ? { channelId: resolvedChannelId } : 'skip'
    );
    const userChannels = useQuery(api.community.getUserChannels, userId ? { userId } : 'skip');
    const posts = useQuery(
        api.community.listPosts,
        resolvedChannelId ? { channelId: resolvedChannelId } : 'skip'
    );
    const joinChannel = useMutation(api.community.joinChannel);

    const isMember = useMemo(() => {
        if (!userChannels || !resolvedChannelId) return false;
        return userChannels.some((c) => c._id === resolvedChannelId);
    }, [userChannels, resolvedChannelId]);

    const filteredPosts = useMemo(() => {
        if (!posts) return [];
        if (activeFilter === 'all') return posts;
        return posts.filter((p) => p.tag === activeFilter);
    }, [posts, activeFilter]);

    const isLoading = resolvedChannelId === undefined || channel === undefined || posts === undefined;
    const isMissingChannel = resolvedChannelId === null || channel === null;

    const handleJoin = useCallback(async () => {
        if (!resolvedChannelId || !userId) return;
        try {
            await joinChannel({ channelId: resolvedChannelId, userId });
        } catch {
            // Silently handle - the UI will update reactively
        }
    }, [resolvedChannelId, userId, joinChannel]);

    const handleCloseCompose = useCallback(() => {
        setShowCompose(false);
    }, []);

    if (isMissingChannel) {
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
        <div className="w-full max-w-5xl mx-auto px-4 md:px-8 py-8 pb-24 md:pb-12">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
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
                        <h1 className="text-display-sm text-text-main-light dark:text-text-main-dark truncate">
                            {channel?.title}
                        </h1>
                    )}
                    {!isLoading && channel && (
                        <p className="text-caption text-text-faint-light dark:text-text-faint-dark">
                            {channel.memberCount ?? 0} {(channel.memberCount ?? 0) === 1 ? 'member' : 'members'}
                        </p>
                    )}
                </div>
                {!isLoading && !isMember && userId && (
                    <button onClick={handleJoin} className="btn-primary text-body-sm px-4 py-2">
                        Join Channel
                    </button>
                )}
            </div>

            {/* Body */}
            <div className="flex gap-6">
                <div className="flex-1 min-w-0 space-y-3">
                    <FilterTabBar activeFilter={activeFilter} onChange={setActiveFilter} />

                    {isLoading && (
                        <div className="space-y-3">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <PostSkeleton key={i} />
                            ))}
                        </div>
                    )}

                    {!isLoading && filteredPosts.length > 0 && (
                        <div className="space-y-3">
                            {filteredPosts.map((post) => (
                                <PostCard key={post._id} post={post} channelId={resolvedChannelId} userId={userId} />
                            ))}
                        </div>
                    )}

                    {!isLoading && posts && filteredPosts.length === 0 && (
                        <div className="text-center py-16">
                            <div className="w-12 h-12 rounded-xl bg-surface-hover-light dark:bg-surface-hover-dark flex items-center justify-center mx-auto mb-3">
                                <span className="material-symbols-outlined text-xl text-text-faint-light dark:text-text-faint-dark">
                                    {activeFilter === 'all' ? 'chat_bubble_outline' : activeFilter === 'question' ? 'help_outline' : 'link'}
                                </span>
                            </div>
                            <p className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark mb-1">
                                {activeFilter === 'all'
                                    ? 'No posts yet'
                                    : `No ${activeFilter === 'question' ? 'questions' : 'resources'} yet`}
                            </p>
                            <p className="text-caption text-text-faint-light dark:text-text-faint-dark">
                                {isMember ? 'Be the first to start a conversation!' : 'Join this channel to start posting.'}
                            </p>
                        </div>
                    )}
                </div>

                {/* Desktop sidebar */}
                <div className="hidden lg:block w-64 shrink-0 space-y-4">
                    {channel && (
                        <div className="card-base p-4">
                            <h3 className="text-overline text-text-faint-light dark:text-text-faint-dark mb-2">About</h3>
                            <p className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark mb-1">
                                {channel.title}
                            </p>
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
                    {resolvedChannelId && <WeeklyLeaderboard channelId={resolvedChannelId} />}
                </div>
            </div>

            {/* Floating compose */}
            {isMember && (
                <button
                    onClick={() => setShowCompose(true)}
                    className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-8 right-5 md:right-8 z-30 w-12 h-12 rounded-xl bg-primary text-white shadow-lg flex items-center justify-center hover:bg-primary-hover transition-colors"
                    aria-label="Create new post"
                >
                    <span className="material-symbols-outlined text-[22px]">edit</span>
                </button>
            )}

            {showCompose && resolvedChannelId && (
                <ComposeModal channelId={resolvedChannelId} userId={userId} onClose={handleCloseCompose} />
            )}
        </div>
    );
};

export default CommunityChannel;
