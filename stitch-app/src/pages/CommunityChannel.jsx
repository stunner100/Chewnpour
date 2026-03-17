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
    'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
    'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
    'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
    'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
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
        classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    },
    resource: {
        label: 'Resource',
        classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    },
    discussion: {
        label: 'Discussion',
        classes: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
    },
};

const TAG_OPTIONS = ['question', 'resource', 'discussion'];

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
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${config.classes}`}>
            {config.label}
        </span>
    );
};

// ── Skeleton post for loading ────────────────────────────────────────────────

const PostSkeleton = () => (
    <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-card p-4 animate-pulse">
        <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-neutral-200 dark:bg-neutral-700" />
            <div>
                <div className="h-4 w-24 bg-neutral-200 dark:bg-neutral-700 rounded mb-1" />
                <div className="h-3 w-16 bg-neutral-100 dark:bg-neutral-800 rounded" />
            </div>
        </div>
        <div className="h-4 w-full bg-neutral-100 dark:bg-neutral-800 rounded mb-2" />
        <div className="h-4 w-2/3 bg-neutral-100 dark:bg-neutral-800 rounded" />
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
                            <span className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                                {reply.authorProfile?.fullName || 'Anonymous'}
                            </span>
                            <span className="text-[11px] text-neutral-400 dark:text-neutral-500 shrink-0">
                                {formatRelativeTime(reply._creationTime)}
                            </span>
                        </div>
                        <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap break-words">
                            {reply.content}
                        </p>
                    </div>
                </div>
            ))}

            {/* Reply input */}
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
                        className="flex-1 min-w-0 px-3.5 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/60 text-sm text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all disabled:opacity-50"
                        aria-label="Write a reply"
                    />
                    <button
                        onClick={handleSubmitReply}
                        disabled={!replyText.trim() || submitting}
                        className="p-2 rounded-xl bg-primary text-white hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label="Send reply"
                    >
                        <span className="material-symbols-outlined text-[18px]">send</span>
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
        <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-card p-4 transition-all">
            {/* Author row */}
            <div className="flex items-center gap-3 mb-2.5">
                <UserAvatar profile={post.authorProfile} size={36} />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                        {post.authorProfile?.fullName || 'Anonymous'}
                    </p>
                    <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                        {formatRelativeTime(post._creationTime)}
                    </p>
                </div>
                <TagBadge tag={post.tag} />

                {/* 3-dot menu */}
                <div className="relative" ref={menuRef}>
                    <button
                        onClick={() => setShowMenu(!showMenu)}
                        className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                        aria-label="Post options"
                    >
                        <span className="material-symbols-outlined text-[20px] text-neutral-400">more_vert</span>
                    </button>
                    {showMenu && (
                        <div className="absolute right-0 top-full mt-1 w-40 py-1 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700 shadow-lg z-20">
                            <button
                                onClick={() => setShowMenu(false)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                            >
                                <span className="material-symbols-outlined text-[18px]">flag</span>
                                Report post
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Content */}
            <p className="text-sm text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap break-words leading-relaxed mb-3">
                {post.content}
            </p>

            {/* Actions row */}
            <div className="flex items-center gap-1">
                <button
                    onClick={() => setShowReplies(!showReplies)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all active:scale-95"
                    aria-expanded={showReplies}
                    aria-label={`${replyCount} replies, toggle replies`}
                >
                    <span className="material-symbols-outlined text-[16px]">chat_bubble_outline</span>
                    {replyCount > 0 ? `${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}` : 'Reply'}
                </button>
            </div>

            {/* Replies */}
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
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Sheet */}
            <div className="relative w-full sm:max-w-lg bg-white dark:bg-neutral-900 rounded-t-2xl sm:rounded-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-xl max-h-[85vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-neutral-100 dark:border-neutral-800">
                    <h2 className="text-base font-bold text-neutral-900 dark:text-white">New Post</h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                        aria-label="Close"
                    >
                        <span className="material-symbols-outlined text-[22px] text-neutral-400">close</span>
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                    {/* Tag selector */}
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
                                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 border ${
                                        isSelected
                                            ? `${config.classes} border-current`
                                            : 'bg-neutral-50 dark:bg-neutral-800/60 text-neutral-500 dark:text-neutral-400 border-neutral-200/80 dark:border-neutral-700/60 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                                    }`}
                                >
                                    {config.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Text area */}
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
                        className="w-full resize-none rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/80 dark:border-neutral-700/60 px-4 py-3 text-sm text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
                        aria-label="Post content"
                    />
                </div>

                {/* Footer */}
                <div className="px-5 pb-5 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                    <button
                        onClick={handleSubmit}
                        disabled={!content.trim() || submitting}
                        className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
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
        <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-card p-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-amber-500">emoji_events</span>
                Top Contributors This Week
            </h3>
            <div className="space-y-3">
                {leaderboard.map((entry, index) => (
                    <div key={entry.userId} className="flex items-center gap-3">
                        <span className="w-5 text-center text-xs font-bold text-neutral-400 dark:text-neutral-500">
                            {index + 1}
                        </span>
                        <UserAvatar profile={entry.profile} size={30} />
                        <span className="flex-1 min-w-0 text-sm font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                            {entry.profile?.fullName || 'Anonymous'}
                        </span>
                        <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 tabular-nums">
                            {entry.postCount} {entry.postCount === 1 ? 'post' : 'posts'}
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
    <div className="flex items-center gap-1 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800/60" role="tablist" aria-label="Filter posts by type">
        {FILTER_TABS.map((tab) => {
            const isActive = activeFilter === tab.key;
            return (
                <button
                    key={tab.key}
                    onClick={() => onChange(tab.key)}
                    role="tab"
                    aria-selected={isActive}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                        isActive
                            ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                            : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
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
    const { channelId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const userId = user?.id;

    const [activeFilter, setActiveFilter] = useState('all');
    const [showCompose, setShowCompose] = useState(false);

    // Queries
    const channel = useQuery(api.community.getChannel, channelId ? { channelId } : 'skip');
    const userChannels = useQuery(api.community.getUserChannels, userId ? { userId } : 'skip');
    const posts = useQuery(api.community.listPosts, channelId ? { channelId } : 'skip');
    const joinChannel = useMutation(api.community.joinChannel);

    const isMember = useMemo(() => {
        if (!userChannels || !channelId) return false;
        return userChannels.some((c) => c._id === channelId);
    }, [userChannels, channelId]);

    const filteredPosts = useMemo(() => {
        if (!posts) return [];
        if (activeFilter === 'all') return posts;
        return posts.filter((p) => p.tag === activeFilter);
    }, [posts, activeFilter]);

    const isLoading = channel === undefined || posts === undefined;

    const handleJoin = useCallback(async () => {
        if (!channelId || !userId) return;
        try {
            await joinChannel({ channelId, userId });
        } catch {
            // Silently handle - the UI will update reactively
        }
    }, [channelId, userId, joinChannel]);

    const handleCloseCompose = useCallback(() => {
        setShowCompose(false);
    }, []);

    // Channel not found after loading
    if (channel === null) {
        return (
            <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center px-6 pb-24">
                <div className="text-center max-w-md">
                    <div className="w-20 h-20 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-5">
                        <span className="material-symbols-outlined text-4xl text-neutral-400">forum</span>
                    </div>
                    <h1 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">Channel not found</h1>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
                        This community channel may have been removed or the link is invalid.
                    </p>
                    <Link
                        to="/dashboard/community"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
                    >
                        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                        Back to Community
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark pb-24">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-white/82 dark:bg-[#0a0a0a]/85 backdrop-blur-xl border-b border-neutral-200/60 dark:border-neutral-800/60">
                <div className="px-4 md:px-6 lg:px-8 max-w-6xl mx-auto flex items-center gap-3 h-14">
                    <button
                        onClick={() => navigate('/dashboard/community')}
                        className="p-1.5 -ml-1.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                        aria-label="Back to community"
                    >
                        <span className="material-symbols-outlined text-[22px] text-neutral-600 dark:text-neutral-300">arrow_back</span>
                    </button>
                    <div className="flex-1 min-w-0">
                        {isLoading ? (
                            <div className="h-5 w-40 bg-neutral-200 dark:bg-neutral-700 rounded-lg animate-pulse" />
                        ) : (
                            <h1 className="text-base font-bold text-neutral-900 dark:text-white truncate">
                                {channel?.title}
                            </h1>
                        )}
                        {!isLoading && channel && (
                            <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                                {channel.memberCount ?? 0} {(channel.memberCount ?? 0) === 1 ? 'member' : 'members'}
                            </p>
                        )}
                    </div>
                    {!isLoading && !isMember && userId && (
                        <button
                            onClick={handleJoin}
                            className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all active:scale-95"
                        >
                            Join Channel
                        </button>
                    )}
                </div>
            </div>

            {/* Body */}
            <div className="px-4 md:px-6 lg:px-8 max-w-6xl mx-auto pt-4">
                <div className="flex gap-6">
                    {/* Main posts column */}
                    <div className="flex-1 min-w-0 space-y-4">
                        {/* Filter tab bar */}
                        <FilterTabBar activeFilter={activeFilter} onChange={setActiveFilter} />

                        {/* Loading */}
                        {isLoading && (
                            <div className="space-y-4">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <PostSkeleton key={i} />
                                ))}
                            </div>
                        )}

                        {/* Posts */}
                        {!isLoading && filteredPosts.length > 0 && (
                            <div className="space-y-4">
                                {filteredPosts.map((post) => (
                                    <PostCard key={post._id} post={post} channelId={channelId} userId={userId} />
                                ))}
                            </div>
                        )}

                        {/* Empty posts */}
                        {!isLoading && posts && filteredPosts.length === 0 && (
                            <div className="flex flex-col items-center py-16 text-center">
                                <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
                                    <span className="material-symbols-outlined text-3xl text-neutral-400 dark:text-neutral-500">
                                        {activeFilter === 'all' ? 'chat_bubble_outline' : activeFilter === 'question' ? 'help_outline' : 'link'}
                                    </span>
                                </div>
                                <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                                    {activeFilter === 'all'
                                        ? 'No posts yet'
                                        : `No ${activeFilter === 'question' ? 'questions' : 'resources'} yet`}
                                </p>
                                <p className="text-xs text-neutral-400 dark:text-neutral-500">
                                    {isMember
                                        ? 'Be the first to start a conversation!'
                                        : 'Join this channel to start posting.'}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Desktop sidebar */}
                    <div className="hidden lg:block w-72 shrink-0 space-y-4">
                        {/* Channel info card */}
                        {channel && (
                            <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-card p-5">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
                                    About
                                </h3>
                                <p className="text-sm text-neutral-800 dark:text-neutral-200 font-semibold mb-1">
                                    {channel.title}
                                </p>
                                <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
                                    <span className="inline-flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[14px]">group</span>
                                        {channel.memberCount ?? 0} members
                                    </span>
                                    <span className="inline-flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[14px]">chat_bubble</span>
                                        {channel.postCount ?? 0} posts
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Leaderboard */}
                        {channelId && <WeeklyLeaderboard channelId={channelId} />}
                    </div>
                </div>
            </div>

            {/* Floating compose button */}
            {isMember && (
                <button
                    onClick={() => setShowCompose(true)}
                    className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-5 z-30 w-14 h-14 rounded-full bg-primary text-white shadow-lg shadow-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
                    aria-label="Create new post"
                >
                    <span className="material-symbols-outlined text-[26px]">edit</span>
                </button>
            )}

            {/* Compose modal */}
            {showCompose && channelId && (
                <ComposeModal channelId={channelId} userId={userId} onClose={handleCloseCompose} />
            )}
        </div>
    );
};

export default CommunityChannel;
