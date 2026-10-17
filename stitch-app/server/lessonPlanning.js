// Plans a course's lessons over the source segments (see sourceSegments.js):
// every lesson is a run of consecutive segments, lessons follow document
// order, and together they cover every segment. The model chooses where
// lessons start from a compact numbered list of the source's parts; when it
// cannot, a deterministic plan groups segments by heading and size.
//
// A plan entry: { title, kind, firstSegment, lastSegment, start, end, chars }
// (start/end are character offsets into the extracted text).
import { normalizeLessonKind } from "../src/lib/lessonKind.js";
import { SOURCE_DATA_RULE, extractJsonObject, untrustedSourceBlock } from "./promptSafety.js";

export const LESSON_TARGET_CHARS = 4500;
export const MAX_LESSON_CHARS = 8000;
// Lessons generated when a course is created; the rest of the plan waits.
export const MAX_GENERATED_LESSONS = 12;
// A new chapter starts a new lesson once the current one has this much text.
const MIN_LESSON_CHARS = 1000;
const MAX_OUTLINE_PARTS = 150;
const PREVIEW_CHARS = 140;

const oneLine = (value) => String(value || "").replace(/\s+/g, " ").trim();

export const targetLessonCount = (totalChars) => {
    const count = Math.max(1, Math.round(totalChars / LESSON_TARGET_CHARS));
    return totalChars >= 2500 ? Math.max(2, count) : count;
};

