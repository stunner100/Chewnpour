import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { resolveAuthUserId } from "./lib/examSecurity";

const SEARCH_KINDS = ["course", "topic", "note"] as const;
type SearchKind = typeof SEARCH_KINDS[number];

const clampSearchLimit = (value: unknown, fallback = 8) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(1, Math.min(20, Math.floor(parsed)));
};

const clampBackfillLimit = (value: unknown, fallback = 200) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(1, Math.min(500, Math.floor(parsed)));
};

const normalizeBody = (value: unknown) =>
    String(value || "")
        .replace(/\u0000/g, "")
        .replace(/\s+/g, " ")
        .trim();

const buildSnippet = (args: { title: string; body: string; query: string }) => {
    const normalizedBody = normalizeBody(args.body);
    const normalizedTitle = normalizeBody(args.title);
    const haystack = `${normalizedTitle} ${normalizedBody}`.trim();
    if (!haystack) return "";

    const terms = Array.from(
        new Set(
            String(args.query || "")
                .toLowerCase()
                .split(/[^a-z0-9]+/)
                .map((token) => token.trim())
                .filter((token) => token.length >= 2)
        )
    );
    if (terms.length === 0) {
        return haystack.slice(0, 180);
    }

    const lowerHaystack = haystack.toLowerCase();
    let matchIndex = -1;
    for (const term of terms) {
        const index = lowerHaystack.indexOf(term);
        if (index >= 0 && (matchIndex < 0 || index < matchIndex)) {
            matchIndex = index;
        }
    }

    if (matchIndex < 0) {
        return haystack.slice(0, 180);
    }

    const start = Math.max(0, matchIndex - 60);
    const end = Math.min(haystack.length, matchIndex + 120);
    const prefix = start > 0 ? "..." : "";
    const suffix = end < haystack.length ? "..." : "";
    return `${prefix}${haystack.slice(start, end).trim()}${suffix}`;
};

const buildSearchDocumentBody = (args: {
    kind: SearchKind;
    title: string;
    subtitle?: string;
    content?: string;
}) =>
    [
        args.title,
        args.subtitle || "",
        normalizeBody(args.content || "").slice(0, args.kind === "note" ? 6_000 : 4_000),
    ]
        .filter(Boolean)
        .join("\n\n");

const buildSearchResultPath = (doc: any) => {
    if (doc?.kind === "course" && doc?.courseId) {
        return `/dashboard/course/${doc.courseId}`;
    }
    if (doc?.topicId) {
        return `/dashboard/topic/${doc.topicId}`;
    }
    if (doc?.courseId) {
        return `/dashboard/course/${doc.courseId}`;
    }
    return "/dashboard";
};

export const getCourseSearchSnapshot = internalQuery({
    args: {
        courseId: v.id("courses"),
    },
    handler: async (ctx, args) => {
        const course = await ctx.db.get(args.courseId);
        if (!course) return null;
        return {
            kind: "course" as const,
            entityId: String(course._id),
            userId: course.userId,
            courseId: course._id,
            title: String(course.title || ""),
            subtitle: String(course.description || ""),
            content: String(course.description || ""),
            updatedAt: Number(course._creationTime || Date.now()),
        };
    },
});

export const getTopicSearchSnapshot = internalQuery({
    args: {
        topicId: v.id("topics"),
    },
    handler: async (ctx, args) => {
        const topic = await ctx.db.get(args.topicId);
        if (!topic) return null;
        const course = await ctx.db.get(topic.courseId);
        if (!course) return null;
        return {
            kind: "topic" as const,
            entityId: String(topic._id),
            userId: course.userId,
            courseId: topic.courseId,
            topicId: topic._id,
            title: String(topic.title || ""),
            subtitle: String(topic.description || ""),
            content: String(topic.content || ""),
            updatedAt: Number(topic.examReadyUpdatedAt || topic._creationTime || Date.now()),
        };
    },
});

export const getNoteSearchSnapshot = internalQuery({
    args: {
        noteId: v.id("topicNotes"),
    },
    handler: async (ctx, args) => {
        const note = await ctx.db.get(args.noteId);
        if (!note) return null;
        const topic = await ctx.db.get(note.topicId);
        if (!topic) return null;
        const course = await ctx.db.get(topic.courseId);
        if (!course) return null;
        return {
            kind: "note" as const,
            entityId: String(note._id),
            userId: note.userId,
            courseId: topic.courseId,
            topicId: topic._id,
            title: `Your note on ${String(topic.title || "Untitled topic")}`,
            subtitle: String(topic.title || ""),
            content: String(note.content || ""),
            updatedAt: Number(note.updatedAt || note._creationTime || Date.now()),
        };
    },
});

