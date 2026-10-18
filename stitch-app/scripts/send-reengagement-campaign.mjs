import { readFileSync } from "node:fs";
import { Resend } from "resend";
import {
    buildReengagementEmail,
    normalizeReengagementRecipients,
    REENGAGEMENT_SUBJECT,
} from "../server/reengagementEmail.js";

const BATCH_SIZE = 100;
const BATCH_PAUSE_MS = 400;
const SIGNUP_URL = "https://www.chewnpour.com/signup";
const SKIP_EMAILS = new Set(["patrickannor35@gmail.com"]);

const parseArgs = (argv) => {
    const args = {
        dryRun: true,
        send: false,
        testTo: "",
        recipientsPath: "",
        excludePath: "",
    };

    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (token === "--send") {
            args.send = true;
            args.dryRun = false;
            continue;
        }
        if (token === "--dry-run") {
            args.dryRun = true;
            args.send = false;
            continue;
        }
        if (token === "--test-to") {
            args.testTo = String(argv[index + 1] || "").trim();
            index += 1;
            continue;
        }
        if (token === "--recipients") {
            args.recipientsPath = String(argv[index + 1] || "").trim();
            index += 1;
            continue;
        }
        if (token === "--exclude-file") {
            args.excludePath = String(argv[index + 1] || "").trim();
            index += 1;
        }
    }

    return args;
};

const parseRecipientFile = (filePath) => {
    const raw = readFileSync(filePath, "utf8");
    if (filePath.endsWith(".json") || filePath.endsWith(".json.local")) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && typeof parsed[0] === "string") {
            return parsed.map((email) => ({ email, name: "there" }));
        }
        if (Array.isArray(parsed)) return parsed;
        return parsed.recipients || [];
    }

    if (filePath.endsWith(".tsv") || filePath.endsWith(".tsv.local") || filePath.endsWith(".txt.local")) {
        return raw
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .filter((line) => !/^email\b/i.test(line))
            .map((line) => {
                const [email, ...nameParts] = line.split("|").map((part) => part.trim());
                return { email, name: nameParts.join(" ") };
            });
    }
};

const chunk = (items, size) => {
    const batches = [];
    for (let index = 0; index < items.length; index += size) {
        batches.push(items.slice(index, index + size));
    }
    return batches;
};

const args = parseArgs(process.argv.slice(2));
const from = String(process.env.RESEND_FROM || "").trim();
const apiKey = String(process.env.RESEND_API_KEY || "").trim();

if (!args.testTo && !args.recipientsPath) {
    console.error(
        "Pass --test-to you@email.com and/or --recipients path.csv|.json.local",
    );
    process.exit(1);
}

const fileRows = args.recipientsPath
    ? parseRecipientFile(args.recipientsPath)
    : [];
const excluded = new Set(SKIP_EMAILS);
if (args.excludePath) {
    for (const row of parseRecipientFile(args.excludePath) || []) {
        const email = String(row.email || "").trim().toLowerCase();
        if (email) excluded.add(email);
    }
}
const recipients = normalizeReengagementRecipients(
    args.testTo
        ? [{ email: args.testTo, name: "there" }, ...fileRows]
        : fileRows,
).filter((row) => !excluded.has(row.email));

if (args.testTo && recipients.length === 0) {
    console.error("Test address was filtered out.");
    process.exit(1);
}

console.log(`Recipients after filters: ${recipients.length}`);
console.log(`Subject: ${REENGAGEMENT_SUBJECT}`);
console.log(`Signup URL: ${SIGNUP_URL}`);

if (args.dryRun || !args.send) {
    console.log("Dry run. No emails sent. Re-run with --send to deliver.");
    console.log(
        recipients
            .slice(0, 8)
            .map((row) => row.email)
            .join("\n"),
    );
    if (recipients.length > 8) {
        console.log(`… ${recipients.length - 8} more`);
    }
    process.exit(0);
}

if (!apiKey || !from) {
    console.error("RESEND_API_KEY and RESEND_FROM must be set to send.");
    process.exit(1);
}

const resend = new Resend(apiKey);

for (const [batchIndex, batch] of chunk(recipients, BATCH_SIZE).entries()) {
    const payload = batch.map((recipient) => {
        const email = buildReengagementEmail({ name: recipient.name });
        return {
            from,
            to: [recipient.email],
            subject: email.subject,
            text: email.text,
            html: email.html,
            headers: email.headers,
        };
    });

    const { error } = await resend.batch.send(payload, {
        idempotencyKey: `chewnpour-reengagement/${batchIndex}/${payload[0]?.to?.[0] || "batch"}`,
    });

    if (error) {
        console.error(`Batch ${batchIndex + 1} failed:`, error.message || error);
        console.error(`Sent before failure: ${batchIndex * BATCH_SIZE} emails.`);
        process.exit(1);
    }

    console.log(`Sent batch ${batchIndex + 1} (${payload.length})`);
    if (batchIndex < Math.ceil(recipients.length / BATCH_SIZE) - 1) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_PAUSE_MS));
    }
}

console.log(`Finished ${recipients.length} emails.`);
