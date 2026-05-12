const envConvexUrl = (import.meta.env.VITE_CONVEX_URL || "").trim();
const envConvexSiteUrl = (import.meta.env.VITE_CONVEX_SITE_URL || "").trim();

// Frontend Convex calls must target the deployment configured at build time.
// Do not silently fall back to a hardcoded deployment URL.
export const convexUrl = envConvexUrl;
export const hasConvexUrl = convexUrl.length > 0;
// Self-hosted Convex uses the configured runtime URL unless a separate site URL is set.
export const convexSiteUrl = hasConvexUrl
    ? envConvexSiteUrl || convexUrl
    : "";