export const listCoursesForSearchBackfill = internalQuery({
    args: {
        paginationOpts: paginationOptsValidator,
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("courses")
            .order("desc")
            .paginate(args.paginationOpts);
    },
});

export const listTopicsForSearchBackfill = internalQuery({
    args: {
        paginationOpts: paginationOptsValidator,
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("topics")
            .order("desc")
            .paginate(args.paginationOpts);
    },
});

export const listNotesForSearchBackfill = internalQuery({
    args: {
        paginationOpts: paginationOptsValidator,
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("topicNotes")
            .order("desc")
            .paginate(args.paginationOpts);
    },
});

export const replaceSearchDocumentInternal = internalMutation({
    args: {
        userId: v.string(),
        kind: v.string(),
        entityId: v.string(),
        courseId: v.optional(v.id("courses")),
        topicId: v.optional(v.id("topics")),
        title: v.string(),
        body: v.string(),
        updatedAt: v.number(),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("searchDocuments")
            .withIndex("by_userId_kind_entityId", (q) =>
                q.eq("userId", args.userId).eq("kind", args.kind).eq("entityId", args.entityId)
            )
            .first();

        const payload = {
            userId: args.userId,
            kind: args.kind,
            entityId: args.entityId,
            courseId: args.courseId,
            topicId: args.topicId,
            title: args.title,
            body: args.body,
            updatedAt: args.updatedAt,
        };

        if (existing) {
            await ctx.db.patch(existing._id, payload);
            return existing._id;
        }
        return await ctx.db.insert("searchDocuments", payload);
    },
});

export const deleteSearchDocumentInternal = internalMutation({
    args: {
        userId: v.string(),
        kind: v.string(),
        entityId: v.string(),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("searchDocuments")
            .withIndex("by_userId_kind_entityId", (q) =>
                q.eq("userId", args.userId).eq("kind", args.kind).eq("entityId", args.entityId)
            )
            .first();
        if (existing) {
            await ctx.db.delete(existing._id);
            return { deleted: true };
        }
        return { deleted: false };
    },
});

export const upsertSearchDocumentsForEntity = internalAction({
    args: {
        kind: v.string(),
        entityId: v.string(),
    },
    handler: async (ctx, args) => {
        const kind = String(args.kind || "").trim() as SearchKind;
        if (!SEARCH_KINDS.includes(kind)) {
            throw new Error(`Unsupported search document kind: ${kind}`);
        }

        let snapshot: any = null;
        if (kind === "course") {
            snapshot = await ctx.runQuery((internal as any).search.getCourseSearchSnapshot, {
                courseId: args.entityId as any,
            });
        } else if (kind === "topic") {
            snapshot = await ctx.runQuery((internal as any).search.getTopicSearchSnapshot, {
                topicId: args.entityId as any,
            });
        } else if (kind === "note") {
            snapshot = await ctx.runQuery((internal as any).search.getNoteSearchSnapshot, {
                noteId: args.entityId as any,
            });
        }

        if (!snapshot?.userId || !snapshot?.entityId) {
            return {
                kind,
                entityId: args.entityId,
                skipped: true,
                reason: "snapshot_missing",
            };
        }

        const body = buildSearchDocumentBody({
            kind,
            title: snapshot.title,
            subtitle: snapshot.subtitle,
            content: snapshot.content,
        });

        if (!body.trim()) {
            await ctx.runMutation((internal as any).search.deleteSearchDocumentInternal, {
                userId: snapshot.userId,
                kind,
                entityId: snapshot.entityId,
            });
            return {
                kind,
                entityId: snapshot.entityId,
                skipped: true,
                reason: "empty_body",
            };
        }

        const docId = await ctx.runMutation((internal as any).search.replaceSearchDocumentInternal, {
            userId: snapshot.userId,
            kind,
            entityId: snapshot.entityId,
            courseId: snapshot.courseId,
            topicId: snapshot.topicId,
            title: snapshot.title,
            body,
            updatedAt: Number(snapshot.updatedAt || Date.now()),
        });

        return {
            kind,
            entityId: snapshot.entityId,
            skipped: false,
            docId,
        };
    },
});

export const deleteSearchDocumentsForEntity = internalAction({
    args: {
        kind: v.string(),
        entityId: v.string(),
        userId: v.string(),
    },
    handler: async (ctx, args) => {
        return await ctx.runMutation((internal as any).search.deleteSearchDocumentInternal, {
            userId: args.userId,
            kind: args.kind,
            entityId: args.entityId,
        });
    },
});

