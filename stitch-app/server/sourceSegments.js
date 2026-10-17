// Splits extracted source text into segments a lesson planner can group:
// headings start segments, and long stretches are split at paragraph, then
// sentence, then line boundaries so no segment's text exceeds maxChars.
//
// Noise never reaches a segment's text: tables of contents, page-number
// lines and running headers or footers (short lines repeated through the
// document). Every character of the source belongs to exactly one segment
// span or one dropped span, in order, so a lesson can always cite where its
// text came from.
//
//   segmentSource(text) -> {
//     segments: [{ index, start, end, heading, path, level, continued, text, chars }],
//     dropped: [{ start, end, reason }],
//   }

export const MAX_SEGMENT_CHARS = 3000;

const FENCE_RE = /^\s{0,3}(`{3,}|~{3,})/;
const HEADING_RE = /^\s{0,3}(#{1,6})\s+(.+?)\s*$/;
const CLOSING_HASHES_RE = /\s+#+\s*$/;
const TOC_LINE_RES = [
    /(?:\.{3,}|…{2,}|\s{2,}|\t)\s*\d{1,4}\s*$/,
    /^\s*[-*+]\s*\[[^\]]+\]\(#[^)]*\)\s*$/,
];
const CONTENTS_TITLE_RE = /^\s*(?:#{1,6}\s*)?(?:table of\s+)?contents\s*$/i;
const PAGE_NUMBER_RE = /^\s*(?:page\s*)?\d{1,4}(?:\s*(?:of|\/)\s*\d{1,4})?\s*$/i;
const NUMBER_RUN_RE = /^\s*\d{1,4}(?:\s+\d{1,4}){2,}\s*$/;
const STRUCTURED_LINE_RE = /^\s*(?:[-*+]\s|\d+[.)]\s|\||>)/;
const SENTENCE_END_RE = /[.!?]["')\]]?\s+(?=["'([]?[A-Z0-9])/g;

const normalizeRepeated = (line) => line.trim().toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ');

const toLines = (text) => {
    const lines = [];
    let offset = 0;
    for (const raw of text.split('\n')) {
        const end = Math.min(text.length, offset + raw.length + 1);
        lines.push({ text: raw, start: offset, end });
        offset = end;
    }
    return lines;
};

const markFences = (lines) => {
    let fence = null;
    for (const line of lines) {
        const match = line.text.match(FENCE_RE);
        if (match) {
            line.fence = true;
            if (!fence) {
                fence = match[1];
                line.inFence = true;
                line.fenceOpen = true;
            } else if (match[1][0] === fence[0] && match[1].length >= fence.length) {
                fence = null;
                line.inFence = true;
                line.fenceClose = true;
            } else {
                line.inFence = true;
            }
            continue;
        }
        line.inFence = Boolean(fence);
    }
};

const isBlank = (line) => !line.inFence && !line.text.trim();

// Table-of-contents runs: three or more contents-style lines with only blank
// lines between them, plus a "Contents" title just before the run.
const markTableOfContents = (lines) => {
    const isTocLine = (line) => !line.inFence && TOC_LINE_RES.some((re) => re.test(line.text));
    let index = 0;
    while (index < lines.length) {
        if (!isTocLine(lines[index])) {
            index += 1;
            continue;
        }
        const run = [];
        let cursor = index;
        while (cursor < lines.length && (isTocLine(lines[cursor]) || isBlank(lines[cursor]))) {
            if (isTocLine(lines[cursor])) run.push(cursor);
            cursor += 1;
        }
        if (run.length >= 3) {
            for (let i = run[0]; i <= run[run.length - 1]; i += 1) lines[i].noise = 'table_of_contents';
            let before = run[0] - 1;
            while (before >= 0 && isBlank(lines[before])) before -= 1;
            if (before >= 0 && CONTENTS_TITLE_RE.test(lines[before].text)) {
                for (let i = before; i < run[0]; i += 1) lines[i].noise = 'table_of_contents';
            }
        }
        index = cursor;
    }
};

const markPageNumbers = (lines) => {
    for (const line of lines) {
        if (line.inFence || line.noise) continue;
        if (PAGE_NUMBER_RE.test(line.text) || NUMBER_RUN_RE.test(line.text)) line.noise = 'page_number';
    }
};

// Running headers and footers: short plain lines that repeat (digits ignored)
// at least three times with a page number in them, or five times without.
const markRepeatedLines = (lines) => {
    const counts = new Map();
    const candidates = lines.filter((line) => {
        const text = line.text.trim();
        return !line.inFence && !line.noise && text.length >= 3 && text.length <= 80
            && !HEADING_RE.test(line.text) && !STRUCTURED_LINE_RE.test(line.text);
    });
    for (const line of candidates) {
        const key = normalizeRepeated(line.text);
        counts.set(key, (counts.get(key) || 0) + 1);
    }
    for (const line of candidates) {
        const count = counts.get(normalizeRepeated(line.text));
        if (count >= 5 || (count >= 3 && /\d/.test(line.text))) line.noise = 'running_header_footer';
    }
};

// Consecutive lines become units: heading, noise, blank, or a paragraph (a
// fenced code block is one paragraph).
const buildUnits = (lines) => {
    const units = [];
    const push = (type, line, extra = {}) => {
        const last = units[units.length - 1];
        if (last && last.type === type && type !== 'heading' && !last.closed && last.noise === extra.noise) {
            last.lines.push(line);
            return;
        }
        units.push({ type, lines: [line], ...extra });
    };
    for (const line of lines) {
        if (line.noise) {
            push('noise', line, { noise: line.noise });
            continue;
        }
        if (line.inFence) {
            const last = units[units.length - 1];
            if (line.fenceOpen || !last || last.type !== 'paragraph' || !last.code) {
                units.push({ type: 'paragraph', code: true, lines: [line] });
            } else {
                last.lines.push(line);
            }
            if (line.fenceClose) units[units.length - 1].closed = true;
            continue;
        }
        const heading = line.text.match(HEADING_RE);
        if (heading) {
            units.push({
                type: 'heading',
                lines: [line],
                level: heading[1].length,
                title: heading[2].replace(CLOSING_HASHES_RE, '').trim(),
            });
            continue;
        }
        if (!line.text.trim()) {
            push('blank', line);
            continue;
        }
        const last = units[units.length - 1];
        if (last && last.type === 'paragraph' && !last.code) {
            last.lines.push(line);
        } else {
            units.push({ type: 'paragraph', lines: [line] });
        }
    }
    for (const unit of units) {
        unit.start = unit.lines[0].start;
        unit.end = unit.lines[unit.lines.length - 1].end;
        unit.text = unit.lines.map((line) => line.text).join('\n').trim();
    }
    return units;
};

// Split one oversized paragraph into pieces of at most maxChars, at sentence
// ends for prose and line ends for code, falling back to whitespace.
const splitParagraph = (unit, source, maxChars) => {
    const breakpoints = [];
    if (unit.code) {
        for (const line of unit.lines.slice(1)) breakpoints.push(line.start);
    } else {
        const body = source.slice(unit.start, unit.end);
        for (const match of body.matchAll(SENTENCE_END_RE)) breakpoints.push(unit.start + match.index + match[0].length);
    }
    const pieces = [];
    let pieceStart = unit.start;
    while (unit.end - pieceStart > maxChars) {
        const limit = pieceStart + maxChars;
        let cut = breakpoints.filter((point) => point > pieceStart && point <= limit).pop();
        if (!cut) {
            const space = source.lastIndexOf(' ', limit);
            cut = space > pieceStart ? space + 1 : limit;
        }
        pieces.push({ ...unit, start: pieceStart, end: cut, text: source.slice(pieceStart, cut).trim() });
        pieceStart = cut;
    }
    pieces.push({ ...unit, start: pieceStart, end: unit.end, text: source.slice(pieceStart, unit.end).trim() });
    return pieces;
};

export const segmentSource = (source, { maxChars = MAX_SEGMENT_CHARS } = {}) => {
    const text = String(source || '');
    const lines = toLines(text);
    markFences(lines);
    markTableOfContents(lines);
    markPageNumbers(lines);
    markRepeatedLines(lines);

    const units = buildUnits(lines);

    const segments = [];
    const dropped = [];
    const headingStack = [];
    let current = null;
    let pendingStart = 0;
    let pendingNoise = null;

    const pathNow = () => headingStack.map((entry) => entry.title);
    const open = (start, { continued = false } = {}) => {
        const deepest = headingStack[headingStack.length - 1];
        current = {
            start,
            heading: deepest?.title || '',
            path: pathNow(),
            level: deepest?.level || 0,
            continued,
            parts: [],
            chars: 0,
            hasBody: false,
        };
    };
    const close = (end) => {
        if (!current) return;
        if (current.hasBody) {
            const segmentText = current.parts.join('\n\n');
            segments.push({
                index: segments.length,
                start: current.start,
                end,
                heading: current.heading,
                path: current.path,
                level: current.level,
                continued: current.continued,
                text: segmentText,
                chars: segmentText.length,
            });
        } else {
            dropped.push({ start: current.start, end, reason: 'empty_heading' });
        }
        current = null;
        pendingStart = end;
        pendingNoise = null;
    };
    // Space before a segment opens: noise in it becomes a dropped span.
    const takePending = (start) => {
        if (pendingNoise && start > pendingStart) {
            dropped.push({ start: pendingStart, end: start, reason: pendingNoise });
            pendingStart = start;
        }
        pendingNoise = null;
        return pendingStart;
    };

    for (let unitIndex = 0; unitIndex < units.length; unitIndex += 1) {
        let unit = units[unitIndex];
        // A paragraph longer than the room left in the segment is split so the
        // first piece fills that room and the rest start new segments.
        if (unit.type === 'paragraph') {
            const room = current?.hasBody ? maxChars : maxChars - (current?.chars || 0) - 2;
            if (unit.text.length > room && (!current?.hasBody || unit.text.length > maxChars)) {
                const [first] = splitParagraph(unit, text, Math.max(200, room));
                const rest = first.end < unit.end
                    ? splitParagraph({ ...unit, start: first.end, text: text.slice(first.end, unit.end).trim() }, text, maxChars)
                    : [];
                units.splice(unitIndex, 1, first, ...rest.filter((piece) => piece.text));
                unit = units[unitIndex];
            }
        }
        if (unit.type === 'noise' || unit.type === 'blank') {
            if (!current && unit.type === 'noise') pendingNoise = pendingNoise || unit.noise;
            continue;
        }
        if (unit.type === 'heading') {
            if (current?.hasBody) close(unit.start);
            while (headingStack.length && headingStack[headingStack.length - 1].level >= unit.level) headingStack.pop();
            headingStack.push({ level: unit.level, title: unit.title });
            if (current) {
                const deepest = headingStack[headingStack.length - 1];
                current.heading = deepest.title;
                current.path = pathNow();
                current.level = deepest.level;
            } else {
                open(takePending(unit.start));
            }
            current.parts.push(unit.text);
            current.chars += unit.text.length;
            continue;
        }
        if (!current) open(takePending(unit.start));
        if (current.hasBody && current.chars + unit.text.length + 2 > maxChars) {
            close(unit.start);
            open(unit.start, { continued: true });
        }
        current.parts.push(unit.text);
        current.chars += unit.text.length + 2;
        current.hasBody = true;
    }
    if (current) {
        close(text.length);
    } else if (text.length > pendingStart) {
        dropped.push({ start: pendingStart, end: text.length, reason: pendingNoise || 'blank' });
    }
    return { segments, dropped };
};
