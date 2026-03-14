import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

// Get all courses for a user
export const getUserCourses = query({
    args: { userId: v.optional(v.string()) },
    handler: async (ctx, args) => {
        if (!args.userId) return [];

        const courses = await ctx.db
            .query("courses")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .order("desc")
            .collect();

        const examAttempts = await ctx.db
            .query("examAttempts")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .collect();

        const conceptAttempts = await ctx.db
            .query("conceptAttempts")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .collect();

        const attemptedTopicIds = new Set([
            ...examAttempts.map((attempt) => attempt.topicId),
            ...conceptAttempts.map((attempt) => attempt.topicId),
        ]);

        const coursesWithProgress = await Promise.all(
            courses.map(async (course) => {
                const topics = await ctx.db
                    .query("topics")
                    .withIndex("by_courseId", (q) => q.eq("courseId", course._id))
                    .collect();

                const totalTopics = topics.length;
                const completedTopics = topics.filter((topic) => attemptedTopicIds.has(topic._id)).length;
                const progress = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

                return {
                    ...course,
                    progress,
                    status: progress >= 100 ? "completed" : "in_progress",
                };
            })
        );

        return coursesWithProgress;
    },
});

// Get single course with its topics
export const getCourseWithTopics = query({
    args: { courseId: v.id("courses") },
    handler: async (ctx, args) => {
        const course = await ctx.db.get(args.courseId);
        if (!course) return null;

        const topics = await ctx.db
            .query("topics")
            .withIndex("by_courseId", (q) => q.eq("courseId", args.courseId))
            .order("asc")
            .collect();

        return {
            ...course,
            topics,
        };
    },
});

// Create a new course
export const createCourse = mutation({
    args: {
        userId: v.string(),
        title: v.string(),
        description: v.optional(v.string()),
        coverColor: v.optional(v.string()),
        uploadId: v.optional(v.id("uploads")),
    },
    handler: async (ctx, args) => {
        const courseId = await ctx.db.insert("courses", {
            userId: args.userId,
            title: args.title,
            description: args.description,
            coverColor: args.coverColor || "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            uploadId: args.uploadId,
            progress: 0,
            status: "in_progress",
        });

        void ctx.scheduler.runAfter(0, (internal as any).search.upsertSearchDocumentsForEntity, {
            kind: "course",
            entityId: courseId,
        }).catch(() => undefined);

        return courseId;
    },
});

// Update course progress
export const updateCourseProgress = mutation({
    args: {
        courseId: v.id("courses"),
        progress: v.number(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.courseId, {
            progress: args.progress,
            status: args.progress >= 100 ? "completed" : "in_progress",
        });
    },
});

// Update course details (for AI processing)
export const updateCourse = mutation({
    args: {
        courseId: v.id("courses"),
        title: v.optional(v.string()),
        description: v.optional(v.string()),
        coverColor: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { courseId, ...updates } = args;
        // Filter out undefined values
        const cleanUpdates: Record<string, any> = {};
        if (updates.title !== undefined) cleanUpdates.title = updates.title;
        if (updates.description !== undefined) cleanUpdates.description = updates.description;
        if (updates.coverColor !== undefined) cleanUpdates.coverColor = updates.coverColor;

        await ctx.db.patch(courseId, cleanUpdates);
        void ctx.scheduler.runAfter(0, (internal as any).search.upsertSearchDocumentsForEntity, {
            kind: "course",
            entityId: courseId,
        }).catch(() => undefined);
    },
});


// Delete course and its topics
export const deleteCourse = mutation({
    args: {
        courseId: v.id("courses"),
        userId: v.string(),
    },
    handler: async (ctx, args) => {
        const course = await ctx.db.get(args.courseId);
        if (!course) {
            return { success: true };
        }

        if (course.userId !== args.userId) {
            throw new Error("You do not have permission to delete this course.");
        }

        // Delete all topics in this course
        const topics = await ctx.db
            .query("topics")
            .withIndex("by_courseId", (q) => q.eq("courseId", args.courseId))
            .collect();

        for (const topic of topics) {
            if (topic.illustrationStorageId) {
                await ctx.storage.delete(topic.illustrationStorageId);
            }

            // Delete lessons for this topic
            const lessons = await ctx.db
                .query("lessons")
                .withIndex("by_topicId", (q) => q.eq("topicId", topic._id))
                .collect();
            for (const lesson of lessons) {
                await ctx.db.delete(lesson._id);
            }

            // Delete questions for this topic
            const questions = await ctx.db
                .query("questions")
                .withIndex("by_topicId", (q) => q.eq("topicId", topic._id))
                .collect();
            for (const q of questions) {
                await ctx.db.delete(q._id);
            }

            // Delete exam attempts for this topic
            const examAttempts = await ctx.db
                .query("examAttempts")
                .withIndex("by_topicId", (q) => q.eq("topicId", topic._id))
                .collect();
            for (const attempt of examAttempts) {
                await ctx.db.delete(attempt._id);
            }

            // Delete concept attempts for this topic
            const conceptAttempts = await ctx.db
                .query("conceptAttempts")
                .withIndex("by_topicId", (q) => q.eq("topicId", topic._id))
                .collect();
            for (const attempt of conceptAttempts) {
                await ctx.db.delete(attempt._id);
            }

            const notes = await ctx.db
                .query("topicNotes")
                .withIndex("by_topicId", (q) => q.eq("topicId", topic._id))
                .collect();
            for (const note of notes) {
                await ctx.db.delete(note._id);
                void ctx.scheduler.runAfter(0, (internal as any).search.deleteSearchDocumentsForEntity, {
                    kind: "note",
                    entityId: note._id,
                    userId: note.userId,
                }).catch(() => undefined);
            }

            await ctx.db.delete(topic._id);
            void ctx.scheduler.runAfter(0, (internal as any).search.deleteSearchDocumentsForEntity, {
                kind: "topic",
                entityId: topic._id,
                userId: course.userId,
            }).catch(() => undefined);
        }

        await ctx.db.delete(args.courseId);
        void ctx.scheduler.runAfter(0, (internal as any).search.deleteSearchDocumentsForEntity, {
            kind: "course",
            entityId: args.courseId,
            userId: course.userId,
        }).catch(() => undefined);

        if (course.uploadId) {
            const userCourses = await ctx.db
                .query("courses")
                .withIndex("by_userId", (q) => q.eq("userId", args.userId))
                .collect();

            const uploadStillReferenced = userCourses.some(
                (userCourse) => userCourse._id !== args.courseId && userCourse.uploadId === course.uploadId
            );

            if (!uploadStillReferenced) {
                const upload = await ctx.db.get(course.uploadId);
                if (upload) {
                    if (upload.storageId) {
                        await ctx.storage.delete(upload.storageId);
                    }
                    await ctx.db.delete(upload._id);
                }
            }
        }

        return { success: true };
    },
});
