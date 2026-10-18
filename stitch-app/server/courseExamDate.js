import { getPool } from "./db.js";
import { parseExamDate } from "../src/lib/examPlan.js";

// node-postgres turns a DATE into a local-midnight Date; read it back with
// local getters so the calendar day never shifts.
export const formatExamDate = (value) => {
    if (value == null) return null;
    if (value instanceof Date) {
        const pad = (n) => String(n).padStart(2, "0");
        return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
    }
    return String(value).slice(0, 10);
};

// examDate "YYYY-MM-DD" sets the exam day; null or "" clears it. Returns
// false when the course is not the user's.
export const setCourseExamDate = async (userId, courseId, examDate) => {
    let value = null;
    if (examDate != null && examDate !== "") {
        value = parseExamDate(examDate);
        if (!value) {
            const error = new Error("examDate must be a valid date from today onwards");
            error.status = 400;
            throw error;
        }
    }
    const db = getPool();
    const result = await db.query(
        `UPDATE courses
         SET exam_date = $3::date, updated_at = NOW()
         WHERE id = $1 AND user_id = $2`,
        [courseId, userId, value],
    );
    return result.rowCount > 0;
};
