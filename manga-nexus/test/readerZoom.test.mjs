import test from 'node:test';
import assert from 'node:assert/strict';

import { clampZoom, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from '../src/utils/readerZoom.mjs';

test('reader zoom stays between 50% and 500%', () => {
  assert.equal(clampZoom(0), ZOOM_MIN);
  assert.equal(clampZoom(9), ZOOM_MAX);
  assert.equal(clampZoom(1 + ZOOM_STEP), 1.25);
});

test('reader zoom safely resets invalid values', () => {
  assert.equal(clampZoom(Number.NaN), 1);
  assert.equal(clampZoom('1.6'), 1.6);
});
