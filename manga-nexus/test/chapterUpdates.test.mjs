import assert from 'node:assert/strict';
import test from 'node:test';

import {
  chapterUpdateBaseline,
  formatRelativeChapterDate,
  nextChapterUpdateDelay,
  reconcileChapterUpdateState,
} from '../src/utils/chapterUpdates.mjs';

test('the first successful scan establishes a baseline without calling old chapters new', () => {
  const state = chapterUpdateBaseline([{ id: 3 }, { id: '2' }, { id: 3 }], 1000);
  assert.deepEqual(state, {
    initialized: true,
    knownIds: ['3', '2'],
    newIds: [],
    newChapters: [],
    checkedAt: 1000,
  });
});

test('later scans report only newly discovered chapter IDs', () => {
  const result = reconcileChapterUpdateState({
    chapters: [{ id: '4', number: '4', name: 'Arrival', publishedAt: '2026-08-28T00:00:00.000Z', group: 'North Star' }, { id: '3' }, { id: '2' }],
    previous: chapterUpdateBaseline([{ id: '3' }, { id: '2' }], 1000),
    readChapterIds: [],
    checkedAt: 2000,
  });
  assert.deepEqual(result.discoveredIds, ['4']);
  assert.deepEqual(result.state.newIds, ['4']);
  assert.deepEqual(result.state.newChapters, [{
    id: '4', number: '4', name: 'Arrival', publishedAt: '2026-08-28T00:00:00.000Z', date: '', group: 'North Star',
  }]);
  assert.deepEqual(result.state.knownIds, ['4', '3', '2']);
});

test('pending releases survive later checks until read and removed chapters are pruned', () => {
  const result = reconcileChapterUpdateState({
    chapters: [{ id: '5' }, { id: '4', read: true }, { id: '3' }],
    previous: {
      initialized: true,
      knownIds: ['4', '3', 'removed'],
      newIds: ['4', 'removed'],
      checkedAt: 1000,
    },
    readChapterIds: [],
    checkedAt: 2000,
  });
  assert.deepEqual(result.discoveredIds, ['5']);
  assert.deepEqual(result.state.newIds, ['5']);
  assert.deepEqual(result.state.newChapters, [{ id: '5', number: '', name: '', publishedAt: '', date: '', group: '' }]);
});

test('stored chapter metadata survives a later scan and legacy ID-only state stays compatible', () => {
  const result = reconcileChapterUpdateState({
    chapters: [{ id: '6' }, { id: '5' }],
    previous: {
      initialized: true,
      knownIds: ['6', '5'],
      newIds: ['6', '5'],
      newChapters: [{ id: '6', number: '6', name: 'Stored title', group: 'Team' }],
    },
    readChapterIds: [],
    checkedAt: 3000,
  });
  assert.equal(result.state.newChapters[0].name, 'Stored title');
  assert.equal(result.state.newChapters[1].id, '5');
});

test('automatic update scheduling waits for the remainder of the configured interval', () => {
  assert.equal(nextChapterUpdateDelay({ intervalMs: 3600000, lastCheckedAt: 0, now: 1000 }), 0);
  assert.equal(nextChapterUpdateDelay({ intervalMs: 3600000, lastCheckedAt: 1000, now: 1801000 }), 1800000);
  assert.equal(nextChapterUpdateDelay({ intervalMs: 3600000, lastCheckedAt: 1000, now: 5000000 }), 0);
  assert.equal(nextChapterUpdateDelay({ intervalMs: 0, lastCheckedAt: 1000, now: 2000 }), null);
});

test('chapter release ages use compact readable labels', () => {
  const now = Date.UTC(2026, 7, 28, 12);
  const previousEvening = new Date(now);
  previousEvening.setDate(previousEvening.getDate() - 1);
  previousEvening.setHours(23, 0, 0, 0);
  assert.equal(formatRelativeChapterDate(new Date(now - 3600000).toISOString(), now), 'today');
  assert.equal(formatRelativeChapterDate(new Date(now - 86400000).toISOString(), now), 'yesterday');
  assert.equal(formatRelativeChapterDate(previousEvening.toISOString(), now), 'yesterday');
  assert.equal(formatRelativeChapterDate(new Date(now - (8 * 86400000)).toISOString(), now), '8 days ago');
  assert.equal(formatRelativeChapterDate('not-a-date', now), '');
});
