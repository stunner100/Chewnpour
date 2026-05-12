import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

const resolveAuthUserId = (identity: any) => {
    if (!identity || typeof identity !== "object") return "";
    const candidates = [
        identity.subject,
        identity.userId,
        identity.id,
        identity.tokenIdentifier,
    ];
    for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.trim()) {
            return candidate.trim();
        }
    }
    return "";
};

const requireAuthorizedUser = async (ctx: any, userId: string) => {
    const identity = await ctx.auth.getUserIdentity();
    const authUserId = resolveAuthUserId(identity);
    if (!authUserId) {
        throw new ConvexError({
            code: "UNAUTHENTICATED",
            message: "You must be signed in to upload library materials.",
        });
    }
    if (authUserId !== userId) {
        throw new ConvexError({
            code: "UNAUTHORIZED",
            message: "You do not have permission to upload for this user.",
        });
    }
};

export const generateMaterialUploadUrl = mutation({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        const authUserId = resolveAuthUserId(identity);
        if (!authUserId) {
            throw new ConvexError({
                code: "UNAUTHENTICATED",
                message: "You must be signed in to upload library materials.",
            });
        }
        return await ctx.storage.generateUploadUrl();
    },
});

export const createMaterial = mutation({
    args: {
        userId: v.string(),
        title: v.string(),
        description: v.optional(v.string()),
        fileName: v.string(),
        fileType: v.optional(v.string()),
        fileSize: v.optional(v.number()),
        storageId: v.id("_storage"),
    },
    handler: async (ctx, args) => {
        try {
            await requireAuthorizedUser(ctx, args.userId);
        } catch (error) {
            await ctx.storage.delete(args.storageId).catch(() => undefined);
            throw error;
        }

        const title = args.title.trim();
        if (!title) {
            await ctx.storage.delete(args.storageId).catch(() => undefined);
            throw new ConvexError({
                code: "INVALID_LIBRARY_MATERIAL",
                message: "Library materials need a title.",
            });
        }

        const now = Date.now();
        return await ctx.db.insert("libraryMaterials", {
            uploadedBy: args.userId,
            title: title.slice(0, 160),
            description: args.description?.trim().slice(0, 500) || undefined,
            fileName: args.fileName.trim().slice(0, 220),
            fileType: args.fileType,
            fileSize: args.fileSize,
            storageId: args.storageId,
            createdAt: now,
            updatedAt: now,
            isHidden: false,
        });
    },
});

export const listMaterials = query({
    args: {
        query: v.optional(v.string()),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const limit = Math.min(Math.max(Number(args.limit || 40), 1), 80);
        const normalizedQuery = String(args.query || "").trim().toLowerCase();
        const rows = await ctx.db
            .query("libraryMaterials")
            .withIndex("by_createdAt")
            .order("desc")
            .collect();

        const visibleRows = rows.filter((row) => !row.isHidden);
        const filteredRows = normalizedQuery
            ? visibleRows.filter((row) => {
                const haystack = [
                    row.title,
                    row.description || "",
                    row.fileName,
                    row.fileType || "",
                ].join(" ").toLowerCase();
                return haystack.includes(normalizedQuery);
            })
            : visibleRows;

        return await Promise.all(
            filteredRows.slice(0, limit).map(async (row) => {
                const profile = await ctx.db
                    .query("profiles")
                    .withIndex("by_userId", (q) => q.eq("userId", row.uploadedBy))
                    .first();
                const fileUrl = await ctx.storage.getUrl(row.storageId);
                return {
                    ...row,
                    fileUrl,
                    uploaderName: profile?.fullName || "ChewnPour student",
                };
            })
        );
    },
});
