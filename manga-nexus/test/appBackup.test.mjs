import assert from 'node:assert/strict';
import test from 'node:test';

import {
  APP_BACKUP_SCHEMA,
  APP_BACKUP_VERSION,
  applyAppBackup,
  createAppBackup,
  validateAppBackup,
} from '../src/utils/appBackup.mjs';

test('backup round-trip preserves supported app data and manga notes', () => {
  const original = new Map([
    ['library', [{ id: '1', title: 'Example' }]],
    ['history', []],
    ['appSettings', { readerMode: 'paged' }],
    ['aka:note:source__1', 'remember this'],
    ['private-token', 'must not leave storage'],
  ]);
  const backup = createAppBackup(key => original.get(key), {
    appVersion: '2.0.51',
    platform: 'win32',
    noteKeys: ['aka:note:source__1', 'private-token'],
  });

  assert.equal(backup.schema, APP_BACKUP_SCHEMA);
  assert.equal(backup.version, APP_BACKUP_VERSION);
  assert.equal(backup.data['aka:note:source__1'], 'remember this');
  assert.equal(backup.data['private-token'], undefined);

  const restored = new Map();
  const keys = applyAppBackup(backup, (key, value) => restored.set(key, value));
  assert.ok(keys.includes('library'));
  assert.deepEqual(restored.get('appSettings'), { readerMode: 'paged' });
});

test('legacy v2 exports remain restorable', () => {
  const result = validateAppBackup({
    version: 2,
    library: [{ id: 7 }],
    history: [],
    progress: { 'source__7': { chapterId: 3 } },
  });
  assert.equal(result.ok, true);
  assert.equal(result.backup.schema, APP_BACKUP_SCHEMA);
  assert.deepEqual(result.backup.data.library, [{ id: 7 }]);
});

test('unsupported or empty backups are rejected', () => {
  assert.equal(validateAppBackup(null).ok, false);
  assert.equal(validateAppBackup({ schema: APP_BACKUP_SCHEMA, version: 999, data: {} }).ok, false);
  assert.equal(validateAppBackup({ schema: APP_BACKUP_SCHEMA, version: APP_BACKUP_VERSION, data: {} }).ok, false);
});
