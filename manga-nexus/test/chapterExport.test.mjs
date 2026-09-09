import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalizeChapterExport, sanitizeArchiveName } = require('../runtime/chapter-export.cjs');

test('chapter exports sanitize filesystem names and preserve source identity', () => {
  const value = normalizeChapterExport({ sourceId: '123', chapterId: '45', mangaTitle: 'Bad:/Name', chapterNum: '7.5', chapterTitle: 'A?Title' });
  assert.equal(value.sourceId, '123');
  assert.equal(value.chapterId, 45);
  assert.equal(value.baseName, 'Bad--Name - Ch 7.5 - A-Title');
  assert.equal(sanitizeArchiveName('trail. '), 'trail');
});

test('chapter exports reject missing source and invalid chapter IDs', () => {
  assert.throws(() => normalizeChapterExport({ chapterId: 1 }), /source/i);
  assert.throws(() => normalizeChapterExport({ sourceId: '1', chapterId: 'nope' }), /chapter ID/i);
});
