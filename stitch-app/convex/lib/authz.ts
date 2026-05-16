import { ConvexError } from "convex/values";
import { collectAuthUserIdCandidates, resolveAuthUserId } from "./examSecurity";

export const getAuthenticatedUserIdOrNull = async (ctx: any): Promise<string | null> => {
    const identity = await ctx.auth.getUserIdentity().catch(() => null);
    const userId = resolveAuthUserId(identity);
    return userId || null;
};

export const requireAuthenticatedUserId = async (ctx: any): Promise<string> => {
    const userId = await getAuthenticatedUserIdOrNull(ctx);
    if (!userId) {
        throw new ConvexError({
            code: "UNAUTHENTICATED",
            message: "You must be signed in.",
        });
    }
    return userId;
};

export const getAuthenticatedUserIdCandidates = async (ctx: any): Promise<string[]> => {
    const identity = await ctx.auth.getUserIdentity().catch(() => null);
    return collectAuthUserIdCandidates(identity);
};

export const assertOwnerUserId = (args: {
    authenticatedUserId: string;
    authenticatedUserIds?: string[];
    ownerUserId?: string | null;
    message?: string;
}) => {
    const ownerUserId = String(args.ownerUserId || "").trim();
    const authenticatedUserIds = Array.from(
        new Set(
            [
                args.authenticatedUserId,
                ...(Array.isArray(args.authenticatedUserIds) ? args.authenticatedUserIds : []),
            ]
                .map((candidate) => String(candidate || "").trim())
                .filter(Boolean)
        )
    );
    if (!ownerUserId || !authenticatedUserIds.includes(ownerUserId)) {
        throw new ConvexError({
            code: "UNAUTHORIZED",
            message: args.message || "You do not have permission to access this resource.",
        });
    }
};
