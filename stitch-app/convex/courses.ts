import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
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

// Get all source uploads for a course
export const getCourseSources = query({
    args: { courseId: v.id("courses") },
    handler: async (ctx, args) => {
        const course = await ctx.db.get(args.courseId);
        if (!course) return [];

        // Check join table first
        const links = await ctx.db
            .query("courseUploads")
            .withIndex("by_courseId", (q) => q.eq("courseId", args.courseId))
            .collect();

        if (links.length > 0) {
            const sources = await Promise.all(
                links.map(async (link) => {
                    const upload = await ctx.db.get(link.uploadId);
                    if (!upload) return null;
                    return {
                        _id: link._id,
                        uploadId: link.uploadId,
                        fileName: upload.fileName,
                        fileType: upload.fileType,
                        fileSize: upload.fileSize,
                        status: link.status,
                        topicCount: link.topicCount,
                        addedAt: link.addedAt,
                    };
                })
            );
            return sources.filter(Boolean);
        }

        // Fallback for legacy courses with single uploadId
        if (course.uploadId) {
            const upload = await ctx.db.get(course.uploadId);
            if (upload) {
                return [{
                    _id: null,
                    uploadId: course.uploadId,
                    fileName: upload.fileName,
                    fileType: upload.fileType,
                    fileSize: upload.fileSize,
                    status: upload.status === "ready" ? "ready" : upload.status === "error" ? "error" : "processing",
                    topicCount: null,
                    addedAt: course._creationTime,
                }];
            }
        }

        return [];
    },
});

// Add an upload as a source to an existing course
export const addUploadToCourse = mutation({
    args: {
        courseId: v.id("courses"),
        uploadId: v.id("uploads"),
        userId: v.string(),
    },
    handler: async (ctx, args) => {
        const course = await ctx.db.get(args.courseId);
        if (!course || course.userId !== args.userId) {
            throw new Error("Course not found or access denied.");
        }
        const upload = await ctx.db.get(args.uploadId);
        if (!upload || upload.userId !== args.userId) {
            throw new Error("Upload not found or access denied.");
        }

        // Check for duplicate
        const existing = await ctx.db
            .query("courseUploads")
            .withIndex("by_courseId_uploadId", (q) =>
                q.eq("courseId", args.courseId).eq("uploadId", args.uploadId)
            )
            .first();
        if (existing) {
            throw new Error("This file is already added to this course.");
        }

        // If this is the first addUploadToCourse call for a legacy course,
        // also backfill the primary upload into the join table
        if (course.uploadId && course.uploadId !== args.uploadId) {
            const primaryExists = await ctx.db
                .query("courseUploads")
                .withIndex("by_courseId_uploadId", (q) =>
                    q.eq("courseId", args.courseId).eq("uploadId", course.uploadId!)
                )
                .first();
            if (!primaryExists) {
                await ctx.db.insert("courseUploads", {
                    courseId: args.courseId,
                    uploadId: course.uploadId,
                    addedAt: course._creationTime,
                    status: "ready",
                });
            }
        }

        const id = await ctx.db.insert("courseUploads", {
            courseId: args.courseId,
            uploadId: args.uploadId,
            addedAt: Date.now(),
            status: "processing",
        });

        return id;
    },
});

