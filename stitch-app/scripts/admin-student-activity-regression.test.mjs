import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The onboarding flow was retired, so the admin dashboard reports what
// students actually did instead of the stale onboarding_completed flag.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFile(path.join(root, rel), "utf8");

const metrics = await read("server/adminMetrics.js");
assert.doesNotMatch(metrics, /onboarding_completed/, "admin metrics must not read the retired onboarding flag");
assert.match(metrics, /FROM uploads up WHERE up\.user_id/, "uploaded milestone reads uploads");
assert.match(metrics, /FROM topic_progress tp/, "studied milestone reads topic progress");
assert.match(metrics, /tp\.last_studied_at IS NOT NULL OR tp\.completed_at IS NOT NULL/, "studied requires real lesson activity");
assert.match(metrics, /FROM quiz_attempts qa/, "quizzed milestone counts topic quizzes");
assert.match(metrics, /ea\.submitted_at IS NOT NULL/, "quizzed milestone counts submitted exams only");
for (const key of ["uploadedUsers", "studiedUsers", "quizzedUsers"]) {
    assert.match(metrics, new RegExp(`${key}:`), `overview exposes ${key}`);
}
assert.match(metrics, /activity: \{\s*uploaded: row\.has_uploaded === true,\s*studied: row\.has_studied === true,\s*quizzed: row\.has_quizzed === true,/);
assert.equal(
    (metrics.match(/\$\{USER_MILESTONE_COLUMNS\}/g) || []).length,
    2,
    "recent users and user search both select the activity columns",
);

const users = await read("src/pages/admin/panels/UsersPanel.jsx");
assert.match(users, />Activity<\/th>/);
assert.doesNotMatch(users, /Incomplete|>Onboarding</, "users table no longer shows onboarding");
assert.match(users, /No activity yet/);

const overview = await read("src/pages/admin/panels/OverviewPanel.jsx");
assert.doesNotMatch(overview, /Finished onboarding|onboardedUsers/);
for (const label of ["Uploaded material", "Studied a lesson", "Took a quiz or exam"]) {
    assert.ok(overview.includes(label), `overview shows "${label}"`);
}

console.log("admin-student-activity-regression.test.mjs passed");
