// Checks a generated lesson against its own source span before it is kept.
//
// A section is supported when its sourceQuote is found in the span (word for
// word, or nearly: 80% of its words, for small extraction differences), every
// number in its body appears in the span, and most of the names it uses do.
// An unsupported optional section (steps, example, misconception, practice)
// is dropped: that is where a model invents episodes, counterarguments and
// worked examples the source never gave. An unsupported core section is kept
// but the lesson is flagged for review. Word bank terms not in the span are
// dropped.
import {
    contentWordCoverage,
    namesIn,
    numbersIn,
    sourceHasPhrase,
    sourceHasWord,
} from "./grounding.js";

const QUOTE_COVERAGE = 0.8;
const NAME_COVERAGE = 0.75;

export const checkSection = (section, source) => {
    const quote = String(section.sourceQuote || "").trim();
    const quoteFound = Boolean(quote) && (sourceHasPhrase(quote, source) || contentWordCoverage(quote, source) >= QUOTE_COVERAGE);
    const missingNumbers = [...new Set(numbersIn(section.body))].filter((number) => !sourceHasWord(number, source));
    const names = [...new Set(namesIn(`${section.title}. ${section.body}`))];
    const missingNames = names.filter((name) => !sourceHasWord(name, source));
    const namesOk = names.length === 0 || (names.length - missingNames.length) / names.length >= NAME_COVERAGE;
    const reasons = [
        ...(quoteFound ? [] : [quote ? "source quote not found" : "no source quote"]),
        ...(missingNumbers.length ? [`numbers not in source: ${missingNumbers.join(", ")}`] : []),
        ...(namesOk ? [] : [`names not in source: ${missingNames.join(", ")}`]),
    ];
    return { supported: reasons.length === 0, reasons };
};

// Returns { lesson, report }. report: { needsReview, droppedSections,
// unsupportedCoreSections, droppedTerms }, each a list of titles or terms.
export const groundLesson = (lesson, source) => {
    const report = { needsReview: false, droppedSections: [], unsupportedCoreSections: [], droppedTerms: [] };
    if (!String(source || "").trim()) return { lesson, report };
    const sections = [];
    for (const section of lesson.sections) {
        const { supported, reasons } = checkSection(section, source);
        if (supported) {
            sections.push(section);
        } else if (section.role === "core") {
            sections.push(section);
            report.unsupportedCoreSections.push({ title: section.title, reasons });
        } else {
            report.droppedSections.push({ title: section.title, role: section.role, reasons });
        }
    }
    const wordBank = lesson.wordBank.filter((entry) => {
        const found = sourceHasWord(entry.term, source);
        if (!found) report.droppedTerms.push(entry.term);
        return found;
    });
    report.needsReview = report.unsupportedCoreSections.length > 0;
    return { lesson: { ...lesson, sections, wordBank }, report };
};
