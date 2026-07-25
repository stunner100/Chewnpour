import { nanoid } from "nanoid";
import { getPool } from "./db.js";
import {
    callDoclingExtract,
    isDoclingEnabled,
    isDoclingExtractable,
    resolveDoclingParser,
} from "./doclingClient.js";
import {
    callLocalExtract,
    isLocalExtractable,
} from "./localExtract.js";
import {
    createSignedUpload,
    downloadUploadObject,
    getStorageBucket,
} from "./supabase.js";
import { ensureCourseFromUpload } from "./courses.js";
import {
    assertUploadCreditsAvailable,
    chargeUploadIfNeeded,
} from "./billing.js";

const MAX_EXTRACT_TEXT_CHARS = 500_000;

const toClientUpload = (row) => {
    if (!row) return null;
    return {
        id: row.id,
        userId: row.user_id,
        fileName: row.file_name,
        fileType: row.file_type,
        fileSize: Number(row.file_size || 0),
        contentType: row.content_type || null,
        status: row.status,
        processingStep: row.processing_step || null,
        extractionStatus: row.extraction_status || null,
        extractedTextPreview: row.extracted_text
            ? String(row.extracted_text).slice(0, 400)
            : "",
        charCount: row.char_count == null ? null : Number(row.char_count),
        pageCount: row.page_count == null ? null : Number(row.page_count),
        extractionBackend: row.extraction_backend || null,
        extractionParser: row.extraction_parser || null,
        extractionWarnings: row.extraction_warnings || [],
        errorMessage: row.error_message || null,
        createdAt: row.created_at ? new Date(row.created_at).getTime() : null,
        updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : null,
    };
};

const toClientUploadWithCourse = async (row) => {
    const upload = toClientUpload(row);
    if (!upload || row.status !== "ready") {
        return upload;
    }
    try {
        const course = await ensureCourseFromUpload({
            userId: row.user_id,
            uploadId: row.id,
            fileName: row.file_name,
            extractedText: row.extracted_text || "",
        });
        return {
            ...upload,
            courseId: course?.id || null,
            topicCount: course?.topicCount || 0,
            quizzesReady: course?.quizzesReady || 0,
        };
    } catch (error) {
        console.warn("[uploads] failed to ensure course from upload", {
            uploadId: row.id,
            message: error?.message || String(error),
        });
        return upload;
    }
};

