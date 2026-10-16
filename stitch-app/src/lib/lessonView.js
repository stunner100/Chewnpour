// Turns a topic's stored lesson markdown into what the lesson page shows:
// sections split on H1/H2, stepper steps with their in-lesson checks, the
// Word Bank terms and the reading time. Used by the topic page and the public
// shared-course page, and run directly by regression scripts.
import { normalizeLessonContent } from './topicContentFormatting.js';
import { SECTION_SETS, SECTION_TEXT_STRIP_PATTERN } from './topicLessonHelpers.js';
import {
    buildLessonSteps,
    isWordBankStepperTitle,
    normalizeSectionTitle,
    splitMarkdownIntoSections,
} from './lessonSections.js';
import { markdownWordCount, parseWordBankTerms } from './lessonMarkdown.js';

// A first-level heading that repeats the page title is dropped; its text joins
// the introduction.
const dropTitleHeading = (sections, topicTitle) => {
    const titleKey = normalizeSectionTitle(topicTitle);
    if (!titleKey) return sections;
    const index = sections.findIndex(
        (section) => section.level === 1 && normalizeSectionTitle(section.title) === titleKey,
    );
    if (index < 0) return sections;
    const next = [...sections];
    const titled = next[index];
    const previous = next[index - 1];
    if (previous && previous.level === 0) {
        next.splice(index - 1, 2, { ...previous, content: `${previous.content}\n\n${titled.content}` });
    } else {
        next.splice(index, 1, { ...titled, title: 'Introduction', level: 0 });
    }
    return next;
};

const filterSectionsByStudyMode = (sections, studyMode) => {
    const allowed = SECTION_SETS[studyMode];
    if (!allowed) return sections;
    return sections.filter((section) => {
        const normalized = section.title.toLowerCase().replace(SECTION_TEXT_STRIP_PATTERN, '').trim();
        return allowed.some((sectionTitle) => normalized.indexOf(sectionTitle) !== -1);
    });
};

const wordBankTermsFrom = (sections, wordBank) => {
    if (Array.isArray(wordBank) && wordBank.length > 0) {
        return wordBank.map((entry, i) => ({ term: entry.term, definition: entry.definition, key: `wb-${i}` }));
    }
    return sections
        .filter((section) => isWordBankStepperTitle(section.title))
        .flatMap((section) => parseWordBankTerms(section.content));
};

// In-lesson checks are stored against a section index of topics.lesson; the
// stepper matches them to sections by title.
export const checksWithSectionTitles = (checks, lesson) => {
    const sections = Array.isArray(lesson?.sections) ? lesson.sections : [];
    return (Array.isArray(checks) ? checks : [])
        .map((check) => ({ ...check, sectionTitle: sections[check?.sectionIndex]?.title || '' }))
        .filter((check) => check.sectionTitle);
};

export const buildLessonView = ({
    content,
    topicTitle = '',
    checks = [],
    studyMode = 'full',
    wordBank = null,
} = {}) => {
    const markdown = normalizeLessonContent(content);
    const sections = dropTitleHeading(splitMarkdownIntoSections(markdown), topicTitle);
    const wordBankTerms = wordBankTermsFrom(sections, wordBank);
    const steps = buildLessonSteps({
        sections: filterSectionsByStudyMode(sections, studyMode),
        checks,
        wordBankTerms,
        studyMode,
    });
    return {
        markdown,
        sections,
        steps,
        wordBankTerms,
        firstHeading: sections.find((section) => section.level > 0)?.title || '',
        readingMinutes: Math.max(1, Math.ceil(markdownWordCount(markdown) / 200)),
    };
};
