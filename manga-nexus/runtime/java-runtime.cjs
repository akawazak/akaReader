'use strict';

const REQUIRED_JAVA_MAJOR = 21;
const REQUIRED_JAVA_VERSION = '21.0.11';

function parseJavaVersionOutput(output) {
  const text = String(output || '');
  const match = text.match(/(?:openjdk|java) version\s+"([^"]+)"/i)
    || text.match(/version\s+"([^"]+)"/i);
  if (!match) return { version: '', major: null };

  const version = match[1];
  const parts = version.split(/[._+-]/);
  const first = Number.parseInt(parts[0], 10);
  const major = first === 1 ? Number.parseInt(parts[1], 10) : first;

  return {
    version,
    major: Number.isFinite(major) ? major : null,
  };
}

function isCompatibleJavaMajor(major, requiredMajor = REQUIRED_JAVA_MAJOR) {
  return Number.isFinite(major) && major >= requiredMajor;
}

function isCompatibleJavaVersion(version, requiredVersion = REQUIRED_JAVA_VERSION) {
  const parts = String(version || '').split(/[^0-9]+/).filter(Boolean).map(Number);
  const requiredParts = String(requiredVersion || '').split(/[^0-9]+/).filter(Boolean).map(Number);
  if (!parts.length || !requiredParts.length) return false;
  const length = Math.max(parts.length, requiredParts.length);
  for (let index = 0; index < length; index += 1) {
    const current = parts[index] || 0;
    const required = requiredParts[index] || 0;
    if (current !== required) return current > required;
  }
  return true;
}

function classifySuwayomiFailure(stderr, exitCode) {
  const detail = String(stderr || '').trim();
  if (/UnsupportedClassVersionError/i.test(detail)) {
    return {
      code: 'java-incompatible',
      title: 'Java needs an update',
      message: `Suwayomi requires Java ${REQUIRED_JAVA_VERSION} or newer.`,
      detail: 'akaReader can install a private Java runtime without changing your system Java.',
      canRepairJava: true,
    };
  }

  return {
    code: 'suwayomi-start-failed',
    title: 'Suwayomi could not start',
    message: exitCode === null || exitCode === undefined
      ? 'The Suwayomi server stopped before it became ready.'
      : `The Suwayomi server exited with code ${exitCode}.`,
    detail: detail.split(/\r?\n/).find(Boolean)?.slice(0, 240) || 'Retry the service or open the data folder to inspect the server logs.',
    canRepairJava: false,
  };
}

module.exports = {
  REQUIRED_JAVA_MAJOR,
  REQUIRED_JAVA_VERSION,
  classifySuwayomiFailure,
  isCompatibleJavaMajor,
  isCompatibleJavaVersion,
  parseJavaVersionOutput,
};
