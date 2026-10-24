import assert from 'node:assert/strict';
import test from 'node:test';

import { buildLocalDoc, docsEqual, indexMangaDetail, makeSyncKey, mergeDocs, planExtensionInstalls, planLocalChanges } from '../src/utils/cloudSync.mjs';

const getMangaKey = (id, sourceId) => `${sourceId}__${id}`;
const detail = (url, chapters, id) => ({ id, url, chapters: chapters.map(([id, number]) => ({ id, number })) });

// The same title has different local IDs on each device: 5 on the PC, 91 on the phone.
const pcIndex = indexMangaDetail({}, 's1__5', 's1', detail('/manga/abc', [['50', '1'], ['51', '2'], ['52', '3']], '5'));
const phoneIndex = indexMangaDetail({}, 's1__91', 's1', detail('/manga/abc', [['900', '1'], ['901', '2'], ['902', '3']], '91'));
const KEY = makeSyncKey('s1', '/manga/abc');

test('progress and read chapters cross devices by chapter number, not local ID', () => {
  const pc = buildLocalDoc({
    library: [{ id: '5', sourceId: 's1', title: 'ABC', addedAt: 100 }],
    progress: { 's1__5': { chapterId: '51', chapterNum: '2', page: 7, lastRead: 2000 } },
    readChapters: { 's1__5': ['50'] },
    index: pcIndex,
    getMangaKey,
  });
  assert.deepEqual(pc.titles[KEY].read, ['1']);
  assert.deepEqual(pc.titles[KEY].progress, { chapterNum: '2', page: 7, lastRead: 2000 });

  const plan = planLocalChanges({ doc: pc, library: [], progress: {}, readChapters: {}, index: phoneIndex, getMangaKey });
  assert.deepEqual(plan.progress['s1__91'], { chapterId: '901', chapterNum: '2', page: 7, lastRead: 2000 });
  assert.deepEqual(plan.read['s1__91'], ['900']);
  assert.equal(plan.addToLibrary[0].mangaKey, 's1__91');
});

test('newest progress wins and read chapters are unioned', () => {
  const a = { version: 1, titles: { [KEY]: { inLibrary: true, libraryAt: 1, read: ['1'], progress: { chapterNum: '2', page: 3, lastRead: 10 } } } };
  const b = { version: 1, titles: { [KEY]: { inLibrary: true, libraryAt: 1, read: ['2'], progress: { chapterNum: '1', page: 0, lastRead: 5 } } } };
  const merged = mergeDocs(a, b);
  assert.deepEqual(merged.titles[KEY].read.sort(), ['1', '2']);
  assert.equal(merged.titles[KEY].progress.lastRead, 10);
  assert.ok(docsEqual(merged, mergeDocs(b, a)));
});

test('a removal on one device is not undone by an older add on another', () => {
  const previous = { version: 1, titles: { [KEY]: { inLibrary: false, libraryAt: 500, read: [], progress: null } } };
  const pc = buildLocalDoc({
    library: [{ id: '5', sourceId: 's1', addedAt: 100 }], progress: {}, readChapters: {}, index: pcIndex, getMangaKey, previous,
  });
  assert.equal(pc.titles[KEY].inLibrary, false);
  const plan = planLocalChanges({ doc: pc, library: [{ id: '5', sourceId: 's1', addedAt: 100 }], progress: {}, readChapters: {}, index: pcIndex, getMangaKey });
  assert.deepEqual(plan.removeFromLibrary, ['s1__5']);
});

test('titles this device has never opened are reported for lookup', () => {
  const doc = { version: 1, titles: { [KEY]: { title: 'ABC', inLibrary: true, libraryAt: 1, read: ['1'], progress: null } } };
  const plan = planLocalChanges({ doc, library: [], progress: {}, readChapters: {}, index: {}, getMangaKey });
  assert.equal(plan.unresolved.length, 1);
  assert.equal(plan.unresolved[0].syncKey, KEY);
});

test('unknown chapter number 0 is not synced as chapter 0', () => {
  const doc = buildLocalDoc({
    library: [], progress: { 's1__5': { chapterId: 'missing', chapterNum: '0', page: 1, lastRead: 5 } }, readChapters: {}, index: pcIndex, getMangaKey,
  });
  assert.equal(doc.titles[KEY], undefined);
});

test('extensions installed on one device are installed on the other; removals only stop spreading', () => {
  const base = { library: [], progress: {}, readChapters: {}, index: {}, getMangaKey: (id, s) => `${s}:${id}` };
  const pc = buildLocalDoc({ ...base, installedExtensions: [{ pkgName: 'ext.a', name: 'A' }, { pkgName: 'ext.b', name: 'B' }] });
  const phone = buildLocalDoc({ ...base, installedExtensions: [{ pkgName: 'ext.b', name: 'B' }], extensionChanges: { 'ext.c': { installed: false, at: 50 } } });
  const merged = mergeDocs(pc, phone);
  const store = [{ pkgName: 'ext.a', isInstalled: false }, { pkgName: 'ext.b', isInstalled: true }, { pkgName: 'ext.c', isInstalled: false }];
  assert.deepEqual(planExtensionInstalls(merged, store), ['ext.a']);
  assert.equal(docsEqual(merged, mergeDocs(merged, phone)), true);

  // The phone removes A after it spread: the account stops installing it, the PC keeps it.
  const removed = buildLocalDoc({ ...base, previous: merged, installedExtensions: [{ pkgName: 'ext.b' }], extensionChanges: { 'ext.a': { installed: false, at: 100 } } });
  const next = mergeDocs(buildLocalDoc({ ...base, previous: merged, installedExtensions: [{ pkgName: 'ext.a' }, { pkgName: 'ext.b' }] }), removed);
  assert.equal(next.extensions['ext.a'].installed, false);
  assert.deepEqual(planExtensionInstalls(next, store), []);
});
