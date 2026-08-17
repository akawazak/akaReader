import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  DEFAULT_EXTENSION_STORES,
  buildSuwayomiConfig,
  configureCloudflareHelper,
  configuredExtensionStores,
  isValidExtensionStoreUrl,
  normalizeExtensionStoreUrls,
} = require('../runtime/extension-stores.cjs');

test('includes the maintained Keiyoushi store by default', () => {
  assert.deepEqual(configuredExtensionStores(), [...DEFAULT_EXTENSION_STORES]);
  assert.match(DEFAULT_EXTENSION_STORES[0], /keiyoushi\/extensions\/repo\/index\.min\.json$/);
});

test('normalizes custom stores without duplicating the built-in store', () => {
  assert.deepEqual(normalizeExtensionStoreUrls([
    DEFAULT_EXTENSION_STORES[0],
    ' https://example.com/repo/index.min.json ',
    'https://example.com/repo/index.min.json',
    'file:///tmp/index.json',
  ]), ['https://example.com/repo/index.min.json']);
  assert.equal(isValidExtensionStoreUrl('https://example.com/index.json'), true);
  assert.equal(isValidExtensionStoreUrl('file:///tmp/index.json'), false);
});

test('writes extensionStores and removes the obsolete managed block', () => {
  const existing = [
    'server.extensionStores = [] # old value',
    '# akaReader managed settings',
    'server.extensionRepos = ["https://old.invalid/index.json"]',
    '# /akaReader managed settings',
  ].join('\n');
  const next = buildSuwayomiConfig(existing, ['https://example.com/repo/index.min.json']);

  assert.doesNotMatch(next, /extensionRepos/);
  assert.match(next, /server\.extensionStores = \["https:\/\/raw\.githubusercontent\.com\/keiyoushi\/extensions\/repo\/index\.min\.json","https:\/\/example\.com\/repo\/index\.min\.json"\]/);
  assert.match(next, /server\.initialOpenInBrowserEnabled = false/);
  assert.match(next, /server\.systemTrayEnabled = false/);
});

test('repairs a multiline extensionStores assignment and its old orphaned tail', () => {
  const malformed = [
    'server.extensionStores = ["https://old.example/index.json"]',
    '    "https://github.com/keiyoushi/extensions/raw/repo/index.pb"',
    ']',
    'server.maxSourcesInParallel = 6',
  ].join('\n');
  const next = buildSuwayomiConfig(malformed);

  assert.match(next, new RegExp(`server\\.extensionStores = \\["${DEFAULT_EXTENSION_STORES[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\]`));
  assert.doesNotMatch(next, /index\.pb|^\s*\]\s*$/m);
  assert.match(next, /server\.maxSourcesInParallel = 6/);
});

test('enables the loopback Cloudflare helper without duplicating settings', () => {
  const existing = [
    'server.flareSolverrEnabled = false',
    'server.flareSolverrUrl = "http://localhost:8191"',
    'server.flareSolverrEnabled = false',
  ].join('\n');
  const next = configureCloudflareHelper(existing);

  assert.equal((next.match(/server\.flareSolverrEnabled/g) || []).length, 1);
  assert.match(next, /server\.flareSolverrEnabled = true/);
  assert.match(next, /server\.flareSolverrUrl = "http:\/\/127\.0\.0\.1:8191"/);
  assert.match(next, /server\.flareSolverrAsResponseFallback = true/);
});
