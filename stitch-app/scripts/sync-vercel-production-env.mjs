#!/usr/bin/env node
/**
 * Upsert production env vars for Supabase cutover.
 * Reads stitch-app/.env.local, overrides public URLs, never prints secret values.
 *
 * Usage (from repo root):
 *   node stitch-app/scripts/sync-vercel-production-env.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, "..");
const repoRoot = resolve(appRoot, "..");
const envPath = resolve(appRoot, ".env.local");
const scope = "stunner100s-projects";
const environment = "production";

const PRODUCTION_URL = "https://www.chewnpour.com";

const OVERRIDES = {
    BETTER_AUTH_URL: PRODUCTION_URL,
    APP_BASE_URL: PRODUCTION_URL,
    FRONTEND_URL: PRODUCTION_URL,
    FRONTEND_URLS: "https://www.chewnpour.com,https://chewnpour.com",
    PAYMENT_PROVIDER: "paystack",
    DATABASE_SSL: "true",
    PG_POOL_MAX: "1",
    SUPABASE_STORAGE_BUCKET: "study-uploads",
    COURSE_AI_ENABLED: "true",
};

const REQUIRED_FROM_FILE = [
    "DATABASE_URL",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_ANON_KEY",
    "BETTER_AUTH_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "PAYSTACK_SECRET_KEY",
];

const OPTIONAL_FROM_FILE = [
    "SUPABASE_PROJECT_REF",
    "PAYSTACK_BASE_URL",
    "PAYSTACK_WEBHOOK_FORWARD_SECRET",
    "PAYSTACK_TIMEOUT_MS",
    "DEEPSEEK_API_KEY",
    "DEEPSEEK_BASE_URL",
    "DEEPSEEK_DOCUMENT_FLASH_MODEL",
    "DEEPSEEK_DOCUMENT_PRO_MODEL",
    "DEEPSEEK_TIMEOUT_MS",
    "INCEPTION_API_KEY",
    "INCEPTION_BASE_URL",
    "INCEPTION_MODEL",
    "INCEPTION_TIMEOUT_MS",
    "STARTER_UPLOAD_CREDITS",
    "UPLOAD_CREDIT_COST",
    "VITE_POSTHOG_KEY",
    "VITE_POSTHOG_HOST",
    "VITE_POSTHOG_UI_HOST",
    "VITE_POSTHOG_DEBUG",
    "DOCLING_ENABLED",
    "DOCLING_EXTRACT_URL",
    "DOCLING_SHARED_SECRET",
    "DOCLING_TIMEOUT_MS",
];

const REMOVE_FROM_PRODUCTION = [
    "VITE_CONVEX_URL",
    "VITE_CONVEX_SITE_URL",
    "CONVEX_URL",
    "CONVEX_SELF_HOSTED_URL",
];

const parseEnvFile = (path) => {
    const map = new Map();
    const text = readFileSync(path, "utf8");
    for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        map.set(key, value);
    }
    return map;
};

const runVercel = (args) => {
    const result = spawnSync("vercel", args, {
        cwd: repoRoot,
        encoding: "utf8",
        env: {
            ...process.env,
            CI: "1",
        },
        timeout: 60_000,
    });
    return {
        status: result.status ?? 1,
        stdout: result.stdout || "",
        stderr: result.stderr || "",
        signal: result.signal,
        error: result.error,
    };
};

const listProductionNames = () => {
    const result = runVercel(["env", "ls", environment, "--scope", scope]);
    if (result.status !== 0) {
        throw new Error(
            `env ls failed: ${(result.stderr || result.stdout).slice(0, 300)}`,
        );
    }
    const names = new Set();
    for (const line of `${result.stdout}\n${result.stderr}`.split("\n")) {
        const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s+/);
        if (match) names.add(match[1]);
    }
    return names;
};

const upsertEnv = (name, value, existingNames) => {
    const args = existingNames.has(name)
        ? [
              "env",
              "update",
              name,
              environment,
              "--scope",
              scope,
              "--yes",
              "--non-interactive",
              "--value",
              value,
          ]
        : [
              "env",
              "add",
              name,
              environment,
              "--scope",
              scope,
              "--yes",
              "--force",
              "--non-interactive",
              "--sensitive",
              "--value",
              value,
          ];

    const result = runVercel(args);
    if (result.status === 0) {
        console.log(
            `[env] ${existingNames.has(name) ? "updated" : "added"} ${name}`,
        );
        existingNames.add(name);
        return true;
    }

    const detail = `${result.stderr}\n${result.stdout}`.trim().slice(0, 400);
    console.error(`[env] FAILED ${name}: ${detail || `exit ${result.status}`}`);
    return false;
};

const removeEnv = (name) => {
    const result = runVercel([
        "env",
        "rm",
        name,
        environment,
        "--scope",
        scope,
        "--yes",
        "--non-interactive",
    ]);
    if (result.status === 0) {
        console.log(`[env] removed ${name}`);
        return;
    }
    const combined = `${result.stderr}\n${result.stdout}`;
    if (/not found|does not exist|No Environment Variable/i.test(combined)) {
        console.log(`[env] skip remove ${name} (absent)`);
        return;
    }
    console.warn(`[env] could not remove ${name}`);
};

if (!existsSync(envPath)) {
    console.error(`[env] missing ${envPath}`);
    process.exit(1);
}

const local = parseEnvFile(envPath);
const desired = new Map();

for (const [key, value] of Object.entries(OVERRIDES)) {
    desired.set(key, value);
}

for (const key of REQUIRED_FROM_FILE) {
    const value = local.get(key);
    if (!value) {
        console.error(`[env] missing required local key: ${key}`);
        process.exit(1);
    }
    desired.set(key, value);
}

for (const key of OPTIONAL_FROM_FILE) {
    const value = local.get(key);
    if (value) desired.set(key, value);
}

const existingNames = listProductionNames();
console.log(`[env] production currently has ${existingNames.size} vars`);

let failed = 0;
for (const [name, value] of desired) {
    if (!upsertEnv(name, value, existingNames)) failed += 1;
}

for (const name of REMOVE_FROM_PRODUCTION) {
    removeEnv(name);
}

if (failed) {
    console.error(`[env] completed with ${failed} failures`);
    process.exit(1);
}

console.log("[env] production env sync complete");
