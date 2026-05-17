import { ConvexError } from "convex/values";

const BLOCKED_UPLOAD_STATUSES = new Set(["error", "failed"]);
const BLOCKED_COURSE_UPLOAD_STATUSES = new Set(["error", "failed"]);

const normalizeStatus = (value: unknown) => String(value || "").trim().toLowerCase();

const safeGet = async (ctx: any, id: any) => {
    if (!id) return null;
    try {
        return await ctx.db.get(id);
    } catch {
        return null;
    }
};

const getCourseUploadLink = async (ctx: any, courseId: any, uploadId: any) => {
    if (!courseId || !uploadId) return null;
    try {
        return await ctx.db
            .query("courseUploads")
            .withIndex("by_courseId_uploadId", (q: any) =>
                q.eq("courseId", courseId).eq("uploadId", uploadId)
            )
            .first();
    } catch {
        return null;
    }
};

const blockedAvailability = (
    reason: string,
    details: Record<string, unknown> = {},
) => ({
    available: false,
    reason,
    ...details,
});

export const isTopicStudyAvailable = async (ctx: any, topic: any) => {
    if (!topic) {
        return blockedAvailability("topic_missing");
    }

    const course = await safeGet(ctx, topic.courseId);
    if (!course) {
        return blockedAvailability("course_missing");
    }

    const sourceUploadId = topic.sourceUploadId || course.uploadId || null;
    if (!sourceUploadId) {
        return {
            available: true,
            reason: "no_source_upload",
        };
    }

    const upload = await safeGet(ctx, sourceUploadId);
    if (!upload) {
        return blockedAvailability("source_upload_missing", { uploadId: sourceUploadId });
    }

    const uploadStatus = normalizeStatus(upload.status);
    if (BLOCKED_UPLOAD_STATUSES.has(uploadStatus)) {
        return blockedAvailability("source_upload_unavailable", {
            uploadId: sourceUploadId,
            uploadStatus: upload.status,
            errorMessage: upload.errorMessage || "",
        });
    }

    const link = await getCourseUploadLink(ctx, topic.courseId, sourceUploadId);
    const linkStatus = normalizeStatus(link?.status);
    if (link && BLOCKED_COURSE_UPLOAD_STATUSES.has(linkStatus)) {
        return blockedAvailability("course_upload_unavailable", {
            uploadId: sourceUploadId,
            linkStatus: link.status,
        });
    }

    return {
        available: true,
        reason: "ready",
        uploadId: sourceUploadId,
        uploadStatus: upload.status,
    };
};

export const filterStudyAvailableTopics = async (ctx: any, topics: any[]) => {
    const availableTopics = [];
    for (const topic of Array.isArray(topics) ? topics : []) {
        const availability = await isTopicStudyAvailable(ctx, topic);
        if (availability.available) {
            availableTopics.push(topic);
        }
    }
    return availableTopics;
};

export const assertTopicStudyAvailableOrThrow = async (ctx: any, topic: any) => {
    const availability = await isTopicStudyAvailable(ctx, topic);
    if (availability.available) return availability;

    throw new ConvexError({
        code: "STUDY_CONTENT_UNAVAILABLE",
        message:
            "This study content is unavailable because its source material did not pass processing quality checks.",
        reason: availability.reason,
    });
};
