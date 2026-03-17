import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ────────────────────────────────────────────────────────────────
// Queries
// ────────────────────────────────────────────────────────────────

// List all channels ordered by last activity (most recent first)
export const listChannels = query({
    args: {},
    handler: async (ctx) => {
        const limit = 20;
        const channels = await ctx.db
            .query("communityChannels")
            .withIndex("by_lastActivity")
            .order("desc")
            .take(limit);

        return channels;
    },
});

// Get a single channel by ID
export const getChannel = query({
    args: { channelId: v.id("communityChannels") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.channelId);
    },
});

// Get the channel for a specific course
export const getChannelByCourse = query({
    args: { courseId: v.id("courses") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("communityChannels")
            .withIndex("by_courseId", (q) => q.eq("courseId", args.courseId))
            .first();
    },
});

// List top-level posts in a channel (no replies), most recent first.
// Filters out hidden posts.
export const listPosts = query({
    args: {
        channelId: v.id("communityChannels"),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const limit = args.limit ?? 25;

        const posts = await ctx.db
            .query("communityPosts")
            .withIndex("by_channelId_createdAt", (q) => q.eq("channelId", args.channelId))
            .order("desc")
            .collect();

        // Filter to top-level, visible posts and apply limit
        const filtered = posts
            .filter((p) => p.parentPostId === undefined && !p.isHidden)
            .slice(0, limit);

        // Enrich with author profile info
        const enriched = await Promise.all(
            filtered.map(async (post) => {
                const profile = await ctx.db
                    .query("profiles")
                    .withIndex("by_userId", (q) => q.eq("userId", post.userId))
                    .first();
                return {
                    ...post,
                    authorProfile: profile
                        ? { fullName: profile.fullName, avatarUrl: profile.avatarUrl ?? null, avatarGradient: profile.avatarGradient ?? null }
                        : null,
                };
            })
        );

        return enriched;
    },
});

// List replies to a specific post, oldest first
export const listReplies = query({
    args: { parentPostId: v.id("communityPosts") },
    handler: async (ctx, args) => {
        const replies = await ctx.db
            .query("communityPosts")
            .withIndex("by_parentPostId", (q) => q.eq("parentPostId", args.parentPostId))
            .collect();

        // Sort by createdAt ascending
        replies.sort((a, b) => a.createdAt - b.createdAt);

        // Filter out hidden replies
        const visible = replies.filter((r) => !r.isHidden);

        // Enrich with author profile info
        const enriched = await Promise.all(
            visible.map(async (reply) => {
                const profile = await ctx.db
                    .query("profiles")
                    .withIndex("by_userId", (q) => q.eq("userId", reply.userId))
                    .first();
                return {
                    ...reply,
                    authorProfile: profile
                        ? { fullName: profile.fullName, avatarUrl: profile.avatarUrl ?? null, avatarGradient: profile.avatarGradient ?? null }
                        : null,
                };
            })
        );

        return enriched;
    },
});

// Check if a user is a member of a channel
export const getChannelMembership = query({
    args: {
        channelId: v.id("communityChannels"),
        userId: v.string(),
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("communityMembers")
            .withIndex("by_channelId_userId", (q) =>
                q.eq("channelId", args.channelId).eq("userId", args.userId)
            )
            .first();
    },
});

// List all channels a user has joined
export const getUserChannels = query({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        const memberships = await ctx.db
            .query("communityMembers")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .collect();

        const channels = await Promise.all(
            memberships.map(async (m) => {
                const channel = await ctx.db.get(m.channelId);
                if (!channel) return null;
                return { ...channel, role: m.role, joinedAt: m.joinedAt };
            })
        );

        // Filter out nulls (deleted channels) and sort by last activity
        return channels
            .filter((c): c is NonNullable<typeof c> => c !== null)
            .sort((a, b) => b.lastActivityAt - a.lastActivityAt);
    },
});

