import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Check for at-risk and broken streaks every 6 hours
crons.interval(
    "streak email check",
    { hours: 6 },
    internal.emails.checkStreaksAndNotify,
);

// Send weekly study summary every Monday at 08:00 UTC
crons.cron(
    "weekly study summary",
    "0 8 * * 1",
    internal.emails.sendWeeklySummary,
);

// Send product research outreach weekly to eligible, opted-in users.
crons.cron(
    "product research outreach",
    "0 13 * * 2",
    internal.productResearchEmails.sendOutreachEmails,
);

// Rebase stale question-bank targets after generation has clearly stalled.
crons.interval(
    "question bank target audit",
    { hours: 12 },
    internal.grounded.runStaleQuestionBankTargetAudit,
);

crons.interval(
    "stale payment reconciliation",
    { hours: 1 },
    internal.subscriptions.reconcileStalePaystackPaymentsInternal,
);

// Fail any Seedance video job stuck in "running" beyond the internal timeout.
crons.interval(
    "topic video stuck-job sweep",
    { minutes: 5 },
    internal.videos.sweepStuckJobsInternal,
);

export default crons;
