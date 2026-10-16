// The stored shape of a lesson (topics.lesson), shared by generation, the
// server's prompt builders and the lesson page:
//
//   {
//     hook: "one optional line on why the topic matters",
//     sections: [{ title, role, body, sourceQuote }],
//     recap: [{ prompt, answer }],
//     wordBank: [{ term, definition }],
//   }
//
// Section titles describe the content ("Where a prokaryote keeps its DNA").
// The role says what the section does for the student; the UI styles and
// filters by role, and in-lesson checks bind to a section by its index.
//
// lessonFromMarkdown mirrors the SQL conversion in
// supabase/migrations/20261017120000_topic_lesson_column.sql; keep the two in step.
import {
    isSkippedStepperTitle,
    isWordBankStepperTitle,
    normalizeSectionTitle,
    splitMarkdownIntoSections,
} from './lessonSections.js';
import { normalizeLessonContent } from './topicContentFormatting.js';

export const LESSON_ROLES = ['core', 'steps', 'example', 'misconception', 'practice'];

const MAX_SECTIONS = 6;
const MAX_TITLE_CHARS = 120;
const MAX_BODY_CHARS = 4000;
const MIN_BODY_CHARS = 40;
const MAX_HOOK_CHARS = 240;
const MAX_QUOTE_CHARS = 300;
const MAX_RECAP_ITEMS = 4;
const MAX_WORD_BANK_TERMS = 10;

const oneLine = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

// Role for a section heading written under the old fixed templates.
const ROLE_BY_TITLE = new Map([
    ['the steps', 'steps'],
    ['step by step breakdown', 'steps'],
    ['worked example', 'example'],
    ['worked examples', 'example'],
    ['examples and non examples', 'example'],
    ['a sourced episode', 'example'],
    ['traps and mistakes', 'misconception'],
    ['the attractive wrong idea', 'misconception'],
    ['common mistakes', 'misconception'],
    ['common mistakes and misconceptions', 'misconception'],
    ['use it', 'practice'],
]);

export const roleForSectionTitle = (title) => ROLE_BY_TITLE.get(normalizeSectionTitle(title)) || 'core';

const withCoreSection = (sections) => {
    if (sections.length === 0 || sections.some((section) => section.role === 'core')) return sections;
    return sections.map((section, index) => (index === 0 ? { ...section, role: 'core' } : section));
};

// Validates a lesson from the model. Returns null when it has fewer than
// minSections usable sections.
export const normalizeLesson = (raw, { minSections = 1 } = {}) => {
    if (!raw || typeof raw !== 'object') return null;
    const seenTitles = new Set();
    const sections = [];
    for (const item of Array.isArray(raw.sections) ? raw.sections : []) {
        if (sections.length >= MAX_SECTIONS) break;
        const title = oneLine(item?.title).slice(0, MAX_TITLE_CHARS);
        const body = String(item?.body ?? '').trim().slice(0, MAX_BODY_CHARS);
        const key = normalizeSectionTitle(title);
        if (!key || body.length < MIN_BODY_CHARS || seenTitles.has(key)) continue;
        if (isSkippedStepperTitle(title) || isWordBankStepperTitle(title)) continue;
        seenTitles.add(key);
        const role = LESSON_ROLES.includes(item?.role) ? item.role : 'core';
        const sourceQuote = oneLine(item?.sourceQuote).slice(0, MAX_QUOTE_CHARS);
        sections.push({ title, role, body, ...(sourceQuote ? { sourceQuote } : {}) });
    }
    if (sections.length < Math.max(1, minSections)) return null;

    const recap = (Array.isArray(raw.recap) ? raw.recap : [])
        .map((item) => ({ prompt: oneLine(item?.prompt).slice(0, 300), answer: oneLine(item?.answer).slice(0, 300) }))
        .filter((item) => item.prompt.length >= 8 && item.answer)
        .slice(0, MAX_RECAP_ITEMS);

    const seenTerms = new Set();
    const wordBank = [];
    for (const item of Array.isArray(raw.wordBank) ? raw.wordBank : []) {
        if (wordBank.length >= MAX_WORD_BANK_TERMS) break;
        const term = oneLine(item?.term).replace(/^\*+|\*+$/g, '').slice(0, 80);
        const definition = oneLine(item?.definition).slice(0, 300);
        const key = term.toLowerCase();
        if (!term || definition.length < 3 || seenTerms.has(key)) continue;
        seenTerms.add(key);
        wordBank.push({ term, definition });
    }

    return {
        hook: oneLine(raw.hook).slice(0, MAX_HOOK_CHARS),
        sections: withCoreSection(sections),
        recap,
        wordBank,
    };
};

