import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = async (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const migration = await read('supabase/migrations/20260724132000_topic_notes_progress.sql');
if (!/CREATE TABLE IF NOT EXISTS "topic_notes"/.test(migration)) {
  throw new Error('Expected topic_notes migration.');
}
if (!/CREATE TABLE IF NOT EXISTS "topic_progress"/.test(migration)) {
  throw new Error('Expected topic_progress migration.');
}

const topicNotes = await read('server/topicNotes.js');
for (const symbol of [
  'getTopicNoteForUser',
  'saveTopicNoteForUser',
  'getTopicProgressForUser',
  'upsertTopicProgressForUser',
]) {
  if (!topicNotes.includes(`export const ${symbol}`)) {
    throw new Error(`Expected topicNotes.js to export ${symbol}.`);
  }
}

const topicExplain = await read('server/topicExplain.js');
for (const symbol of ['explainTopicSelection', 'reExplainTopicContent']) {
  if (!topicExplain.includes(`export const ${symbol}`)) {
    throw new Error(`Expected topicExplain.js to export ${symbol}.`);
  }
}

const courseHttp = await read('server/courseHttp.js');
for (const snippet of [
  'parts[1] === "notes"',
  'parts[1] === "progress"',
  'parts[1] === "explain"',
  'parts[1] === "re-explain"',
  'parts[1] === "voice"',
]) {
  if (!courseHttp.includes(snippet)) {
    throw new Error(`Expected courseHttp to handle ${snippet}.`);
  }
}

const profiles = await read('server/profiles.js');
if (!profiles.includes('export const addStudyTimeForUser')) {
  throw new Error('Expected profiles.js to export addStudyTimeForUser.');
}

const profileHttp = await read('server/profileHttp.js');
if (!profileHttp.includes('/api/profile/study-time')) {
  throw new Error('Expected profileHttp to expose study-time.');
}

const useTopicDetail = await read('src/hooks/useTopicDetail.js');
if (/from ['"]convex\/react['"]|api\.topics\.|api\.ai\./.test(useTopicDetail)) {
  throw new Error('Expected useTopicDetail to stop depending on Convex.');
}
if (!useTopicDetail.includes('/api/topics/') || !useTopicDetail.includes('re-explain')) {
  throw new Error('Expected useTopicDetail to load/re-explain topics via /api/topics.');
}

const notesPanel = await read('src/components/TopicNotesPanel.jsx');
if (/from ['"]convex\/react['"]|api\.topicNotes/.test(notesPanel)) {
  throw new Error('Expected TopicNotesPanel to stop depending on Convex.');
}
if (!notesPanel.includes('/notes')) {
  throw new Error('Expected TopicNotesPanel to call /api/topics/:id/notes.');
}

const highlight = await read('src/components/HighlightExplainPopover.jsx');
if (/from ['"]convex\/react['"]|api\.ai\.explainSelection/.test(highlight)) {
  throw new Error('Expected HighlightExplainPopover to stop depending on Convex.');
}
if (!highlight.includes('/explain')) {
  throw new Error('Expected HighlightExplainPopover to call /api/topics/:id/explain.');
}

const studyTimer = await read('src/hooks/useStudyTimer.js');
if (/from ['"]convex\/react['"]|api\.profiles\.addStudyTime/.test(studyTimer)) {
  throw new Error('Expected useStudyTimer to stop depending on Convex.');
}
if (!studyTimer.includes('/api/profile/study-time')) {
  throw new Error('Expected useStudyTimer to flush via /api/profile/study-time.');
}

const productResearch = await read('src/pages/ProductResearch.jsx');
if (/from ['"]convex\/react['"]|api\.productResearch/.test(productResearch)) {
  throw new Error('Expected ProductResearch to stop depending on Convex.');
}

const unsubscribe = await read('src/pages/Unsubscribe.jsx');
if (/from ['"]convex\/react['"]|api\.profiles\.unsubscribeByToken/.test(unsubscribe)) {
  throw new Error('Expected Unsubscribe to stop depending on Convex.');
}

const courses = await read('server/courses.js');
if (!courses.includes('_id: row.id') || !courses.includes('assessmentRoute: "topic_quiz"')) {
  throw new Error('Expected toClientTopic to expose _id and topic_quiz assessmentRoute.');
}

console.log('supabase-topic-lesson-milestone-regression.test.mjs passed');
