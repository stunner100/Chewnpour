import assert from "node:assert/strict";
import {
    buildReengagementEmail,
    isExcludedReengagementEmail,
    normalizeReengagementRecipients,
    REENGAGEMENT_SUBJECT,
} from "../server/reengagementEmail.js";

assert.equal(
    isExcludedReengagementEmail("study-loop-smoke@example.com"),
    true,
);
assert.equal(isExcludedReengagementEmail("qa+qa-lesson@gmail.com"), true);
assert.equal(isExcludedReengagementEmail("student@st.ug.edu.gh"), false);
assert.equal(isExcludedReengagementEmail("example@stitch.com"), true);
assert.equal(isExcludedReengagementEmail("student@university.com"), true);

const recipients = normalizeReengagementRecipients([
    { email: "Pat@Gmail.com", name: "Patrick Annor" },
    { email: "pat@gmail.com", name: "Patrick" },
    { email: "smoke@example.com", name: "Smoke" },
    { email: "not-an-email", name: "Skip" },
]);

assert.deepEqual(recipients, [{ email: "pat@gmail.com", name: "Patrick" }]);

const email = buildReengagementEmail({ name: "Benedicta Bentum" });
assert.equal(email.subject, REENGAGEMENT_SUBJECT);
assert.match(email.text, /Hi Benedicta/);
assert.match(email.text, /https:\/\/www\.chewnpour\.com\/signup/);
assert.match(email.text, /old login will not work/i);
assert.match(email.text, /free now/i);
assert.match(email.text, /best experience/i);
assert.match(email.text, /learn on a laptop/i);
assert.doesNotMatch(email.text, /credit pack/i);
assert.match(email.html, /Hi Benedicta/);
assert.match(email.headers["List-Unsubscribe"], /unsubscribe/i);

console.log("reengagement-email-regression tests passed");