// Top 5 contributors in a channel this week (by post count)
export const getWeeklyLeaderboard = query({
    args: { channelId: v.id("communityChannels") },
    handler: async (ctx, args) => {
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

        const recentPosts = await ctx.db
            .query("communityPosts")
            .withIndex("by_channelId_createdAt", (q) =>
                q.eq("channelId", args.channelId).gte("createdAt", oneWeekAgo)
            )
            .collect();

        // Tally posts per user
        const counts = new Map<string, number>();
        for (const post of recentPosts) {
            counts.set(post.userId, (counts.get(post.userId) ?? 0) + 1);
        }

        // Sort descending and take top 5
        const sorted = Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        // Enrich with profile info
        const leaderboard = await Promise.all(
            sorted.map(async ([userId, postCount]) => {
                const profile = await ctx.db
                    .query("profiles")
                    .withIndex("by_userId", (q) => q.eq("userId", userId))
                    .first();
                return {
                    userId,
                    postCount,
                    profile: profile
                        ? { fullName: profile.fullName, avatarUrl: profile.avatarUrl ?? null, avatarGradient: profile.avatarGradient ?? null }
                        : null,
                };
            })
        );

        return leaderboard;
    },
});

// ────────────────────────────────────────────────────────────────
// Mutations
// ────────────────────────────────────────────────────────────────

// Create a community channel for a course (idempotent)
export const createChannelForCourse = mutation({
    args: {
        courseId: v.id("courses"),
        userId: v.string(),
    },
    handler: async (ctx, args) => {
        // Check if a channel already exists for this course
        const existing = await ctx.db
            .query("communityChannels")
            .withIndex("by_courseId", (q) => q.eq("courseId", args.courseId))
            .first();

        if (existing) {
            return existing._id;
        }

        // Fetch the course to get title and description
        const course = await ctx.db.get(args.courseId);
        if (!course) {
            throw new Error("Course not found.");
        }

        const now = Date.now();

        const channelId = await ctx.db.insert("communityChannels", {
            courseId: args.courseId,
            createdBy: args.userId,
            title: course.title,
            description: course.description ?? `Discussion channel for ${course.title}`,
            memberCount: 1,
            postCount: 0,
            lastActivityAt: now,
            createdAt: now,
        });

        // Auto-add the creator as a member
        await ctx.db.insert("communityMembers", {
            channelId,
            userId: args.userId,
            joinedAt: now,
            role: "creator",
        });

        return channelId;
    },
});

// Join an existing channel
export const joinChannel = mutation({
    args: {
        channelId: v.id("communityChannels"),
        userId: v.string(),
    },
    handler: async (ctx, args) => {
        // Check if already a member
        const existing = await ctx.db
            .query("communityMembers")
            .withIndex("by_channelId_userId", (q) =>
                q.eq("channelId", args.channelId).eq("userId", args.userId)
            )
            .first();

        if (existing) {
            return existing._id;
        }

        const channel = await ctx.db.get(args.channelId);
        if (!channel) {
            throw new Error("Channel not found.");
        }

        const now = Date.now();

        const memberId = await ctx.db.insert("communityMembers", {
            channelId: args.channelId,
            userId: args.userId,
            joinedAt: now,
            role: "member",
        });

        // Increment member count
        await ctx.db.patch(args.channelId, {
            memberCount: channel.memberCount + 1,
        });

        return memberId;
    },
});

// Leave a channel
export const leaveChannel = mutation({
    args: {
        channelId: v.id("communityChannels"),
        userId: v.string(),
    },
    handler: async (ctx, args) => {
        const membership = await ctx.db
            .query("communityMembers")
            .withIndex("by_channelId_userId", (q) =>
                q.eq("channelId", args.channelId).eq("userId", args.userId)
            )
            .first();

        if (!membership) {
            throw new Error("Not a member of this channel.");
        }

        if (membership.role === "creator") {
            throw new Error("Channel creator cannot leave the channel.");
        }

        const channel = await ctx.db.get(args.channelId);
        if (!channel) {
            throw new Error("Channel not found.");
        }

        await ctx.db.delete(membership._id);

        // Decrement member count (floor at 0 for safety)
        await ctx.db.patch(args.channelId, {
            memberCount: Math.max(0, channel.memberCount - 1),
        });

        return { ok: true };
    },
});

