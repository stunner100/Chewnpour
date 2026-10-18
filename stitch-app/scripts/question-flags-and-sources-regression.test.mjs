import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readMessageSources, toTutorSources } from '../server/tutorSources.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFile(path.join(root, rel), 'utf8');

// Tutor sources: at most 3 short snippets, from passages with ids.
const long = 'Mitochondria make ATP through oxidative phosphorylation. '.repeat(10);
const sources = toTutorSources([
    { id: 'p1', chunkIndex: 2, content: long },
    { id: 'p2', chunkIndex: 0, content: '  Short   passage. ' },
    { id: '', content: 'no id' },
    { id: 'p3', content: '' },
    { id: 'p4', content: 'Fourth' },
    { id: 'p5', content: 'Fifth' },
]);
assert.deepEqual(sources.map((s) => s.passageId), ['p1', 'p2', 'p4']);
assert.ok(sources[0].snippet.length <= 241 && sources[0].snippet.endsWith('…'), 'long passages are trimmed');
assert.equal(sources[1].snippet, 'Short passage.');
assert.deepEqual(readMessageSources({ sources: null }), []);

const [stream, chat, row, flags, flagHttp, admin, router, results, review, panel, migSources, migFlags] = await Promise.all([
    read('server/tutorStream.js'),
    read('server/topicChat.js'),
    read('src/components/tutor/TutorMessageRow.jsx'),
    read('server/questionFlags.js'),
    read('server/questionFlagHttp.js'),
    read('server/adminHttp.js'),
    read('api/router.js'),
    read('src/pages/DashboardResults.jsx'),
    read('src/pages/ReviewSession.jsx'),
    read('src/pages/admin/AdminDashboard.jsx'),
    read('supabase/migrations/20261018140000_tutor_message_sources.sql'),
    read('supabase/migrations/20261018150000_question_flags.sql'),
]);

assert.match(stream, /sources = toTutorSources\(retrieved\.passages\)/, 'tutor keeps the passages it was grounded in');
assert.match(stream, /if \(!fullText\.trim\(\)\) sources = \[\];/, 'the canned fallback must not claim note sources');
for (const source of [stream, chat]) {
    assert.match(source, /sources: readMessageSources\(row\)/, 'saved messages return their sources');
}
assert.match(row, /<TutorMessageSources sources=\{message\.sources\} \/>/);
assert.match(await read('src/hooks/useTutorChat.js'), /sources: Array\.isArray\(msg\.sources\)/, 'loaded chat history keeps sources');

assert.match(flags, /SELECT 1 FROM questions WHERE id = \$1 AND user_id = \$2/, 'students can only report their own questions');
assert.match(flags, /ON CONFLICT \(user_id, question_id\) DO UPDATE/, 'one report per student per question');
assert.match(flags, /WHERE id = \$1 AND status = 'open'/, 'a report is resolved once');
assert.match(flagHttp, /\/api\\\/questions\\\/\(\[\^\/\]\+\)\\\/flag/);
assert.match(router, /pathname\.startsWith\("\/api\/questions\/"\)[\s\S]*handleQuestionsRequest/);
assert.match(admin, /\/api\/admin\/question-flags"/);
assert.ok(admin.indexOf('requireAdminUser(req)') < admin.indexOf('question-flags'), 'flag admin routes sit behind the admin check');
assert.match(results, /<ReportQuestionButton questionId=\{answer\.questionId\} \/>/);
assert.match(review, /<ReportQuestionButton key=\{question\.id\} questionId=\{question\.id\} \/>/);
assert.match(panel, /activeTab === 'reports'\) return <QuestionReportsPanel \/>/);

for (const migration of [migSources, migFlags]) {
    assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
    assert.match(migration, /REVOKE ALL ON TABLE "[a-z_]+" FROM anon, authenticated/);
}

console.log('question-flags-and-sources regression passed');
