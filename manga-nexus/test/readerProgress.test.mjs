import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateMangaProgressPercent, resolveContinueTarget } from '../src/utils/readerProgress.mjs';

const chapters = [
  { id: 'chapter-3', number: '3' },
  { id: 'chapter-2', number: '2' },
  { id: 'chapter-1', number: '1' },
];

test('Continue resumes the exact saved chapter and page', () => {
  assert.deepEqual(
    resolveContinueTarget(chapters, { chapterId: 'chapter-2', page: 17 }),
    { chapter: chapters[1], page: 17 },
  );
});

test('Continue compares numeric and string chapter IDs consistently', () => {
  const numericChapters = [{ id: 42, number: '4.2' }];
  assert.deepEqual(
    resolveContinueTarget(numericChapters, { chapterId: '42', page: '6' }),
    { chapter: numericChapters[0], page: 6 },
  );
});

test('Continue safely restarts when a saved chapter disappeared', () => {
  assert.deepEqual(
    resolveContinueTarget(chapters, { chapterId: 'removed', page: 99 }),
    { chapter: chapters[2], page: 0 },
  );
});

test('Continue can use stored metadata while chapter details are unavailable', () => {
  assert.deepEqual(
    resolveContinueTarget([], { chapterId: 'offline-chapter', chapterNum: '8', page: 3 }),
    { chapter: { id: 'offline-chapter', number: '8' }, page: 3 },
  );
});

test('home progress uses a known chapter total instead of a made-up 100 chapters', () => {
  assert.equal(calculateMangaProgressPercent({ totalChapters: 2 }, { chapterNum: '1' }), 50);
  assert.equal(calculateMangaProgressPercent({}, { chapterNum: '1' }), null);
  assert.equal(calculateMangaProgressPercent({ totalChapters: 12 }, { chapterNum: 'Special' }), null);
});
