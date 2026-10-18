import { createHmac, timingSafeEqual } from "node:crypto";

// Pure pieces of the review reminder email: copy and the signed one-click
// unsubscribe token. Kept free of DB/network so they can be unit-tested.
export const REMINDER_KIND = "review_reminder";

const escapeHtml = (value) =>
    String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

export const firstName = (name) => {
    const token = String(name || "").trim().split(/\s+/)[0]?.replace(/[^\p{L}'-]/gu, "");
    return token && token.length >= 2 ? token : "there";
};

const tokenSignature = (userId, secret) =>
    createHmac("sha256", secret).update(`${REMINDER_KIND}:${userId}`).digest("base64url").slice(0, 32);

export const signUnsubscribeToken = (userId, secret) => {
    if (!userId || !secret) throw new Error("userId and secret are required");
    return `${Buffer.from(String(userId)).toString("base64url")}.${tokenSignature(userId, secret)}`;
};

/** Returns the userId for a valid token, else null. */
export const verifyUnsubscribeToken = (token, secret) => {
    const [encoded, signature] = String(token || "").split(".");
    if (!encoded || !signature || !secret) return null;
    const userId = Buffer.from(encoded, "base64url").toString("utf8");
    if (!userId) return null;
    const expected = Buffer.from(tokenSignature(userId, secret));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    return userId;
};

const examLine = (daysLeft) => {
    if (daysLeft == null) return "";
    if (daysLeft <= 0) return "Your exam is today.";
    if (daysLeft === 1) return "Your exam is tomorrow.";
    return `Your exam is in ${daysLeft} days.`;
};

/**
 * @param recipient {name, dueCount, examDaysLeft, examCourseTitle, topics: [{title, dueCount}]}
 */
export const buildReviewReminderEmail = (recipient, { appUrl, unsubscribeUrl }) => {
    const dueCount = Number(recipient.dueCount || 0);
    const daysLeft = recipient.examDaysLeft == null ? null : Number(recipient.examDaysLeft);
    const reviewUrl = `${appUrl}/dashboard/review`;
    const topics = (recipient.topics || []).slice(0, 3);

    const examWhen = daysLeft == null ? "" : daysLeft <= 0 ? "today" : daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`;
    const reviewPart = dueCount > 0 ? `${plural(dueCount, "question")} to review` : "time for a quick review";
    const subject = daysLeft != null && daysLeft <= 7
        ? `Exam ${examWhen}: ${reviewPart}`
        : `${plural(dueCount, "question")} ${dueCount === 1 ? "is" : "are"} due for review`;

    const intro = dueCount > 0
        ? `You have ${plural(dueCount, "question")} you missed before that ${dueCount === 1 ? "is" : "are"} due for review today. A few minutes now helps them stick.`
        : "You have no reviews due, but a short session keeps things fresh before your exam.";
    const exam = daysLeft != null
        ? `${examLine(daysLeft)}${recipient.examCourseTitle ? ` (${recipient.examCourseTitle})` : ""}`
        : "";
    const topicLines = topics.map((topic) => `- ${topic.title}: ${plural(topic.dueCount, "question")}`);

    const text = [
        `Hi ${firstName(recipient.name)},`,
        "",
        intro,
        exam,
        topicLines.length ? `\n${topicLines.join("\n")}` : "",
        "",
        `Start your review: ${reviewUrl}`,
        "",
        `Stop review reminders: ${unsubscribeUrl}`,
    ].filter((line, index, all) => line !== "" || all[index - 1] !== "").join("\n");

    const html = [
        `<p>Hi ${escapeHtml(firstName(recipient.name))},</p>`,
        `<p>${escapeHtml(intro)}</p>`,
        exam ? `<p><strong>${escapeHtml(exam)}</strong></p>` : "",
        topics.length
            ? `<ul>${topics.map((topic) => `<li>${escapeHtml(topic.title)}: ${plural(topic.dueCount, "question")}</li>`).join("")}</ul>`
            : "",
        `<p><a href="${escapeHtml(reviewUrl)}">Start your review</a></p>`,
        `<p style="color:#666;font-size:12px">You get these because review reminders are on. <a href="${escapeHtml(unsubscribeUrl)}">Stop review reminders</a>.</p>`,
    ].join("");

    return { subject, text, html };
};
