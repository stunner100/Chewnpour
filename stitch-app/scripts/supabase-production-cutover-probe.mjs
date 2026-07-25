#!/usr/bin/env node
/**
 * Post-deploy probe for Supabase cutover on production.
 * Usage:
 *   node scripts/supabase-production-cutover-probe.mjs
 *   BASE_URL=https://www.chewnpour.com node scripts/supabase-production-cutover-probe.mjs
 */

const BASE_URL = String(process.env.BASE_URL || "https://www.chewnpour.com").replace(
    /\/$/,
    "",
);

const failures = [];

const check = async (label, fn) => {
    try {
        await fn();
        console.log(`[ok] ${label}`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${label}: ${message}`);
        console.error(`[fail] ${label}: ${message}`);
    }
};

const fetchText = async (path, init = {}) => {
    const response = await fetch(`${BASE_URL}${path}`, {
        redirect: "manual",
        ...init,
        headers: {
            accept: "application/json, text/html, */*",
            ...(init.headers || {}),
        },
    });
    const text = await response.text();
    return { response, text };
};

await check("homepage 200", async () => {
    const { response, text } = await fetchText("/");
    if (response.status !== 200) {
        throw new Error(`status ${response.status}`);
    }
    if (!text.includes("/assets/")) {
        throw new Error("missing asset bundle reference");
    }
});

await check("JS bundles are Convex-free", async () => {
    const { text: html } = await fetchText("/");
    const assets = Array.from(
        html.matchAll(/\/assets\/[^"']+\.js/g),
        (match) => match[0],
    );
    if (assets.length === 0) throw new Error("no JS assets found");

    let sawBetterAuth = false;
    for (const asset of assets.slice(0, 8)) {
        const { text: js } = await fetchText(asset);
        for (const needle of ["api.chewnpour.com", "site.chewnpour.com"]) {
            if (js.includes(needle)) {
                throw new Error(`${asset} still references ${needle}`);
            }
        }
        if (
            js.includes("/api/auth") ||
            js.includes("api/auth") ||
            js.includes("better-auth")
        ) {
            sawBetterAuth = true;
        }
    }
    if (!sawBetterAuth) {
        throw new Error("no Better Auth markers found in initial JS assets");
    }
});

await check("/api/auth/get-session responds", async () => {
    const { response, text } = await fetchText("/api/auth/get-session");
    if (response.status === 404) {
        throw new Error("NOT_FOUND — Better Auth API not deployed");
    }
    if (![200, 401, 204].includes(response.status)) {
        throw new Error(`unexpected status ${response.status}: ${text.slice(0, 120)}`);
    }
});

await check("/api/billing requires auth (not 404)", async () => {
    const { response } = await fetchText("/api/billing");
    if (response.status === 404) {
        throw new Error("billing API missing");
    }
    if (![200, 401, 403].includes(response.status)) {
        throw new Error(`unexpected status ${response.status}`);
    }
});

await check("Convex backends stay down (expected for cutover)", async () => {
    const controllers = [];
    for (const host of ["https://api.chewnpour.com", "https://site.chewnpour.com"]) {
        const controller = new AbortController();
        controllers.push(controller);
        const timer = setTimeout(() => controller.abort(), 4000);
        try {
            await fetch(host, { signal: controller.signal });
            console.warn(
                `[warn] ${host} responded — production login must not depend on it`,
            );
        } catch {
            // timeout / connection failure expected
        } finally {
            clearTimeout(timer);
        }
    }
});

console.log("");
if (failures.length) {
    console.error(`[cutover-probe] FAILED (${failures.length}) against ${BASE_URL}`);
    for (const failure of failures) console.error(` - ${failure}`);
    process.exit(1);
}

console.log(`[cutover-probe] passed against ${BASE_URL}`);
