import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as courseGeneration from '../server/courseGeneration.js';
import { normalizeAiCoursePayload } from '../server/aiCourseGeneration.js';

// Heuristic MCQs used other true sentences from the source as distractors, so
// a correct pick could be marked wrong. Without the model, topics are lessons only.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

assert.equal(courseGeneration.buildQuestionsForTopic, undefined, 'the heuristic MCQ builder must be gone');

const source = [
  '# Cell Theory',
  'All living things are made of cells. Cells are the basic unit of life. New cells come from existing cells.',
  '',
  '# Organelles',
  'Mitochondria produce ATP during cellular respiration. Ribosomes build proteins from amino acids in the cytoplasm.',
].join('\n');

// An unusable model payload falls back to heuristic topics.
const fallback = normalizeAiCoursePayload({ topics: [] }, { fileName: 'biology.pdf', extractedText: source });
assert.equal(fallback.backend, 'heuristic');
assert.ok(fallback.topics.length > 0, 'heuristic fallback still builds lessons');
// Paragraph-chunked sources (no headings) take the same path.
const paragraphs = normalizeAiCoursePayload(
  { topics: [] },
  { fileName: 'notes.pdf', extractedText: source.replace(/^# .*$/gm, '').trim() },
);
for (const topic of [...fallback.topics, ...paragraphs.topics]) {
  assert.ok(String(topic.lesson?.sections?.[0]?.body || '').trim(), 'heuristic topics keep the lesson text');
  assert.deepEqual(topic.questions, [], 'heuristic topics must not ship quiz MCQs');
  assert.deepEqual(topic.inLessonChecks, [], 'heuristic topics must not ship in-lesson checks');
}

// A topic whose AI questions are all ungrounded gets no quiz, not heuristic filler.
const ungrounded = normalizeAiCoursePayload(
  {
    topics: [
      {
        title: 'Cell Theory',
        lesson: { sections: [{ title: 'What cell theory says', role: 'core', body: source }] },
        questions: [
          {
            prompt: 'What is the smallest unit of life?',
            options: ['A planet', 'A galaxy', 'A star', 'A comet'],
            correctIndex: 0,
          },
        ],
      },
    ],
  },
  { fileName: 'biology.pdf', extractedText: source },
);
assert.deepEqual(ungrounded.topics[0].questions, []);

const aiSource = read('server/aiCourseGeneration.js');
assert.doesNotMatch(aiSource, /buildQuestionsForTopic/);
assert.doesNotMatch(aiSource, /which statement is accurate/);

const courses = read('server/courses.js');
assert.doesNotMatch(courses, /regenerateQuizForTopic/, 'the heuristic-only quiz regeneration must be gone');
assert.doesNotMatch(read('server/courseHttp.js'), /regenerateQuiz/);
assert.doesNotMatch(read('src/pages/TopicQuizPlayer.jsx'), /quiz\/regenerate|fresh/);
assert.doesNotMatch(read('src/pages/DashboardResults.jsx'), /\?fresh=1/);

const topicDetail = read('src/hooks/useTopicDetail.js');
assert.match(topicDetail, /const topicHasQuiz = Number\(topic\?\.questionCount \|\| 0\) > 0;/);
assert.match(topicDetail, /isTopicQuizRoute\s*\?\s*\(topicHasQuiz \? topicId : null\)/, 'a lesson without questions must not link to an empty quiz');
assert.match(read('src/components/study/LessonCompletion.jsx'), /quizHref \? 'Ready to test what you remember\?'/);

const migrations = readdirSync(join(root, 'supabase/migrations'));
const cleanup = migrations.find((name) => name.endsWith('_drop_heuristic_mcqs.sql'));
assert.ok(cleanup, 'stored heuristic MCQs must be removed by a migration');
assert.match(
  read(`supabase/migrations/${cleanup}`),
  /DELETE FROM public\.questions[\s\S]*According to “%”, which statement is accurate\?/,
);

console.log('heuristic-mcq-removed-regression.test.mjs passed');
