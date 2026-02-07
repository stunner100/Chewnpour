import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";

const isProd = process.env.NODE_ENV === "production";

export const devDeleteUserByEmail = mutation({
    args: { email: v.string() },
    handler: async (ctx, args) => {
        if (isProd) {
            throw new Error("devDeleteUserByEmail is disabled in production.");
        }

        const email = args.email.trim().toLowerCase();
        const adapterFactory = authComponent.adapter(ctx);
        const adapter = await adapterFactory();

        const user = await adapter.findOne({
            model: "user",
            where: [{ field: "email", value: email }],
        });

        if (!user) {
            return { deleted: false, reason: "not_found" as const };
        }

        await adapter.deleteMany({
            model: "account",
            where: [{ field: "userId", value: user.id }],
        });
        await adapter.deleteMany({
            model: "session",
            where: [{ field: "userId", value: user.id }],
        });
        await adapter.deleteMany({
            model: "user",
            where: [{ field: "id", value: user.id }],
        });

        const profile = await ctx.db
            .query("profiles")
            .withIndex("by_userId", (q) => q.eq("userId", user.id))
            .unique();
        if (profile) {
            await ctx.db.delete(profile._id);
        }

        return { deleted: true, userId: user.id };
    },
});
