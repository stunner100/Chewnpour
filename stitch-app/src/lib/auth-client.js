import { createAuthClient } from "better-auth/react";
import { crossDomainClient } from "@convex-dev/better-auth/client/plugins";
import { hasConvexUrl, convexSiteUrl } from "./convex-config";

// Better Auth needs the Convex site URL (where HTTP actions are served)
// The site URL is derived from the deployment URL by replacing .convex.cloud with .convex.site
const siteUrl = hasConvexUrl
    ? convexSiteUrl
    : (typeof window !== "undefined" ? window.location.origin : "http://localhost");

export const authClient = createAuthClient({
    baseURL: siteUrl,
    plugins: hasConvexUrl ? [crossDomainClient()] : [],
});

export const {
    signIn,
    signUp,
    signOut,
    useSession,
    getSession,
    requestPasswordReset,
    resetPassword,
} = authClient;
