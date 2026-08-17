import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { REQUIRED_BACKEND_FILES, getMissingBackendFiles } = require('../runtime/backend-runtime.cjs');

test('detects a backend package that cannot start its local service', () => {
  const root = path.resolve('packaged-backend');
  const present = new Set(REQUIRED_BACKEND_FILES.slice(0, -1).map(relativePath => (
    path.join(root, ...relativePath.split('/'))
  )));

  assert.deepEqual(
    getMissingBackendFiles(root, candidate => present.has(candidate)),
    ['node_modules/axios/package.json'],
  );
});

test('accepts a complete packaged backend runtime', () => {
  assert.deepEqual(getMissingBackendFiles('backend', () => true), []);
});
