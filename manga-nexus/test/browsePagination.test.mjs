import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTO_BROWSE_DELAY_MS,
  autoBrowseRetryDelay,
  isRetryableBrowseError,
  mergeBrowseResults,
} from '../src/utils/browsePagination.mjs';

test('appends unique manga and supplies the active source id', () => {
  const merged = mergeBrowseResults(
    [{ id: '1', title: 'One', sourceId: 'source-a' }],
    [{ id: '1', title: 'Duplicate' }, { id: '2', title: 'Two' }],
    'source-a',
  );

  assert.equal(merged.addedCount, 1);
  assert.deepEqual(merged.results.map(manga => manga.id), ['1', '2']);
  assert.equal(merged.results[1].sourceId, 'source-a');
});

test('reports no progress for a repeated page so automatic loading can stop', () => {
  const merged = mergeBrowseResults(
    [{ id: '1', sourceId: 'source-a' }, { id: '2', sourceId: 'source-a' }],
    [{ id: '1' }, { id: '2' }],
    'source-a',
  );

  assert.equal(merged.addedCount, 0);
  assert.equal(merged.results.length, 2);
});

test('treats an empty source id as the active source when deduplicating', () => {
  const merged = mergeBrowseResults(
    [{ id: '1', sourceId: 'source-a' }],
    [{ id: '1', sourceId: '' }],
    'source-a',
  );

  assert.equal(merged.addedCount, 0);
  assert.equal(merged.results.length, 1);
});

test('keeps identical manga ids distinct across sources', () => {
  const merged = mergeBrowseResults(
    [{ id: '1', sourceId: 'source-a' }],
    [{ id: '1', sourceId: 'source-b' }],
  );

  assert.equal(merged.addedCount, 1);
  assert.equal(merged.results.length, 2);
});

test('retries transient failures but not ordinary client errors', () => {
  assert.equal(isRetryableBrowseError(new TypeError('network unavailable')), true);
  assert.equal(isRetryableBrowseError({ status: 408 }), true);
  assert.equal(isRetryableBrowseError({ status: 429 }), true);
  assert.equal(isRetryableBrowseError({ status: 503 }), true);
  assert.equal(isRetryableBrowseError({ status: 403 }), false);
  assert.equal(isRetryableBrowseError({ status: 404 }), false);
});

test('uses a short initial delay and bounded exponential retry delays', () => {
  assert.equal(autoBrowseRetryDelay(0), AUTO_BROWSE_DELAY_MS);
  assert.equal(autoBrowseRetryDelay(1), 1000);
  assert.equal(autoBrowseRetryDelay(2), 2000);
  assert.equal(autoBrowseRetryDelay(8), 4000);
});
