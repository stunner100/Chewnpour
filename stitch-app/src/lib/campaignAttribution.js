const PENDING_CAMPAIGN_ATTRIBUTION_KEY = 'pending_campaign_attribution';
const RECORDED_CAMPAIGN_ATTRIBUTION_KEY = 'recorded_campaign_attribution';
const MAX_STORED_RECORDS = 50;
const MAX_PENDING_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const normalizeString = (value, maxLength = 200) => {
    if (typeof value !== 'string') return '';
    const normalized = value.trim();
    if (!normalized) return '';
    return normalized.slice(0, maxLength);
};

const readSessionStorage = (key) => {
    if (typeof window === 'undefined') return null;
    try {
        return window.sessionStorage.getItem(key);
    } catch {
        return null;
    }
};

const writeSessionStorage = (key, value) => {
    if (typeof window === 'undefined') return;
    try {
        window.sessionStorage.setItem(key, value);
    } catch {
        // Ignore session storage failures.
    }
};

const removeSessionStorage = (key) => {
    if (typeof window === 'undefined') return;
    try {
        window.sessionStorage.removeItem(key);
    } catch {
        // Ignore session storage failures.
    }
};

export const readCampaignAttributionFromSearch = (search, pathname = '') => {
    const rawSearch = normalizeString(search, 1000);
    if (!rawSearch) return null;

    const params = new URLSearchParams(rawSearch.startsWith('?') ? rawSearch : `?${rawSearch}`);
    const campaignId = normalizeString(
        params.get('campaign') || params.get('campaignId') || params.get('campaign_id'),
        160,
    );
    if (!campaignId) return null;

    return {
        campaignId,
        source: normalizeString(params.get('campaign_source') || params.get('utm_source'), 80) || 'email',
        medium: normalizeString(params.get('campaign_medium') || params.get('utm_medium'), 80) || 'email_cta',
        content: normalizeString(params.get('campaign_content') || params.get('utm_content'), 160) || undefined,
        landingPath: normalizeString(pathname, 200) || '/',
        landingSearch: rawSearch,
        observedAt: Date.now(),
    };
};

export const stashPendingCampaignAttribution = (value) => {
    const campaignId = normalizeString(value?.campaignId, 160);
    if (!campaignId) return;

    writeSessionStorage(PENDING_CAMPAIGN_ATTRIBUTION_KEY, JSON.stringify({
        campaignId,
        source: normalizeString(value?.source, 80) || 'email',
        medium: normalizeString(value?.medium, 80) || 'email_cta',
        content: normalizeString(value?.content, 160) || undefined,
        landingPath: normalizeString(value?.landingPath, 200) || '/',
        landingSearch: normalizeString(value?.landingSearch, 1000) || '',
        observedAt: Number(value?.observedAt) || Date.now(),
    }));
};

export const readPendingCampaignAttribution = () => {
    const raw = readSessionStorage(PENDING_CAMPAIGN_ATTRIBUTION_KEY);
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw);
        const observedAt = Number(parsed?.observedAt) || 0;
        if (observedAt > 0 && Date.now() - observedAt > MAX_PENDING_AGE_MS) {
            removeSessionStorage(PENDING_CAMPAIGN_ATTRIBUTION_KEY);
            return null;
        }

        const campaignId = normalizeString(parsed?.campaignId, 160);
        if (!campaignId) {
            removeSessionStorage(PENDING_CAMPAIGN_ATTRIBUTION_KEY);
            return null;
        }

        return {
            campaignId,
            source: normalizeString(parsed?.source, 80) || 'email',
            medium: normalizeString(parsed?.medium, 80) || 'email_cta',
            content: normalizeString(parsed?.content, 160) || undefined,
            landingPath: normalizeString(parsed?.landingPath, 200) || '/',
            landingSearch: normalizeString(parsed?.landingSearch, 1000) || '',
            observedAt,
        };
    } catch {
        removeSessionStorage(PENDING_CAMPAIGN_ATTRIBUTION_KEY);
        return null;
    }
};

export const clearPendingCampaignAttribution = () => {
    removeSessionStorage(PENDING_CAMPAIGN_ATTRIBUTION_KEY);
};

export const buildRecordedCampaignAttributionKey = ({ userId, campaignId }) => {
    const normalizedUserId = normalizeString(userId, 160);
    const normalizedCampaignId = normalizeString(campaignId, 160);
    if (!normalizedUserId || !normalizedCampaignId) return '';
    return `${normalizedUserId}:${normalizedCampaignId}`;
};

const readRecordedCampaignAttributionKeys = () => {
    const raw = readSessionStorage(RECORDED_CAMPAIGN_ATTRIBUTION_KEY);
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed)
            ? parsed.map((value) => normalizeString(value, 320)).filter(Boolean)
            : [];
    } catch {
        return [];
    }
};

export const hasRecordedCampaignAttribution = (key) => {
    const normalizedKey = normalizeString(key, 320);
    if (!normalizedKey) return false;
    return readRecordedCampaignAttributionKeys().includes(normalizedKey);
};

export const markRecordedCampaignAttribution = (key) => {
    const normalizedKey = normalizeString(key, 320);
    if (!normalizedKey) return;

    const existing = readRecordedCampaignAttributionKeys().filter((value) => value !== normalizedKey);
    existing.unshift(normalizedKey);
    writeSessionStorage(
        RECORDED_CAMPAIGN_ATTRIBUTION_KEY,
        JSON.stringify(existing.slice(0, MAX_STORED_RECORDS)),
    );
};