// Create a post or reply in a channel
export const createPost = mutation({
    args: {
        channelId: v.id("communityChannels"),
        userId: v.string(),
        content: v.string(),
        tag: v.optional(v.string()),
        parentPostId: v.optional(v.id("communityPosts")),
    },
    handler: async (ctx, args) => {
        const channel = await ctx.db.get(args.channelId);
        if (!channel) {
            throw new Error("Channel not found.");
        }

        const now = Date.now();

        const postId = await ctx.db.insert("communityPosts", {
            channelId: args.channelId,
            userId: args.userId,
            content: args.content,
            tag: args.tag,
            parentPostId: args.parentPostId,
            replyCount: 0,
            flagCount: 0,
            isHidden: false,
            createdAt: now,
        });

        // If this is a reply, increment parent's replyCount
        if (args.parentPostId) {
            const parent = await ctx.db.get(args.parentPostId);
            if (parent) {
                await ctx.db.patch(args.parentPostId, {
                    replyCount: parent.replyCount + 1,
                });
            }
        }

        // Update channel stats
        await ctx.db.patch(args.channelId, {
            postCount: channel.postCount + 1,
            lastActivityAt: now,
        });

        return postId;
    },
});

// Flag a post for moderation
export const flagPost = mutation({
    args: {
        postId: v.id("communityPosts"),
        userId: v.string(),
        reason: v.string(),
    },
    handler: async (ctx, args) => {
        // Check if this user already flagged this post
        const existingFlag = await ctx.db
            .query("communityFlags")
            .withIndex("by_userId_postId", (q) =>
                q.eq("userId", args.userId).eq("postId", args.postId)
            )
            .first();

        if (existingFlag) {
            throw new Error("You have already flagged this post.");
        }

        const post = await ctx.db.get(args.postId);
        if (!post) {
            throw new Error("Post not found.");
        }

        const now = Date.now();

        await ctx.db.insert("communityFlags", {
            postId: args.postId,
            userId: args.userId,
            reason: args.reason,
            createdAt: now,
        });

        const newFlagCount = post.flagCount + 1;
        const updates: { flagCount: number; isHidden?: boolean } = {
            flagCount: newFlagCount,
        };

        // Auto-hide if flagged 3 or more times
        if (newFlagCount >= 3) {
            updates.isHidden = true;
        }

        await ctx.db.patch(args.postId, updates);

        return { ok: true, flagCount: newFlagCount, isHidden: newFlagCount >= 3 };
    },
});

// Auto-join a user when they upload/create a course.
// Creates the channel if it doesn't exist yet, then joins the user.
export const autoJoinOnUpload = mutation({
    args: {
        courseId: v.id("courses"),
        userId: v.string(),
    },
    handler: async (ctx, args) => {
        // Check if a channel already exists for this course
        let channel = await ctx.db
            .query("communityChannels")
            .withIndex("by_courseId", (q) => q.eq("courseId", args.courseId))
            .first();

        const now = Date.now();

        if (!channel) {
            // Fetch the course to get title and description
            const course = await ctx.db.get(args.courseId);
            if (!course) {
                throw new Error("Course not found.");
            }

            const channelId = await ctx.db.insert("communityChannels", {
                courseId: args.courseId,
                createdBy: args.userId,
                title: course.title,
                description: course.description ?? `Discussion channel for ${course.title}`,
                memberCount: 1,
                postCount: 0,
                lastActivityAt: now,
                createdAt: now,
            });

            // Auto-add as creator
            await ctx.db.insert("communityMembers", {
                channelId,
                userId: args.userId,
                joinedAt: now,
                role: "creator",
            });

            return { channelId, created: true };
        }

        // Channel exists — check if user is already a member
        const existingMembership = await ctx.db
            .query("communityMembers")
            .withIndex("by_channelId_userId", (q) =>
                q.eq("channelId", channel!._id).eq("userId", args.userId)
            )
            .first();

        if (existingMembership) {
            return { channelId: channel._id, created: false };
        }

        // Join as a regular member
        await ctx.db.insert("communityMembers", {
            channelId: channel._id,
            userId: args.userId,
            joinedAt: now,
            role: "member",
        });

        await ctx.db.patch(channel._id, {
            memberCount: channel.memberCount + 1,
        });

        return { channelId: channel._id, created: false };
    },
});
