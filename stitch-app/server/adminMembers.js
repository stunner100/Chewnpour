import { getPool } from "./db.js";
import {
    BOOTSTRAP_ADMIN_EMAILS,
    adminSourcesFor,
    isAdminUser,
    listAdminEmails,
    listAdminUserIds,
} from "./adminAccess.js";

const httpError = (status, message, code) => {
    const error = new Error(message);
    error.status = status;
    if (code) error.code = code;
    return error;
};

const toIso = (value) => (value ? new Date(value).toISOString() : null);

export const loadDashboardAdminIds = async () => {
    const result = await getPool().query(`SELECT user_id FROM admin_members`);
    return new Set(result.rows.map((row) => row.user_id));
};

/** Admin check for a signed-in session user: code/env lists, then the table. */
export const isAdminSessionUser = async (user) => {
    if (!user?.id) return false;
    if (isAdminUser({ email: user.email, id: user.id, emailVerified: user.emailVerified })) {
        return true;
    }
    const result = await getPool().query(
        `SELECT 1 FROM admin_members WHERE user_id = $1 LIMIT 1`,
        [user.id],
    );
    return result.rowCount > 0;
};

/**
 * Every admin, with where their access comes from. Allowlisted emails without
 * a verified account are listed as pending so it's clear they can't sign in yet.
 */
export const listAdmins = async () => {
    const emails = listAdminEmails();
    const envIds = listAdminUserIds();
    const result = await getPool().query(
        `SELECT u.id, u.email, u.name, u.email_verified, p.full_name,
                am.created_at AS granted_at, am.user_id IS NOT NULL AS is_db,
                adder.email AS added_by_email
         FROM "user" u
         LEFT JOIN profiles p ON p.user_id = u.id
         LEFT JOIN admin_members am ON am.user_id = u.id
         LEFT JOIN "user" adder ON adder.id = am.added_by
         WHERE am.user_id IS NOT NULL
            OR lower(u.email) = ANY($1::text[])
            OR u.id = ANY($2::text[])`,
        [emails, envIds],
    );
    const dbIds = new Set(result.rows.filter((row) => row.is_db).map((row) => row.id));
    const admins = [];
    const seenEmails = new Set();
    for (const row of result.rows) {
        seenEmails.add(String(row.email || "").toLowerCase());
        const sources = adminSourcesFor(
            { email: row.email, id: row.id, emailVerified: row.email_verified === true },
            dbIds,
        );
        admins.push({
            userId: row.id,
            email: row.email,
            name: row.full_name || row.name || "",
            emailVerified: row.email_verified === true,
            sources,
            active: sources.length > 0,
            canRemove: sources.includes("db"),
            addedBy: row.added_by_email || null,
            grantedAt: toIso(row.granted_at),
        });
    }
    for (const email of emails) {
        if (seenEmails.has(email)) continue;
        admins.push({
            userId: null,
            email,
            name: "",
            emailVerified: false,
            sources: [BOOTSTRAP_ADMIN_EMAILS.includes(email) ? "bootstrap" : "env"],
            active: false,
            canRemove: false,
            addedBy: null,
            grantedAt: null,
        });
    }
    return admins.sort((a, b) => Number(b.active) - Number(a.active) || a.email.localeCompare(b.email));
};

/**
 * Grant admin to an existing account, found by user id or email. Accounts
 * with an unverified email need an explicit confirmation, since anyone can
 * register an address with a password.
 */
export const grantAdmin = async ({ actorId, userId, email, allowUnverified = false }) => {
    const db = getPool();
    const lookup = userId
        ? await db.query(`SELECT id, email, email_verified FROM "user" WHERE id = $1`, [String(userId)])
        : await db.query(`SELECT id, email, email_verified FROM "user" WHERE lower(email) = lower($1)`, [
            String(email || "").trim(),
        ]);
    const target = lookup.rows[0];
    if (!target) {
        throw httpError(
            404,
            "No ChewnPour account uses that email. Ask them to sign up first, then add them.",
            "ADMIN_TARGET_NOT_FOUND",
        );
    }
    if (target.email_verified !== true && !allowUnverified) {
        throw httpError(
            409,
            `${target.email} has not verified their email. Confirm you know this account belongs to them.`,
            "ADMIN_TARGET_UNVERIFIED",
        );
    }
    await db.query(
        `INSERT INTO admin_members (user_id, added_by) VALUES ($1, $2)
         ON CONFLICT (user_id) DO NOTHING`,
        [target.id, actorId || null],
    );
    return { userId: target.id, email: target.email };
};

export const revokeAdmin = async ({ actorId, userId }) => {
    if (String(userId) === String(actorId)) {
        throw httpError(400, "You can't remove your own admin access.", "ADMIN_SELF_REMOVE");
    }
    const removed = await getPool().query(
        `DELETE FROM admin_members WHERE user_id = $1 RETURNING user_id`,
        [String(userId)],
    );
    if (!removed.rowCount) {
        throw httpError(
            409,
            "This admin was added in code or environment settings and can't be removed here.",
            "ADMIN_NOT_REMOVABLE",
        );
    }
    return { removed: true, userId: String(userId) };
};
