import { createAuthClient } from "better-auth/react";

// Same-origin Better Auth on Vercel `/api/auth/*` (proxied locally via Vite).
export const authBaseUrl =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";

export const authClient = createAuthClient({
    baseURL: authBaseUrl,
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
