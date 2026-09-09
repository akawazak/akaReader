import test from 'node:test';
import assert from 'node:assert/strict';
import { downloadedMangaKeys, parseDownloadKey, summarizeDownloadedChapters } from '../src/utils/downloadStorage.mjs';

test('download keys retain composite manga IDs and split only at the chapter separator', () => {
  assert.deepEqual(parseDownloadKey('source__manga___chapter-7'), {
    key: 'source__manga___chapter-7', mangaKey: 'source__manga', chapterId: 'chapter-7',
  });
  assert.deepEqual([...downloadedMangaKeys(['one__two___3', 'one__two___4'])], ['one__two']);
});

test('download storage summary groups bytes, pages, titles, and read cleanup keys', () => {
  const summary = summarizeDownloadedChapters({
    records: [
      { key: 's__m___1', sizeBytes: 100, pageCount: 2, savedAt: 10, chapterNum: '1' },
      { key: 's__m___2', sizeBytes: 250, pageCount: 4, savedAt: 20, chapterNum: '2' },
    ],
    library: [{ mangaKey: 's__m', title: 'Example' }],
    readChapters: { 's__m': ['1'] },
  });
  assert.equal(summary.chapterCount, 2);
  assert.equal(summary.mangaCount, 1);
  assert.equal(summary.sizeBytes, 350);
  assert.equal(summary.pageCount, 6);
  assert.equal(summary.groups[0].mangaTitle, 'Example');
  assert.deepEqual(summary.readKeys, ['s__m___1']);
});
