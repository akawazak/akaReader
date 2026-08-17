import test from 'node:test';
import assert from 'node:assert/strict';
import {
  describeSourceError,
  isSourceVerificationError,
  readApiError,
} from '../src/utils/sourceErrors.mjs';

test('turns a Suwayomi stack trace into a verification prompt', () => {
  const raw = '{"error":"Exception while fetching data (/fetchSourceManga) : Cloudflare bypass currently disabled\\r\\n\\tat eu.kanade.CloudflareInterceptor.intercept(CloudflareInterceptor.kt:52)"}';
  const failure = describeSourceError(new Error(raw));

  assert.equal(isSourceVerificationError(raw), true);
  assert.equal(failure.kind, 'verification');
  assert.equal(failure.title, 'Source verification required');
  assert.doesNotMatch(failure.message, /kanade|interceptor|\.kt:/i);
});

test('uses structured API error codes without exposing JSON', () => {
  const raw = JSON.stringify({
    code: 'source-verification-required',
    error: 'Source verification required.',
    detail: 'This source blocked the request with a browser check.',
  });

  assert.equal(readApiError(raw).code, 'source-verification-required');
  assert.equal(describeSourceError(raw).kind, 'verification');
});

test('keeps a stopped configured helper in the source recovery flow', () => {
  const raw = 'java.io.IOException: Failed to connect to localhost/[0:0:0:0:0:0:0:1]:8191';
  assert.equal(isSourceVerificationError(raw), true);
  assert.equal(describeSourceError(raw).kind, 'verification');
});

test('keeps a generic source failure to its first readable line', () => {
  const failure = describeSourceError(new Error('Upstream source timed out\n at worker.js:10'));

  assert.equal(failure.kind, 'error');
  assert.equal(failure.title, 'Source could not load');
  assert.equal(failure.message, 'Upstream source timed out');
});
