import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertOwnerUserId, requireAuthenticatedUserId } from "./lib/authz";

const READING_LEVELS = new Set(["beginner", "growing", "confident"]);
const HELP_PROMPTS = new Set(["Explain again", "Give example", "Make it a story", "Read it easier"]);

const normalizeReadingLevel = (value: string) => {
    const normalized = String(value || "").trim().toLowerCase();
    return READING_LEVELS.has(normalized) ? normalized : "growing";
};

const cleanName = (value: string) => String(value || "").trim().replace(/\s+/g, " ");

const titleFromFileName = (fileName = "Reading page") =>
    String(fileName || "Reading page")
        .replace(/\.(pdf|pptx|docx|png|jpe?g|webp|txt|md)$/i, "")
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim() || "Reading page";

const assertKidProfileOwner = async (
    ctx: any,
    args: { childId: any; userId: string },
): Promise<any> => {
    const child = await ctx.db.get(args.childId);
    if (!child) {
        throw new ConvexError({ code: "NOT_FOUND", message: "Child profile not found." });
    }
    assertOwnerUserId({ authenticatedUserId: args.userId, ownerUserId: child.userId });
    return child;
};

const assertMaterialOwner = async (
    ctx: any,
    args: { materialId: any; userId: string },
): Promise<any> => {
    const material = await ctx.db.get(args.materialId);
    if (!material) {
        throw new ConvexError({ code: "NOT_FOUND", message: "Reading page not found." });
    }
    assertOwnerUserId({ authenticatedUserId: args.userId, ownerUserId: material.userId });
    return material;
};

const assertLessonOwner = async (
    ctx: any,
    args: { lessonId: any; userId: string },
): Promise<any> => {
    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) {
        throw new ConvexError({ code: "NOT_FOUND", message: "Lesson not found." });
    }
    assertOwnerUserId({ authenticatedUserId: args.userId, ownerUserId: lesson.userId });
    return lesson;
};

const starterLessonContent = (title: string, readingLevel: string) => {
    const levelLabel = readingLevel === "beginner"
        ? "short"
        : readingLevel === "confident"
            ? "clear"
            : "friendly";
    return {
        vocabulary: [
            { term: "Main idea", meaning: "What the page is mostly about" },
            { term: "Detail", meaning: "A small fact that helps the idea" },
            { term: "Question", meaning: "Something to answer after reading" },
        ],
        recap: `This ${levelLabel} lesson helps your child read ${title}, learn a few important words, and check what they understood.`,
        questions: [
            {
                prompt: `What should you look for first in ${title}?`,
                options: ["The main idea", "A random word", "The page number"],
                correctOption: "The main idea",
            },
            {
                prompt: "What does a detail do?",
                options: ["Helps explain the idea", "Hides the answer", "Ends the lesson"],
                correctOption: "Helps explain the idea",
            },
        ],
    };
};

