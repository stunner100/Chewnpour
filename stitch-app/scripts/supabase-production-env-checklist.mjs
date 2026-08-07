#!/usr/bin/env node
/**
 * Prints the production env checklist for the Convex → Supabase hard cutover.
 * Does not read or print secret values — names and expected shapes only.
 *
 * Usage:
 *   node scripts/supabase-production-env-checklist.mjs
 *   node scripts/supabase-production-env-checklist.mjs --check-file .env.local
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const REQUIRED = [
    {
        name: "DATABASE_URL",
        note: "Supabase pooler URI, transaction mode (port 6543) for Vercel",
    },
    { name: "DATABASE_SSL", note: "true (unless local)" },
    { name: "SUPABASE_URL", note: "https://bpfmueufwjwgkwjmxflk.supabase.co" },
    { name: "SUPABASE_SERVICE_ROLE_KEY", note: "server-only; Storage signed uploads" },
    { name: "SUPABASE_ANON_KEY", note: "optional for server; keep if used" },
    { name: "SUPABASE_STORAGE_BUCKET", note: "study-uploads" },
    { name: "BETTER_AUTH_SECRET", note: "long random secret" },
    {
        name: "BETTER_AUTH_URL",
        note: "https://www.chewnpour.com (same-origin /api/auth)",
    },
    { name: "APP_BASE_URL", note: "https://www.chewnpour.com" },
    { name: "FRONTEND_URL", note: "https://www.chewnpour.com" },
    {
        name: "GOOGLE_CLIENT_ID",
        note: "Google Cloud OAuth client",
    },
    { name: "GOOGLE_CLIENT_SECRET", note: "Google Cloud OAuth secret" },
    { name: "PAYSTACK_SECRET_KEY", note: "live key for production top-ups" },
    { name: "PAYMENT_PROVIDER", note: "paystack" },
];

const RECOMMENDED = [
    { name: "DEEPSEEK_API_KEY", note: "curriculum / explain / tutor" },
    { name: "INCEPTION_API_KEY", note: "fallback LLM" },
    { name: "COURSE_AI_ENABLED", note: "true" },
    { name: "STARTER_UPLOAD_CREDITS", note: "3" },
    { name: "UPLOAD_CREDIT_COST", note: "1" },
    { name: "PG_POOL_MAX", note: "1 on Vercel serverless" },
    { name: "FRONTEND_URLS", note: "https://chewnpour.com,https://www.chewnpour.com" },
    { name: "VITE_POSTHOG_KEY", note: "build-time analytics" },
    { name: "VITE_POSTHOG_HOST", note: "/ingest" },
];

const MUST_NOT_SET_FOR_CUTOVER = [
    "VITE_CONVEX_URL",
    "VITE_CONVEX_SITE_URL",
    "CONVEX_SELF_HOSTED_URL",
    "CONVEX_URL",
    "CONVEX_DEPLOY_KEY",
];

const GOOGLE_CALLBACK =
    "https://www.chewnpour.com/api/auth/callback/google";

const checkFileArg = process.argv.indexOf("--check-file");
const filePath =
    checkFileArg >= 0 ? resolve(process.argv[checkFileArg + 1] || "") : null;

const presentKeys = new Set();
if (filePath) {
    if (!existsSync(filePath)) {
        console.error(`[env-checklist] file not found: ${filePath}`);
        process.exit(1);
    }
    const text = readFileSync(filePath, "utf8");
    for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        const value = trimmed.slice(eq + 1).trim();
        if (value) presentKeys.add(key);
    }
}

const printSection = (title, items, mode) => {
    console.log(`\n## ${title}`);
    for (const item of items) {
        let mark = "-";
        if (filePath) {
            const has = presentKeys.has(item.name);
            if (mode === "required") mark = has ? "OK" : "MISSING";
            else if (mode === "forbidden") mark = has ? "REMOVE" : "ok";
            else mark = has ? "set" : "unset";
        }
        console.log(`[${mark}] ${item.name} — ${item.note}`);
    }
};

console.log("# ChewnPour production env checklist (Supabase cutover)");
console.log("Target: https://www.chewnpour.com");
console.log(`Google OAuth redirect URI to allow: ${GOOGLE_CALLBACK}`);
console.log(
    "Hard cutover: do not point the Vite build at api.chewnpour.com / site.chewnpour.com.",
);

printSection("Required (Vercel Production)", REQUIRED, "required");
printSection("Recommended", RECOMMENDED, "recommended");
printSection(
    "Must NOT ship on production cutover build",
    MUST_NOT_SET_FOR_CUTOVER.map((name) => ({
        name,
        note: "Convex-era; leave unset for Vite production build",
    })),
    "forbidden",
);

if (filePath) {
    const missing = REQUIRED.filter((item) => !presentKeys.has(item.name));
    const forbidden = MUST_NOT_SET_FOR_CUTOVER.filter((name) =>
        presentKeys.has(name),
    );
    console.log("\n## Summary");
    if (missing.length === 0 && forbidden.length === 0) {
        console.log("[env-checklist] local file has required keys (values not validated).");
        process.exit(0);
    }
    if (missing.length) {
        console.log(
            `[env-checklist] missing required: ${missing.map((m) => m.name).join(", ")}`,
        );
    }
    if (forbidden.length) {
        console.log(
            `[env-checklist] Convex-era keys present (ok for local; strip from Vercel Production Vite build): ${forbidden.join(", ")}`,
        );
    }
    process.exit(missing.length ? 1 : 0);
}
