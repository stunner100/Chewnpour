import { nanoid } from "nanoid";
import { getPool } from "./db.js";

export const STARTER_UPLOAD_CREDITS = Math.max(
    0,
    Number(process.env.STARTER_UPLOAD_CREDITS || 3) || 3,
);
export const UPLOAD_CREDIT_COST = Math.max(
    1,
    Number(process.env.UPLOAD_CREDIT_COST || 1) || 1,
);

const toClientBilling = (row) => {
    if (!row) return null;
    const purchased = Math.max(0, Number(row.purchased_upload_credits || 0));
    const consumed = Math.max(0, Number(row.consumed_upload_credits || 0));
    const remaining = Math.max(0, purchased - consumed);
    return {
        userId: row.user_id,
        plan: row.plan || "free",
        status: row.status || "active",
        purchasedUploadCredits: purchased,
        consumedUploadCredits: consumed,
        remainingUploadCredits: remaining,
        starterGranted: Boolean(row.starter_granted),
        createdAt: row.created_at ? new Date(row.created_at).getTime() : null,
        updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : null,
    };
};

const getBillingRow = async (userId) => {
    const db = getPool();
    const result = await db.query(
        `SELECT * FROM billing_accounts WHERE user_id = $1 LIMIT 1`,
        [userId],
    );
    return result.rows[0] || null;
};

const insertLedgerEntry = async ({
    userId,
    entryType,
    amount,
    reason,
    uploadId = null,
    balanceAfter,
}) => {
    const db = getPool();
    await db.query(
        `INSERT INTO credit_ledger (
            id, user_id, entry_type, amount, reason, upload_id, balance_after
         ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
            nanoid(),
            userId,
            entryType,
            amount,
            reason,
            uploadId,
            Math.max(0, Number(balanceAfter) || 0),
        ],
    );
};

export const ensureBillingAccount = async (userId) => {
    const existing = await getBillingRow(userId);
    if (existing) {
        if (!existing.starter_granted && STARTER_UPLOAD_CREDITS > 0) {
            return grantStarterCredits(userId);
        }
        return toClientBilling(existing);
    }

    const db = getPool();
    const starter = STARTER_UPLOAD_CREDITS;
    const inserted = await db.query(
        `INSERT INTO billing_accounts (
            user_id,
            plan,
            status,
            purchased_upload_credits,
            consumed_upload_credits,
            starter_granted
         ) VALUES ($1, 'free', 'active', $2, 0, $3)
         ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
         RETURNING *`,
        [userId, starter, starter > 0],
    );

    const row = inserted.rows[0];
    if (starter > 0) {
        await insertLedgerEntry({
            userId,
            entryType: "grant",
            amount: starter,
            reason: "starter_upload_credits",
            balanceAfter: starter,
        });
    }
    return toClientBilling(row);
};

export const grantStarterCredits = async (userId) => {
    const existing = await getBillingRow(userId);
    if (!existing) {
        return ensureBillingAccount(userId);
    }
    if (existing.starter_granted || STARTER_UPLOAD_CREDITS <= 0) {
        return toClientBilling(existing);
    }

    const db = getPool();
    const nextPurchased =
        Math.max(0, Number(existing.purchased_upload_credits || 0)) + STARTER_UPLOAD_CREDITS;
    const updated = await db.query(
        `UPDATE billing_accounts
         SET purchased_upload_credits = $2,
             starter_granted = TRUE,
             updated_at = NOW()
         WHERE user_id = $1
         RETURNING *`,
        [userId, nextPurchased],
    );
    const row = updated.rows[0];
    const remaining = Math.max(
        0,
        Number(row.purchased_upload_credits || 0) - Number(row.consumed_upload_credits || 0),
    );
    await insertLedgerEntry({
        userId,
        entryType: "grant",
        amount: STARTER_UPLOAD_CREDITS,
        reason: "starter_upload_credits",
        balanceAfter: remaining,
    });
    return toClientBilling(row);
};

export const getBillingForUser = async (userId) => ensureBillingAccount(userId);

export const assertUploadCreditsAvailable = async (userId) => getBillingForUser(userId);

export const consumeUploadCredit = async ({ userId, uploadId: _uploadId }) =>
    getBillingForUser(userId);

export const chargeUploadIfNeeded = async ({ userId, uploadId: _uploadId }) =>
    getBillingForUser(userId);

export const hasSuccessfulPurchase = async (userId) => {
    const db = getPool();
    const result = await db.query(
        `SELECT id
         FROM payments
         WHERE user_id = $1
           AND status = 'success'
         LIMIT 1`,
        [userId],
    );
    if (result.rows[0]) return true;

    const ledger = await db.query(
        `SELECT id
         FROM credit_ledger
         WHERE user_id = $1
           AND entry_type = 'purchase'
         LIMIT 1`,
        [userId],
    );
    return Boolean(ledger.rows[0]);
};

export const grantPurchasedCredits = async ({
    userId,
    credits,
    reason = "upload_topup",
    planId = null,
    paymentReference = null,
}) => {
    const amount = Math.max(0, Math.floor(Number(credits) || 0));
    if (amount <= 0) {
        return ensureBillingAccount(userId);
    }

    await ensureBillingAccount(userId);
    const db = getPool();
    const updated = await db.query(
        `UPDATE billing_accounts
         SET purchased_upload_credits = purchased_upload_credits + $2,
             plan = CASE WHEN plan = 'free' THEN 'premium' ELSE plan END,
             last_payment_reference = COALESCE($3, last_payment_reference),
             last_payment_at = NOW(),
             last_top_up_plan_id = COALESCE($4, last_top_up_plan_id),
             updated_at = NOW()
         WHERE user_id = $1
         RETURNING *`,
        [userId, amount, paymentReference, planId],
    );
    const billing = toClientBilling(updated.rows[0]);
    await insertLedgerEntry({
        userId,
        entryType: "purchase",
        amount,
        reason,
        balanceAfter: billing.remainingUploadCredits,
    });
    return billing;
};
