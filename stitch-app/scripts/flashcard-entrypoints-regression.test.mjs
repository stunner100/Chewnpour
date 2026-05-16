import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const source = await fs.readFile(
  path.join(root, 'src', 'pages', 'FlashcardStudySession.jsx'),
  'utf8',
);

const requireIncludes = (snippet, label) => {
  if (!source.includes(snippet)) {
    throw new Error(`Expected FlashcardStudySession.jsx to include ${label}.`);
  }
};

const requireExcludes = (snippet, label) => {
  if (source.includes(snippet)) {
    throw new Error(`FlashcardStudySession.jsx should not include ${label}.`);
  }
};

const extractComponent = (name) => {
  const start = source.indexOf(`const ${name} =`);
  if (start < 0) throw new Error(`Could not find ${name}.`);
  const nextComponent = source.indexOf('\nconst ', start + 1);
  return source.slice(start, nextComponent < 0 ? source.length : nextComponent);
};

requireIncludes(
  "const activeTopicId = deckId ? String(deckId) : '';",
  'route-param-only active topic selection',
);
requireExcludes(
  "const activeTopicId = deckId || resumeTarget?.topicId || '';",
  'resume-target auto-open on the flashcards index',
);

requireIncludes('const conceptsToTerms =', 'concept review fallback term builder');
requireIncludes('conceptReviewTerms', 'concept review terms merged into the active deck');
requireIncludes("definitionLabel: 'Review cue'", 'human review cue label for concept fallback cards');
requireIncludes("current.source === 'concept-review' ? 'Concept' : 'Term'", 'concept fallback front label');
requireExcludes(
  "`${status} concept from your recent practice, ${accuracy}.`",
  'raw concept status as a flashcard definition',
);

const courseCard = extractComponent('CourseFlashcardsCard');
if (courseCard.includes('to="/dashboard/flashcards"')) {
  throw new Error('CourseFlashcardsCard should not route back to the flashcards index.');
}
if (!courseCard.includes('course.firstTopicId')) {
  throw new Error('CourseFlashcardsCard should route to an actual course topic when one exists.');
}

requireIncludes(
  'const recordConceptReview = useMutation(api.concepts.createConceptSessionAttempt);',
  'concept review persistence mutation',
);
requireIncludes('recordConceptReview({', 'rating buttons persisting review attempts');
requireIncludes('correctAnswers: [term]', 'flashcard ratings recording the reviewed concept');

console.log('flashcard-entrypoints-regression.test.mjs passed');
