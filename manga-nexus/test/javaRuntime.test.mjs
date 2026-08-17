import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  REQUIRED_JAVA_MAJOR,
  REQUIRED_JAVA_VERSION,
  classifySuwayomiFailure,
  isCompatibleJavaMajor,
  isCompatibleJavaVersion,
  parseJavaVersionOutput,
} = require('../runtime/java-runtime.cjs');

test('parses legacy Java 8 version output', () => {
  assert.deepEqual(
    parseJavaVersionOutput('java version "1.8.0_461"\nJava(TM) SE Runtime Environment'),
    { version: '1.8.0_461', major: 8 },
  );
});

test('parses current OpenJDK version output', () => {
  assert.deepEqual(
    parseJavaVersionOutput('openjdk version "21.0.4" 2024-07-16 LTS'),
    { version: '21.0.4', major: 21 },
  );
});

test('requires Java 21 or newer', () => {
  assert.equal(REQUIRED_JAVA_MAJOR, 21);
  assert.equal(isCompatibleJavaMajor(8), false);
  assert.equal(isCompatibleJavaMajor(17), false);
  assert.equal(isCompatibleJavaMajor(21), true);
  assert.equal(isCompatibleJavaMajor(22), true);
  assert.equal(isCompatibleJavaMajor(null), false);
});

test('requires the Java 21 maintenance level proven with current Suwayomi', () => {
  assert.equal(REQUIRED_JAVA_VERSION, '21.0.11');
  assert.equal(isCompatibleJavaVersion('21.0.4'), false);
  assert.equal(isCompatibleJavaVersion('21.0.10'), false);
  assert.equal(isCompatibleJavaVersion('21.0.11'), true);
  assert.equal(isCompatibleJavaVersion('21.0.12+7'), true);
  assert.equal(isCompatibleJavaVersion('22.0.1'), true);
  assert.equal(isCompatibleJavaVersion(''), false);
});

test('classifies an unsupported class version as a repairable Java issue', () => {
  const issue = classifySuwayomiFailure(
    'java.lang.UnsupportedClassVersionError: suwayomi/tachidesk/MainKt',
    1,
  );

  assert.equal(issue.code, 'java-incompatible');
  assert.equal(issue.canRepairJava, true);
  assert.match(issue.message, /Java 21/);
});

test('keeps unrelated Suwayomi exits distinct from Java failures', () => {
  const issue = classifySuwayomiFailure('Address already in use', 1);

  assert.equal(issue.code, 'suwayomi-start-failed');
  assert.equal(issue.canRepairJava, false);
  assert.match(issue.detail, /Address already in use/);
});
