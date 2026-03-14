import assert from 'node:assert/strict';
import { isHardInceptionProviderFailure, shouldFallbackToGeminiText } from '../convex/lib/llmProviderFallback.js';

assert.equal(
  isHardInceptionProviderFailure(
    'inception API error: 400 (Arrearage) - Access denied, please make sure your account is in good standing.'
  ),
  true
);
assert.equal(isHardInceptionProviderFailure('inception request timed out after 60000ms'), false);
assert.equal(
  shouldFallbackToGeminiText({
    errorMessage:
      'inception API error: 400 (Arrearage) - Access denied, please make sure your account is in good standing.',
    geminiApiKey: 'present',
  }),
  true
);
assert.equal(
  shouldFallbackToGeminiText({
    errorMessage: 'inception API error: 400 (Arrearage) - Access denied',
    geminiApiKey: '',
  }),
  false
);

console.log('inception-gemini-fallback-regression: ok');
