const safeJsonParse = (value) => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) {
        return null;
    }
    try {
        return JSON.parse(trimmed);
    } catch {
        return null;
    }
};

const normalizeOptionString = (value) => {
    if (typeof value !== 'string') return value;
    return value
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n')
        .replace(/^"+|"+$/g, '')
        .trim();
};

const cleanOptionText = (value) => {
    if (value === null || value === undefined) return '';
    let text = typeof value === 'string' ? normalizeOptionString(value) : String(value);
    if (!text) return '';

    const parsed = safeJsonParse(text);
    if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed)) return '';
        if (typeof parsed.text === 'string') return normalizeOptionString(parsed.text);
        return '';
    }

    const textMatch = text.match(/"text"\s*:\s*"([^"]+)"/);
    if (textMatch) return textMatch[1];

    if (/"label"\s*:\s*"/.test(text) || /"isCorrect"\s*:/.test(text)) return '';

    return text;
};

const extractOptionsFromText = (text) => {
    if (typeof text !== 'string') return null;
    const cleaned = normalizeOptionString(text);
    const labelMatches = [...cleaned.matchAll(/"label"\s*:\s*"([^"]+)"/g)];
    const textMatches = [...cleaned.matchAll(/"text"\s*:\s*"([^"]+)"/g)];
    if (textMatches.length === 0) return null;
    return textMatches.map((match, index) => ({
        label: labelMatches[index]?.[1] ?? String.fromCharCode(65 + index),
        text: match[1],
    }));
};

const tryReconstructOptions = (stringOptions) => {
    if (!Array.isArray(stringOptions) || stringOptions.length === 0) return null;
    const joined = stringOptions.map(normalizeOptionString).join(',');
    const cleanedCandidates = [joined, normalizeOptionString(joined)];

    for (const candidate of cleanedCandidates) {
        const parsed = safeJsonParse(candidate);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && Array.isArray(parsed.options)) return parsed.options;
    }

    for (const candidate of cleanedCandidates) {
        const wrapped = candidate.trim().startsWith('[') ? candidate : `[${candidate}]`;
        const parsed = safeJsonParse(wrapped);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && Array.isArray(parsed.options)) return parsed.options;
    }

    return extractOptionsFromText(joined) || null;
};

const reconstructFromFragments = (stringOptions) => {
    if (!Array.isArray(stringOptions) || stringOptions.length === 0) return null;

    const reconstructed = [];
    let current = null;

    for (const fragment of stringOptions) {
        const cleaned = normalizeOptionString(fragment);
        const labelMatch = cleaned.match(/"label"\s*:\s*"([^"]+)"/);
        const textMatch = cleaned.match(/"text"\s*:\s*"([^"]+)"/);
        const correctMatch = cleaned.match(/"isCorrect"\s*:\s*(true|false)/);

        if (labelMatch) {
            if (current && current.text) reconstructed.push(current);
            current = { label: labelMatch[1] };
        }

        if (textMatch) {
            if (!current) current = { label: String.fromCharCode(65 + reconstructed.length) };
            current.text = textMatch[1];
        }

        if (correctMatch) {
            if (!current) current = { label: String.fromCharCode(65 + reconstructed.length) };
            current.isCorrect = correctMatch[1] === 'true';
        }

        if (current && current.label && current.text && correctMatch) {
            reconstructed.push(current);
            current = null;
        }
    }

    if (current && current.text) reconstructed.push(current);

    return reconstructed.length > 0 ? reconstructed : null;
};

const coerceOptions = (rawOptions) => {
    if (!rawOptions) return [];

    let options = rawOptions;
    if (typeof options === 'string') {
        const parsed = safeJsonParse(options);
        options = parsed ?? options;
    }

    if (options && !Array.isArray(options) && typeof options === 'object') {
        if (Array.isArray(options.options)) {
            options = options.options;
        } else if (Array.isArray(options.choices)) {
            options = options.choices;
        }
    }

    if (!Array.isArray(options)) options = [options];

    const flattened = [];
    for (const option of options) {
        if (typeof option === 'string') {
            const parsed = safeJsonParse(option);
            if (Array.isArray(parsed)) { flattened.push(...parsed); continue; }
            if (parsed) { flattened.push(parsed); continue; }
        }
        flattened.push(option);
    }

    const cleaned = flattened.filter((option) => option !== null && option !== undefined);
    if (cleaned.length > 0 && cleaned.every((option) => typeof option === 'string')) {
        const fromFragments = reconstructFromFragments(cleaned);
        if (fromFragments && fromFragments.length > 0) return fromFragments;
        const reconstructed = tryReconstructOptions(cleaned);
        if (reconstructed && reconstructed.length > 0) return reconstructed;
        const extracted = extractOptionsFromText(cleaned.join(','));
        if (extracted && extracted.length > 0) return extracted;
    }

    return cleaned;
};

const normalizeOption = (option, index) => {
    if (option && typeof option === 'object') {
        const label = option.label ?? option.id ?? String.fromCharCode(65 + index);
        const text = cleanOptionText(
            option.text ?? option.value ?? option.answer ?? option.choiceText ?? '',
        );
        if (!text) return null;
        return { label, value: String(label), text };
    }

    let label = String.fromCharCode(65 + index);
    let text = cleanOptionText(option ?? '');
    const labelMatch = typeof text === 'string' ? text.match(/"label"\s*:\s*"([^"]+)"/) : null;
    const textMatch = typeof text === 'string' ? text.match(/"text"\s*:\s*"([^"]+)"/) : null;
    if (labelMatch) label = labelMatch[1];
    if (textMatch) {
        text = textMatch[1];
    } else if (labelMatch) {
        text = '';
    } else if (typeof text === 'string' && /"isCorrect"\s*:/.test(text)) {
        text = '';
    }

    const letterPrefixMatch = typeof text === 'string'
        ? text.match(/^\s*([A-D])[).\-:\s]+(.+)$/i)
        : null;
    if (letterPrefixMatch) {
        label = letterPrefixMatch[1].toUpperCase();
        text = letterPrefixMatch[2].trim();
    }

    if (!text) return null;
    return { label, value: label, text };
};

const buildFallbackOptionsFromRaw = (rawOptions) => {
    try {
        const rawString = typeof rawOptions === 'string'
            ? rawOptions
            : JSON.stringify(rawOptions ?? '');
        const cleaned = normalizeOptionString(rawString);
        const matches = [...cleaned.matchAll(/"text"\s*:\s*"([^"]+)"/g)];
        if (matches.length === 0) return [];
        return matches.map((match, index) => ({
            label: String.fromCharCode(65 + index),
            value: String.fromCharCode(65 + index),
            text: match[1],
        }));
    } catch {
        return [];
    }
};

export const resolveQuestionOptions = (rawOptions) => {
    const options = coerceOptions(rawOptions);
    const renderOptions = options.flatMap((option, index) => {
        const normalized = normalizeOption(option, index);
        return normalized ? [normalized] : [];
    });
    const hasRawArtifacts = renderOptions.some((option) => {
        if (typeof option.text !== 'string') return false;
        return (
            option.text.includes('"label"')
            || option.text.includes('{"label"')
            || option.text.includes('\\"label\\"')
            || option.text.includes('\\"isCorrect\\"')
        );
    });
    const fallbackOptions = buildFallbackOptionsFromRaw(rawOptions);
    return renderOptions.length === 0 || hasRawArtifacts
        ? (fallbackOptions.length > 0 ? fallbackOptions : renderOptions)
        : renderOptions;
};
