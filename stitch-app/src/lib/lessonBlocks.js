// Pure lesson-content pipeline used by the topic page: normalize the stored
// markdown, parse it into display blocks, then group the blocks into stepper
// steps. Lives outside the hook so regression scripts can run it in Node.
import {
    SECTION_TITLES_SET,
    cleanDisplayLine,
    isArtifactLine,
    isLowSignalLessonLine,
    normalizeLessonContent,
    slugifyText,
} from './topicContentFormatting.js';
import {
    SECTION_SETS,
    EMBEDDED_SECTION_SPLIT_PATTERN,
    SECTION_TEXT_STRIP_PATTERN,
    QUICK_CHECK_SECTION_PATTERN,
    WORD_BANK_SECTION_PATTERN,
    ANALOGY_SECTION_PATTERN,
    COMMON_MISTAKE_SECTION_PATTERN,
    STEP_TERM_PATTERN,
} from './topicLessonHelpers.js';
import { splitBlocksIntoSections, buildLessonSteps } from './lessonSections.js';

const cleanLine = (text) => cleanDisplayLine(text);

export const prepareLessonContent = ({ content, title = '', description = '' } = {}) => {
    if (!content || typeof content !== 'string') return content;

    const normalized = normalizeLessonContent(content);
    const normalizedWordCount = normalized
        .replace(/[#>*_`~-]/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .length;

    if (normalizedWordCount >= 40) {
        return normalized;
    }

    const heading = String(title || 'Lesson Overview')
        .replace(/^Topic\s*\d+\s*:\s*/i, '')
        .replace(/\s*[•|]\s.*$/, '')
        .replace(/\s+/g, ' ')
        .trim();
    const summary = String(description || '')
        .replace(/\s+/g, ' ')
        .trim();

    return [
        `## ${heading || 'Lesson Overview'}`,
        summary || 'This lesson is being prepared from your uploaded material.',
        '### What You Will Learn',
        '- Core ideas from this topic',
        '- Step-by-step explanations with examples',
        '- Common mistakes and how to avoid them',
        '### Note',
        'Full lesson details are still being finalized. You can tap "Re-explain differently" to regenerate immediately.',
    ].join('\n\n');
};

export const parseLessonBlocks = (normalizedContent) => {
    if (!normalizedContent || typeof normalizedContent !== 'string') {
        return { blocks: [], toc: [] };
    }

    const lines = normalizedContent.split(/\n/);
    const blocks = [];
    const toc = [];
    let headerCount = 0;
    let previousWasSpacer = false;

    for (let i = 0; i < lines.length; i += 1) {
        const raw = lines[i]?.trim?.() ?? '';
        if (!raw) {
            if (previousWasSpacer || blocks.length === 0) continue;
            blocks.push({ type: 'spacer', key: `spacer-${i}` });
            previousWasSpacer = true;
            continue;
        }
        previousWasSpacer = false;
        const cleanedRaw = cleanLine(raw);

        // Skip malformed marker-only lines that should not render as content blocks.
        if (isArtifactLine(raw) || !cleanedRaw || isLowSignalLessonLine(raw)) {
            continue;
        }

        // Headers
        const headerMatch = raw.match(/^(#{1,6})\s+(.+)$/);
        if (headerMatch) {
            const level = headerMatch[1].length;
            let text = cleanLine(headerMatch[2]);
            let trailingParagraph = '';
            if (text.length > 80) {
                const splitMatch = text.match(/^(.{15,250}?[.!?)]|.{15,150}?[:])\s+([A-Z].+)$/);
                if (splitMatch) {
                    text = splitMatch[1].trim();
                    trailingParagraph = splitMatch[2].trim();
                }
            }
            const id = slugifyText(text, headerCount);
            headerCount += 1;
            toc.push({ id, text, level });
            blocks.push({ type: 'header', level, text, id, key: `h-${i}` });
            if (trailingParagraph) {
                blocks.push({ type: 'paragraph', text: trailingParagraph, key: `p-${i}-after-header` });
            }
            continue;
        }

        const plainSectionTitle = cleanLine(raw)
            .replace(/:$/, '')
            .toLowerCase();
        if (SECTION_TITLES_SET.has(plainSectionTitle)) {
            const id = slugifyText(raw, headerCount);
            headerCount += 1;
            const text = cleanLine(raw).replace(/:$/, '');
            toc.push({ id, text, level: 3 });
            blocks.push({ type: 'header', level: 3, text, id, key: `h-section-${i}` });
            continue;
        }

        // Alerts (Tip, Note, Warning, Important)
        const alertMatch = raw.match(/^[-•*]?\s*(Tip|Note|Warning|Important|Key Takeaway):\s*(.+)$/i);
        if (alertMatch) {
            blocks.push({
                type: 'alert',
                alertType: alertMatch[1].toLowerCase(),
                text: alertMatch[2],
                key: `a-${i}`
            });
            continue;
        }

        // Definitions
        const defMatch = raw.match(/^[-•*]?\s*(Definition|Key Term|Concept):\s*(.+)$/i);
        if (defMatch) {
            blocks.push({
                type: 'definition',
                term: defMatch[1],
                text: defMatch[2],
                key: `d-${i}`
            });
            continue;
        }

        const emphasizedDefinitionMatch = raw.match(/^\*\*([^*]{2,40})\*\*\s*:\s*(.+)$/);
        if (emphasizedDefinitionMatch) {
            const term = cleanLine(emphasizedDefinitionMatch[1]);
            // Prevent matching generic lists or steps that happen to use bolding
            if (!STEP_TERM_PATTERN.test(term) && !term.startsWith('-')) {
                blocks.push({
                    type: 'definition',
                    term,
                    text: emphasizedDefinitionMatch[2],
                    key: `d-em-${i}`
                });
                continue;
            }
        }

        // Examples
        const exampleMatch = raw.match(/^[-•*]?\s*(Example|For example):\s*(.+)$/i);
        if (exampleMatch) {
            blocks.push({
                type: 'example',
                text: exampleMatch[2],
                key: `e-${i}`
            });
            continue;
        }

        // Lists
        if (raw.startsWith('- ') || raw.startsWith('• ') || raw.startsWith('* ')) {
            blocks.push({ type: 'bullet', text: raw.replace(/^[-•*]\s+/, ''), key: `b-${i}` });
            continue;
        }

        const numMatch = raw.match(/^(\d+)[.)]\s+(.+)$/);
        if (numMatch) {
            blocks.push({ type: 'numbered', num: numMatch[1], text: numMatch[2], key: `n-${i}` });
            continue;
        }

        // Blockquotes
        if (raw.startsWith('> ')) {
            const quoteText = cleanLine(raw.slice(2));
            if (!quoteText || isArtifactLine(quoteText)) {
                continue;
            }
            blocks.push({ type: 'quote', text: quoteText, key: `q-${i}` });
            continue;
        }

        // Default Paragraph — try to split long text with embedded section titles
        if (raw.length > 200) {
            // Try to detect embedded section-like patterns and split them
            const sectionSplit = raw.split(EMBEDDED_SECTION_SPLIT_PATTERN);
            if (sectionSplit.length > 1) {
                for (let j = 0; j < sectionSplit.length; j++) {
                    const part = sectionSplit[j]?.trim();
                    if (!part) continue;
                    // Check if this part looks like a section title (short, title-case)
                    if (part.length < 60 && /^[A-Z]/.test(part) && !/[.!?]$/.test(part)) {
                        const titleId = slugifyText(part, headerCount);
                        headerCount += 1;
                        toc.push({ id: titleId, text: cleanLine(part), level: 3 });
                        blocks.push({ type: 'header', level: 3, text: cleanLine(part), id: titleId, key: `h-${i}-${j}` });
                    } else {
                        blocks.push({ type: 'paragraph', text: part, key: `p-${i}-${j}` });
                    }
                }
                continue;
            }
        }
        blocks.push({ type: 'paragraph', text: raw, key: `p-${i}` });
    }

    // ── Second pass: section-aware block enrichment ──
    const quickCheckPairs = [];
    const wordBankTerms = [];
    let currentSection = '';

    const detectMistakeLabel = (text) => {
        if (/(exam|test|paper)/i.test(text)) return 'Exam Trap';
        if (/(confuse|similar|mix|same as)/i.test(text)) return 'Do Not Mix Up';
        if (/(common|often|many|students)/i.test(text)) return 'Common Confusion';
        return null;
    };

    for (let b = 0; b < blocks.length; b++) {
        const block = blocks[b];
        if (block.type === 'header') {
            currentSection = block.text.toLowerCase().replace(SECTION_TEXT_STRIP_PATTERN, '').trim();
            continue;
        }
        const blockText = typeof block.text === 'string' ? block.text : '';

        // Quick Check: collect Q/A pairs from numbered blocks
        if (QUICK_CHECK_SECTION_PATTERN.test(currentSection) && block.type === 'numbered') {
            const qMatch = blockText.match(/^\*\*Q:\*\*\s*(.+)/);
            if (qMatch) {
                const next = blocks[b + 1];
                const nextText = typeof next?.text === 'string' ? next.text : '';
                const aMatch = nextText.match(/^\*\*A:\*\*\s*(.+)/);
                if (aMatch) {
                    const questionText = qMatch[1].trim();
                    const answerText = aMatch[1].trim();
                    block.type = 'quickcheck_hidden';
                    next.type = 'quickcheck_hidden';
                    if (
                        !isLowSignalLessonLine(questionText)
                        && !isLowSignalLessonLine(answerText)
                    ) {
                        quickCheckPairs.push({
                            questionText,
                            answerText,
                            key: `qc-${b}`,
                        });
                    }
                    b += 1; // skip answer line
                }
            }
        }

        // Word Bank: collect term/definition from bullets
        if (WORD_BANK_SECTION_PATTERN.test(currentSection)
            && block.type === 'bullet') {
            const termMatch = blockText.match(/^(.+?)\s+[—–-]\s+(.+)$/);
            if (termMatch) {
                wordBankTerms.push({
                    term: termMatch[1].replace(/\*\*/g, '').trim(),
                    definition: termMatch[2].trim(),
                    key: `wb-${b}`,
                });
                block.type = 'wordbank_hidden';
            }
        }

        // Analogies: convert numbered items to analogy cards
        if (ANALOGY_SECTION_PATTERN.test(currentSection)
            && block.type === 'numbered') {
            const analogyMatch = blockText.match(/^\*\*(.+?):\*\*\s*(.+)/);
            if (analogyMatch) {
                block.type = 'analogycard';
                block.label = analogyMatch[1].trim();
                block.text = analogyMatch[2].trim();
            }
        }

        // Common Mistakes: add labels to bullets
        if (COMMON_MISTAKE_SECTION_PATTERN.test(currentSection)
            && block.type === 'bullet') {
            block.type = 'mistake';
            block.label = detectMistakeLabel(blockText);
        }
    }

    const wordCount = normalizedContent
        ? normalizedContent.replace(/[#>*_`~-]/g, ' ').split(/\s+/).filter(Boolean).length
        : 0;
    const readingMinutes = Math.max(1, Math.ceil(wordCount / 200));

    return { blocks, toc, readingMinutes, quickCheckPairs, wordBankTerms };
};

// Prefer structured definitions from the DB over the markdown parse.
export const resolveWordBankTerms = ({ dbDefinitions, parsedTerms }) => {
    if (dbDefinitions?.length > 0) {
        return dbDefinitions.map((d, i) => ({ term: d.term, definition: d.meaning, key: `db-${i}` }));
    }
    return parsedTerms;
};

export const filterBlocksByStudyMode = (blocks, studyMode) => {
    if (!studyMode || studyMode === 'full' || !SECTION_SETS[studyMode]) return blocks;
    const allowed = SECTION_SETS[studyMode];
    let include = false;
    return blocks.filter((block) => {
        if (block.type === 'header') {
            const normalized = block.text.toLowerCase().replace(SECTION_TEXT_STRIP_PATTERN, '').trim();
            include = allowed.some((sectionTitle) => normalized.indexOf(sectionTitle) !== -1);
            return include; // always show allowed section headers
        }
        return include;
    });
};

export const buildLessonStepsFromBlocks = ({
    blocks,
    topicTitle = '',
    checks = [],
    wordBankTerms = [],
    studyMode,
} = {}) => {
    const normalizeTitle = (value) => String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    const pageTitleKey = normalizeTitle(topicTitle);
    let skippedDuplicateTitle = false;
    const sectionBlocks = blocks.filter((block) => {
        if (
            !skippedDuplicateTitle
            && block.type === 'header'
            && block.level === 1
            && pageTitleKey
            && normalizeTitle(block.text) === pageTitleKey
        ) {
            skippedDuplicateTitle = true;
            return false;
        }
        return true;
    });
    return buildLessonSteps({
        sections: splitBlocksIntoSections(sectionBlocks),
        checks,
        wordBankTerms,
        studyMode,
    });
};
