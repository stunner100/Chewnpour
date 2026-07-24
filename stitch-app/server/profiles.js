import { getPool } from "./db.js";

const DEFAULT_STUDY_PREFERENCES = {
    dailyGoalMinutes: 30,
    preferredSessionLength: "25",
    dailyReminders: true,
    processingAlerts: true,
    weeklyProgressReport: true,
    preferredPersona: "coach",
};

const toClientProfile = (row) => {
    if (!row) return null;
    return {
        userId: row.user_id,
        fullName: row.full_name || "",
        educationLevel: row.education_level || null,
        department: row.department || null,
        avatarUrl: row.avatar_url || null,
        avatarGradient: row.avatar_gradient ?? null,
        voiceModeEnabled: Boolean(row.voice_mode_enabled),
        onboardingCompleted: Boolean(row.onboarding_completed),
        studyPreferences: row.study_preferences || DEFAULT_STUDY_PREFERENCES,
        streakDays: Number(row.streak_days || 0),
        totalStudyHours: Number(row.total_study_hours || 0),
        createdAt: row.created_at ? new Date(row.created_at).getTime() : null,
        updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : null,
    };
};

export const ensureProfile = async ({ userId, fullName = "", avatarUrl = null }) => {
    const db = getPool();
    const existing = await db.query(
        `SELECT * FROM profiles WHERE user_id = $1 LIMIT 1`,
        [userId],
    );
    if (existing.rows[0]) {
        return toClientProfile(existing.rows[0]);
    }

    const inserted = await db.query(
        `INSERT INTO profiles (
            user_id,
            full_name,
            avatar_url,
            onboarding_completed,
            study_preferences
        ) VALUES ($1, $2, $3, FALSE, $4::jsonb)
        ON CONFLICT (user_id) DO UPDATE SET
            updated_at = NOW()
        RETURNING *`,
        [
            userId,
            String(fullName || "").trim() || null,
            avatarUrl || null,
            JSON.stringify(DEFAULT_STUDY_PREFERENCES),
        ],
    );

    return toClientProfile(inserted.rows[0]);
};

export const getProfileForUser = async (userId) => {
    const db = getPool();
    const result = await db.query(
        `SELECT * FROM profiles WHERE user_id = $1 LIMIT 1`,
        [userId],
    );
    if (result.rows[0]) {
        return toClientProfile(result.rows[0]);
    }
    return null;
};

const ALLOWED_UPDATE_KEYS = new Set([
    "fullName",
    "educationLevel",
    "department",
    "avatarUrl",
    "avatarGradient",
    "voiceModeEnabled",
    "onboardingCompleted",
    "studyPreferences",
    "streakDays",
    "totalStudyHours",
]);

export const updateProfileForUser = async (userId, updates = {}) => {
    await ensureProfile({ userId });

    const setFragments = [];
    const values = [];
    let index = 1;

    const push = (column, value) => {
        setFragments.push(`${column} = $${index}`);
        values.push(value);
        index += 1;
    };

    for (const [key, value] of Object.entries(updates || {})) {
        if (!ALLOWED_UPDATE_KEYS.has(key)) continue;
        if (value === undefined) continue;

        switch (key) {
            case "fullName":
                push("full_name", String(value || "").trim() || null);
                break;
            case "educationLevel":
                push("education_level", value ? String(value) : null);
                break;
            case "department":
                push("department", value ? String(value) : null);
                break;
            case "avatarUrl":
                push("avatar_url", value ? String(value) : null);
                break;
            case "avatarGradient":
                push(
                    "avatar_gradient",
                    Number.isFinite(Number(value)) ? Number(value) : null,
                );
                break;
            case "voiceModeEnabled":
                push("voice_mode_enabled", Boolean(value));
                break;
            case "onboardingCompleted":
                push("onboarding_completed", Boolean(value));
                break;
            case "studyPreferences":
                push("study_preferences", JSON.stringify(value || DEFAULT_STUDY_PREFERENCES));
                break;
            case "streakDays":
                push("streak_days", Math.max(0, Number(value) || 0));
                break;
            case "totalStudyHours":
                push("total_study_hours", Math.max(0, Number(value) || 0));
                break;
            default:
                break;
        }
    }

    if (setFragments.length === 0) {
        return getProfileForUser(userId);
    }

    setFragments.push("updated_at = NOW()");
    values.push(userId);

    const db = getPool();
    const result = await db.query(
        `UPDATE profiles
         SET ${setFragments.join(", ")}
         WHERE user_id = $${index}
         RETURNING *`,
        values,
    );

    return toClientProfile(result.rows[0]);
};

export const addStudyTimeForUser = async (userId, minutes) => {
    const normalizedMinutes = Math.max(0, Number(minutes) || 0);
    if (normalizedMinutes <= 0) {
        return getProfileForUser(userId);
    }

    await ensureProfile({ userId });
    const hoursToAdd = normalizedMinutes / 60;
    const db = getPool();
    const result = await db.query(
        `UPDATE profiles
         SET total_study_hours = COALESCE(total_study_hours, 0) + $1,
             updated_at = NOW()
         WHERE user_id = $2
         RETURNING *`,
        [hoursToAdd, userId],
    );
    return toClientProfile(result.rows[0]);
};