// Remove a source upload from a course
export const removeSourceFromCourse = mutation({
    args: {
        courseId: v.id("courses"),
        uploadId: v.id("uploads"),
        userId: v.string(),
    },
    handler: async (ctx, args) => {
        const course = await ctx.db.get(args.courseId);
        if (!course || course.userId !== args.userId) {
            throw new Error("Course not found or access denied.");
        }

        // Delete the join record
        const link = await ctx.db
            .query("courseUploads")
            .withIndex("by_courseId_uploadId", (q) =>
                q.eq("courseId", args.courseId).eq("uploadId", args.uploadId)
            )
            .first();
        if (link) {
            await ctx.db.delete(link._id);
        }

        // Delete topics generated from this upload
        const topics = await ctx.db
            .query("topics")
            .withIndex("by_courseId", (q) => q.eq("courseId", args.courseId))
            .collect();

        for (const topic of topics) {
            if (topic.sourceUploadId === args.uploadId) {
                // Delete child data for the topic
                const lessons = await ctx.db.query("lessons").withIndex("by_topicId", (q) => q.eq("topicId", topic._id)).collect();
                for (const l of lessons) await ctx.db.delete(l._id);
                const questions = await ctx.db.query("questions").withIndex("by_topicId", (q) => q.eq("topicId", topic._id)).collect();
                for (const q of questions) await ctx.db.delete(q._id);
                const attempts = await ctx.db.query("examAttempts").withIndex("by_topicId", (q) => q.eq("topicId", topic._id)).collect();
                for (const a of attempts) await ctx.db.delete(a._id);
                const concepts = await ctx.db.query("conceptAttempts").withIndex("by_topicId", (q) => q.eq("topicId", topic._id)).collect();
                for (const c of concepts) await ctx.db.delete(c._id);
                const notes = await ctx.db.query("topicNotes").withIndex("by_topicId", (q) => q.eq("topicId", topic._id)).collect();
                for (const n of notes) {
                    await ctx.db.delete(n._id);
                    void ctx.scheduler.runAfter(0, (internal as any).search.deleteSearchDocumentsForEntity, {
                        kind: "note", entityId: n._id, userId: n.userId,
                    }).catch(() => undefined);
                }
                if (topic.illustrationStorageId) await ctx.storage.delete(topic.illustrationStorageId);
                await ctx.db.delete(topic._id);
                void ctx.scheduler.runAfter(0, (internal as any).search.deleteSearchDocumentsForEntity, {
                    kind: "topic", entityId: topic._id, userId: course.userId,
                }).catch(() => undefined);
            }
        }

        // Delete evidence passages for this upload in this course
        const passages = await ctx.db
            .query("evidencePassages")
            .withIndex("by_uploadId", (q) => q.eq("uploadId", args.uploadId))
            .collect();
        for (const p of passages) {
            if (p.courseId === args.courseId) {
                await ctx.db.delete(p._id);
            }
        }

        // If the primary uploadId was removed, update it
        if (course.uploadId === args.uploadId) {
            const remainingLinks = await ctx.db
                .query("courseUploads")
                .withIndex("by_courseId", (q) => q.eq("courseId", args.courseId))
                .first();
            await ctx.db.patch(args.courseId, {
                uploadId: remainingLinks?.uploadId ?? undefined,
            });
        }

        // Clean up upload if not referenced elsewhere
        const otherLinks = await ctx.db
            .query("courseUploads")
            .withIndex("by_uploadId", (q) => q.eq("uploadId", args.uploadId))
            .first();
        const otherCourses = await ctx.db
            .query("courses")
            .withIndex("by_uploadId", (q) => q.eq("uploadId", args.uploadId))
            .collect();
        const stillReferenced = otherLinks || otherCourses.some((c) => c._id !== args.courseId);

        if (!stillReferenced) {
            const upload = await ctx.db.get(args.uploadId);
            if (upload) {
                if (upload.storageId) await ctx.storage.delete(upload.storageId);
                await ctx.db.delete(upload._id);
            }
        }

        return { success: true };
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

        // Delete courseUploads join records
        const courseUploadLinks = await ctx.db
            .query("courseUploads")
            .withIndex("by_courseId", (q) => q.eq("courseId", args.courseId))
            .collect();
        const linkedUploadIds = courseUploadLinks.map((l) => l.uploadId);
        for (const link of courseUploadLinks) {
            await ctx.db.delete(link._id);
        }

        await ctx.db.delete(args.courseId);
        void ctx.scheduler.runAfter(0, (internal as any).search.deleteSearchDocumentsForEntity, {
            kind: "course",
            entityId: args.courseId,
            userId: course.userId,
        }).catch(() => undefined);

        // Clean up uploads from join table that are no longer referenced
        for (const uid of linkedUploadIds) {
            const otherLink = await ctx.db.query("courseUploads").withIndex("by_uploadId", (q) => q.eq("uploadId", uid)).first();
            const otherCourse = await ctx.db.query("courses").withIndex("by_uploadId", (q) => q.eq("uploadId", uid)).first();
            if (!otherLink && !otherCourse) {
                const upload = await ctx.db.get(uid);
                if (upload) {
                    if (upload.storageId) await ctx.storage.delete(upload.storageId);
                    await ctx.db.delete(upload._id);
                }
            }
        }

        if (course.uploadId && !linkedUploadIds.includes(course.uploadId)) {
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

// Internal mutation to update courseUploads status (used by AI pipeline)
export const updateCourseUploadStatus = internalMutation({
    args: {
        courseId: v.id("courses"),
        uploadId: v.id("uploads"),
        status: v.string(),
        topicCount: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const link = await ctx.db
            .query("courseUploads")
            .withIndex("by_courseId_uploadId", (q) =>
                q.eq("courseId", args.courseId).eq("uploadId", args.uploadId)
            )
            .first();
        if (link) {
            const patch: Record<string, any> = { status: args.status };
            if (args.topicCount !== undefined) patch.topicCount = args.topicCount;
            await ctx.db.patch(link._id, patch);
        }
    },
});
