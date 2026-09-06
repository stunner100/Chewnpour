import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const repoRoot = path.resolve(root, '..');

const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const workerChat = await read('src/components/tutor/StudyWorkerChat.jsx');
const courseHttp = await read('server/courseHttp.js');
const tutorStream = await read('server/tutorStream.js');
const tutorTools = await read('server/tutorTools.js');
const useTutorChat = await read('src/hooks/useTutorChat.js');
const packageJson = await read('package.json');

const requireIncludes = (source, snippet, label) => {
  if (!source.includes(snippet)) {
    throw new Error(`Tutor stream should keep ${label}: ${snippet}`);
  }
};

const requireExcludes = (source, snippet, label) => {
  if (source.includes(snippet)) {
    throw new Error(`Tutor stream should avoid ${label}: ${snippet}`);
  }
};

// ---------------------------------------------------------------------------
// Eve is fully removed from stitch-app
// ---------------------------------------------------------------------------
requireExcludes(workerChat, "from 'eve/react'", 'eve React import');
requireExcludes(workerChat, 'useEveAgent', 'eve agent hook');
requireExcludes(packageJson, '"eve":', 'eve dependency in package.json');

// Verify studyWorkerToken files are deleted
for (const gone of [
    'server/studyWorkerToken.js',
    'src/lib/studyWorkerToken.js',
]) {
    try {
        await fs.access(path.join(root, gone));
        throw new Error(`${gone} should be deleted after Eve removal`);
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }
}

// No Eve imports anywhere in src/ or server/
const srcDir = path.join(root, 'src');
const serverDir = path.join(root, 'server');
for (const dir of [srcDir, serverDir]) {
    const files = await fs.readdir(dir, { recursive: true });
    for (const file of files) {
        if (!file.endsWith('.js') && !file.endsWith('.jsx')) continue;
        const content = await fs.readFile(path.join(dir, file), 'utf8');
        if (content.includes("from 'eve/react'") || content.includes("from 'eve'")) {
            throw new Error(`${file} should not import from eve after migration`);
        }
    }
}

// ---------------------------------------------------------------------------
// New streaming tutor architecture is in place
// ---------------------------------------------------------------------------
requireIncludes(workerChat, 'useTutorChat', 'custom tutor chat hook');
requireIncludes(workerChat, 'TutorChatMessages', 'existing tutor transcript');
requireIncludes(workerChat, 'TutorChatComposer', 'existing tutor composer');
requireIncludes(workerChat, 'scrollerKey={topicId}', 'topic-scoped scroller reset');

// Server streaming endpoint
requireIncludes(tutorStream, 'handleTutorStream', 'streaming handler export');
requireIncludes(tutorStream, 'text/event-stream', 'SSE content type');
requireIncludes(tutorStream, 'text-delta', 'streaming text delta events');
requireIncludes(tutorStream, 'message-complete', 'completion event');
requireIncludes(tutorStream, 'isCourseAiEnabled', 'AI feature flag check');
requireIncludes(tutorStream, 'toOutline', 'lesson outline in context');

// Server tools ported from study-agent
requireIncludes(tutorTools, 'splitMarkdownIntoSections', 'markdown section splitter');
requireIncludes(tutorTools, 'searchLessonSections', 'lesson search tool');
requireIncludes(tutorTools, 'findLessonSection', 'section retrieval tool');
requireIncludes(tutorTools, 'toOutline', 'lesson outline tool');
requireIncludes(tutorTools, 'listCourseLessonsForUser', 'sibling lessons tool');

// Route wired in courseHttp
requireIncludes(courseHttp, 'handleTutorStream', 'streaming route handler');
requireExcludes(courseHttp, 'signStudyWorkerToken', 'deleted token signer');
requireExcludes(courseHttp, 'study-worker-token', 'deleted token route');

// Client hook
requireIncludes(useTutorChat, '/api/topics/', 'API endpoint');
requireIncludes(useTutorChat, 'text/event-stream', 'SSE accept header');
requireIncludes(useTutorChat, 'text-delta', 'delta event parsing');
requireIncludes(useTutorChat, 'message-complete', 'completion event parsing');
requireIncludes(useTutorChat, 'parseTutorStreamError', 'object SSE errors become readable strings');
requireIncludes(useTutorChat, '_id: id', 'persisted messages keep _id for latest-turn scroll');

requireIncludes(tutorStream, 'followPostRedirects', 'Grid 307 supplier redirects keep the POST body');
requireIncludes(tutorStream, 'buildFallbackAnswer', 'stream path falls back to a lesson snippet');
requireIncludes(tutorStream, 'empty stream', 'empty provider streams fail over');
requireIncludes(tutorStream, 'res.headersSent', 'pre-SSE failures return JSON, not a broken event frame');
requireExcludes(tutorStream, 'All AI providers failed. Please try again later.', 'stream must not fail closed after a user row is inserted');

console.log('tutor-stream-regression.test.mjs passed');
