'use strict';

const VERIFICATION_MARKERS = [
  'cloudflare',
  'captcha',
  'bot detection',
  'checking your browser',
  'challenge',
  'verification',
  'bypass currently disabled',
  'flaresolverr',
  ':8191',
];

function extractErrorText(value) {
  if (!value) return '';

  let text = value instanceof Error ? value.message : String(value);
  try {
    const parsed = JSON.parse(text);
    text = parsed?.detail || parsed?.error || text;
  } catch {}

  return String(text).replace(/\\r\\n|\\n/g, '\n').trim();
}

function isSourceVerificationError(value) {
  const original = value instanceof Error ? value.message : String(value || '');
  try {
    const parsed = JSON.parse(original);
    if (parsed?.code === 'source-verification-required') return true;
  } catch {}

  const text = extractErrorText(value).toLowerCase();
  return VERIFICATION_MARKERS.some(marker => text.includes(marker));
}

function safeFirstLine(value) {
  const line = extractErrorText(value)
    .split(/\r?\n/)
    .map(part => part.trim())
    .find(Boolean) || '';

  return line
    .replace(/^exception while fetching data\s*\([^)]*\)\s*:\s*/i, '')
    .replace(/^java\.[\w.]+:\s*/i, '')
    .slice(0, 240);
}

function classifySourceError(value) {
  if (isSourceVerificationError(value)) {
    return {
      status: 403,
      body: {
        code: 'source-verification-required',
        error: 'Source verification required.',
        detail: 'This source blocked the request with a browser check. Complete it manually, then retry.',
      },
    };
  }

  return {
    status: 502,
    body: {
      code: 'source-request-failed',
      error: 'The source could not load right now.',
      detail: safeFirstLine(value) || 'Check the source connection and try again.',
    },
  };
}

function sendSourceError(res, value) {
  const failure = classifySourceError(value);
  return res.status(failure.status).json(failure.body);
}

module.exports = {
  classifySourceError,
  extractErrorText,
  isSourceVerificationError,
  sendSourceError,
};
