import { Resend } from "resend";

let resendClient = null;

const getResendClient = () => {
    const apiKey = String(process.env.RESEND_API_KEY || "").trim();
    if (!apiKey) return null;
    if (!resendClient) {
        resendClient = new Resend(apiKey);
    }
    return resendClient;
};

export const isResendConfigured = () =>
    Boolean(
        String(process.env.RESEND_API_KEY || "").trim() &&
            String(process.env.RESEND_FROM || "").trim(),
    );

/**
 * Fire-and-forget friendly email send for Better Auth reset links.
 * Callers should not await this in a way that enables timing attacks.
 */
export const sendPasswordResetEmail = async ({ to, url, userName }) => {
    const client = getResendClient();
    const from = String(process.env.RESEND_FROM || "").trim();
    if (!client || !from) {
        throw new Error(
            "Password reset email is not configured (RESEND_API_KEY / RESEND_FROM).",
        );
    }

    const name = String(userName || "").trim() || "there";
    const { error } = await client.emails.send({
        from,
        to: [to],
        subject: "Reset your ChewnPour password",
        text:
            `Hi ${name},\n\n` +
            `Reset your ChewnPour password using this link:\n${url}\n\n` +
            `If you did not request this, you can ignore this email.\n`,
        html:
            `<p>Hi ${name},</p>` +
            `<p>Reset your ChewnPour password using this link:</p>` +
            `<p><a href="${url}">${url}</a></p>` +
            `<p>If you did not request this, you can ignore this email.</p>`,
    });

    if (error) {
        throw new Error(error.message || "Failed to send reset email");
    }
};
