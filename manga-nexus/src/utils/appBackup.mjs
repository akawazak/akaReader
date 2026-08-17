export const APP_BACKUP_SCHEMA = 'akareader-backup';
export const APP_BACKUP_VERSION = 3;
export const APP_BACKUP_MAX_BYTES = 10 * 1024 * 1024;

export const BACKUP_STORAGE_KEYS = Object.freeze([
  'library',
  'history',
  'progress',
  'mangaCategories',
  'categories',
  'readChapters',
  'readingTime',
  'appSettings',
  'keyMigrationV2',
  'onboardingDone',
  'aka:dup-dismissed',
]);

const ARRAY_KEYS = new Set(['library', 'history', 'categories', 'aka:dup-dismissed']);
const OBJECT_KEYS = new Set(['progress', 'mangaCategories', 'readChapters', 'readingTime', 'appSettings']);
const BOOLEAN_KEYS = new Set(['keyMigrationV2', 'onboardingDone']);

function hasExpectedBackupType(key, value) {
  if (key.startsWith('aka:note:')) return typeof value === 'string';
  if (ARRAY_KEYS.has(key)) return Array.isArray(value);
  if (OBJECT_KEYS.has(key)) return !!value && typeof value === 'object' && !Array.isArray(value);
  if (BOOLEAN_KEYS.has(key)) return typeof value === 'boolean';
  return false;
}

export function createAppBackup(readValue, metadata = {}) {
  const data = {};
  const noteKeys = Array.isArray(metadata.noteKeys)
    ? metadata.noteKeys.filter(key => /^aka:note:[^\r\n]{1,700}$/.test(String(key)))
    : [];
  for (const key of [...BACKUP_STORAGE_KEYS, ...noteKeys]) {
    const value = readValue(key);
    if (value !== undefined && value !== null) data[key] = value;
  }
  return {
    schema: APP_BACKUP_SCHEMA,
    version: APP_BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    appVersion: String(metadata.appVersion || ''),
    platform: String(metadata.platform || ''),
    data,
  };
}

export function validateAppBackup(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'This is not an akaReader backup.' };
  }
  if (!value.schema && value.version === 2) {
    const legacyData = {};
    for (const key of BACKUP_STORAGE_KEYS) {
      if (Object.prototype.hasOwnProperty.call(value, key) && hasExpectedBackupType(key, value[key])) legacyData[key] = value[key];
    }
    if (!Object.keys(legacyData).length) return { ok: false, error: 'The legacy backup contains no restorable data.' };
    return {
      ok: true,
      backup: {
        schema: APP_BACKUP_SCHEMA,
        version: 2,
        createdAt: value.createdAt || '',
        appVersion: '',
        platform: '',
        data: legacyData,
      },
    };
  }
  if (value.schema !== APP_BACKUP_SCHEMA) {
    return { ok: false, error: 'This file was not created by a supported akaReader version.' };
  }
  if (!Number.isInteger(value.version) || value.version < 2 || value.version > APP_BACKUP_VERSION) {
    return { ok: false, error: `Backup version ${value.version ?? 'unknown'} is not supported.` };
  }
  if (!value.data || typeof value.data !== 'object' || Array.isArray(value.data)) {
    return { ok: false, error: 'The backup data is missing or damaged.' };
  }

  const data = {};
  for (const [key, entry] of Object.entries(value.data)) {
    if ((BACKUP_STORAGE_KEYS.includes(key) || /^aka:note:[^\r\n]{1,700}$/.test(key)) && hasExpectedBackupType(key, entry)) {
      data[key] = entry;
    }
  }
  if (!Object.keys(data).length) return { ok: false, error: 'The backup contains no restorable data.' };
  return { ok: true, backup: { ...value, data } };
}

export function applyAppBackup(backup, writeValue) {
  const result = validateAppBackup(backup);
  if (!result.ok) throw new Error(result.error);
  for (const [key, value] of Object.entries(result.backup.data)) writeValue(key, value);
  return Object.keys(result.backup.data);
}
