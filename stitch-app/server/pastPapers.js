import { nanoid } from "nanoid";
import { getPool } from "./db.js";
import {
    createSignedDownloadUrl,
    createSignedUpload,
    deleteUploadObject,
    downloadUploadObject,
    uploadObject,
} from "./supabase.js";
import { finalizeUploadForUser } from "./uploads.js";

export const PAST_PAPERS_BUCKET = "past-papers";
export const MAX_PAST_PAPER_BYTES = 50 * 1024 * 1024;
const LIST_LIMIT = 200;

const httpError = (status, message, code) => {
    const error = new Error(message);
    error.status = status;
    if (code) error.code = code;
    return error;
};

const cleanText = (value, maxLength) =>
    String(value ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maxLength);

export const normalizeCourseCode = (value) =>
    cleanText(value, 40).toUpperCase();

// "csc201" and "CSC 201" should find the same paper.
export const compactCourseCode = (value) =>
    String(value ?? "").replace(/\s+/g, "").toUpperCase();

const escapeLike = (value) => String(value).replace(/[\\%_]/g, (char) => `\\${char}`);

const PAST_PAPER_TYPES = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    png: "image/png",
    jpg: "image/jpeg",
    webp: "image/webp",
};

// Photos of papers can be viewed and downloaded, but the study pipeline does
// not extract text from images, so they cannot be practised as an exam.
export const isPracticablePastPaperType = (fileType) =>
    fileType === "pdf" || fileType === "docx";

export const resolvePastPaperFileType = ({ fileName = "", contentType = "" } = {}) => {
    const rawExtension = String(fileName).toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || "";
    const extension = rawExtension === "jpeg" ? "jpg" : rawExtension;
    const mime = String(contentType || "").trim().toLowerCase();
    for (const [type, typeMime] of Object.entries(PAST_PAPER_TYPES)) {
        if (extension === type || mime === typeMime) {
            return { fileType: type, contentType: typeMime };
        }
    }
    return null;
};

/**
 * Validate admin-entered paper metadata. With `partial`, only the provided
 * fields are validated and returned (for edits).
 */
export const normalizePastPaperInput = (input = {}, { partial = false, now = new Date() } = {}) => {
    const out = {};
    const has = (key) => Object.prototype.hasOwnProperty.call(input, key);
    const maxYear = now.getUTCFullYear() + 1;

    if (!partial || has("institution")) {
        out.institution = cleanText(input.institution, 120);
        if (!out.institution) throw httpError(400, "Institution is required.", "INVALID_INSTITUTION");
    }
    if (!partial || has("courseCode")) {
        out.courseCode = normalizeCourseCode(input.courseCode);
        if (!out.courseCode) throw httpError(400, "Course code is required.", "INVALID_COURSE_CODE");
    }
    if (!partial || has("courseTitle")) {
        out.courseTitle = cleanText(input.courseTitle, 160);
    }
    if (!partial || has("year")) {
        const year = Number(input.year);
        if (!Number.isInteger(year) || year < 1950 || year > maxYear) {
            throw httpError(400, `Year must be between 1950 and ${maxYear}.`, "INVALID_YEAR");
        }
        out.year = year;
    }
    if (!partial || has("semester")) {
        out.semester = cleanText(input.semester, 60);
    }
    if (!partial || has("level")) {
        out.level = cleanText(input.level, 40);
    }
    if (has("status")) {
        if (!["draft", "published"].includes(input.status)) {
            throw httpError(400, "Status must be draft or published.", "INVALID_STATUS");
        }
        out.status = input.status;
    }
    return out;
};

const COLUMN_BY_FIELD = {
    institution: "institution",
    courseCode: "course_code",
    courseTitle: "course_title",
    year: "year",
    semester: "semester",
    level: "level",
    status: "status",
};

/**
 * Build the student browse query. Only published papers are ever visible.
 */
export const buildPastPaperListQuery = ({ institution, courseCode, year, q } = {}) => {
    const where = [`status = 'published'`];
    const values = [];
    const push = (value) => {
        values.push(value);
        return `$${values.length}`;
    };

    const cleanInstitution = cleanText(institution, 120);
    if (cleanInstitution) {
        where.push(`institution = ${push(cleanInstitution)}`);
    }
    const cleanCode = compactCourseCode(courseCode);
    if (cleanCode) {
        where.push(`REPLACE(course_code, ' ', '') = ${push(cleanCode)}`);
    }
    const numericYear = Number(year);
    if (year !== undefined && year !== null && year !== "" && Number.isInteger(numericYear)) {
        where.push(`year = ${push(numericYear)}`);
    }
    const search = cleanText(q, 80);
    if (search) {
        const codeParam = push(`%${escapeLike(compactCourseCode(search))}%`);
        const textParam = push(`%${escapeLike(search)}%`);
        where.push(
            `(REPLACE(course_code, ' ', '') LIKE ${codeParam} OR course_title ILIKE ${textParam} OR institution ILIKE ${textParam})`,
        );
    }

    return {
        text: `SELECT * FROM past_papers WHERE ${where.join(" AND ")}
               ORDER BY institution ASC, course_code ASC, year DESC, semester ASC
               LIMIT ${LIST_LIMIT}`,
        values,
    };
};

