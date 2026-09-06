import assert from 'node:assert/strict';
import { followPostRedirects } from '../server/tutorStreamFetch.js';
import { parseTutorStreamError } from '../src/lib/tutorStreamError.js';

assert.equal(
  parseTutorStreamError({ message: 'All AI providers failed. Please try again later.' }),
  'All AI providers failed. Please try again later.',
  'SSE error objects must expose message, not [object Object]',
);
assert.equal(
  parseTutorStreamError({ error: 'Topic not found' }),
  'Topic not found',
);
assert.equal(parseTutorStreamError('plain string'), 'plain string');
assert.equal(
  parseTutorStreamError({}),
  'The tutor could not answer just now.',
);

const originalFetch = globalThis.fetch;
const calls = [];

globalThis.fetch = async (url, init = {}) => {
  calls.push({ url: String(url), redirect: init.redirect, method: init.method });
  if (String(url).includes('api.thegrid.ai')) {
    return new Response(null, {
      status: 307,
      headers: { Location: 'https://supplier.example/v1/chat/completions' },
    });
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

try {
  const response = await followPostRedirects('https://api.thegrid.ai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer test' },
    body: '{}',
  });
  assert.equal(response.status, 200);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].redirect, 'manual');
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[1].url, 'https://supplier.example/v1/chat/completions');
  assert.equal(calls[1].method, 'POST');
} finally {
  globalThis.fetch = originalFetch;
}

console.log('tutor-stream-failover.test.mjs passed');
