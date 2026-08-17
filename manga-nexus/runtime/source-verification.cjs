const CHALLENGE_MARKERS = Object.freeze([
  'verify you are human',
  'checking your browser',
  'just a moment',
  'performing security verification',
  'enable javascript and cookies to continue',
  'cloudflare ray id',
]);

const SOURCE_VERIFICATION_TOP_INSET = 96;

function getSourceVerificationViewBounds(contentSize = []) {
  const width = Math.max(0, Number(contentSize[0]) || 0);
  const height = Math.max(0, Number(contentSize[1]) || 0);
  return {
    x: 0,
    y: SOURCE_VERIFICATION_TOP_INSET,
    width,
    height: Math.max(0, height - SOURCE_VERIFICATION_TOP_INSET),
  };
}

function normalizedHostname(value) {
  try {
    return new URL(String(value || '')).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function isCloudflareClearanceCookie(cookie = {}, targetUrl = '') {
  if (cookie.name !== 'cf_clearance') return false;
  const targetHostname = normalizedHostname(targetUrl);
  const cookieHostname = String(cookie.domain || '')
    .toLowerCase()
    .replace(/^\./, '')
    .replace(/^www\./, '');
  if (!targetHostname || !cookieHostname) return false;
  return targetHostname === cookieHostname || targetHostname.endsWith(`.${cookieHostname}`);
}

function hasSourceChallengeSignals(snapshot = {}) {
  if (snapshot.hasChallengeWidget) return true;
  const visibleText = `${snapshot.title || ''}\n${snapshot.text || ''}`.toLowerCase();
  return CHALLENGE_MARKERS.some(marker => visibleText.includes(marker));
}

function isVerifiedSourcePage(snapshot = {}, targetUrl = '') {
  const targetHostname = normalizedHostname(targetUrl);
  const currentHostname = normalizedHostname(snapshot.url);
  if (!targetHostname || currentHostname !== targetHostname) return false;
  if (snapshot.readyState !== 'complete') return false;
  if (snapshot.hasPasswordField || hasSourceChallengeSignals(snapshot)) return false;

  return snapshot.hasMainContent || Number(snapshot.bodyTextLength || 0) >= 200;
}

function isSourcePageReadyForReturn(snapshot = {}, targetUrl = '', progress = {}) {
  if (isVerifiedSourcePage(snapshot, targetUrl)) return true;
  if (normalizedHostname(snapshot.url) !== normalizedHostname(targetUrl)) return false;
  if (snapshot.readyState !== 'complete' || snapshot.hasPasswordField) return false;
  if (hasSourceChallengeSignals(snapshot)) return false;
  if (Number(snapshot.bodyTextLength || 0) < 20) return false;

  return !!progress.challengeObserved
    || Number(progress.consecutiveNonChallengeChecks || 0) >= 3;
}

module.exports = {
  CHALLENGE_MARKERS,
  SOURCE_VERIFICATION_TOP_INSET,
  getSourceVerificationViewBounds,
  hasSourceChallengeSignals,
  isCloudflareClearanceCookie,
  isSourcePageReadyForReturn,
  isVerifiedSourcePage,
  normalizedHostname,
};