export const listUploadsForUser = async (userId, { limit = 20 } = {}) => {
    const db = getPool();
    const result = await db.query(
        `SELECT *
         FROM uploads
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, Math.max(1, Math.min(100, Number(limit) || 20))],
    );
    return result.rows.map(toClientUpload);
};

export const getUploadForUser = async (userId, uploadId) => {
    const db = getPool();
    const result = await db.query(
        `SELECT * FROM uploads WHERE id = $1 AND user_id = $2 LIMIT 1`,
        [uploadId, userId],
    );
    return toClientUpload(result.rows[0] || null);
};

const getUploadRowForUser = async (userId, uploadId) => {
    const db = getPool();
    const result = await db.query(
        `SELECT * FROM uploads WHERE id = $1 AND user_id = $2 LIMIT 1`,
        [uploadId, userId],
    );
    return result.rows[0] || null;
};

export const initUploadForUser = async ({
    userId,
    fileName,
    fileType,
    fileSize,
    contentType,
}) => {
    const id = nanoid();
    const bucket = getStorageBucket();
    const safeName = String(fileName || "upload")
        .replace(/[^a-zA-Z0-9._-]+/g, "_")
        .slice(0, 120);
    const storagePath = `${userId}/${id}-${safeName}`;

    const signed = await createSignedUpload({ path: storagePath, upsert: false });
    const db = getPool();
    const inserted = await db.query(
        `INSERT INTO uploads (
            id,
            user_id,
            file_name,
            file_type,
            file_size,
            content_type,
            storage_bucket,
            storage_path,
            status,
            processing_step,
            extraction_status
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending','awaiting_upload','pending')
         RETURNING *`,
        [
            id,
            userId,
            String(fileName || "upload").slice(0, 255),
            String(fileType || "bin").slice(0, 32),
            Math.max(0, Number(fileSize) || 0),
            contentType || null,
            signed.bucket || bucket,
            signed.path || storagePath,
        ],
    );

    return {
        upload: toClientUpload(inserted.rows[0]),
        signedUrl: signed.signedUrl,
        token: signed.token,
        path: signed.path || storagePath,
        bucket: signed.bucket || bucket,
    };
};

const updateUploadRow = async (uploadId, fields) => {
    const setFragments = [];
    const values = [];
    let index = 1;

    for (const [column, value] of Object.entries(fields)) {
        setFragments.push(`${column} = $${index}`);
        values.push(value);
        index += 1;
    }
    setFragments.push("updated_at = NOW()");
    values.push(uploadId);

    const db = getPool();
    const result = await db.query(
        `UPDATE uploads
         SET ${setFragments.join(", ")}
         WHERE id = $${index}
         RETURNING *`,
        values,
    );
    return result.rows[0] || null;
};

const persistExtractedUpload = async (uploadId, payload) => {
    const text = String(payload?.text || "").slice(0, MAX_EXTRACT_TEXT_CHARS);
    return updateUploadRow(uploadId, {
        status: "ready",
        processing_step: "ready",
        extraction_status: "complete",
        extracted_text: text || null,
        char_count: text.length,
        page_count: Number.isFinite(Number(payload?.pageCount))
            ? Number(payload.pageCount)
            : null,
        extraction_backend: payload?.backend || "local",
        extraction_parser: payload?.parser || null,
        extraction_warnings: JSON.stringify(payload?.warnings || []),
        error_message: null,
    });
};

const tryLocalExtract = async ({ row, fileBuffer }) => {
    if (!isLocalExtractable({
        fileType: row.file_type,
        contentType: row.content_type,
        fileName: row.file_name,
    })) {
        return null;
    }
    return callLocalExtract({
        fileName: row.file_name,
        contentType: row.content_type || "application/octet-stream",
        fileType: row.file_type,
        fileBuffer,
    });
};

export const finalizeUploadForUser = async (userId, uploadId) => {
    const row = await getUploadRowForUser(userId, uploadId);
    if (!row) {
        const error = new Error("Upload not found");
        error.status = 404;
        throw error;
    }

    if (row.status === "ready") {
        return toClientUploadWithCourse(row);
    }

    await assertUploadCreditsAvailable(userId);

    await updateUploadRow(uploadId, {
        status: "extracting",
        processing_step: "downloading",
        extraction_status: "running",
        error_message: null,
    });

    const finishReady = async (readyRow) => {
        await chargeUploadIfNeeded({ userId, uploadId });
        return toClientUploadWithCourse(readyRow);
    };

    let fileBuffer;
    try {
        fileBuffer = await downloadUploadObject({
            bucket: row.storage_bucket,
            path: row.storage_path,
        });
    } catch (error) {
        const failed = await updateUploadRow(uploadId, {
            status: "error",
            processing_step: "download_failed",
            extraction_status: "failed",
            error_message: error.message || "Download failed",
        });
        return toClientUpload(failed);
    }

    const meta = {
        fileType: row.file_type,
        contentType: row.content_type,
        fileName: row.file_name,
    };
    const doclingCapable = isDoclingExtractable(meta);
    const localCapable = isLocalExtractable(meta);

    if (!doclingCapable && !localCapable) {
        const deferred = await updateUploadRow(uploadId, {
            status: "ready",
            processing_step: "ready",
            extraction_status: "deferred",
            extraction_warnings: JSON.stringify([
                "Extraction is not available for this file type yet.",
            ]),
            extracted_text: null,
            char_count: 0,
            page_count: null,
            extraction_backend: null,
            extraction_parser: null,
        });
        return finishReady(deferred);
    }

    await updateUploadRow(uploadId, {
        processing_step: "extracting",
        extraction_status: "running",
    });

    const extractionErrors = [];

    if (isDoclingEnabled() && doclingCapable) {
        try {
            const parser = resolveDoclingParser(meta);
            const payload = await callDoclingExtract({
                fileName: row.file_name,
                contentType: row.content_type || "application/octet-stream",
                fileBuffer,
                parser,
            });
            const ready = await persistExtractedUpload(uploadId, {
                text: payload?.text,
                pageCount: payload?.pageCount,
                backend: payload?.backend || "docling",
                parser: payload?.parser || parser,
                warnings: payload?.warnings || [],
            });
            return finishReady(ready);
        } catch (error) {
            extractionErrors.push(error.message || "Docling extraction failed");
            console.warn("[uploads] Docling extract failed; trying local fallback", {
                uploadId,
                message: error?.message || String(error),
            });
        }
    }

    if (localCapable) {
        try {
            const payload = await tryLocalExtract({ row, fileBuffer });
            if (payload) {
                const warnings = [...(payload.warnings || [])];
                if (extractionErrors.length > 0) {
                    warnings.unshift(
                        `Docling unavailable (${extractionErrors[0]}). Used local text extraction.`,
                    );
                }
                const ready = await persistExtractedUpload(uploadId, {
                    ...payload,
                    warnings,
                });
                return finishReady(ready);
            }
        } catch (error) {
            extractionErrors.push(error.message || "Local extraction failed");
        }
    }

    // Images (and similar) that Docling could OCR, but we have no OCR host.
    if (doclingCapable && !localCapable) {
        const deferred = await updateUploadRow(uploadId, {
            status: "ready",
            processing_step: "ready",
            extraction_status: "deferred",
            extraction_warnings: JSON.stringify([
                "This file needs OCR. Local text extraction cannot read it; connect a cloud OCR service later.",
            ]),
            extracted_text: null,
            char_count: 0,
            page_count: null,
            extraction_backend: null,
            extraction_parser: null,
        });
        return finishReady(deferred);
    }

    const failed = await updateUploadRow(uploadId, {
        status: "error",
        processing_step: "extract_failed",
        extraction_status: "failed",
        error_message: extractionErrors.filter(Boolean).join(" | ") || "Extraction failed",
    });
    return toClientUpload(failed);
};