export const listProfiles = query({
    args: {},
    handler: async (ctx) => {
        const userId = await requireAuthenticatedUserId(ctx);
        const profiles = await ctx.db
            .query("kidProfiles")
            .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
            .collect();
        return profiles
            .filter((profile: any) => !profile.archivedAt)
            .sort((a: any, b: any) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
    },
});

export const createProfile = mutation({
    args: {
        name: v.string(),
        age: v.number(),
        readingLevel: v.string(),
    },
    handler: async (ctx, args) => {
        const userId = await requireAuthenticatedUserId(ctx);
        const name = cleanName(args.name);
        if (!name) {
            throw new ConvexError({ code: "INVALID_NAME", message: "Enter a child name." });
        }
        const age = Math.floor(Number(args.age));
        if (!Number.isFinite(age) || age < 6 || age > 17) {
            throw new ConvexError({ code: "INVALID_AGE", message: "ChewnPour Kids starts at age 6." });
        }
        const now = Date.now();
        return await ctx.db.insert("kidProfiles", {
            userId,
            name,
            age,
            readingLevel: normalizeReadingLevel(args.readingLevel),
            avatarTone: "accent",
            createdAt: now,
            updatedAt: now,
        });
    },
});

export const createMaterialFromUpload = mutation({
    args: {
        childId: v.id("kidProfiles"),
        uploadId: v.id("uploads"),
        readingLevel: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const userId = await requireAuthenticatedUserId(ctx);
        const child = await assertKidProfileOwner(ctx, { childId: args.childId, userId });
        const upload = await ctx.db.get(args.uploadId);
        if (!upload) {
            throw new ConvexError({ code: "NOT_FOUND", message: "Upload not found." });
        }
        assertOwnerUserId({ authenticatedUserId: userId, ownerUserId: upload.userId });
        const now = Date.now();
        return await ctx.db.insert("kidMaterials", {
            userId,
            childId: child._id,
            uploadId: upload._id,
            title: titleFromFileName(upload.fileName),
            fileName: upload.fileName,
            fileType: upload.fileType,
            fileSize: upload.fileSize,
            status: upload.status === "error" ? "error" : "ready",
            readingLevel: normalizeReadingLevel(args.readingLevel || child.readingLevel),
            visibleToChild: true,
            createdAt: now,
            updatedAt: now,
            errorMessage: upload.status === "error" ? upload.errorMessage : undefined,
        });
    },
});

export const createStarterLesson = mutation({
    args: {
        materialId: v.id("kidMaterials"),
    },
    handler: async (ctx, args) => {
        const userId = await requireAuthenticatedUserId(ctx);
        const material = await assertMaterialOwner(ctx, { materialId: args.materialId, userId });
        await assertKidProfileOwner(ctx, { childId: material.childId, userId });

        const existing = await ctx.db
            .query("kidLessons")
            .withIndex("by_materialId", (q) => q.eq("materialId", material._id))
            .first();
        if (existing) return existing._id;

        const now = Date.now();
        const content = starterLessonContent(material.title, material.readingLevel);
        return await ctx.db.insert("kidLessons", {
            userId,
            childId: material.childId,
            materialId: material._id,
            title: material.title,
            readingLevel: material.readingLevel,
            status: "ready",
            visibleToChild: material.visibleToChild,
            estimatedMinutes: material.readingLevel === "beginner" ? 5 : material.readingLevel === "confident" ? 10 : 8,
            vocabulary: content.vocabulary,
            recap: content.recap,
            questions: content.questions,
            helpRequests: [],
            createdAt: now,
            updatedAt: now,
        });
    },
});

export const listParentLessons = query({
    args: {},
    handler: async (ctx) => {
        const userId = await requireAuthenticatedUserId(ctx);
        return await ctx.db
            .query("kidLessons")
            .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
            .order("desc")
            .collect();
    },
});

export const listChildLessons = query({
    args: {
        childId: v.optional(v.id("kidProfiles")),
    },
    handler: async (ctx, args) => {
        const userId = await requireAuthenticatedUserId(ctx);
        const profiles = await ctx.db
            .query("kidProfiles")
            .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
            .collect();
        const activeProfiles = profiles.filter((profile: any) => !profile.archivedAt);
        const child = args.childId
            ? await assertKidProfileOwner(ctx, { childId: args.childId, userId })
            : activeProfiles[0];
        if (!child) return [];
        const lessons = await ctx.db
            .query("kidLessons")
            .withIndex("by_childId", (q) => q.eq("childId", child._id))
            .collect();
        return lessons
            .filter((lesson: any) => lesson.visibleToChild && lesson.status === "ready")
            .sort((a: any, b: any) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
    },
});

export const getLesson = query({
    args: {
        lessonId: v.id("kidLessons"),
    },
    handler: async (ctx, args) => {
        const userId = await requireAuthenticatedUserId(ctx);
        return await assertLessonOwner(ctx, { lessonId: args.lessonId, userId });
    },
});

export const setLessonVisibility = mutation({
    args: {
        lessonId: v.id("kidLessons"),
        visibleToChild: v.boolean(),
    },
    handler: async (ctx, args) => {
        const userId = await requireAuthenticatedUserId(ctx);
        const lesson = await assertLessonOwner(ctx, { lessonId: args.lessonId, userId });
        await ctx.db.patch(lesson._id, {
            visibleToChild: args.visibleToChild,
            updatedAt: Date.now(),
        });
        return lesson._id;
    },
});

export const recordHelpRequest = mutation({
    args: {
        lessonId: v.id("kidLessons"),
        prompt: v.string(),
    },
    handler: async (ctx, args) => {
        const userId = await requireAuthenticatedUserId(ctx);
        const lesson = await assertLessonOwner(ctx, { lessonId: args.lessonId, userId });
        const prompt = String(args.prompt || "").trim();
        if (!HELP_PROMPTS.has(prompt)) {
            throw new ConvexError({
                code: "UNSUPPORTED_HELP_PROMPT",
                message: "Choose one of the lesson help buttons.",
            });
        }
        const helpRequests = Array.isArray(lesson.helpRequests) ? lesson.helpRequests.slice(-19) : [];
        helpRequests.push({ prompt, requestedAt: Date.now() });
        await ctx.db.patch(lesson._id, {
            helpRequests,
            updatedAt: Date.now(),
        });
        return { prompt };
    },
});
