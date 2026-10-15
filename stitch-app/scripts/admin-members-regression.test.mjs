import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFile(path.join(root, rel), "utf8");

process.env.DATABASE_URL ||= "postgres://user:pass@localhost:5432/unused";

const { BOOTSTRAP_ADMIN_EMAILS, adminSourcesFor } = await import("../server/adminAccess.js");
const { ACTIVITY_CTE, DAILY_SERIES_SQL } = await import("../server/adminMetrics.js");
const { grantAdminAccess, shareOfStudents } = await import("../src/lib/admin/ui.js");

// 1. Admin sources: owner/env by verified email or env id; dashboard by user id.
{
    const owner = BOOTSTRAP_ADMIN_EMAILS[0];
    assert.deepEqual(adminSourcesFor({ email: owner, id: "o", emailVerified: true }), ["bootstrap"]);
    assert.deepEqual(adminSourcesFor({ email: owner, id: "o", emailVerified: false }), [], "unverified owner email grants nothing");

    process.env.ADMIN_EMAILS = "ops@example.com";
    process.env.ADMIN_USER_IDS = "env-id";
    assert.deepEqual(adminSourcesFor({ email: "OPS@example.com", id: "x", emailVerified: true }), ["env"]);
    assert.deepEqual(adminSourcesFor({ email: "a@b.c", id: "env-id" }), ["env"]);
    assert.deepEqual(adminSourcesFor({ email: "a@b.c", id: "db-id" }, new Set(["db-id"])), ["db"],
        "dashboard grants are by user id and need no email verification");
    assert.deepEqual(adminSourcesFor({ email: "a@b.c", id: "nobody" }, new Set(["db-id"])), []);
    delete process.env.ADMIN_EMAILS;
    delete process.env.ADMIN_USER_IDS;
}

// 2. Server: the admin gate consults the table; grants are guarded.
{
    const http = await read("server/adminHttp.js");
    assert.ok(http.includes("await isAdminSessionUser(user)"), "admin gate includes dashboard-granted admins");
    for (const route of ['pathname === "/api/admin/admins" && method === "GET"', 'pathname === "/api/admin/admins" && method === "POST"', 'pathname.startsWith("/api/admin/admins/") && method === "DELETE"']) {
        assert.ok(http.includes(route), `route: ${route}`);
    }
    const members = await read("server/adminMembers.js");
    assert.match(members, /ADMIN_TARGET_UNVERIFIED/, "unverified accounts need explicit confirmation");
    assert.match(members, /ADMIN_SELF_REMOVE/, "admins can't remove themselves");
    assert.match(members, /DELETE FROM admin_members WHERE user_id = \$1/, "only dashboard grants are removable");
    assert.match(members, /ADMIN_TARGET_NOT_FOUND/, "grant requires an existing account");

    const migration = await read("supabase/migrations/20261016120000_admin_members.sql");
    assert.match(migration, /"user_id" TEXT PRIMARY KEY REFERENCES "user"\("id"\) ON DELETE CASCADE/);
    assert.match(migration, /REVOKE ALL ON TABLE "admin_members" FROM anon, authenticated/);
}

// 3. Client grant helper: confirms before granting an unverified account.
{
    const calls = [];
    const responses = [
        { status: 409, ok: false, body: { code: "ADMIN_TARGET_UNVERIFIED", error: "x has not verified" } },
        { status: 201, ok: true, body: { granted: { email: "x" }, admins: [] } },
    ];
    const fetchImpl = async (_url, init) => {
        calls.push(JSON.parse(init.body));
        const next = responses.shift();
        return { status: next.status, ok: next.ok, json: async () => next.body };
    };
    const asked = [];
    const result = await grantAdminAccess({ userId: "u1" }, { fetchImpl, confirmUnverified: (m) => { asked.push(m); return true; } });
    assert.deepEqual(calls.map((c) => c.allowUnverified), [false, true]);
    assert.equal(asked.length, 1);
    assert.equal(result.granted.email, "x");

    const declined = await grantAdminAccess({ email: "y" }, {
        fetchImpl: async () => ({ status: 409, ok: false, json: async () => ({ code: "ADMIN_TARGET_UNVERIFIED", error: "no" }) }),
        confirmUnverified: () => false,
    });
    assert.deepEqual(declined, { cancelled: true });

    await assert.rejects(
        grantAdminAccess({ email: "z" }, { fetchImpl: async () => ({ status: 404, ok: false, json: async () => ({ error: "No account" }) }) }),
        /No account/,
    );
}

// 4. Clear user metrics: active = real study activity over 1/7/30 days.
{
    for (const source of ["topic_progress", "quiz_attempts", "exam_attempts", "topic_chat_messages", "uploads"]) {
        assert.ok(ACTIVITY_CTE.includes(`FROM ${source}`), `activity includes ${source}`);
    }
    assert.match(ACTIVITY_CTE, /role = 'user'/, "only student chat messages count, not tutor replies");
    assert.match(DAILY_SERIES_SQL, /'new' AS kind/);
    assert.match(DAILY_SERIES_SQL, /'active'/);
    const metrics = await read("server/adminMetrics.js");
    for (const key of ["active1d", "active7d", "active30d", "users30d", "dailyActiveUsers"]) {
        assert.ok(metrics.includes(key), `snapshot exposes ${key}`);
    }
    assert.equal(shareOfStudents(3, 12), "25% of students");
    assert.equal(shareOfStudents(5, 0), "0% of students");

    const overview = await read("src/pages/admin/panels/OverviewPanel.jsx");
    for (const label of ["Total students", "Active today", "Active this week", "Active this month", "Active students per day"]) {
        assert.ok(overview.includes(label), `overview shows ${label}`);
    }
}

// 5. UI wiring: Admins tab and Make admin from Users.
{
    assert.ok((await read("src/lib/admin/constants.js")).includes("key: 'admins'"));
    const dashboard = await read("src/pages/admin/AdminDashboard.jsx");
    assert.ok(dashboard.includes("if (activeTab === 'admins') return <AdminsPanel />;"));
    assert.ok(dashboard.includes("previousTab.current === 'admins'"), "Users tab refreshes after admin changes");
    assert.ok((await read("src/pages/admin/panels/UsersPanel.jsx")).includes("grantAdminAccess("));
}

console.log("admin-members regression checks passed");