const segmentBody = (segment) =>
    segment.text.split("\n").filter((line) => !/^\s{0,3}#{1,6}\s/.test(line)).join(" ");

const firstSentence = (segment) => {
    const body = oneLine(segmentBody(segment));
    const sentence = body.match(/^.{20,}?[.!?](?=\s|$)/)?.[0] || body;
    return sentence.length > PREVIEW_CHARS ? `${sentence.slice(0, PREVIEW_CHARS).trim()}…` : sentence;
};

const titleForSegment = (segment, fallback) => {
    if (segment.heading) return segment.heading.slice(0, 120);
    const sentence = firstSentence(segment).replace(/[.!?…]+$/, "");
    return sentence.length >= 8 && sentence.length <= 80 ? sentence : fallback;
};

// Parts the planner sees: each segment, or runs of segments when the source
// has more segments than one outline prompt should list.
export const outlineParts = (segments, maxParts = MAX_OUTLINE_PARTS) => {
    const size = Math.max(1, Math.ceil(segments.length / maxParts));
    const parts = [];
    for (let first = 0; first < segments.length; first += size) {
        const last = Math.min(segments.length - 1, first + size - 1);
        const run = segments.slice(first, last + 1);
        parts.push({
            firstSegment: first,
            lastSegment: last,
            path: run[0].path,
            preview: firstSentence(run[0]),
            chars: run.reduce((sum, segment) => sum + segment.chars, 0),
        });
    }
    return parts;
};

const withSpan = (entry, segments) => {
    const run = segments.slice(entry.firstSegment, entry.lastSegment + 1);
    return {
        title: entry.title,
        kind: entry.kind || null,
        firstSegment: entry.firstSegment,
        lastSegment: entry.lastSegment,
        start: run[0].start,
        end: run[run.length - 1].end,
        chars: run.reduce((sum, segment) => sum + segment.chars, 0),
    };
};

// Splits lessons longer than MAX_LESSON_CHARS into consecutive parts.
export const capLessonSize = (plan, segments) => plan.flatMap((entry) => {
    if (entry.chars <= MAX_LESSON_CHARS) return [entry];
    const pieces = [];
    let first = entry.firstSegment;
    let chars = 0;
    for (let index = entry.firstSegment; index <= entry.lastSegment; index += 1) {
        if (index > first && chars + segments[index].chars > MAX_LESSON_CHARS) {
            pieces.push({ firstSegment: first, lastSegment: index - 1 });
            first = index;
            chars = 0;
        }
        chars += segments[index].chars;
    }
    pieces.push({ firstSegment: first, lastSegment: entry.lastSegment });
    return pieces.map((piece, index) => withSpan({
        ...piece,
        title: index === 0 ? entry.title : `${entry.title} (part ${index + 1})`,
        kind: entry.kind,
    }, segments));
});

// Groups segments without the model: a new lesson starts at a new top-level
// heading once the current one has some substance, or when it would grow
// past the target size.
export const heuristicLessonPlan = (segments) => {
    const plan = [];
    let current = null;
    segments.forEach((segment, index) => {
        const topLevelChanged = current && segment.path[0] !== segments[current.firstSegment].path[0];
        const startNew = !current
            || (topLevelChanged && current.chars >= MIN_LESSON_CHARS)
            || current.chars + segment.chars > LESSON_TARGET_CHARS * 1.3;
        if (startNew) {
            current = { firstSegment: index, lastSegment: index, chars: 0 };
            plan.push(current);
        }
        current.lastSegment = index;
        current.chars += segment.chars;
    });
    return capLessonSize(plan.map((entry, index) => withSpan({
        ...entry,
        title: titleForSegment(segments[entry.firstSegment], `Part ${index + 1}`),
    }, segments)), segments);
};

const parseLessonStarts = (payload, parts) => {
    const starts = new Map();
    for (const item of Array.isArray(payload?.lessons) ? payload.lessons : []) {
        const part = Number(item?.firstPart);
        const title = oneLine(item?.title).slice(0, 120);
        if (!Number.isInteger(part) || part < 0 || part >= parts.length || !title || starts.has(part)) continue;
        starts.set(part, { title, kind: normalizeLessonKind(item?.kind) });
    }
    const sorted = [...starts.entries()].sort((a, b) => a[0] - b[0]);
    if (sorted.length === 0) return null;
    sorted[0][0] = 0;
    return sorted.map(([part, details], index) => ({
        ...details,
        firstPart: part,
        lastPart: index + 1 < sorted.length ? sorted[index + 1][0] - 1 : parts.length - 1,
    }));
};

export const planLessons = async ({ chat, segments, fileName }) => {
    const parts = outlineParts(segments);
    const totalChars = segments.reduce((sum, segment) => sum + segment.chars, 0);
    const lessonCount = Math.min(parts.length, targetLessonCount(totalChars));
    const listing = parts.map((part, index) =>
        `[${index}] ${part.path.length ? part.path.join(" > ") : "(untitled)"} (${part.chars} chars): ${part.preview}`,
    ).join("\n");
    const result = await chat({
        messages: [
            {
                role: "system",
                content: [
                    "You are ChewnPour's study curriculum planner.",
                    'Return ONLY valid JSON: {"lessons":[{"title":"string","kind":"narrative|procedure|concept|argument","firstPart":0}]}.',
                    "The source is listed as numbered parts in document order. Group consecutive parts into lessons.",
                    `Plan about ${lessonCount} lessons. Each lesson starts at its firstPart and runs until the next lesson's firstPart; the first lesson starts at part 0. List lessons in document order.`,
                    "Start a new lesson where the source moves to a new topic, usually at a heading. Do not start a lesson on a part that continues the one before it.",
                    "Each title says what the lesson teaches, in plain words, grounded in the parts it covers.",
                    "kind: narrative for history and events, procedure for processes the learner performs, concept for ideas and mechanisms, argument for claims and debates.",
                    SOURCE_DATA_RULE,
                ].join(" "),
            },
            {
                role: "user",
                content: [`Source file name: ${fileName || "upload"}`, "", untrustedSourceBlock(listing, "Source parts")].join("\n"),
            },
        ],
        temperature: 0.2,
        maxTokens: Math.min(8000, Math.max(1200, 400 + 40 * lessonCount)),
        responseFormat: "json_object",
    });
    const lessons = parseLessonStarts(extractJsonObject(result.text), parts);
    if (!lessons) throw new Error("AI returned an unusable lesson plan.");
    const plan = lessons.map((lesson) => withSpan({
        title: lesson.title,
        kind: lesson.kind,
        firstSegment: parts[lesson.firstPart].firstSegment,
        lastSegment: parts[lesson.lastPart].lastSegment,
    }, segments));
    return { plan: capLessonSize(plan, segments), provider: result.provider, model: result.model };
};

export const lessonSourceText = (entry, segments) =>
    segments.slice(entry.firstSegment, entry.lastSegment + 1).map((segment) => segment.text).join("\n\n");
