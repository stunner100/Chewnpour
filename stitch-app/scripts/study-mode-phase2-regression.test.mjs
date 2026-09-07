/**
 * Phase 2: persist the current lesson section, give the tutor that
 * section plus real quiz scores, and show source passages only when
 * topic_passages rows exist.
 *
 * Run: node scripts/study-mode-phase2-regression.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildResumeTarget, computeResumeProgressPercent } from '../server/resumeTarget.js';
import {
    lessonCheckCount,
    mergeStudyPositionIntoChecks,
    normalizeStudyPosition,
    splitLessonChecks,
    studyPositionPercent,
} from '../server/studyPosition.js';
import { formatTutorStudyBlock, sanitizeStudyContext } from '../server/tutorStudyContext.js';
import { resumeActivityCopy } from '../src/lib/resumeActivity.js';
import { buildStudyContext } from '../src/lib/studyPosition.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const position = normalizeStudyPosition({
    sectionIndex: 7,
    sectionCount: 5,
    sectionTitle: '  Working memory  ',
    finished: false,
});
assert.equal(position.sectionIndex, 4);
assert.equal(position.sectionCount, 5);
assert.equal(position.sectionTitle, 'Working memory');
assert.equal(studyPositionPercent(position), 99);
assert.equal(studyPositionPercent({ sectionIndex: 1, sectionCount: 5 }), 40);
assert.equal(studyPositionPercent({ sectionIndex: 4, sectionCount: 5, finished: true }), 100);
assert.equal(studyPositionPercent(null), null);
assert.equal(
    lessonCheckCount(mergeStudyPositionIntoChecks(
        { q1: { correct: true }, q2: { correct: false } },
        { sectionIndex: 1, sectionCount: 5, sectionTitle: 'Capacity' },
    )),
    2,
);
assert.equal(
    splitLessonChecks(mergeStudyPositionIntoChecks(
        { q1: { correct: true } },
        { sectionIndex: 1, sectionCount: 5, sectionTitle: 'Capacity' },
    )).studyPosition.sectionTitle,
    'Capacity',
);

assert.equal(
    computeResumeProgressPercent({
        kind: 'lesson',
        studyPosition: { sectionIndex: 1, sectionCount: 5, sectionTitle: 'Capacity' },
    }),
    40,
);

const resume = buildResumeTarget({
    latestProgress: {
        topicId: 'topic-wm',
        topicTitle: 'Working Memory',
        lastStudiedAt: '2026-09-06T15:00:00.000Z',
        lastActivityKind: 'lesson',
        studyPosition: { sectionIndex: 1, sectionCount: 5, sectionTitle: 'Capacity limits' },
    },
});
assert.equal(resume.sectionTitle, 'Capacity limits');
assert.equal(resume.progressPercent, 40);
assert.match(resumeActivityCopy(resume).hint, /Section 2 of 5/);
assert.match(resumeActivityCopy(resume).hint, /Capacity limits/);

const completedCopy = resumeActivityCopy({
    kind: 'lesson',
    topicTitle: 'Working Memory',
    completedAt: Date.now(),
    finished: true,
});
assert.equal(completedCopy.badge, 'Lesson complete');
assert.match(completedCopy.hint, /Ready to test/);

const context = sanitizeStudyContext({
    sectionIndex: 1,
    sectionCount: 5,
    sectionTitle: 'Capacity limits',
    sectionExcerpt: 'Hold a phone number briefly.',
});
const block = formatTutorStudyBlock({
    studyContext: context,
    snapshot: {
        completedAt: null,
        bestScore: 80,
        latestQuiz: { score: 8, total: 10 },
        missedQuestions: ['Why is working memory limited?'],
    },
});
assert.match(block, /CURRENT SECTION:/);
assert.match(block, /Index: 2 of 5/);
assert.match(block, /Title: Capacity limits/);
assert.match(block, /Best quiz score: 80%/);
assert.match(block, /Latest quiz: 8 \/ 10 \(80%\)/);
assert.match(block, /Missed questions: Why is working memory limited\?/);
assert.equal(sanitizeStudyContext(null), null);
assert.equal(sanitizeStudyContext({ sectionTitle: '' }), null);

const clientContext = buildStudyContext({
    sectionIndex: 0,
    sectionCount: 3,
    sectionTitle: 'What it is',
    sectionExcerpt: 'A temporary workspace.',
});
assert.equal(clientContext.sectionTitle, 'What it is');
assert.match(clientContext.sectionExcerpt, /temporary workspace/);

const tutorStream = read('server/tutorStream.js');
const topicChat = read('server/topicChat.js');
const topicNotes = read('server/topicNotes.js');
const courseHttp = read('server/courseHttp.js');
const hook = read('src/hooks/useTopicDetail.js');
const studyProgress = read('src/hooks/useStudyProgress.js');
const chatPanel = read('src/components/TopicChatPanel.jsx');
const useTutorChat = read('src/hooks/useTutorChat.js');
const stepper = read('src/components/lesson/LessonSectionStepper.jsx');
const results = read('src/pages/DashboardResults.jsx');
const sourcePanel = read('src/components/SourcePanel.jsx');
const views = read('src/components/topic/TopicLessonViews.jsx');
const studyPositionServer = read('server/studyPosition.js');

assert.match(studyPositionServer, /__studyPosition/);
assert.match(topicNotes, /mergeStudyPositionIntoChecks/);
assert.match(courseHttp, /parts\[1\] === "passages"/);
assert.match(courseHttp, /listTopicPassagesForUser/);
assert.match(tutorStream, /loadTopicTutorSnapshot/);
assert.match(topicChat, /studyContext/);
assert.match(useTutorChat, /studyContext: studyContextRef.current/);
assert.match(chatPanel, /current section "\$\{sectionTitle\}"/);
assert.match(stepper, /initialIndex/);
assert.match(
  stepper,
  /requestedIndex == null \|\| requestedIndex === ''/,
  'Resume must not treat a null requestedIndex as section 0.',
);
assert.match(hook, /useStudyProgress/);
assert.match(studyProgress, /buildStudyContext/);
assert.match(studyProgress, /\/passages/);
assert.match(
  studyProgress,
  /stepperReport\?\.index \?\? restoredPosition\?\.sectionIndex \?\? 0/,
  'Restored studyPosition must seed the live section index before the stepper reports.',
);
assert.match(
  studyProgress,
  /nextPosition\.sectionIndex === 0\s*&& restored\.sectionIndex > 0/,
  'Section 0 must not overwrite a restored later section before the stepper reports.',
);
assert.match(
  studyProgress,
  /pendingPositionRef\.current = nextPosition/,
  'Lesson position writes must queue so an older last-studied touch cannot clobber a later section.',
);
assert.match(
  studyProgress,
  /latestPositionRef\.current = nextPosition/,
  'The latest section must be remembered so leaving the lesson can flush it.',
);
assert.match(
  studyProgress,
  /return \(\) => window\.clearTimeout\(timer\)/,
  'Changing sections must cancel the debounce without writing the previous section.',
);
assert.match(
  studyProgress,
  /if \(latest\) enqueueStudyPosition\(latest\)/,
  'Leaving the lesson must flush the current section instead of dropping the debounce.',
);
assert.doesNotMatch(
  studyProgress,
  /upsertProgress\(\{ topicId, lastStudiedAt: Date\.now\(\), lastActivityKind: 'lesson' \}\)/,
  'Opening a lesson must not upsert lastActivityKind without the current studyPosition.',
);
assert.match(hook, /\/dashboard\/lessons\?courseId=/);
assert.doesNotMatch(hook, /\/dashboard\/course\/\$\{courseId\}/);
assert.doesNotMatch(results, /Try the essay/);
assert.match(results, /Retry with new questions/);
assert.match(sourcePanel, /Passage \{passage.page\}/);
assert.match(views, /<SourcePanel/);
assert.match(views, /hasSourcePassages/);
assert.doesNotMatch(block, /correctIndex/);

console.log('study-mode-phase2-regression.test.mjs passed');
