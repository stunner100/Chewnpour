#!/usr/bin/env node
// Aggregated runner for stitch-app's standalone *.test.mjs regression scripts.
//
// The repo has no single "npm test" entrypoint: every regression check is a
// self-contained script under scripts/. This runner discovers them all, runs
// each one in its own child process (so a test calling process.exit() cannot
// kill the runner), reports pass/fail/skip, and exits non-zero if any test
// fails.
//
// Skipped by default:
//   * smoke / benchmark / probe tests and anything issuing a real network call
//     (they need live services, latency harnesses, or seeded accounts)
//   * tests that reference the Convex backend when no convex/ checkout exists
//
// Options:
//   --include-live          run live-service tests (or RUN_LIVE=1)
//   --include-all           run everything, including convex-dependent tests
//   <filter>...             only run tests whose path contains a filter string
//   --json <path>           also write machine-readable results to <path>

import {
    existsSync,
    readdirSync,
    readFileSync,
    statSync,
    writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(scriptDir, "..");

const rawArgs = process.argv.slice(2);
const filters = [];
const flags = new Set();
let jsonPath = null;

for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === "--json") {
        jsonPath = rawArgs[index + 1] || path.join(scriptDir, "test-results.json");
        index += 1;
    } else if (arg.startsWith("--")) {
        flags.add(arg);
    } else {
        filters.push(arg);
    }
}

if (flags.has("--help") || flags.has("-h")) {
    console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(0, 22).join("\n"));
    process.exit(0);
}

const envFlag = (name) => /^(1|true|yes|on)$/i.test(String(process.env[name] || ""));
const includeLive = flags.has("--include-live") || envFlag("RUN_LIVE");
const includeAll = flags.has("--include-all") || envFlag("RUN_ALL");

const TIMEOUT_MS = 120_000;

// Filename patterns for tests that need live services or external harnesses.
const LIVE_PATTERNS = [/smoke/i, /benchmark/i, /probe/i];
// Known live tests that don't match a filename pattern (e.g. they fetch a
// deployed auth endpoint but are named "regression").
const LIVE_FILES = new Set(["production-google-callback-regression.test.mjs"]);

const convexDir = path.join(appRoot, "convex");
const convexPresent = existsSync(convexDir) && statSync(convexDir).isDirectory();
const depsInstalled = existsSync(path.join(appRoot, "node_modules"));

const skipReason = (fileName, content) => {
    if (includeAll) return null;
    if (!includeLive) {
        const liveName = LIVE_PATTERNS.some((pattern) => pattern.test(fileName));
        const liveFile = LIVE_FILES.has(fileName);
        const liveCall = /await\s+fetch\s*\(/.test(content);
        if (liveName || liveFile || liveCall) {
            return liveName ? "live-service test (smoke/benchmark/probe)" : "live-service test";
        }
    }
    if (!convexPresent && /(convex\/|['"]convex['"])/.test(content)) {
        return "convex/ checkout missing";
    }
    return null;
};

const discoverTests = () =>
    readdirSync(scriptDir)
        .filter((name) => name.endsWith(".test.mjs"))
        .map((name) => path.join(scriptDir, name))
        .sort();

const tests = discoverTests();
const passed = [];
const failed = [];
const skipped = [];

for (const file of tests) {
    const relPath = path.relative(appRoot, file);
    if (filters.length && !filters.some((filter) => relPath.toLowerCase().includes(filter.toLowerCase()))) {
        continue;
    }

    let content = "";
    try {
        content = readFileSync(file, "utf8");
    } catch {
        // Unreadable file: fall through and let the run report the failure.
    }

    const reason = skipReason(path.basename(file), content);
    if (reason) {
        skipped.push({ path: relPath, reason });
        console.log(`SKIP  ${relPath}  (${reason})`);
        continue;
    }

    const result = spawnSync(process.execPath, [file], {
        cwd: appRoot,
        encoding: "utf8",
        timeout: TIMEOUT_MS,
        env: process.env,
    });

    if (result.status === 0) {
        passed.push(relPath);
        console.log(`PASS  ${relPath}`);
    } else {
        const detail =
            result.signal === "SIGTERM"
                ? `timed out after ${TIMEOUT_MS}ms`
                : (result.stderr || result.stdout || "").trim();
        failed.push({ path: relPath, detail });
        console.log(`FAIL  ${relPath}`);
        if (detail) {
            for (const line of detail.split("\n").slice(0, 6)) {
                console.log(`      ${line}`);
            }
        }
    }
}

const summary = {
    discovered: tests.length,
    selected: passed.length + failed.length + skipped.length,
    passed: passed.length,
    failed: failed.length,
    skipped: skipped.length,
    failures: failed,
    skippedTests: skipped,
};

console.log("\n----");
console.log(
    `discovered=${summary.discovered} selected=${summary.selected} passed=${summary.passed} failed=${summary.failed} skipped=${summary.skipped}`,
);

if (!depsInstalled) {
    console.log(
        "note: stitch-app/node_modules is not installed; failures mentioning " +
            "'Cannot find package' / 'ERR_MODULE_NOT_FOUND' are missing dependencies " +
            "(run `npm install` in stitch-app to resolve).",
    );
}

if (jsonPath) {
    try {
        writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
        console.log(`results written to ${jsonPath}`);
    } catch (error) {
        console.warn(`failed to write ${jsonPath}: ${error?.message || error}`);
    }
}

if (failed.length > 0) {
    console.log("\nfailed tests:");
    for (const item of failed) {
        console.log(`  ${item.path}`);
    }
    process.exit(1);
}
