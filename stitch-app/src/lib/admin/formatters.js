const NUMBER_FORMATTER = new Intl.NumberFormat();
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
});

export const formatNumber = (value) => NUMBER_FORMATTER.format(Number(value) || 0);
export const formatPercent = (value) => {
    const parsed = Number(value);
    const safe = Number.isFinite(parsed) ? parsed : 0;
    const rounded = Math.round(safe * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
};
export const formatRatioPercent = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return '0%';
    const percent = parsed * 100;
    const rounded = Math.round(percent * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
};

export const formatDateTime = (value) => {
    if (value == null || value === '') return 'N/A';
    const parsed = value instanceof Date
        ? value
        : typeof value === 'number'
            ? new Date(value)
            : new Date(String(value));
    if (Number.isNaN(parsed.getTime())) return 'N/A';
    return DATE_TIME_FORMATTER.format(parsed);
};

export const formatBytes = (value) => {
    const bytes = Number(value) || 0;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round((bytes / 1024) * 10) / 10} KB`;
    return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
};

export const formatRelativeHours = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return '<1h';
    if (parsed < 24) return `${Math.round(parsed * 10) / 10}h`;
    const days = parsed / 24;
    return `${Math.round(days * 10) / 10}d`;
};

export const formatTokenLabel = (value) => {
    const normalized = String(value || '').trim();
    if (!normalized) return 'Unknown';
    return normalized
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
};

export const formatTrend = (currentValue, previousValue) => {
    const current = Number(currentValue) || 0;
    const previous = Number(previousValue) || 0;
    const delta = current - previous;
    if (delta > 0) return `+${delta}`;
    if (delta < 0) return `${delta}`;
    return '0';
};

export const formatCurrency = (amountMinor, currency = 'GHS') => {
    const major = (Number(amountMinor) || 0) / 100;
    return `${currency} ${major.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatMajorCurrency = (amountMajor, currency = 'GHS') => {
    const major = Number(amountMajor);
    if (!Number.isFinite(major) || major <= 0) return 'N/A';
    return `${currency} ${major.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatDuration = (seconds) => {
    const s = Number(seconds) || 0;
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const remaining = Math.round(s % 60);
    return remaining > 0 ? `${m}m ${remaining}s` : `${m}m`;
};

export const formatSignedPercent = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return '0%';
    const rounded = Math.round(parsed * 10) / 10;
    return `${rounded.toFixed(rounded % 1 === 0 ? 0 : 1)}%`;
};

export const canRemoveAdminEmail = (sources) => (
    Array.isArray(sources)
    && sources.includes('db')
    && !sources.includes('bootstrap')
    && !sources.includes('env')
);

export const formatAdminSource = (source) => {
    if (source === 'bootstrap') return 'Bootstrap';
    if (source === 'env') return 'Environment';
    return 'Dashboard';
};

export const formatFileTypeLabel = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized || normalized === 'unknown') return 'Unknown';
    if (normalized === 'image') return 'Image';
    if (normalized === 'pdf') return 'PDF';
    if (normalized === 'docx') return 'DOCX';
    if (normalized === 'pptx') return 'PPTX';
    if (['mp3', 'm4a', 'mp4', 'wav', 'webm', 'ogg', 'aac', 'flac'].includes(normalized)) return 'AUDIO';
    if (normalized === 'txt') return 'TXT';
    return normalized.toUpperCase();
};

export const normalizeFeedbackMessage = (value) => (
    typeof value === 'string' ? value.trim() : ''
);
export const formatResearchChoice = (value) => {
    const normalized = normalizeFeedbackMessage(value);
    if (!normalized) return '';
    return normalized
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
};