export const practiceFileNameFor = (paper) => {
    const parts = [
        paper.course_code,
        paper.course_title,
        paper.year,
        paper.semester,
        "past paper",
    ]
        .map((part) => cleanText(part, 160))
        .filter(Boolean);
    return `${parts.join(" - ")}.${paper.file_type || "pdf"}`.slice(0, 255);
};

export const toClientPastPaper = (row, { admin = false } = {}) => {
    if (!row) return null;
    const paper = {
        id: row.id,
        institution: row.institution,
        courseCode: row.course_code,
        courseTitle: row.course_title || "",
        year: Number(row.year),
        semester: row.semester || "",
        level: row.level || "",
        fileType: row.file_type,
        fileSize: Number(row.file_size || 0),
        canPractice: isPracticablePastPaperType(row.file_type),
    };
    if (admin) {
        paper.status = row.status;
        paper.fileName = row.file_name;
        paper.createdAt = row.created_at ? new Date(row.created_at).getTime() : null;
        paper.updatedAt = row.updated_at ? new Date(row.updated_at).getTime() : null;
    }
    return paper;
};

// ---------------------------------------------------------------- students

export const listPublishedPastPapers = async (filters = {}) => {
    const db = getPool();
    const query = buildPastPaperListQuery(filters);
    const [papers, institutions] = await Promise.all([
        db.query(query.text, query.values),
        db.query(
            `SELECT institution, COUNT(*)::int AS count
             FROM past_papers
             WHERE status = 'published'
             GROUP BY institution
             ORDER BY institution ASC`,
        ),
    ]);
    return {
        papers: papers.rows.map((row) => toClientPastPaper(row)),
        institutions: institutions.rows.map((row) => ({
            name: row.institution,
            count: Number(row.count || 0),
        })),
    };
};

const getPublishedPaperRow = async (paperId) => {
    const result = await getPool().query(
        `SELECT * FROM past_papers WHERE id = $1 AND status = 'published' LIMIT 1`,
        [paperId],
    );
    const row = result.rows[0];
    if (!row) throw httpError(404, "Past paper not found.", "PAST_PAPER_NOT_FOUND");
    return row;
};

export const getPastPaperFileUrl = async (paperId, { download = false } = {}) => {
    const row = await getPublishedPaperRow(paperId);
    const fileName = practiceFileNameFor(row);
    const signed = await createSignedDownloadUrl({
        bucket: row.storage_bucket,
        path: row.storage_path,
        expiresIn: 300,
        download: download ? fileName : undefined,
    });
    return { url: signed.signedUrl, fileName };
};

const findPracticeUploadRow = async (userId, paperId) => {
    const result = await getPool().query(
        `SELECT * FROM uploads WHERE user_id = $1 AND source_past_paper_id = $2 LIMIT 1`,
        [userId, paperId],
    );
    return result.rows[0] || null;
};

/**
 * Copy a published paper into the student's own uploads so the normal
 * extraction → course → timed exam pipeline handles practice. Re-running
 * reuses the same copy.
 */
export const startPastPaperPracticeForUser = async (userId, paperId) => {
    const paper = await getPublishedPaperRow(paperId);
    if (!isPracticablePastPaperType(paper.file_type)) {
        throw httpError(400, "Pictures of past papers can be viewed and downloaded, but not practised as an exam.", "PAST_PAPER_NOT_PRACTICABLE");
    }
    let row = await findPracticeUploadRow(userId, paper.id);

    if (!row) {
        const id = nanoid();
        const fileName = practiceFileNameFor(paper);
        const safeName = fileName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
        const storagePath = `${userId}/${id}-${safeName}`;
        const body = await downloadUploadObject({
            bucket: paper.storage_bucket,
            path: paper.storage_path,
        });
        const stored = await uploadObject({
            path: storagePath,
            body,
            contentType: paper.content_type || PAST_PAPER_TYPES[paper.file_type],
        });
        const inserted = await getPool().query(
            `INSERT INTO uploads (
                id, user_id, file_name, file_type, file_size, content_type,
                storage_bucket, storage_path, status, processing_step,
                extraction_status, source_past_paper_id
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending','awaiting_upload','pending',$9)
             ON CONFLICT (user_id, source_past_paper_id)
                WHERE source_past_paper_id IS NOT NULL
                DO NOTHING
             RETURNING *`,
            [
                id,
                userId,
                fileName,
                paper.file_type,
                body.byteLength || Number(paper.file_size || 0),
                paper.content_type || PAST_PAPER_TYPES[paper.file_type],
                stored.bucket,
                stored.path,
                paper.id,
            ],
        );
        row = inserted.rows[0] || null;
        if (!row) {
            // A concurrent request created the copy first; drop ours.
            await deleteUploadObject({ bucket: stored.bucket, path: stored.path }).catch(() => {});
            row = await findPracticeUploadRow(userId, paper.id);
        }
    }

    try {
        const upload = await finalizeUploadForUser(userId, row.id);
        return { upload, processing: false };
    } catch (error) {
        if (Number(error?.status) === 409) {
            return { upload: { id: row.id, status: "extracting" }, processing: true };
        }
        throw error;
    }
};

