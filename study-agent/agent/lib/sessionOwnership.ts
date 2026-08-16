import { getPool } from "./db";

// The study worker binds each durable eve session to the student who initiated
// it. Route auth verifies the caller's token but does not (by design) enforce
// session ownership, so the worker records the initiator here and rejects a
// follow-up whose verified principal does not match.

export const recordSessionOwner = async (
  sessionId: string,
  userId: string,
): Promise<void> => {
  try {
    const db = getPool();
    await db.query(
      `INSERT INTO study_worker_sessions (session_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (session_id) DO NOTHING`,
      [sessionId, userId],
    );
  } catch (error) {
    // Recording is best-effort: a failed write must not take down the session.
    console.warn("[study-worker] failed to record session owner", {
      sessionId,
      message: String((error as Error)?.message || error),
    });
  }
};

export const getSessionOwner = async (
  sessionId: string,
): Promise<string | null> => {
  try {
    const db = getPool();
    const result = await db.query(
      `SELECT user_id FROM study_worker_sessions WHERE session_id = $1 LIMIT 1`,
      [sessionId],
    );
    const row = result.rows[0];
    return row ? String(row.user_id) : null;
  } catch (error) {
    // Fail open on lookup errors (missing table during rollout, transient DB
    // outage). A positive mismatch is still rejected by the caller.
    console.warn("[study-worker] failed to look up session owner", {
      sessionId,
      message: String((error as Error)?.message || error),
    });
    return null;
  }
};
