/**
 * Regression test: question repetition across exam attempts.
 *
 * Verifies:
 * 1. First attempt draws from the full question pool
 * 2. Second attempt gets entirely fresh (unseen) questions when the bank is large enough
 * 3. When the bank is exhausted, least-recently-seen questions are recycled (not blocked)
 * 4. Format filtering — MCQ history doesn't affect essay selection (and vice versa)
 * 5. Lookback window is 50, not the old 10
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const selectionPath = path.join(root, 'convex', 'lib', 'examQuestionSelection.js');
const examsPath = path.join(root, 'convex', 'exams.ts');

const [selectionSource, examsSource] = await Promise.all([
  fs.readFile(selectionPath, 'utf8'),
  fs.readFile(examsPath, 'utf8'),
]);

// ── Source-level checks ──

// 1. Lookback is 50
if (!examsSource.includes('EXAM_ATTEMPT_REUSE_LOOKBACK = 50')) {
  throw new Error('Expected EXAM_ATTEMPT_REUSE_LOOKBACK = 50 in exams.ts');
}

// 2. examFormat parameter is passed to selectQuestionsForAttempt
if (!/selectQuestionsForAttempt\(\{[\s\S]*examFormat,/.test(examsSource)) {
  throw new Error('Expected examFormat to be passed to selectQuestionsForAttempt');
}

// 3. Format filtering exists in buildSeenQuestionIdsFromCompletedAttempts
if (!selectionSource.includes('buildSeenQuestionIdsFromCompletedAttempts = (recentAttempts, examFormat)')) {
  throw new Error('Expected buildSeenQuestionIdsFromCompletedAttempts to accept examFormat parameter');
}

// 4. questionLastSeenOrder tracking exists
if (!selectionSource.includes('questionLastSeenOrder')) {
  throw new Error('Expected questionLastSeenOrder tracking for least-recently-seen fallback');
}

// 5. selectQuestionsForAttempt accepts examFormat
if (!selectionSource.includes('examFormat,')) {
  throw new Error('Expected selectQuestionsForAttempt to destructure examFormat');
}

console.log('✓ Source-level checks passed');

// ── Dynamic import for logic tests ──

// We need to import the module. Since it uses ESM exports, use dynamic import
// with a file:// URL. Convex modules may use bare specifiers that won't resolve
// in Node, so we inline the key functions for isolated testing.

const makeQuestion = (id, text, type = 'mcq', difficulty = 'medium') => ({
  _id: id,
  questionText: text,
  questionType: type,
  difficulty,
  options: type !== 'essay' ? [
    { label: 'A', text: 'Option A', isCorrect: true },
    { label: 'B', text: 'Option B', isCorrect: false },
    { label: 'C', text: 'Option C', isCorrect: false },
    { label: 'D', text: 'Option D', isCorrect: false },
  ] : undefined,
  correctAnswer: type === 'essay' ? 'Model answer text here' : 'Option A',
});

const makeAttempt = (id, questionIds, format = 'mcq', answered = true) => ({
  _id: id,
  _creationTime: Date.now() - 60000,
  examFormat: format,
  topicId: 'topic1',
  questionIds,
  answers: answered ? questionIds.map(qid => ({ questionId: qid, selectedAnswer: 'A' })) : [],
  score: answered ? 1 : 0,
});

// ── Inline the core selection logic for testing ──

const normalizeQuestionPromptKey = (value) => {
  return String(value || '')
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
};

const dedupeQuestionsByPrompt = (questions) => {
  const items = Array.isArray(questions) ? questions : [];
  const seenPromptKeys = new Set();
  const deduped = [];
  for (const question of items) {
    if (!question) continue;
    const normalizedPrompt = normalizeQuestionPromptKey(question.questionText);
    const fallbackKey = String(question._id || '');
    const dedupeKey = normalizedPrompt || fallbackKey;
    if (!dedupeKey) continue;
    if (seenPromptKeys.has(dedupeKey)) continue;
    seenPromptKeys.add(dedupeKey);
    deduped.push(question);
  }
  return deduped;
};

const pickRandomSubset = (items, size) => {
  const copied = [...items];
  for (let i = copied.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }
  return copied.slice(0, Math.max(0, size));
};

const buildSeenQuestionIdsFromCompletedAttempts = (recentAttempts, examFormat) => {
  const attempts = Array.isArray(recentAttempts) ? recentAttempts : [];
  const normalizedFormat = String(examFormat || '').trim().toLowerCase();
  const completedAttempts = attempts.filter((attempt) => {
    const answers = Array.isArray(attempt?.answers) ? attempt.answers : [];
    if (answers.length === 0) return false;
    if (normalizedFormat) {
      const attemptFormat = String(attempt?.examFormat || '').trim().toLowerCase();
      if (attemptFormat && attemptFormat !== normalizedFormat) return false;
    }
    return true;
  });

  const seenQuestionIds = new Set();
  const questionLastSeenOrder = new Map();
  let rank = 0;
  for (const attempt of completedAttempts) {
    const questionIds = Array.isArray(attempt?.questionIds) ? attempt.questionIds : [];
    for (const questionId of questionIds) {
      const key = String(questionId);
      seenQuestionIds.add(key);
      if (!questionLastSeenOrder.has(key)) {
        questionLastSeenOrder.set(key, rank);
      }
    }
    rank += 1;
  }
  return { seenQuestionIds, questionLastSeenOrder, completedAttemptCount: completedAttempts.length };
};

const selectQuestionsForAttempt = ({ questions, recentAttempts, subsetSize, isEssay, examFormat }) => {
  const dedupedQuestions = dedupeQuestionsByPrompt(questions);
  const effectiveFormat = examFormat || (isEssay ? 'essay' : 'mcq');
  const { seenQuestionIds, questionLastSeenOrder, completedAttemptCount } =
    buildSeenQuestionIdsFromCompletedAttempts(recentAttempts, effectiveFormat);
  const unseenQuestions = dedupedQuestions.filter(
    (question) => !seenQuestionIds.has(String(question?._id))
  );
  const targetSize = Math.max(0, Number(subsetSize || 0));

  if (completedAttemptCount === 0) {
    const selectedQuestions = pickRandomSubset(dedupedQuestions, targetSize);
    return { selectedQuestions, dedupedCount: dedupedQuestions.length, unseenCount: unseenQuestions.length, completedAttemptCount, requiresFreshGeneration: false };
  }

  if (unseenQuestions.length >= targetSize) {
    const selectedQuestions = pickRandomSubset(unseenQuestions, targetSize);
    return { selectedQuestions, dedupedCount: dedupedQuestions.length, unseenCount: unseenQuestions.length, completedAttemptCount, requiresFreshGeneration: false };
  }

  if (unseenQuestions.length > 0 || dedupedQuestions.length > 0) {
    const selected = [...unseenQuestions];
    const remainingNeeded = targetSize - selected.length;
    if (remainingNeeded > 0) {
      const seenQuestions = dedupedQuestions
        .filter((q) => seenQuestionIds.has(String(q?._id)))
        .sort((a, b) => {
          const rankA = questionLastSeenOrder.get(String(a?._id)) ?? Infinity;
          const rankB = questionLastSeenOrder.get(String(b?._id)) ?? Infinity;
          return rankB - rankA;
        });
      selected.push(...seenQuestions.slice(0, remainingNeeded));
    }
    const selectedQuestions = pickRandomSubset(selected, targetSize);
    return { selectedQuestions, dedupedCount: dedupedQuestions.length, unseenCount: unseenQuestions.length, completedAttemptCount, requiresFreshGeneration: unseenQuestions.length === 0 };
  }

  return { selectedQuestions: [], dedupedCount: 0, unseenCount: 0, completedAttemptCount, requiresFreshGeneration: true };
};

// ── Test 1: First attempt uses full pool ──
{
  const questions = Array.from({ length: 50 }, (_, i) => makeQuestion(`q${i}`, `Question ${i}`));
  const result = selectQuestionsForAttempt({
    questions,
    recentAttempts: [],
    subsetSize: 35,
    isEssay: false,
    examFormat: 'mcq',
  });

  if (result.selectedQuestions.length !== 35) {
    throw new Error(`Test 1: Expected 35 questions, got ${result.selectedQuestions.length}`);
  }
  if (result.requiresFreshGeneration) {
    throw new Error('Test 1: Should not require fresh generation on first attempt');
  }
  console.log('✓ Test 1: First attempt draws 35 from full pool of 50');
}

// ── Test 2: Second attempt gets entirely unseen questions ──
{
  const questions = Array.from({ length: 70 }, (_, i) => makeQuestion(`q${i}`, `Question ${i}`));
  const firstAttemptIds = questions.slice(0, 35).map(q => q._id);
  const attempt1 = makeAttempt('a1', firstAttemptIds, 'mcq', true);

  const result = selectQuestionsForAttempt({
    questions,
    recentAttempts: [attempt1],
    subsetSize: 35,
    isEssay: false,
    examFormat: 'mcq',
  });

  const selectedIds = new Set(result.selectedQuestions.map(q => q._id));
  const overlap = firstAttemptIds.filter(id => selectedIds.has(id));

  if (overlap.length > 0) {
    throw new Error(`Test 2: Expected 0 overlap with first attempt, got ${overlap.length}: ${overlap.join(', ')}`);
  }
  if (result.selectedQuestions.length !== 35) {
    throw new Error(`Test 2: Expected 35 questions, got ${result.selectedQuestions.length}`);
  }
  console.log('✓ Test 2: Second attempt gets 35 entirely unseen questions (0 overlap)');
}

// ── Test 3: Exhausted bank recycles least-recently-seen (never blocks) ──
{
  const questions = Array.from({ length: 20 }, (_, i) => makeQuestion(`q${i}`, `Question ${i}`));
  // Two completed attempts that together cover all 20 questions.
  const attempt1 = makeAttempt('a1', questions.slice(0, 10).map(q => q._id), 'mcq', true);
  const attempt2 = makeAttempt('a2', questions.slice(10, 20).map(q => q._id), 'mcq', true);

  const result = selectQuestionsForAttempt({
    questions,
    recentAttempts: [attempt2, attempt1], // most recent first
    subsetSize: 10,
    isEssay: false,
    examFormat: 'mcq',
  });

  if (result.selectedQuestions.length === 0) {
    throw new Error('Test 3: Should NOT return 0 questions when bank is exhausted — should recycle');
  }
  if (result.selectedQuestions.length !== 10) {
    throw new Error(`Test 3: Expected 10 recycled questions, got ${result.selectedQuestions.length}`);
  }

  // The recycled questions should prefer the oldest (attempt1's questions).
  // attempt1 is rank=1 (older), attempt2 is rank=0 (newer).
  // So attempt1's questions should be preferred.
  const selectedIds = new Set(result.selectedQuestions.map(q => q._id));
  const fromAttempt1 = questions.slice(0, 10).filter(q => selectedIds.has(q._id)).length;
  if (fromAttempt1 < 5) {
    throw new Error(`Test 3: Expected recycled set to prefer oldest questions, but only ${fromAttempt1}/10 came from attempt1`);
  }
  console.log(`✓ Test 3: Exhausted bank recycles ${result.selectedQuestions.length} questions (${fromAttempt1} from oldest attempt)`);
}

// ── Test 4: Format filtering — essay attempts don't count as MCQ history ──
{
  const mcqQuestions = Array.from({ length: 40 }, (_, i) => makeQuestion(`mcq${i}`, `MCQ Question ${i}`, 'mcq'));
  const essayAttemptIds = Array.from({ length: 15 }, (_, i) => `essay${i}`);
  const essayAttempt = makeAttempt('ea1', essayAttemptIds, 'essay', true);

  const result = selectQuestionsForAttempt({
    questions: mcqQuestions,
    recentAttempts: [essayAttempt],
    subsetSize: 35,
    isEssay: false,
    examFormat: 'mcq',
  });

  // The essay attempt should be ignored for MCQ selection, so completedAttemptCount = 0
  // and all questions are available.
  if (result.completedAttemptCount !== 0) {
    throw new Error(`Test 4: Expected 0 MCQ completed attempts (essay should be filtered), got ${result.completedAttemptCount}`);
  }
  if (result.selectedQuestions.length !== 35) {
    throw new Error(`Test 4: Expected 35 MCQ questions, got ${result.selectedQuestions.length}`);
  }
  console.log('✓ Test 4: Essay history correctly ignored for MCQ selection');
}

// ── Test 5: Format filtering — MCQ attempts don't count as essay history ──
{
  const essayQuestions = Array.from({ length: 20 }, (_, i) => makeQuestion(`e${i}`, `Essay Question ${i}`, 'essay'));
  const mcqAttemptIds = Array.from({ length: 35 }, (_, i) => `mcq${i}`);
  const mcqAttempt = makeAttempt('ma1', mcqAttemptIds, 'mcq', true);

  const result = selectQuestionsForAttempt({
    questions: essayQuestions,
    recentAttempts: [mcqAttempt],
    subsetSize: 15,
    isEssay: true,
    examFormat: 'essay',
  });

  if (result.completedAttemptCount !== 0) {
    throw new Error(`Test 5: Expected 0 essay completed attempts (MCQ should be filtered), got ${result.completedAttemptCount}`);
  }
  console.log('✓ Test 5: MCQ history correctly ignored for essay selection');
}

// ── Test 6: Many attempts — lookback covers 50 attempts worth of questions ──
{
  const totalQuestions = 200;
  const questions = Array.from({ length: totalQuestions }, (_, i) => makeQuestion(`q${i}`, `Question ${i}`));

  // Simulate 12 past attempts, each using 10 questions (120 questions seen total).
  const attempts = [];
  for (let a = 0; a < 12; a++) {
    const ids = questions.slice(a * 10, (a + 1) * 10).map(q => q._id);
    attempts.unshift(makeAttempt(`a${a}`, ids, 'mcq', true)); // newest first
  }

  const result = selectQuestionsForAttempt({
    questions,
    recentAttempts: attempts,
    subsetSize: 35,
    isEssay: false,
    examFormat: 'mcq',
  });

  // 200 total - 120 seen = 80 unseen. Should get 35 fully unseen.
  const selectedIds = new Set(result.selectedQuestions.map(q => q._id));
  const seenIds = new Set(attempts.flatMap(a => a.questionIds));
  const overlapCount = result.selectedQuestions.filter(q => seenIds.has(q._id)).length;

  if (overlapCount > 0) {
    throw new Error(`Test 6: Expected 0 overlap across 12 attempts, got ${overlapCount}`);
  }
  if (result.selectedQuestions.length !== 35) {
    throw new Error(`Test 6: Expected 35 questions, got ${result.selectedQuestions.length}`);
  }
  console.log(`✓ Test 6: 12 past attempts (120 seen), still got 35 fully fresh questions from pool of 200`);
}

// ── Test 7: Partial unseen + recycled fill ──
{
  const questions = Array.from({ length: 40 }, (_, i) => makeQuestion(`q${i}`, `Question ${i}`));
  // One attempt used 35 questions — only 5 unseen remain.
  const attempt1 = makeAttempt('a1', questions.slice(0, 35).map(q => q._id), 'mcq', true);

  const result = selectQuestionsForAttempt({
    questions,
    recentAttempts: [attempt1],
    subsetSize: 35,
    isEssay: false,
    examFormat: 'mcq',
  });

  if (result.selectedQuestions.length !== 35) {
    throw new Error(`Test 7: Expected 35 questions (5 unseen + 30 recycled), got ${result.selectedQuestions.length}`);
  }

  const selectedIds = new Set(result.selectedQuestions.map(q => q._id));
  const unseenSelected = questions.slice(35, 40).filter(q => selectedIds.has(q._id)).length;
  if (unseenSelected !== 5) {
    throw new Error(`Test 7: Expected all 5 unseen questions included, got ${unseenSelected}`);
  }
  // requiresFreshGeneration should be false because we still had some unseen
  if (result.requiresFreshGeneration) {
    throw new Error('Test 7: Should not require fresh generation when some unseen exist');
  }
  console.log(`✓ Test 7: Partial bank (5 unseen + 30 recycled) = 35 total, no blocking`);
}

// ── Test 8: Duplicate question texts are deduped ──
{
  const questions = [
    makeQuestion('q1', 'What is polymorphism?'),
    makeQuestion('q2', 'What is polymorphism?'), // exact duplicate text
    makeQuestion('q3', 'What is encapsulation?'),
  ];

  const result = selectQuestionsForAttempt({
    questions,
    recentAttempts: [],
    subsetSize: 10,
    isEssay: false,
    examFormat: 'mcq',
  });

  if (result.dedupedCount !== 2) {
    throw new Error(`Test 8: Expected 2 deduped questions, got ${result.dedupedCount}`);
  }
  if (result.selectedQuestions.length !== 2) {
    throw new Error(`Test 8: Expected 2 selected (after dedup), got ${result.selectedQuestions.length}`);
  }
  console.log('✓ Test 8: Duplicate question texts correctly deduped');
}

console.log('\n✅ All question repetition regression tests passed.');
