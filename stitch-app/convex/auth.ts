import { createClient } from "@convex-dev/better-auth";
import { components } from "./_generated/api";
import schema from "./schema";

// Create the Better Auth component client
export const authComponent = createClient(components.betterAuth, {
    local: {
        schema,
    },
    verbose: true,
});

// Export client API functions
export const { getAuthUser } = authComponent.clientApi();
