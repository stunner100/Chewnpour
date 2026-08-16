import { nanoid } from "nanoid";
import { getPool } from "./db.js";
import {
    callAnydocExtract,
    isAnydocExtractable,
    isAnydocUnsupportedError,
} from "./anydocClient.js";
import {
    callLocalExtract,
    isLocalExtractable,
} from "./localExtract.js";
import {
    callOcrSpace,
    isOcrSpaceEnabled,
} from "./ocrSpaceClient.js";
import {
    callDeepgramTranscribe,
    isAudioUploadType,
    isDeepgramTranscribeEnabled,
} from "./deepgramTranscribe.js";
import {
    createSignedDownloadUrl,
    createSignedUpload,
    deleteUploadObject,
    downloadUploadObject,
    getStorageBucket,
} from "./supabase.js";
import { ensureCourseFromUpload } from "./courses.js";
import { buildTransformedExportZip } from "./materialExport.js";

const EXTRACTION_FAILED_MESSAGE =
    "Could not extract text from this file. Upload a text-based PDF, DOCX, or PPTX, a scanned PDF with OCR configured, or an audio lecture for transcription.";

const UNSUPPORTED_TYPE_MESSAGE =
    "Only PDF, DOCX, PPTX, and audio (MP3, M4A, WAV, WEBM, OGG, AAC, FLAC) files are supported right now.";

const OCR_UNSUPPORTED_HINT =
    "Anydoc reported an unsupported or image-only document.";

const MAX_EXTRACT_TEXT_CHARS = 500_000;

const ALLOWED_STUDY_FILE_TYPES = new Set([
    "pdf",
    "docx",
    "pptx",
    "mp3",
    "m4a",
    "wav",
    "webm",
    "ogg",
    "aac",
    "flac",
]);

export const isAllowedStudyUploadType = ({
    fileType = "",
    contentType = "",
    fileName = "",
} = {}) => {
    const source = `${fileType} ${contentType} ${fileName}`.toLowerCase();
    if (source.includes("image") || /\.(png|jpe?g|webp|gif)\b/.test(source)) {
        return false;
    }
    if (isAudioUploadType({ fileType, contentType, fileName })) {
        return true;
    }
    const normalizedType = String(fileType || "").trim().toLowerCase();
    if (ALLOWED_STUDY_FILE_TYPES.has(normalizedType)) return true;
    return (
        source.includes("pdf") ||
        source.includes("docx") ||
        source.includes("wordprocessingml") ||
        source.includes("pptx") ||
        source.includes("presentationml") ||
        /\.(pdf|docx|pptx)\b/.test(source)
    );
};

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
        canExport: Boolean(
            row.status === "ready" &&
                row.extraction_status === "complete" &&
                String(row.extracted_text || "").trim(),
        ),
        createdAt: row.created_at ? new Date(row.created_at).getTime() : null,
        updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : null,
    };
};

const hasCompleteExtract = (row) =>
    Boolean(
        row &&
            row.status === "ready" &&
            row.extraction_status === "complete" &&
            Number(row.char_count || 0) > 0 &&
            String(row.extracted_text || "").trim(),
    );

