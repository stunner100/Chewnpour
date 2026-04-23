import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(__dirname, '..', 'convex', 'videosActions.ts'), 'utf8');

if (!/const resolveErrorMessage = \(error: unknown, fallback: string\)/.test(source)) {
  throw new Error('Expected videosActions.ts to normalize unexpected action errors.');
}

if (!/handler: async \(ctx, args\) => \{\s*const row = await ctx\.runQuery\(internal\.videos\.getVideoInternal, \{ videoId: args\.videoId \}\);\s*if \(!row \|\| row\.status !== "pending"\) return;\s*try \{\s*const apiKey = requireApiKey\(\);/s.test(source)) {
  throw new Error('Expected kickoff to guard API-key lookup and submission setup inside a try/catch.');
}

if (!/errorMessage: resolveErrorMessage\(error, "Unexpected kickoff failure"\)/.test(source)) {
  throw new Error('Expected kickoff to fail stuck pending jobs with an explicit fallback error message.');
}

if (!/handler: async \(ctx, args\) => \{\s*const row = await ctx\.runQuery\(internal\.videos\.getVideoInternal, \{ videoId: args\.videoId \}\);\s*if \(!row\) return;\s*if \(row\.status !== "running"\) return;\s*if \(!row\.providerJobId\)/s.test(source)) {
  throw new Error('Expected poll to retain its running-job guardrails before error handling.');
}

if (!/errorMessage: resolveErrorMessage\(error, "Unexpected poll failure"\)/.test(source)) {
  throw new Error('Expected poll to fail unexpected runtime errors instead of leaving jobs stuck.');
}

console.log('topic-video-failure-handling-regression.test.mjs passed');
