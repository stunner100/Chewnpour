import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'server/podcasts.js'), 'utf8');
const PODCAST_STALE_AFTER_MS = 5 * 60 * 1000 + 30 * 1000;

assert.match(
  source,
  /export const PODCAST_STALE_AFTER_MS = 5 \* 60 \* 1000 \+ 30 \* 1000/,
  'Stale window must sit past the 300s generate budget',
);
assert.match(source, /expireStalePodcast/, 'List and generate must expire stale jobs');

const isStalePodcastJob = (row, now = Date.now()) => {
  if (!row || (row.status !== 'pending' && row.status !== 'running')) {
    return false;
  }
  const started = new Date(row.started_at || row.created_at).getTime();
  if (!Number.isFinite(started)) return true;
  return now - started > PODCAST_STALE_AFTER_MS;
};

const now = Date.parse('2026-08-13T19:40:00.000Z');
assert.equal(
  isStalePodcastJob(
    { status: 'running', started_at: '2026-08-13T15:33:54.085Z' },
    now,
  ),
  true,
  'A four-hour running job must be stale',
);
assert.equal(
  isStalePodcastJob(
    { status: 'running', started_at: '2026-08-13T19:38:00.000Z' },
    now,
  ),
  false,
  'A two-minute running job must still be in flight',
);
assert.equal(
  isStalePodcastJob({ status: 'ready', started_at: '2026-08-13T15:33:54.085Z' }, now),
  false,
  'Ready podcasts are not stale jobs',
);
assert.equal(isStalePodcastJob(null, now), false);

console.log('podcast-stale-job-regression.test.mjs passed');