const toClientUploadWithCourse = async (row) => {
    const upload = toClientUpload(row);
    if (!upload || !hasCompleteExtract(row)) {
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
            firstTopicId: course?.firstTopicId || null,
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

const notFoundUploadError = () => {
    const error = new Error("Upload not found");
    error.status = 404;
    error.code = "UPLOAD_NOT_FOUND";
    return error;
};

export const exportTransformedContentForUser = async (userId, uploadId) => {
    const row = await getUploadRowForUser(userId, uploadId);
    if (!row) throw notFoundUploadError();

    const extractedText = String(row.extracted_text || "").trim();
    if (!extractedText) {
        const error = new Error("Transformed content is not ready yet.");
        error.status = 409;
        error.code = "EXPORT_NOT_READY";
        throw error;
    }

    const db = getPool();
    const courseResult = await db.query(
        `SELECT id, title FROM courses WHERE user_id = $1 AND upload_id = $2 LIMIT 1`,
        [userId, uploadId],
    );
    const course = courseResult.rows[0] || null;
    let topics = [];
    let quizzes = [];

    if (course?.id) {
        const topicsResult = await db.query(
            `SELECT title, description, content, sort_order
             FROM topics
             WHERE course_id = $1 AND user_id = $2
             ORDER BY sort_order ASC, created_at ASC`,
            [course.id, userId],
        );
        topics = topicsResult.rows;
        const quizzesResult = await db.query(
            `SELECT
                q.prompt,
                q.options,
                q.correct_index,
                q.explanation,
                q.surface,
                t.title AS topic_title
             FROM questions q
             JOIN topics t ON t.id = q.topic_id
             WHERE t.course_id = $1 AND t.user_id = $2
             ORDER BY t.sort_order ASC, q.sort_order ASC, q.created_at ASC`,
            [course.id, userId],
        );
        quizzes = quizzesResult.rows.map((question) => ({
            topicTitle: question.topic_title || "",
            prompt: question.prompt || "",
            options: question.options,
            correctIndex: Number(question.correct_index || 0),
            explanation: question.explanation || "",
            surface: question.surface || "quiz",
        }));
    }

    return buildTransformedExportZip({
        fileName: row.file_name,
        title: course?.title || row.file_name,
        extractedText,
        pageCount: row.page_count,
        charCount: row.char_count,
        topics,
        quizzes,
    });
};

export const getOriginalDownloadForUser = async (userId, uploadId) => {
    const row = await getUploadRowForUser(userId, uploadId);
    if (!row) throw notFoundUploadError();
    if (!row.storage_path) {
        const error = new Error("Original file is not available.");
        error.status = 404;
        error.code = "ORIGINAL_MISSING";
        throw error;
    }

    const signed = await createSignedDownloadUrl({
        bucket: row.storage_bucket,
        path: row.storage_path,
        expiresIn: 120,
    });
    return {
        url: signed.signedUrl,
        fileName: row.file_name,
    };
};

export const initUploadForUser = async ({
    userId,
    fileName,
    fileType,
    fileSize,
    contentType,
}) => {
    if (
        !isAllowedStudyUploadType({
            fileType,
            contentType,
            fileName,
        })
    ) {
        const error = new Error(UNSUPPORTED_TYPE_MESSAGE);
        error.status = 400;
        error.code = "UNSUPPORTED_FILE_TYPE";
        throw error;
    }

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

const persistExtractionFailure = async (uploadId, message, warnings = []) => {
    return updateUploadRow(uploadId, {
        status: "error",
        processing_step: "extract_failed",
        extraction_status: "failed",
        extracted_text: null,
        char_count: 0,
        page_count: null,
        extraction_backend: null,
        extraction_parser: null,
        extraction_warnings: JSON.stringify(warnings),
        error_message: message || EXTRACTION_FAILED_MESSAGE,
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

const tryDeepgramTranscribe = async ({ row, fileBuffer }) => {
    await updateUploadRow(row.id, {
        processing_step: "transcribing",
        extraction_status: "running",
    });

    if (!isDeepgramTranscribeEnabled()) {
        return persistExtractionFailure(
            row.id,
            "Audio upload received, but transcription is not configured (DEEPGRAM_API_KEY).",
            ["Deepgram listen is not configured."],
        );
    }

    try {
        const payload = await callDeepgramTranscribe({
            fileBuffer,
            contentType: row.content_type || "audio/mpeg",
            fileName: row.file_name,
        });
        if (payload?.skipped) {
            return persistExtractionFailure(
                row.id,
                EXTRACTION_FAILED_MESSAGE,
                [payload.reason || "deepgram_skipped"],
            );
        }
        const text = String(payload?.text || "").trim();
        if (!text) {
            return persistExtractionFailure(
                row.id,
                "Transcription finished but no speech was detected in this audio file.",
                payload?.warnings || [],
            );
        }
        return persistExtractedUpload(row.id, {
            text,
            pageCount: null,
            backend: payload?.backend || "deepgram",
            parser: payload?.parser || "listen",
            warnings: [
                ...(payload?.warnings || []),
                "Transcribed with Deepgram.",
            ],
        });
    } catch (error) {
        console.warn("[uploads] Deepgram transcription failed", {
            uploadId: row.id,
            message: error?.message || String(error),
        });
        return persistExtractionFailure(
            row.id,
            `Transcription failed: ${error?.message || "unknown error"}`,
            [],
        );
    }
};

const tryOcrSpaceFallback = async ({ row, fileBuffer, priorWarnings = [] }) => {
    await updateUploadRow(row.id, {
        processing_step: "ocr",
        extraction_status: "running",
    });

    if (!isOcrSpaceEnabled()) {
        return persistExtractionFailure(
            row.id,
            "Scanned or image-only document. OCR is not configured. Upload a text-based PDF, DOCX, or PPTX.",
            [
                ...priorWarnings,
                "OCR.space is not configured (OCR_SPACE_API_KEY).",
            ],
        );
    }

    try {
        const payload = await callOcrSpace({
            fileBuffer,
            contentType: row.content_type || "application/pdf",
            fileName: row.file_name,
            fileType: row.file_type,
        });
        if (payload?.skipped) {
            return persistExtractionFailure(
                row.id,
                EXTRACTION_FAILED_MESSAGE,
                [...priorWarnings, payload.reason || "ocr_space_skipped"],
            );
        }
        const text = String(payload?.text || "").trim();
        if (!text) {
            return persistExtractionFailure(
                row.id,
                "OCR ran but found no readable text in this document.",
                [...priorWarnings, ...(payload?.warnings || [])],
            );
        }
        return persistExtractedUpload(row.id, {
            text,
            pageCount: payload?.pageCount,
            backend: payload?.backend || "ocr_space",
            parser: payload?.parser || "ocr.space",
            warnings: [
                ...priorWarnings,
                ...(payload?.warnings || []),
                "Used OCR.space because selectable text was unavailable.",
            ],
        });
    } catch (error) {
        console.warn("[uploads] OCR.space failed", {
            uploadId: row.id,
            message: error?.message || String(error),
        });
        return persistExtractionFailure(
            row.id,
            `OCR failed: ${error?.message || "unknown error"}`,
            priorWarnings,
        );
    }
};

const finishReadyIfComplete = async ({ readyRow }) => {
    if (!hasCompleteExtract(readyRow)) {
        return toClientUpload(readyRow);
    }
    return toClientUploadWithCourse(readyRow);
};

export const finalizeUploadForUser = async (userId, uploadId) => {
    const row = await getUploadRowForUser(userId, uploadId);
    if (!row) {
        const error = new Error("Upload not found");
        error.status = 404;
        throw error;
    }

    if (row.status === "ready" && hasCompleteExtract(row)) {
        return toClientUploadWithCourse(row);
    }

    if (row.status === "ready" && !hasCompleteExtract(row)) {
        // Legacy deferred/ready-without-text rows: treat as failed until re-finalized.
        const failed = await persistExtractionFailure(
            uploadId,
            EXTRACTION_FAILED_MESSAGE,
            Array.isArray(row.extraction_warnings) ? row.extraction_warnings : [],
        );
        return toClientUpload(failed);
    }

    const claimed = await getPool().query(
        `UPDATE uploads
         SET status = 'extracting',
             processing_step = 'downloading',
             extraction_status = 'running',
             error_message = NULL,
             updated_at = NOW()
         WHERE id = $1
           AND user_id = $2
           AND status IN ('pending', 'error', 'extracting')
         RETURNING *`,
        [uploadId, userId],
    );
    if (!claimed.rows[0]) {
        const latest = await getUploadRowForUser(userId, uploadId);
        if (latest && hasCompleteExtract(latest)) {
            return toClientUploadWithCourse(latest);
        }
        const error = new Error("Upload is already being processed.");
        error.status = 409;
        throw error;
    }

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
    const audioUpload = isAudioUploadType(meta);
    if (audioUpload) {
        const readyOrFailed = await tryDeepgramTranscribe({ row, fileBuffer });
        return finishReadyIfComplete({
            userId,
            uploadId,
            readyRow: readyOrFailed,
        });
    }

    const anydocCapable = isAnydocExtractable(meta);
    const localCapable = isLocalExtractable(meta);

    if (!anydocCapable && !localCapable) {
        const failed = await persistExtractionFailure(
            uploadId,
            UNSUPPORTED_TYPE_MESSAGE,
            ["Extraction is not available for this file type."],
        );
        return toClientUpload(failed);
    }

    await updateUploadRow(uploadId, {
        processing_step: "extracting",
        extraction_status: "running",
    });

    const extractionErrors = [];

    if (anydocCapable) {
        try {
            const payload = await callAnydocExtract({
                fileName: row.file_name,
                contentType: row.content_type || "application/octet-stream",
                fileType: row.file_type,
                fileBuffer,
            });
            const text = String(payload?.text || "").trim();
            if (!text) {
                const readyOrFailed = await tryOcrSpaceFallback({
                    row,
                    fileBuffer,
                    priorWarnings: [
                        "Anydoc returned no selectable text.",
                        ...(payload?.warnings || []),
                    ],
                });
                return finishReadyIfComplete({
                    userId,
                    uploadId,
                    readyRow: readyOrFailed,
                });
            }
            const ready = await persistExtractedUpload(uploadId, {
                text,
                pageCount: payload?.pageCount,
                backend: payload?.backend || "anydoc",
                parser: payload?.parser || "anydoc",
                warnings: payload?.warnings || [],
            });
            return finishReadyIfComplete({ userId, uploadId, readyRow: ready });
        } catch (error) {
            if (isAnydocUnsupportedError(error)) {
                console.warn("[uploads] Anydoc unsupported (likely scanned); trying OCR.space", {
                    uploadId,
                    message: error?.message || String(error),
                });
                const readyOrFailed = await tryOcrSpaceFallback({
                    row,
                    fileBuffer,
                    priorWarnings: [OCR_UNSUPPORTED_HINT],
                });
                return finishReadyIfComplete({
                    userId,
                    uploadId,
                    readyRow: readyOrFailed,
                });
            }
            extractionErrors.push(error.message || "Anydoc extraction failed");
            console.warn("[uploads] Anydoc extract failed; trying local fallback", {
                uploadId,
                message: error?.message || String(error),
            });
        }
    }

    if (localCapable) {
        try {
            const payload = await tryLocalExtract({ row, fileBuffer });
            if (payload) {
                const text = String(payload?.text || "").trim();
                if (!text) {
                    const readyOrFailed = await tryOcrSpaceFallback({
                        row,
                        fileBuffer,
                        priorWarnings: [
                            "Local extract found no selectable text.",
                            ...(payload?.warnings || []),
                        ],
                    });
                    return finishReadyIfComplete({
                        userId,
                        uploadId,
                        readyRow: readyOrFailed,
                    });
                }
                const warnings = [...(payload.warnings || [])];
                if (extractionErrors.length > 0) {
                    warnings.unshift(
                        `Anydoc unavailable (${extractionErrors[0]}). Used local text extraction.`,
                    );
                }
                const ready = await persistExtractedUpload(uploadId, {
                    ...payload,
                    warnings,
                });
                return finishReadyIfComplete({ userId, uploadId, readyRow: ready });
            }
        } catch (error) {
            extractionErrors.push(error.message || "Local extraction failed");
        }
    }

    if (anydocCapable) {
        const readyOrFailed = await tryOcrSpaceFallback({
            row,
            fileBuffer,
            priorWarnings: extractionErrors,
        });
        return finishReadyIfComplete({
            userId,
            uploadId,
            readyRow: readyOrFailed,
        });
    }

    const failed = await persistExtractionFailure(
        uploadId,
        extractionErrors.filter(Boolean).join(" | ") || EXTRACTION_FAILED_MESSAGE,
        extractionErrors,
    );
    return toClientUpload(failed);
};

export const deleteUploadForUser = async (userId, uploadId) => {
    const row = await getUploadRowForUser(userId, uploadId);
    if (!row) {
        const error = new Error("Upload not found");
        error.status = 404;
        throw error;
    }

    const db = getPool();
    const courses = await db.query(
        `SELECT id FROM courses WHERE user_id = $1 AND upload_id = $2`,
        [userId, uploadId],
    );
    for (const course of courses.rows) {
        await db.query(`DELETE FROM courses WHERE id = $1 AND user_id = $2`, [
            course.id,
            userId,
        ]);
    }

    try {
        await deleteUploadObject({
            bucket: row.storage_bucket,
            path: row.storage_path,
        });
    } catch (error) {
        console.warn("[uploads] storage delete failed; continuing with DB delete", {
            uploadId,
            message: error?.message || String(error),
        });
    }

    await db.query(`DELETE FROM uploads WHERE id = $1 AND user_id = $2`, [
        uploadId,
        userId,
    ]);

    return { deleted: true, uploadId };
};