// ------------------------------------------------------------------ admins

export const listAllPastPapers = async () => {
    const result = await getPool().query(
        `SELECT * FROM past_papers ORDER BY created_at DESC LIMIT 500`,
    );
    return result.rows.map((row) => toClientPastPaper(row, { admin: true }));
};

export const initPastPaperUpload = async ({ adminUserId, input = {} }) => {
    const meta = normalizePastPaperInput(input);
    const fileName = cleanText(input.fileName, 255);
    const fileSize = Number(input.fileSize || 0);
    const type = resolvePastPaperFileType({ fileName, contentType: input.contentType });
    if (!fileName || !type) {
        throw httpError(400, "Upload a PDF, DOCX, or picture (PNG, JPG, WEBP).", "UNSUPPORTED_FILE_TYPE");
    }
    if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_PAST_PAPER_BYTES) {
        throw httpError(400, "File must be smaller than 50MB.", "INVALID_FILE_SIZE");
    }

    const id = nanoid();
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
    const storagePath = `${id}/${safeName}`;
    const signed = await createSignedUpload({
        path: storagePath,
        bucket: PAST_PAPERS_BUCKET,
    });
    const inserted = await getPool().query(
        `INSERT INTO past_papers (
            id, institution, course_code, course_title, year, semester, level,
            file_name, file_type, file_size, content_type, storage_bucket,
            storage_path, status, uploaded_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'draft',$14)
         RETURNING *`,
        [
            id,
            meta.institution,
            meta.courseCode,
            meta.courseTitle,
            meta.year,
            meta.semester,
            meta.level,
            fileName,
            type.fileType,
            fileSize,
            type.contentType,
            signed.bucket,
            signed.path || storagePath,
            adminUserId || null,
        ],
    );
    return {
        paper: toClientPastPaper(inserted.rows[0], { admin: true }),
        signedUrl: signed.signedUrl,
        contentType: type.contentType,
    };
};

export const updatePastPaper = async (paperId, input = {}) => {
    const fields = normalizePastPaperInput(input, { partial: true });
    const db = getPool();
    const existing = await db.query(`SELECT * FROM past_papers WHERE id = $1`, [paperId]);
    const row = existing.rows[0];
    if (!row) throw httpError(404, "Past paper not found.", "PAST_PAPER_NOT_FOUND");

    if (fields.status === "published") {
        // Refuse to publish a paper whose file never finished uploading.
        try {
            await createSignedDownloadUrl({
                bucket: row.storage_bucket,
                path: row.storage_path,
                expiresIn: 60,
            });
        } catch {
            throw httpError(409, "The file for this paper is missing. Upload it again.", "PAST_PAPER_FILE_MISSING");
        }
    }

    const entries = Object.entries(fields);
    if (!entries.length) return toClientPastPaper(row, { admin: true });
    const sets = entries.map(([key], index) => `${COLUMN_BY_FIELD[key]} = $${index + 2}`);
    const updated = await db.query(
        `UPDATE past_papers SET ${sets.join(", ")}, updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [paperId, ...entries.map(([, value]) => value)],
    );
    return toClientPastPaper(updated.rows[0], { admin: true });
};

export const deletePastPaper = async (paperId) => {
    const deleted = await getPool().query(
        `DELETE FROM past_papers WHERE id = $1 RETURNING storage_bucket, storage_path`,
        [paperId],
    );
    const row = deleted.rows[0];
    if (!row) throw httpError(404, "Past paper not found.", "PAST_PAPER_NOT_FOUND");
    await deleteUploadObject({ bucket: row.storage_bucket, path: row.storage_path }).catch((error) => {
        console.warn("[pastPapers] storage delete failed", { paperId, message: error?.message });
    });
    return { deleted: true, id: paperId };
};
