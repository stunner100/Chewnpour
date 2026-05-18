import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const source = await fs.readFile(
  path.join(root, 'src', 'pages', 'FlashcardStudySession.jsx'),
  'utf8',
);
const aiSource = await fs.readFile(path.join(root, 'convex', 'ai.ts'), 'utf8');

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

requireIncludes(
  'const terms = useMemo(() => getTopicTerms(topic), [topic]);',
  'lesson term selection',
);
requireIncludes('if (dbTerms.length >= 6) return dbTerms;', 'valid structured definition minimum before using stored deck');
requireIncludes(
  'Flashcards are built from lesson terms and definitions tied to your account.',
  'neutral flashcard source copy',
);
requireExcludes('const conceptsToTerms =', 'concept review fallback term builder');
requireExcludes('conceptReviewTerms', 'concept review terms merged into the active deck');
requireExcludes("source: 'concept-review'", 'concept review flashcard source marker');
requireExcludes("definitionLabel: 'Review cue'", 'human review cue label for concept fallback cards');
requireExcludes("current.source === 'concept-review' ? 'Concept' : 'Term'", 'concept fallback front label');
requireExcludes(
  "`${status} concept from your recent practice, ${accuracy}.`",
  'raw concept status as a flashcard definition',
);

if (!/Word Bank must include at least 6 entries\./.test(aiSource)) {
  throw new Error('Expected AI lesson generation to reject topics without at least 6 Word Bank entries.');
}
if (!aiSource.includes('structuredDefinitions: groundedTopicData.definitions')) {
  throw new Error('Expected grounded topic data definitions to be saved as structuredDefinitions.');
}
if (!aiSource.includes('extractWordBankDefinitionsFromLessonContent(content)')) {
  throw new Error('Expected lesson regeneration to extract fresh structuredDefinitions from the rebuilt Word Bank.');
}
if (!aiSource.includes('structuredDefinitions: rebuilt.structuredDefinitions')) {
  throw new Error('Expected lesson regeneration to patch stored structuredDefinitions.');
}

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
requireIncludes(
  'const regenerateLessonContent = useAction(api.ai.regenerateLessonContent);',
  'topic deck preparation action',
);
requireIncludes('terms.length < 6', 'minimum usable term-definition gate');
requireIncludes('Deck is being prepared', 'neutral invalid deck state');
requireIncludes('resumeFlashcardReady', 'latest flashcard entrypoint readiness gate');
requireIncludes('This deck is still being prepared from your lesson terms.', 'neutral latest topic flashcard entrypoint copy');
requireIncludes('actionLabel="Prepare deck"', 'neutral deck preparation CTA');
requireIncludes('Refresh deck', 'existing deck refresh CTA');
requireExcludes('Word Bank needs regeneration', 'generated-content failure copy');
requireExcludes('Regenerate Word Bank', 'generated-content regeneration copy');
requireExcludes('This topic needs a valid Word Bank before it can become a study deck.', 'generated-content failure explanation');
requireIncludes('onRegenerate={handleRegenerateTopic}', 'regenerate handler passed to the active deck');
requireIncludes('onRegenerateResumeTopic={handleRegenerateResumeTopic}', 'regenerate handler passed to the latest topic card');
requireIncludes('await regenerateLessonContent({', 'regenerate action invocation');
requireIncludes('GENERIC_DEFINITION_PATTERNS', 'client-side generic definition rejection');
requireIncludes('LEARNING_OBJECTIVE_FRAGMENT_TERM_PATTERN', 'client-side fragment term rejection');
requireIncludes('recordConceptReview({', 'rating buttons persisting review attempts');
requireIncludes('correctAnswers: [term]', 'flashcard ratings recording the reviewed concept');
requireExcludes('mastered this session', 'local mastered-session counter in flashcard controls');
requireIncludes('Card {safeIndex + 1} of {terms.length}', 'card position indicator in flashcard controls');
requireExcludes('Due for review', 'backend-sounding due review section title');
requireExcludes('need reinforcement', 'backend-sounding reinforcement copy');
requireExcludes('need more practice', 'backend-sounding weak concept copy');
requireExcludes('terms due', 'backend-sounding due count copy');
requireExcludes('item.dueCount', 'review-card due count rendering');
requireExcludes('item.weakCount', 'review-card weak count rendering');
requireExcludes('Practice next', 'recommendation-style review section title');
requireExcludes('Start review', 'review-status CTA copy');
requireIncludes('Study decks', 'neutral flashcard deck section title');
requireIncludes('Open deck', 'neutral flashcard deck CTA');
requireIncludes('Open first lesson', 'unverified course flashcard entrypoint opens the lesson instead of a broken deck');

console.log('flashcard-entrypoints-regression.test.mjs passed');
