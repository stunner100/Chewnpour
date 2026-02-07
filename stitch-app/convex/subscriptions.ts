import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get user's subscription
export const getSubscription = query({
    args: { userId: v.optional(v.string()) },
    handler: async (ctx, args) => {
        if (!args.userId) return null;

        const subscription = await ctx.db
            .query("subscriptions")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .first();

        // Return default free plan if no subscription exists
        if (!subscription) {
            return {
                plan: "free",
                status: "active",
                amount: 0,
                currency: "USD",
                nextBillingDate: null,
            };
        }

        return subscription;
    },
});

// Create or update subscription
export const upsertSubscription = mutation({
    args: {
        userId: v.string(),
        plan: v.string(),
        amount: v.optional(v.number()),
        currency: v.optional(v.string()),
        status: v.string(),
        nextBillingDate: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("subscriptions")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .first();

        if (existing) {
            await ctx.db.patch(existing._id, {
                plan: args.plan,
                amount: args.amount,
                currency: args.currency,
                status: args.status,
                nextBillingDate: args.nextBillingDate,
            });
            return existing._id;
        } else {
            return await ctx.db.insert("subscriptions", {
                userId: args.userId,
                plan: args.plan,
                amount: args.amount,
                currency: args.currency,
                status: args.status,
                nextBillingDate: args.nextBillingDate,
            });
        }
    },
});

// Upgrade to premium
export const upgradeToPremium = mutation({
    args: {
        userId: v.string(),
        amount: v.number(),
        currency: v.string(),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("subscriptions")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .first();

        // Calculate next billing date (30 days from now)
        const nextBilling = new Date();
        nextBilling.setDate(nextBilling.getDate() + 30);
        const nextBillingDate = nextBilling.toISOString();

        const data = {
            plan: "premium",
            status: "active",
            amount: args.amount,
            currency: args.currency,
            nextBillingDate,
        };

        if (existing) {
            await ctx.db.patch(existing._id, data);
            return existing._id;
        } else {
            return await ctx.db.insert("subscriptions", {
                userId: args.userId,
                ...data,
            });
        }
    },
});

// Cancel subscription
export const cancelSubscription = mutation({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        const subscription = await ctx.db
            .query("subscriptions")
            .withIndex("by_userId", (q) => q.eq("userId", args.userId))
            .first();

        if (subscription) {
            await ctx.db.patch(subscription._id, {
                status: "cancelled",
                plan: "free",
            });
        }
    },
});
