import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DOWNLOAD_STORAGE_RESERVE_BYTES,
  formatByteSize,
  normalizeDownloadQueue,
  queueForPersistence,
  storageCapacityResult,
} from '../src/utils/downloadQueue.mjs';

const interruptedItem = {
  id: 'job-1',
  mangaId: 'manga-1',
  mangaTitle: 'Example',
  chapterId: 'chapter-2',
  chapterNum: 2,
  sourceId: 'source-3',
  downloadKey: 'source-3__manga-1___chapter-2',
  status: 'downloading',
  progress: 64,
  pagesLoaded: 8,
  pagesTotal: 12,
  attempts: 2,
};

test('interrupted downloads recover as fresh pending jobs', () => {
  const [job] = normalizeDownloadQueue([interruptedItem]);
  assert.equal(job.status, 'pending');
  assert.equal(job.progress, 0);
  assert.equal(job.pagesLoaded, 0);
  assert.equal(job.attempts, 0);
  assert.equal(job.recovered, true);
});

test('persistence drops cancelled jobs and leaves failed work available', () => {
  const queue = [
    { ...interruptedItem, id: 'cancelled', status: 'cancelled' },
    { ...interruptedItem, id: 'failed', status: 'error', error: 'network' },
  ];
  const saved = queueForPersistence(queue);
  assert.deepEqual(saved.map(job => job.id), ['failed']);
  assert.equal(saved[0].error, 'network');
});

test('storage capacity check blocks downloads when the reserve is exhausted', () => {
  const low = storageCapacityResult({ quota: 200_000_000, usage: 200_000_000 - DOWNLOAD_STORAGE_RESERVE_BYTES + 1 });
  const enough = storageCapacityResult({ quota: 500_000_000, usage: 100_000_000 });
  const unknown = storageCapacityResult({});
  assert.equal(low.ok, false);
  assert.equal(enough.ok, true);
  assert.equal(unknown.ok, true);
  assert.equal(unknown.known, false);
  assert.equal(formatByteSize(1024 * 1024), '1.0 MB');
});