export const backfillSearchDocuments = internalAction({
    args: {
        kind: v.optional(v.string()),
        cursor: v.optional(v.string()),
        batchSize: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const requestedKinds = String(args.kind || "").trim();
        const batchSize = clampBackfillLimit(args.batchSize, 200);
        if (!requestedKinds) {
            for (const kind of SEARCH_KINDS) {
                await ctx.scheduler.runAfter(0, (internal as any).search.backfillSearchDocuments, {
                    kind,
                    batchSize,
                });
            }
            return {
                kinds: [...SEARCH_KINDS],
                batchSize,
                scheduledCount: SEARCH_KINDS.length,
                scheduled: SEARCH_KINDS.map((kind) => ({ kind, entityId: "" })),
                delegatedByKind: true,
            };
        }

        const kinds = [requestedKinds].filter((kind): kind is SearchKind => SEARCH_KINDS.includes(kind as SearchKind));
        const kind = kinds[0];
        if (!kind) {
            return {
                kinds: [],
                batchSize,
                scheduledCount: 0,
                scheduled: [],
                delegatedByKind: false,
            };
        }

        const paginationOpts = {
            cursor: args.cursor ?? null,
            numItems: batchSize,
        };
        const pageResult = kind === "course"
            ? await ctx.runQuery((internal as any).search.listCoursesForSearchBackfill, { paginationOpts })
            : kind === "topic"
                ? await ctx.runQuery((internal as any).search.listTopicsForSearchBackfill, { paginationOpts })
                : await ctx.runQuery((internal as any).search.listNotesForSearchBackfill, { paginationOpts });

        const scheduled: Array<{ kind: SearchKind; entityId: string }> = [];
        for (const row of Array.isArray(pageResult?.page) ? pageResult.page : []) {
            const entityId = String(row?._id || "").trim();
            if (!entityId) continue;
            await ctx.scheduler.runAfter(0, (internal as any).search.upsertSearchDocumentsForEntity, {
                kind,
                entityId,
            });
            scheduled.push({ kind, entityId });
        }

        if (!pageResult?.isDone && pageResult?.continueCursor) {
            await ctx.scheduler.runAfter(0, (internal as any).search.backfillSearchDocuments, {
                kind,
                batchSize,
                cursor: pageResult.continueCursor,
            });
        }

        return {
            kinds: [kind],
            batchSize,
            scheduledCount: scheduled.length,
            scheduled,
            continueCursor: pageResult?.continueCursor || null,
            isDone: Boolean(pageResult?.isDone),
            delegatedByKind: false,
        };
    },
});

export const searchDashboardContent = query({
    args: {
        query: v.string(),
        limit: v.optional(v.number()),
        kinds: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        const userId = resolveAuthUserId(identity);
        if (!userId) {
            return {
                totalCount: 0,
                searchLatencyMs: 0,
                zeroResults: true,
                courses: [],
                topics: [],
                notes: [],
            };
        }

        const startedAt = Date.now();
        const queryText = normalizeBody(args.query);
        if (!queryText) {
            return {
                totalCount: 0,
                searchLatencyMs: Date.now() - startedAt,
                zeroResults: true,
                courses: [],
                topics: [],
                notes: [],
            };
        }

        const requestedKinds = Array.isArray(args.kinds)
            ? args.kinds.map((kind) => String(kind || "").trim()).filter((kind): kind is SearchKind => SEARCH_KINDS.includes(kind as SearchKind))
            : [];
        const kinds = requestedKinds.length > 0 ? requestedKinds : [...SEARCH_KINDS];
        const limit = clampSearchLimit(args.limit, 8);

        const groupedResults: Record<SearchKind, any[]> = {
            course: [],
            topic: [],
            note: [],
        };

        for (const kind of kinds) {
            const docs = await ctx.db
                .query("searchDocuments")
                .withSearchIndex("search_body", (q) =>
                    q.search("body", queryText).eq("userId", userId).eq("kind", kind)
                )
                .take(limit);

            groupedResults[kind] = docs.map((doc: any) => ({
                kind,
                entityId: doc.entityId,
                courseId: doc.courseId,
                topicId: doc.topicId,
                title: String(doc.title || ""),
                snippet: buildSnippet({
                    title: String(doc.title || ""),
                    body: String(doc.body || ""),
                    query: queryText,
                }),
                updatedAt: Number(doc.updatedAt || 0),
                path: buildSearchResultPath(doc),
            }));
        }

        const totalCount = kinds.reduce(
            (sum, kind) => sum + (Array.isArray(groupedResults[kind]) ? groupedResults[kind].length : 0),
            0
        );
        const searchLatencyMs = Date.now() - startedAt;
        console.info("[Search] dashboard_search_completed", {
            userId,
            queryLength: queryText.length,
            kinds,
            totalCount,
            searchZeroResults: totalCount === 0,
            searchLatencyMs,
        });

        return {
            totalCount,
            searchLatencyMs,
            zeroResults: totalCount === 0,
            courses: groupedResults.course,
            topics: groupedResults.topic,
            notes: groupedResults.note,
        };
    },
});
