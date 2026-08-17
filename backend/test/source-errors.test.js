'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  classifySourceError,
  extractErrorText,
  isSourceVerificationError,
} = require('../source-errors');

test('recognizes Suwayomi Cloudflare failures and hides the stack trace', () => {
  const raw = 'Exception while fetching data (/fetchSourceManga) : Cloudflare bypass currently disabled\\r\\n\\tat eu.kanade.CloudflareInterceptor.intercept(CloudflareInterceptor.kt:52)';
  const failure = classifySourceError(new Error(raw));

  assert.equal(isSourceVerificationError(raw), true);
  assert.equal(failure.status, 403);
  assert.equal(failure.body.code, 'source-verification-required');
  assert.equal(failure.body.error, 'Source verification required.');
  assert.doesNotMatch(JSON.stringify(failure.body), /kanade|interceptor|\.kt:/i);
});

test('extracts JSON API error details', () => {
  const raw = JSON.stringify({
    code: 'source-verification-required',
    error: 'Source verification required.',
    detail: 'Complete the browser check.',
  });

  assert.equal(extractErrorText(raw), 'Complete the browser check.');
  assert.equal(isSourceVerificationError(raw), true);
});

test('recognizes a configured helper that is not running', () => {
  const raw = 'java.io.IOException: Failed to connect to localhost/[0:0:0:0:0:0:0:1]:8191';
  assert.equal(isSourceVerificationError(raw), true);
  assert.equal(classifySourceError(raw).body.code, 'source-verification-required');
});

test('keeps generic source failures short and readable', () => {
  const failure = classifySourceError(new Error('Upstream source timed out\n    at internal.worker (server.js:10)'));

  assert.equal(failure.status, 502);
  assert.equal(failure.body.code, 'source-request-failed');
  assert.equal(failure.body.detail, 'Upstream source timed out');
});
