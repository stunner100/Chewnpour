import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFile(path.join(root, rel), "utf8");

process.env.DATABASE_URL ||= "postgres://user:pass@localhost:5432/unused";

const { buildTrustedOrigins } = await import("../server/authOrigins.js");
const { BOOTSTRAP_ADMIN_EMAILS, isAdminUser } = await import("../server/adminAccess.js");
const { fillDailySeries, STATUS_BREAKDOWN_SQL } = await import("../server/adminMetrics.js");
const { PAST_PAPER_STORAGE_PATH } = await import("../server/pastPapers.js");

// 1. Auth never trusts arbitrary *.vercel.app origins (reset-token leak), only
//    our domains, configured frontends, and this deployment's own URLs.
{
    const origins = buildTrustedOrigins({
        FRONTEND_URLS: "https://preview.chewnpour.com, not a url",
        VERCEL_URL: "stitch-abc123-stunner100s-projects.vercel.app",
        VERCEL_BRANCH_URL: "stitch-app-git-feature-stunner100s-projects.vercel.app",
    });
    assert.ok(origins.includes("https://www.chewnpour.com"));
    assert.ok(origins.includes("https://staging.chewnpour.com"));
    assert.ok(origins.includes("https://preview.chewnpour.com"));
    assert.ok(origins.includes("https://stitch-abc123-stunner100s-projects.vercel.app"));
    assert.ok(origins.includes("https://stitch-app-git-feature-stunner100s-projects.vercel.app"));
    assert.ok(!origins.some((origin) => origin.includes("*")), "no wildcard origins");
    assert.ok(!origins.includes("https://attacker.vercel.app"));

    const bare = buildTrustedOrigins({});
    assert.ok(!bare.some((origin) => origin.endsWith(".vercel.app")), "no vercel.app origin without VERCEL_URL");

    const authSource = await read("server/auth.js");
    assert.ok(!authSource.includes('endsWith(".vercel.app")'), "auth.js must not trust request-supplied vercel.app origins");
    assert.ok(!/headers\.get\("origin"\)/.test(authSource), "trusted origins are not derived from the request");
}

// 2. Allowlisted admin emails only count once the email is verified.
{
    const email = BOOTSTRAP_ADMIN_EMAILS[0];
    assert.equal(isAdminUser({ email, id: "u1" }), false, "unverified by default");
    assert.equal(isAdminUser({ email, id: "u1", emailVerified: false }), false);
    assert.equal(isAdminUser({ email: email.toUpperCase(), id: "u1", emailVerified: true }), true);
    assert.equal(isAdminUser({ email: "someone@example.com", id: "u1", emailVerified: true }), false);

    process.env.ADMIN_USER_IDS = "admin-user-id";
    assert.equal(isAdminUser({ email: "", id: "admin-user-id" }), true, "explicit user ids need no email");
    delete process.env.ADMIN_USER_IDS;

    const members = await read("server/adminMembers.js");
    assert.ok(members.includes("emailVerified: user.emailVerified"), "admin gate passes the session's verification flag");
}

// 3. New-student chart has one bar per day, zero-filled, oldest first.
{
    const now = new Date("2026-10-15T09:00:00Z");
    const series = fillDailySeries([{ day: "2026-10-15", value: 3 }, { day: "2026-10-11", value: "2" }], { now, days: 7 });
    assert.equal(fillDailySeries([], { now }).length, 14, "overview charts cover 14 days");
    assert.equal(series.length, 7);
    assert.deepEqual(series.map((d) => d.value), [0, 0, 2, 0, 0, 0, 3]);
    assert.equal(series[0].label, "Oct 09");
    assert.equal(series[6].label, "Oct 15");
}

// 4. Bars are sized in pixels (percentage heights collapsed to 0px).
{
    const ui = await read("src/components/admin/AdminUi.jsx");
    assert.ok(!/height: `\$\{pct\}%`/.test(ui), "no percentage bar heights");
    const { barHeightPx, nextTabKey } = await import("../src/lib/admin/ui.js");
    assert.equal(barHeightPx(5, 5, 96), 96);
    assert.equal(barHeightPx(1, 4, 96), 24);
    assert.equal(barHeightPx(0, 5, 96), 2, "zero still shows a sliver");
    assert.match(ui, /style=\{\{ height: barHeightPx\(item\.value, max\) \}\}/);
    assert.equal(nextTabKey(["a", "b", "c"], "c", "ArrowRight"), "a");
    assert.equal(nextTabKey(["a", "b", "c"], "a", "ArrowLeft"), "c");
    assert.equal(nextTabKey(["a", "b", "c"], "b", "End"), "c");
    assert.equal(nextTabKey(["a", "b", "c"], "b", "Enter"), null);
    assert.match(ui, /aria-controls=\{ADMIN_TABPANEL_ID\}/);
    assert.match(ui, /tabIndex=\{selected \? 0 : -1\}/);
}

// 5. Metrics: tutor usage comes from chat messages, expired exams are split
//    out, and status breakdowns are a single round trip.
{
    const metrics = await read("server/adminMetrics.js");
    assert.ok(!metrics.includes("study_worker_sessions"), "dead tutor table is not counted");
    assert.match(metrics, /FROM topic_chat_messages/);
    assert.match(STATUS_BREAKDOWN_SQL, /status = 'in_progress' AND ends_at < NOW\(\) THEN 'expired'/);
    assert.equal((STATUS_BREAKDOWN_SQL.match(/UNION ALL/g) || []).length, 3);
    assert.match(metrics, /SNAPSHOT_TTL_MS/);

    const learning = await read("src/pages/admin/panels/LearningPanel.jsx");
    assert.ok(!learning.includes("in progress rows"), "progress rows are not mislabeled as in-progress");
    const overview = await read("src/pages/admin/panels/OverviewPanel.jsx");
    assert.ok(overview.includes("overview.tutorConversations"));
}

// 6. Past questions tab does not depend on the snapshot; papers are created
//    only after the file is uploaded (no orphan drafts).
{
    const dashboard = await read("src/pages/admin/AdminDashboard.jsx");
    assert.match(dashboard, /if \(activeTab === 'past-papers'\) return <PastPapersPanel \/>;[\s\S]*?if \(!snapshot\) return null;/);
    assert.ok(dashboard.includes("const needsSnapshot = activeTab !== 'past-papers' && activeTab !== 'admins';"));

    const pastPapers = await read("server/pastPapers.js");
    const init = pastPapers.slice(pastPapers.indexOf("export const initPastPaperUpload"), pastPapers.indexOf("export const createPastPaper"));
    assert.ok(!init.includes("INSERT INTO past_papers"), "init must not write a paper row");
    assert.ok(PAST_PAPER_STORAGE_PATH.test("V1StGXR8_Z5jdHi6B-myT/CSC_201.pdf"));
    assert.ok(!PAST_PAPER_STORAGE_PATH.test("../other/x.pdf"));
    assert.ok(!PAST_PAPER_STORAGE_PATH.test("short/x.pdf"));

    const panel = await read("src/pages/admin/panels/PastPapersPanel.jsx");
    assert.ok(panel.includes("storagePath: init.storagePath"));
}

// 7. Users can be searched beyond the 25 most recent.
{
    const http = await read("server/adminHttp.js");
    assert.ok(http.includes('pathname === "/api/admin/users"') && http.includes("searchAdminUsers"));
    const users = await read("src/pages/admin/panels/UsersPanel.jsx");
    assert.ok(users.includes("/api/admin/users?q="));
}

console.log("admin-dashboard-audit regression checks passed");
