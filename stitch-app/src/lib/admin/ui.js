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
