// Turns a topic's stored lesson (topics.lesson, see lessonSchema.js) into the
// steps the lesson stepper shows: one step per section, then the recap cards,
// then the Word Bank. Study modes filter sections by role. Used by the topic
// page and the public shared-course page, and run directly by regression
// scripts.
import { markdownWordCount } from './lessonMarkdown.js';

// Which section roles each study mode keeps. "full" keeps everything; the
// recap and Word Bank steps are part of every mode.
export const STUDY_MODE_ROLES = {
    quick_revision: ['core'],
    exam_prep: ['core', 'misconception', 'practice'],
};

// Labels students see above a section title. Core sections carry no label.
export const SECTION_ROLE_LABELS = {
    steps: { label: 'Steps', icon: 'low_priority' },
    example: { label: 'Example', icon: 'lightbulb' },
    misconception: { label: 'Common mistake', icon: 'error' },
    practice: { label: 'Try it', icon: 'edit' },
};

const lessonSections = (lesson) => (Array.isArray(lesson?.sections) ? lesson.sections : []);

const checksBySection = (checks) => {
    const bySection = new Map();
    for (const check of Array.isArray(checks) ? checks : []) {
        const index = Number(check?.sectionIndex);
        if (!Number.isInteger(index) || bySection.has(index)) continue;
        bySection.set(index, check);
    }
    return bySection;
};

export const buildLessonView = ({ lesson, checks = [], studyMode = 'full' } = {}) => {
    const sections = lessonSections(lesson);
    const recap = Array.isArray(lesson?.recap) ? lesson.recap : [];
    const wordBankTerms = (Array.isArray(lesson?.wordBank) ? lesson.wordBank : [])
        .map((entry, index) => ({ term: entry.term, definition: entry.definition, key: `wb-${index}` }));
    const allowedRoles = STUDY_MODE_ROLES[studyMode] || null;
    const checkFor = checksBySection(checks);

    let steps = sections
        .map((section, index) => ({
            type: 'section',
            sectionIndex: index,
            title: section.title,
            role: section.role || 'core',
            markdown: section.body,
            check: checkFor.get(index) || null,
        }))
        .filter((step) => !allowedRoles || allowedRoles.includes(step.role));
    if (studyMode === 'practice_only') {
        steps = steps.filter((step) => step.check);
    }
    if (recap.length > 0) {
        steps.push({ type: 'recap', title: 'Recap', items: recap, check: null });
    }
    if (wordBankTerms.length > 0) {
        steps.push({ type: 'wordbank', title: 'Word Bank', check: null });
    }

    const words = sections.reduce((sum, section) => sum + markdownWordCount(section.body), 0);
    return {
        hook: String(lesson?.hook || ''),
        sections,
        steps,
        wordBankTerms,
        firstHeading: sections[0]?.title || '',
        readingMinutes: Math.max(1, Math.ceil(words / 200)),
    };
};
