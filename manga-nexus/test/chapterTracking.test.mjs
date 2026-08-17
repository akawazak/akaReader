import test from 'node:test';
import assert from 'node:assert/strict';

import {
  countReadChapterIds,
  getUnreadChapterIds,
} from '../src/utils/chapterTracking.mjs';

test('countReadChapterIds counts unique stored chapter IDs per manga', () => {
  assert.equal(countReadChapterIds({
    'source-a:manga-1': [101, '101', '102', null, ''],
    'source-b:manga-2': ['101', 'special-1'],
    malformed: 'not-an-array',
  }), 4);
});

test('countReadChapterIds handles missing or malformed state', () => {
  assert.equal(countReadChapterIds(), 0);
  assert.equal(countReadChapterIds(null), 0);
  assert.equal(countReadChapterIds([]), 0);
});

test('getUnreadChapterIds uses IDs instead of decimal or special chapter labels', () => {
  const chapters = [
    { id: 'release-special', number: 'Special' },
    { id: 'release-10-5', number: '10.5' },
    { id: 'release-3', number: '3' },
  ];

  assert.deepEqual(
    getUnreadChapterIds(chapters, ['release-10-5']),
    ['release-special', 'release-3'],
  );
});

test('getUnreadChapterIds respects Suwayomi read state and deduplicates IDs', () => {
  const chapters = [
    { id: 900, number: '100', read: true },
    { id: 42, number: '7' },
    { id: '42', number: '7 duplicate' },
    { id: 'bonus-a', number: '?' },
    { id: null, number: 'invalid' },
  ];

  assert.deepEqual(getUnreadChapterIds(chapters, []), ['42', 'bonus-a']);
  assert.deepEqual(getUnreadChapterIds(chapters, ['bonus-a']), ['42']);
});

test('getUnreadChapterIds treats a replacement ID as a distinct available chapter', () => {
  const chapters = [
    { id: 'new-provider-id', number: '12' },
    { id: 'chapter-11', number: '11' },
  ];

  assert.deepEqual(
    getUnreadChapterIds(chapters, ['old-provider-id', 'chapter-11']),
    ['new-provider-id'],
  );
});
