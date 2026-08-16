import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const vercelConfig = JSON.parse(read("vercel.json"));
const globalHeaderRule = vercelConfig.headers.find((rule) => rule.source === "/(.*)");
assert.ok(globalHeaderRule, "vercel.json must define global security headers");

const headers = new Map(globalHeaderRule.headers.map((header) => [header.key, header.value]));
for (const key of [
  "Content-Security-Policy",
  "X-Frame-Options",
  "X-Content-Type-Options",
  "Referrer-Policy",
  "Permissions-Policy",
]) {
  assert.ok(headers.has(key), `vercel.json missing ${key}`);
}

const csp = headers.get("Content-Security-Policy");
assert.ok(csp.includes("frame-ancestors 'none'"), "CSP must block framing");
assert.ok(csp.includes("object-src 'none'"), "CSP must block plugin/object content");
assert.ok(/script-src[^;]*https:\/\/datafa\.st/.test(csp), "CSP script-src must allow DataFast");
assert.ok(/connect-src[^;]*https:\/\/datafa\.st/.test(csp), "CSP connect-src must allow DataFast");
assert.ok(/script-src[^;]*https:\/\/us-assets\.i\.posthog\.com/.test(csp), "CSP script-src must allow PostHog replay/survey assets");
assert.ok(/connect-src[^;]*https:\/\/us\.i\.posthog\.com/.test(csp), "CSP connect-src must allow PostHog capture");
assert.equal(csp.includes("assistia"), false, "CSP must not allow the Assistia support widget");
const indexHtml = read("index.html");
assert.equal(
  indexHtml.includes("assistia"),
  false,
  "index.html must not load the Assistia support widget",
);
assert.ok(indexHtml.includes('src="https://datafa.st/js/script.js"'), "index.html must load DataFast");
assert.ok(
  indexHtml.includes('data-website-id="dfid_XuoHdWYG3ZqYPssuhYooU"'),
  "index.html must keep the DataFast website id",
);
assert.ok(
  indexHtml.includes('data-domain="chewnpour.com"'),
  "index.html must keep the DataFast domain",
);
assert.equal(headers.get("X-Frame-Options"), "DENY");
assert.equal(headers.get("X-Content-Type-Options"), "nosniff");

const doclingSource = read("../docling-service/render_api/app.py");
for (const snippet of [
  "def _require_shared_secret",
  "Docling shared secret is not configured.",
  "DOCLING_MAX_UPLOAD_BYTES",
  "file.read(READ_CHUNK_BYTES)",
  "status_code=413",
  "Unsupported file type.",
]) {
  assert.ok(doclingSource.includes(snippet), `Docling hardening missing ${snippet}`);
}
assert.equal(
  doclingSource.includes("payload = await file.read()"),
  false,
  "Docling extract endpoint must not read full uploads into memory",
);

console.log("security-hardening-regression.test.mjs passed");
