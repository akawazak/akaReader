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

export const readApiError = (value) => {
  if (!value) return { code: '', message: '', detail: '' };

  const fallback = value instanceof Error ? value.message : String(value);
  const suppliedCode = value && typeof value === 'object' ? value.code : '';
  const suppliedDetail = value && typeof value === 'object' ? value.detail : '';

  try {
    const parsed = JSON.parse(fallback);
    return {
      code: parsed?.code || suppliedCode || '',
      message: parsed?.error || fallback,
      detail: parsed?.detail || suppliedDetail || '',
    };
  } catch {
    return { code: suppliedCode || '', message: fallback, detail: suppliedDetail || '' };
  }
};

export const isSourceVerificationError = (value) => {
  const parsed = readApiError(value);
  if (parsed.code === 'source-verification-required') return true;
  const text = `${parsed.message} ${parsed.detail}`.toLowerCase();
  return VERIFICATION_MARKERS.some(marker => text.includes(marker));
};

const firstReadableLine = (value) => {
  const parsed = readApiError(value);
  const text = parsed.detail || parsed.message;
  return String(text)
    .replace(/\\r\\n|\\n/g, '\n')
    .split(/\r?\n/)
    .map(part => part.trim())
    .find(Boolean)
    ?.replace(/^exception while fetching data\s*\([^)]*\)\s*:\s*/i, '')
    .replace(/^java\.[\w.]+:\s*/i, '')
    .slice(0, 240) || 'Check the source connection and try again.';
};

export const describeSourceError = (value, subject = 'source') => {
  if (isSourceVerificationError(value)) {
    return {
      kind: 'verification',
      title: 'Source verification required',
      message: `This ${subject} blocked the request with a browser check. Open Verify Source, complete the check yourself, then retry.`,
    };
  }

  return {
    kind: 'error',
    title: 'Source could not load',
    message: firstReadableLine(value),
  };
};
