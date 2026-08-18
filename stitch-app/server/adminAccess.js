/* eslint-env node */
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

export const isAdminUser = ({ email, id } = {}) => {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const userId = String(id || "").trim();
    if (normalizedEmail && listAdminEmails().includes(normalizedEmail)) {
        return true;
    }
    if (userId && listAdminUserIds().includes(userId)) {
        return true;
    }
    return false;
};
