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
requireIncludes(workerChat, 'scrollerKey={topicId}', 'topic-scoped scroller reset');
requireIncludes(courseHttp, 'study-worker-token', 'signed study-worker token route');
requireIncludes(tokenServer, 'STUDY_WORKER_AUDIENCE = "study-worker"', 'audience-bound JWT');
requireIncludes(agentTs, 'zai/glm-5.2', 'GLM 5.2 study-worker model');
requireIncludes(channel, 'studyWorkerAuth()', 'ChewnPour JWT route auth');
requireExcludes(channel, 'placeholderAuth()', 'production placeholder auth');
requireIncludes(searchTool, 'getLessonForUser', 'user-scoped lesson search');
requireIncludes(bashTool, 'disableTool()', 'disabled sandbox shell');
requireIncludes(webSearch, 'disableTool()', 'disabled web search');
requireExcludes(topicPanel, '/api/topics/${encodeURIComponent(topicId)}/chat', 'legacy one-shot tutor chat in the panel');
requireExcludes(tutorPage, '/api/topics/${encodeURIComponent(topicId)}/chat', 'legacy one-shot tutor chat on the tutor page');

console.log('study-worker-eve-regression.test.mjs passed');
