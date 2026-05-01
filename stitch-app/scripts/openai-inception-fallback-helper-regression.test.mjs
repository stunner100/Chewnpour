import assert from 'node:assert/strict';
import {
  isBedrockProviderFailure,
  isInceptionProviderFailure,
  isOpenAiProviderFailure,
  shouldFallbackToBedrockText,
  shouldFallbackToInceptionText,
  shouldFallbackToOpenAiText,
} from '../convex/lib/llmProviderFallback.js';

assert.equal(
  isOpenAiProviderFailure(
    'deepseek API error: 429 (rate_limit_reached) - Rate limit reached: too many requests per minute'
  ),
  true
);
assert.equal(isOpenAiProviderFailure('deepseek request timed out after 60000ms'), true);
assert.equal(
  isOpenAiProviderFailure('openai API error: 401 - {"error":"Incorrect API key provided"}'),
  true
);
assert.equal(
  isOpenAiProviderFailure('openai API error: 401 (unauthorized) - invalid authentication'),
  true
);
assert.equal(
  shouldFallbackToBedrockText({
    errorMessage:
      'openai API error: 429 (rate_limit_reached) - Rate limit reached: too many requests per minute',
    bedrockAvailable: true,
  }),
  true
);
assert.equal(
  shouldFallbackToBedrockText({
    errorMessage: 'openai API error: 401 - {"error":"Incorrect API key provided"}',
    bedrockAvailable: true,
  }),
  true
);
assert.equal(
  shouldFallbackToBedrockText({
    errorMessage: 'openai API error: 429 (rate_limit_reached) - Rate limit reached',
    bedrockAvailable: false,
  }),
  false
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
  isBedrockProviderFailure(
    'bedrock API error: 429 (throttling) - Too many requests'
  ),
  true
);
assert.equal(isBedrockProviderFailure('bedrock request timed out after 60000ms'), true);
assert.equal(
  shouldFallbackToInceptionText({
    errorMessage: 'bedrock API error: 429 (throttling) - Too many requests',
    inceptionApiKey: 'present',
  }),
  true
);
assert.equal(
  shouldFallbackToInceptionText({
    errorMessage: 'bedrock API error: 403 (access denied) - Forbidden',
    inceptionApiKey: 'present',
  }),
  true
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
