const envConvexUrl = (import.meta.env.VITE_CONVEX_URL || "").trim();

// Keep preview deploys functional even when Vercel build env vars are absent.
export const FALLBACK_CONVEX_URL = "https://whimsical-pelican-356.convex.cloud";
export const convexUrl = envConvexUrl || FALLBACK_CONVEX_URL;
export const hasConvexUrl = convexUrl.length > 0;
export const convexSiteUrl = hasConvexUrl
    ? convexUrl.replace(".convex.cloud", ".convex.site")
    : "";