const WORD_BANK_ITEM_RE = /^\s*[-*+]\s+(.+)$/;
const BOLD_TERM_RE = /^\*\*(.+?)\*\*\s*(.*)$/;
const PLAIN_TERM_RE = /^(.{1,80}?)\s*(?::|\s—\s|\s–\s|\s-\s)\s*(.+)$/;

const parseWordBankLines = (body) => {
    const terms = [];
    for (const line of String(body || '').split('\n')) {
        const item = line.match(WORD_BANK_ITEM_RE)?.[1]?.trim();
        if (!item) continue;
        let term = '';
        let definition = '';
        const bold = item.match(BOLD_TERM_RE);
        if (bold) {
            term = bold[1].replace(/[:\s]+$/, '').trim();
            definition = bold[2].replace(/^[:—–-]\s*/, '').trim();
        } else {
            const plain = item.match(PLAIN_TERM_RE);
            if (plain) {
                term = plain[1].trim();
                definition = plain[2].trim();
            }
        }
        if (term && definition) terms.push({ term, definition });
    }
    return terms;
};

// Converts lesson markdown (lessons written before topics.lesson existed, and
// the non-AI fallback) into the lesson shape. Section titles keep their text;
// roles come from roleForSectionTitle.
export const lessonFromMarkdown = (markdown, { topicTitle = '' } = {}) => {
    const titleKey = normalizeSectionTitle(topicTitle);
    const sections = [];
    const wordBank = [];
    for (const section of splitMarkdownIntoSections(normalizeLessonContent(markdown))) {
        if (isSkippedStepperTitle(section.title)) continue;
        if (isWordBankStepperTitle(section.title)) {
            const terms = parseWordBankLines(section.content);
            if (terms.length > 0) {
                wordBank.push(...terms);
                continue;
            }
        }
        const repeatsPageTitle = titleKey && section.level === 1 && normalizeSectionTitle(section.title) === titleKey;
        const previous = sections[sections.length - 1];
        if (repeatsPageTitle && previous?.title === 'Introduction' && sections.length === 1) {
            previous.body = `${previous.body}\n\n${section.content}`;
            continue;
        }
        const title = repeatsPageTitle ? 'Introduction' : section.title;
        sections.push({ title, role: roleForSectionTitle(title), body: section.content });
    }
    return { hook: '', sections: withCoreSection(sections), recap: [], wordBank };
};

// Markdown view of a lesson, used wherever a prompt or a reader needs plain
// text: tutor and podcast prompts, exports, passage indexing.
export const lessonToMarkdown = (lesson) => {
    if (!lesson || typeof lesson !== 'object') return '';
    const parts = [];
    if (lesson.hook) parts.push(lesson.hook);
    for (const section of Array.isArray(lesson.sections) ? lesson.sections : []) {
        parts.push(`## ${section.title}\n\n${section.body}`);
    }
    const recap = Array.isArray(lesson.recap) ? lesson.recap : [];
    if (recap.length > 0) {
        parts.push(`## Recap\n\n${recap.map((item) => `- ${item.prompt} ${item.answer}`).join('\n')}`);
    }
    const wordBank = Array.isArray(lesson.wordBank) ? lesson.wordBank : [];
    if (wordBank.length > 0) {
        parts.push(`## Word Bank\n\n${wordBank.map((item) => `- **${item.term}**: ${item.definition}`).join('\n')}`);
    }
    return parts.join('\n\n');
};
