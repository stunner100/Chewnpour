import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const examModePath = path.join(root, 'src', 'pages', 'ExamMode.jsx');
const source = await fs.readFile(examModePath, 'utf8');

if (!/import \{ ConvexHttpClient \} from 'convex\/browser';/.test(source)) {
  throw new Error('Expected ExamMode to import ConvexHttpClient for exam startup.');
}

if (!/const fetchConvexBrowserToken = async \(\) => \{/.test(source)) {
  throw new Error('Expected ExamMode to fetch a browser auth token before starting exams.');
}

if (!/const readCachedConvexBrowserToken = \(\) => \{/.test(source) || !/better-auth\.convex_jwt/.test(source)) {
  throw new Error('Expected ExamMode to reuse the cached Better Auth Convex JWT before fetching a new one.');
}

if (!/for \(let attempt = 0; attempt < 6; attempt \+= 1\)/.test(source)) {
  throw new Error('Expected ExamMode to retry browser auth token fetches during session sync.');
}

if (!/await getSession\(\)\.catch\(\(\) => null\);/.test(source)) {
  throw new Error('Expected ExamMode to refresh Better Auth session data before giving up on Convex JWT sync.');
}

if (!/const startExamAttemptHttp = useCallback\(async \(\{ topicId: nextTopicId, examFormat: nextExamFormat \}\) => \{/.test(source)) {
  throw new Error('Expected ExamMode to define an HTTP-backed exam start helper.');
}

if (!/client\.action\(api\.exams\.startExamAttempt, \{[\s\S]*topicId: nextTopicId,[\s\S]*examFormat: nextExamFormat/.test(source)) {
  throw new Error('Expected ExamMode to start exams through ConvexHttpClient.action.');
}

if (!/withTimeout\(\s*startExamAttemptHttp\(\{ topicId, examFormat \}\)/.test(source)) {
  throw new Error('Expected ExamMode to use the HTTP-backed exam start helper in beginExamAttempt.');
}

if (!/topicId[\s\S]*examFormat[\s\S]*userId[\s\S]*!authLoading[\s\S]*!examStarted/.test(source)) {
  throw new Error('Expected ExamMode autostart to wait for an authenticated, settled session.');
}

console.log('exam-http-start-regression.test.mjs passed');
