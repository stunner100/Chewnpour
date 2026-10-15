const SIGNUP_URL = "https://www.chewnpour.com/signup";
const UNSUBSCRIBE_MAILTO = "mailto:noreply@chewnpour.com?subject=unsubscribe";

const TEST_EMAIL_PATTERN =
    /(?:@example\.com$|@chewnpour\.test$|@stitch\.com$|@university\.com$|\+qa-|browser[._]exam|gate_ai_|dollicons\.com$|hidingmail\.com$|kaoing\.com$|netoiu\.com$|chatnak\.com$|hack\.me$|maximail\.fyi$|fentaoba\.com$|sisterment\.com$|dolofan\.com$|disney\.co\.uk$)/i;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const REENGAGEMENT_SUBJECT =
    "ChewnPour is free now — come try the new version";

export const isExcludedReengagementEmail = (email) => {
    const value = String(email || "").trim().toLowerCase();
    if (!value || !EMAIL_PATTERN.test(value)) return true;
    return TEST_EMAIL_PATTERN.test(value);
};

export const firstNameFromDisplayName = (name) => {
    const token = String(name || "")
        .trim()
        .split(/\s+/)[0]
        ?.replace(/[^A-Za-z'-]/g, "");
    if (!token || token.length < 2) return "there";
    return token;
};

export const normalizeReengagementRecipients = (rows = []) => {
    const seen = new Set();
    const recipients = [];

    for (const row of rows) {
        const email = String(row?.email || "").trim().toLowerCase();
        if (isExcludedReengagementEmail(email) || seen.has(email)) continue;
        seen.add(email);
        recipients.push({
            email,
            name: firstNameFromDisplayName(row?.name),
        });
    }

    return recipients;
};

export const buildReengagementEmail = ({ name } = {}) => {
    const greetingName = firstNameFromDisplayName(name);

    const text =
        `Hi ${greetingName},\n\n` +
        `You used ChewnPour before. We rebuilt it.\n\n` +
        `It is free now: upload your notes, get lessons and quizzes, and study with the AI tutor. No subscription.\n\n` +
        `For the best experience, learn on a laptop.\n\n` +
        `Your old login will not work on this version. Create a new account here:\n${SIGNUP_URL}\n\n` +
        `If this was not you, ignore this email. To stop these messages, reply with unsubscribe.\n`;

    const html =
        `<p>Hi ${escapeHtml(greetingName)},</p>` +
        `<p>You used ChewnPour before. We rebuilt it.</p>` +
        `<p>It is free now: upload your notes, get lessons and quizzes, and study with the AI tutor. No subscription.</p>` +
        `<p>For the best experience, learn on a laptop.</p>` +
        `<p>Your old login will not work on this version. Create a new account here:</p>` +
        `<p><a href="${SIGNUP_URL}">${SIGNUP_URL}</a></p>` +
        `<p>If this was not you, ignore this email. To stop these messages, reply with unsubscribe.</p>`;

    return {
        subject: REENGAGEMENT_SUBJECT,
        text,
        html,
        headers: {
            "List-Unsubscribe": `<${UNSUBSCRIBE_MAILTO}>`,
        },
    };
};

const escapeHtml = (value) =>
    String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
