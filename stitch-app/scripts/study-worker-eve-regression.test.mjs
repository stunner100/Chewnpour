import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const repoRoot = path.resolve(root, '..');

const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const topicPanel = await read('src/components/TopicChatPanel.jsx');
const tutorPage = await read('src/pages/AIStudyTutor.jsx');
const workerChat = await read('src/components/tutor/StudyWorkerChat.jsx');
const courseHttp = await read('server/courseHttp.js');
const tokenServer = await read('server/studyWorkerToken.js');
const agentTs = await fs.readFile(path.join(repoRoot, 'study-agent', 'agent', 'agent.ts'), 'utf8');
const channel = await fs.readFile(path.join(repoRoot, 'study-agent', 'agent', 'channels', 'eve.ts'), 'utf8');
const searchTool = await fs.readFile(path.join(repoRoot, 'study-agent', 'agent', 'tools', 'search_lesson.ts'), 'utf8');
const bashTool = await fs.readFile(path.join(repoRoot, 'study-agent', 'agent', 'tools', 'bash.ts'), 'utf8');
const webSearch = await fs.readFile(path.join(repoRoot, 'study-agent', 'agent', 'tools', 'web_search.ts'), 'utf8');

const requireIncludes = (source, snippet, label) => {
  if (!source.includes(snippet)) {
    throw new Error(`Study worker should keep ${label}: ${snippet}`);
  }
};

const requireExcludes = (source, snippet, label) => {
  if (source.includes(snippet)) {
    throw new Error(`Study worker should avoid ${label}: ${snippet}`);
  }
};

requireIncludes(topicPanel, 'StudyWorkerChat', 'topic panel study worker chat');
requireIncludes(tutorPage, 'StudyWorkerChat', 'dedicated tutor study worker chat');
requireIncludes(workerChat, "from 'eve/react'", 'official eve React hook');
requireIncludes(workerChat, 'useEveAgent', 'durable eve session hook');
requireIncludes(workerChat, 'TutorChatMessages', 'existing tutor transcript');
requireIncludes(workerChat, 'TutorChatComposer', 'existing tutor composer');
requireIncludes(workerChat, 'mergePendingTutorMessages', 'pending user bubbles independent of eve');
requireIncludes(topicPanel, 'courseId={courseId}', 'topic panel passes course id to the study worker');
requireIncludes(workerChat, 'scrollerKey={topicId}', 'topic-scoped scroller reset');
requireIncludes(courseHttp, 'study-worker-token', 'signed study-worker token route');
requireIncludes(tokenServer, 'STUDY_WORKER_AUDIENCE = "study-worker"', 'audience-bound JWT');
requireIncludes(agentTs, 'zai/glm-5.2', 'GLM 5.2 study-worker model');
requireIncludes(channel, 'studyWorkerAuth()', 'ChewnPour JWT route auth');
requireIncludes(channel, '"x-eve-stream-format"', 'CORS must allow eve stream request headers');
requireExcludes(channel, 'placeholderAuth()', 'production placeholder auth');
requireIncludes(searchTool, 'getLessonForUser', 'user-scoped lesson search');
requireIncludes(bashTool, 'disableTool()', 'disabled sandbox shell');
requireIncludes(webSearch, 'disableTool()', 'disabled web search');
requireExcludes(topicPanel, '/api/topics/${encodeURIComponent(topicId)}/chat', 'legacy one-shot tutor chat in the panel');
requireExcludes(tutorPage, '/api/topics/${encodeURIComponent(topicId)}/chat', 'legacy one-shot tutor chat on the tutor page');

const { mergePendingTutorMessages } = await import('../src/lib/studyWorkerSession.js');
const pending = [{ id: 'pending-1', _id: 'pending-1', role: 'user', content: 'hello' }];
const merged = mergePendingTutorMessages([], pending);
if (merged.length !== 1 || merged[0].content !== 'hello') {
    throw new Error('Pending tutor messages must appear before the eve session echoes them');
}
const echoed = mergePendingTutorMessages([{
    id: 'eve-1',
    role: 'user',
    parts: [{ type: 'text', text: 'hello' }],
}], pending);
if (echoed.length !== 1 || echoed[0].id !== 'eve-1') {
    throw new Error('Pending tutor messages must drop once eve confirms the same user text');
}

console.log('study-worker-eve-regression.test.mjs passed');
