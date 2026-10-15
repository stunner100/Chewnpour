export const BOOTSTRAP_ADMIN_EMAILS = ["patrickannor35@gmail.com"];

const splitEmails = (value) =>
    String(value || "")
        .split(/[,;\s]+/)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);

const splitIds = (value) =>
    String(value || "")
        .split(/[,;\s]+/)
        .map((item) => item.trim())
        .filter(Boolean);

export const listAdminEmails = () => {
    const unique = new Set([
        ...BOOTSTRAP_ADMIN_EMAILS.map((email) => email.toLowerCase()),
        ...splitEmails(process.env.ADMIN_EMAILS),
    ]);
    return Array.from(unique);
};

export const listAdminUserIds = () => splitIds(process.env.ADMIN_USER_IDS);

// Email/password sign-up does not verify addresses, so an allowlisted email
// only grants admin once the account has proven it owns that address.
export const isAdminUser = ({ email, id, emailVerified = false } = {}) => {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const userId = String(id || "").trim();
    if (
        emailVerified === true &&
        normalizedEmail &&
        listAdminEmails().includes(normalizedEmail)
    ) {
        return true;
    }
    if (userId && listAdminUserIds().includes(userId)) {
        return true;
    }
    return false;
};

/**
 * Where a user's admin access comes from: "bootstrap" / "env" (code and
 * environment, not removable from the dashboard) and "db" (granted from the
 * dashboard). Allowlisted emails only count once verified.
 */
export const adminSourcesFor = (
    { email, id, emailVerified = false } = {},
    dashboardAdminIds = new Set(),
) => {
    const sources = [];
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const userId = String(id || "").trim();
    if (emailVerified === true && normalizedEmail) {
        if (BOOTSTRAP_ADMIN_EMAILS.map((item) => item.toLowerCase()).includes(normalizedEmail)) {
            sources.push("bootstrap");
        } else if (splitEmails(process.env.ADMIN_EMAILS).includes(normalizedEmail)) {
            sources.push("env");
        }
    }
    if (userId && listAdminUserIds().includes(userId) && !sources.includes("env")) {
        sources.push("env");
    }
    if (userId && dashboardAdminIds.has(userId)) {
        sources.push("db");
    }
    return sources;
};
