const envConvexUrl = (import.meta.env.VITE_CONVEX_URL || "").trim();

// Frontend Convex calls must target the deployment configured at build time.
// Do not silently fall back to a hardcoded deployment URL.
export const convexUrl = envConvexUrl;
export const hasConvexUrl = convexUrl.length > 0;
export const convexSiteUrl = hasConvexUrl
    ? convexUrl.replace(".convex.cloud", ".convex.site")
    : "";
