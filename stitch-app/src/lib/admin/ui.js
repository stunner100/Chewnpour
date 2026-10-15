export const ADMIN_TABPANEL_ID = 'admin-tabpanel';

export const BAR_TRACK_PX = 96;

/** Arrow/Home/End target for a roving-tabindex tablist (wraps around). */
export const nextTabKey = (keys, currentKey, key) => {
    const index = Math.max(0, keys.indexOf(currentKey));
    if (key === 'ArrowRight') return keys[(index + 1) % keys.length];
    if (key === 'ArrowLeft') return keys[(index - 1 + keys.length) % keys.length];
    if (key === 'Home') return keys[0];
    if (key === 'End') return keys[keys.length - 1];
    return null;
};

// Bar heights are in pixels: a percentage height inside an auto-height flex
// column resolves to 0, which rendered every bar invisible.
export const barHeightPx = (value, max, trackPx = BAR_TRACK_PX) => {
    const ratio = Math.max(0, Number(value) || 0) / Math.max(1, Number(max) || 0);
    return Math.max(Math.round(ratio * trackPx), 2);
};

/** "38% of students" style share, safe for an empty user base. */
export const shareOfStudents = (part, total) => {
    const whole = Number(total) || 0;
    if (whole <= 0) return '0% of students';
    return `${Math.round(((Number(part) || 0) / whole) * 100)}% of students`;
};

export const ACTIVE_DEFINITION =
    'Active means the student studied a lesson, took a quiz or exam, asked the tutor, or uploaded material.';

export const ADMIN_SOURCE_LABELS = {
    bootstrap: 'Owner (built in)',
    env: 'Environment setting',
    db: 'Added from dashboard',
};

const parseJson = async (response) => response.json().catch(() => ({}));

/**
 * Grant admin by user id or email. If the account's email is unverified the
 * server asks for confirmation; `confirmUnverified` decides whether to retry.
 */
export const grantAdminAccess = async (target, { confirmUnverified, fetchImpl = fetch } = {}) => {
    const send = (allowUnverified) => fetchImpl('/api/admin/admins', {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...target, allowUnverified }),
    });
    let response = await send(false);
    let payload = await parseJson(response);
    if (response.status === 409 && payload.code === 'ADMIN_TARGET_UNVERIFIED') {
        if (!confirmUnverified || !confirmUnverified(payload.error)) {
            return { cancelled: true };
        }
        response = await send(true);
        payload = await parseJson(response);
    }
    if (!response.ok) {
        throw new Error(payload.error || 'Could not add admin.');
    }
    return payload;
};
