import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesSmartLibraryFilter, smartLibraryCounts } from '../src/utils/libraryFilters.mjs';

const state = {
  progressedKeys: new Set(['s__1']),
  updatedKeys: new Set(['s__2']),
  downloadedKeys: new Set(['s__1']),
  readChapters: { 's__1': ['a'], 's__2': ['b'] },
  mangaCategories: { 's__2': 'completed' },
};

test('smart library filters use stable manga state rather than chapter labels', () => {
  assert.equal(matchesSmartLibraryFilter({ ...state, filter: 'continue', mangaKey: 's__1', manga: {} }), true);
  assert.equal(matchesSmartLibraryFilter({ ...state, filter: 'downloaded', mangaKey: 's__1', manga: {} }), true);
  assert.equal(matchesSmartLibraryFilter({ ...state, filter: 'updated', mangaKey: 's__2', manga: {} }), true);
  assert.equal(matchesSmartLibraryFilter({ ...state, filter: 'completed', mangaKey: 's__2', manga: {} }), true);
  assert.equal(matchesSmartLibraryFilter({ ...state, filter: 'unread', mangaKey: 's__3', manga: { totalChapters: 1 } }), true);
});

test('smart library counts are calculated for every filter in one public helper', () => {
  const counts = smartLibraryCounts({
    ...state,
    library: [
      { id: '1', sourceId: 's', totalChapters: 1 },
      { id: '2', sourceId: 's', totalChapters: 3 },
    ],
    getMangaKey: (id, sourceId) => `${sourceId}__${id}`,
  });
  assert.deepEqual(counts, { all: 2, continue: 1, unread: 1, updated: 1, downloaded: 1, completed: 1 });
});
