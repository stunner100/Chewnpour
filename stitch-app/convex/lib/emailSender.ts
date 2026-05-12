const APP_NAME = "ChewnPour";
const DEFAULT_FROM_EMAIL = "noreply@chewnpour.com";
const CLOUDFLARE_EMAIL_API_BASE_URL = "https://api.cloudflare.com/client/v4/accounts";

type SendEmailParams = {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    context?: string;
};

const normalizeRecipients = (value: string | string[]) => {
    const recipients = Array.isArray(value) ? value : [value];
    return recipients
        .map((recipient) => String(recipient || "").trim())
        .filter(Boolean);
};

const readCloudflareEmailConfig = () => {
    const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || "").trim();
    const apiToken = String(process.env.CLOUDFLARE_EMAIL_API_TOKEN || "").trim();
    const fromAddress = String(process.env.CLOUDFLARE_EMAIL_FROM || DEFAULT_FROM_EMAIL).trim();

    return {
        accountId,
        apiToken,
        fromAddress: fromAddress || DEFAULT_FROM_EMAIL,
    };
};

export const sendEmail = async (params: SendEmailParams): Promise<boolean> => {
    const context = params.context || "email";
    const to = normalizeRecipients(params.to);
    const subject = String(params.subject || "").trim();
    const html = typeof params.html === "string" && params.html.trim() ? params.html : undefined;
    const text = typeof params.text === "string" && params.text.trim() ? params.text : undefined;

    if (to.length === 0 || !subject || (!html && !text)) {
        console.warn(`[${context}] missing email payload -- skipping send.`);
        return false;
    }

    const { accountId, apiToken, fromAddress } = readCloudflareEmailConfig();
    if (!accountId || !apiToken) {
        console.warn(
            `[${context}] Cloudflare email env not set -- skipping email send.`,
        );
        return false;
    }

    try {
        const response = await fetch(
            `${CLOUDFLARE_EMAIL_API_BASE_URL}/${encodeURIComponent(accountId)}/email/sending/send`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    from: { address: fromAddress, name: APP_NAME },
                    to,
                    subject,
                    ...(html ? { html } : {}),
                    ...(text ? { text } : {}),
                }),
            },
        );

        const payload = await response.json().catch(() => null);
        if (!response.ok || payload?.success !== true) {
            console.error(`[${context}] Cloudflare Email Sending API error`, {
                status: response.status,
                errors: Array.isArray(payload?.errors) ? payload.errors : undefined,
                messages: Array.isArray(payload?.messages) ? payload.messages : undefined,
            });
            return false;
        }

        return true;
    } catch (error) {
        console.error(`[${context}] failed to send email`, {
            error: error instanceof Error ? error.message : String(error),
        });
        return false;
    }
};
