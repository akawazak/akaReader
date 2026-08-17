import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  getSourceVerificationViewBounds,
  isCloudflareClearanceCookie,
  isSourcePageReadyForReturn,
  isVerifiedSourcePage,
} = require('../runtime/source-verification.cjs');

const targetUrl = 'https://aquareader.org/';

test('accepts a fully rendered source page on the requested host', () => {
  assert.equal(isVerifiedSourcePage({
    url: 'https://www.aquareader.org/',
    title: 'Aqua Manga',
    text: 'Popular today Latest updates '.repeat(12),
    bodyTextLength: 360,
    readyState: 'complete',
    hasChallengeWidget: false,
    hasPasswordField: false,
    hasMainContent: true,
  }, targetUrl), true);
});

test('keeps the window open while a browser challenge is visible', () => {
  assert.equal(isVerifiedSourcePage({
    url: targetUrl,
    title: 'Just a moment...',
    text: 'Verify you are human',
    bodyTextLength: 40,
    readyState: 'complete',
    hasChallengeWidget: true,
    hasPasswordField: false,
    hasMainContent: false,
  }, targetUrl), false);
});

test('does not auto-close login or unrelated redirected pages', () => {
  assert.equal(isVerifiedSourcePage({
    url: 'https://aquareader.org/login',
    title: 'Login',
    text: 'Sign in to continue '.repeat(20),
    bodyTextLength: 400,
    readyState: 'complete',
    hasChallengeWidget: false,
    hasPasswordField: true,
    hasMainContent: true,
  }, targetUrl), false);
  assert.equal(isVerifiedSourcePage({
    url: 'https://example.com/',
    title: 'Redirected',
    text: 'Normal page '.repeat(30),
    bodyTextLength: 400,
    readyState: 'complete',
    hasChallengeWidget: false,
    hasPasswordField: false,
    hasMainContent: true,
  }, targetUrl), false);
});

test('keeps the embedded verification page below the app controls', () => {
  assert.deepEqual(getSourceVerificationViewBounds([1400, 900]), {
    x: 0,
    y: 96,
    width: 1400,
    height: 804,
  });
  assert.deepEqual(getSourceVerificationViewBounds([800, 40]), {
    x: 0,
    y: 96,
    width: 800,
    height: 0,
  });
});

test('returns to akaReader when the challenge is gone even if the source is stuck on its own loader', () => {
  const sourceLoader = {
    url: targetUrl,
    title: 'Aqua Manga',
    text: 'Loading... Privacy Policy Terms of Use',
    bodyTextLength: 39,
    readyState: 'complete',
    hasChallengeWidget: false,
    hasPasswordField: false,
    hasMainContent: false,
  };

  assert.equal(isSourcePageReadyForReturn(sourceLoader, targetUrl, {
    challengeObserved: true,
    consecutiveNonChallengeChecks: 1,
  }), true);
  assert.equal(isSourcePageReadyForReturn(sourceLoader, targetUrl, {
    challengeObserved: false,
    consecutiveNonChallengeChecks: 3,
  }), true);
});

test('does not return on the first ambiguous loading screen or while a challenge remains', () => {
  const initialLoader = {
    url: targetUrl,
    title: 'Aqua Manga',
    text: 'Loading... Privacy Policy Terms of Use',
    bodyTextLength: 39,
    readyState: 'complete',
    hasChallengeWidget: false,
    hasPasswordField: false,
    hasMainContent: false,
  };
  assert.equal(isSourcePageReadyForReturn(initialLoader, targetUrl, {
    challengeObserved: false,
    consecutiveNonChallengeChecks: 1,
  }), false);
  assert.equal(isSourcePageReadyForReturn({
    ...initialLoader,
    title: 'Just a moment...',
    text: 'Verify you are human',
    hasChallengeWidget: true,
  }, targetUrl, {
    challengeObserved: true,
    consecutiveNonChallengeChecks: 3,
  }), false);
});

test('recognizes a Cloudflare clearance cookie for the verified source only', () => {
  assert.equal(isCloudflareClearanceCookie({
    name: 'cf_clearance',
    domain: '.aquareader.org',
  }, targetUrl), true);
  assert.equal(isCloudflareClearanceCookie({
    name: 'cf_clearance',
    domain: '.example.com',
  }, targetUrl), false);
  assert.equal(isCloudflareClearanceCookie({
    name: 'session',
    domain: '.aquareader.org',
  }, targetUrl), false);
});
