import assert from 'node:assert/strict';
import {
  isInceptionProviderFailure,
  isOpenAiProviderFailure,
  shouldFallbackToInceptionText,
  shouldFallbackToOpenAiText,
} from '../convex/lib/llmProviderFallback.js';

assert.equal(
  isOpenAiProviderFailure(
    'openai API error: 429 (rate_limit_reached) - Rate limit reached: too many requests per minute'
  ),
  true
);
assert.equal(isOpenAiProviderFailure('openai request timed out after 60000ms'), true);
assert.equal(
  isOpenAiProviderFailure('openai API error: 401 - {"error":"Incorrect API key provided"}'),
  true
);
assert.equal(
  isOpenAiProviderFailure('openai API error: 401 (unauthorized) - invalid authentication'),
  true
);
assert.equal(
  shouldFallbackToInceptionText({
    errorMessage:
      'openai API error: 429 (rate_limit_reached) - Rate limit reached: too many requests per minute',
    inceptionApiKey: 'present',
  }),
  true
);
assert.equal(
  shouldFallbackToInceptionText({
    errorMessage: 'openai API error: 401 - {"error":"Incorrect API key provided"}',
    inceptionApiKey: 'present',
  }),
  true
);
assert.equal(
  shouldFallbackToInceptionText({
    errorMessage: 'openai API error: 429 (rate_limit_reached) - Rate limit reached',
    inceptionApiKey: '',
  }),
  false
);

assert.equal(
  isInceptionProviderFailure(
    'inception API error: 429 (rate_limit_reached) - Rate limit reached: too many requests per minute'
  ),
  true
);
assert.equal(isInceptionProviderFailure('inception request timed out after 60000ms'), true);
assert.equal(
  shouldFallbackToOpenAiText({
    errorMessage: 'inception API error: 429 (rate_limit_reached) - Rate limit reached',
    openAiAvailable: true,
  }),
  true
);
assert.equal(
  shouldFallbackToOpenAiText({
    errorMessage: 'inception API error: 429 (rate_limit_reached) - Rate limit reached',
    openAiAvailable: false,
  }),
  false
);

console.log('openai-inception-fallback-helper-regression: ok');
