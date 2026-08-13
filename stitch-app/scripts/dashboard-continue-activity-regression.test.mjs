import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'process';

const root = process.cwd();
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const [
  dashboard,
  progressPage,
  progressServer,
  topicNotes,
  courseHttp,
  activity,
  player,
  hub,
  card,
  examMode,
  migration,
] = await Promise.all([
  read('src/pages/StudentDashboard.jsx'),
  read('src/pages/StudyProgressMastery.jsx'),
  read('server/progress.js'),
  read('server/topicNotes.js'),
  read('server/courseHttp.js'),
  read('src/lib/resumeActivity.js'),
  read('src/components/podcast/PodcastWaveformPlayer.jsx'),
  read('src/pages/DashboardPodcasts.jsx'),
  read('src/components/lesson/LessonPodcastCard.jsx'),
  read('src/pages/ExamMode.jsx'),
  read('supabase/migrations/20260813190000_topic_progress_last_activity_kind.sql'),
]);

if (!/resumeActivityCopy/.test(dashboard) || !/continueHref/.test(dashboard)) {
  throw new Error('Dashboard continue card must resume the current lesson, quiz, or podcast.');
}
if (!/Continue studying/.test(dashboard)) {
  throw new Error('Dashboard must keep a Continue studying CTA for lessons.');
}
if (!/last_activity_kind/.test(progressServer) || !/buildResumeTarget/.test(progressServer)) {
  throw new Error('Progress snapshot must pick resume targets from current study activity.');
}
if (!/last_activity_kind/.test(topicNotes) || !/lastActivityKind/.test(topicNotes)) {
  throw new Error('Topic progress must persist lastActivityKind.');
}
if (!/lastActivityKind: "quiz"/.test(courseHttp)) {
  throw new Error('Opening a topic quiz must record quiz activity.');
}
if (!/recordStudyActivity/.test(hub) || !/recordStudyActivity/.test(card)) {
  throw new Error('Playing a podcast must record listening activity.');
}
if (!/onPlay/.test(player)) {
  throw new Error('Podcast player must notify when playback starts.');
}
if (!/resumeCopy/.test(progressPage) || !/resumeTarget\?\.href/.test(progressPage)) {
  throw new Error('Progress next-up must use the activity-aware resume href.');
}
if (!/shouldResume/.test(examMode) || !/get\('resume'\) === '1'/.test(examMode)) {
  throw new Error('Exam mode must resume an in-progress exam from the dashboard.');
}
if (!/last_activity_kind/.test(migration)) {
  throw new Error('Expected topic_progress.last_activity_kind migration.');
}
if (!/kind === 'quiz'/.test(activity) || !/Continue listening/.test(activity)) {
  throw new Error('Resume copy must distinguish lesson, quiz, and listening.');
}

console.log('dashboard-continue-activity-regression.test.mjs passed');
