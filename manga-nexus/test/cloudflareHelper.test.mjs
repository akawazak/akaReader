import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  SUWAYOMI_CLOUDFLARE_SESSION,
  buildManagedCloudflareRuntime,
  getManagedCloudflareRelease,
  hasCloudflareSession,
} = require('../runtime/cloudflare-helper.cjs');

test('describes both the private helper profile and exact shared driver path', () => {
  const runtime = buildManagedCloudflareRuntime(
    { APPDATA: 'C:\\Users\\reader\\AppData\\Roaming', KEEP_ME: 'yes' },
    'C:\\Users\\reader\\AppData\\Roaming\\akareader',
    '4321-123456',
    'win32',
  );

  assert.equal(runtime.env.KEEP_ME, 'yes');
  assert.equal(runtime.env.APPDATA, runtime.sessionDir);
  assert.equal(runtime.env.LOCALAPPDATA, runtime.sessionDir);
  assert.equal(runtime.env.DISABLE_MEDIA, 'true');
  assert.equal(
    runtime.sessionDir,
    'C:\\Users\\reader\\AppData\\Roaming\\akareader\\flaresolverr-sessions\\4321-123456',
  );
  assert.equal(
    runtime.sharedDriverPath,
    'C:\\Users\\reader\\AppData\\Roaming\\undetected_chromedriver\\chromedriver.exe',
  );
  assert.doesNotMatch(runtime.sessionDir, /undetected_chromedriver$/i);
});

test('rejects an unusable helper session id', () => {
  assert.throws(() => buildManagedCloudflareRuntime({}, 'C:\\akaReader', '***'), /session directory/i);
});

test('pins verified Windows and Linux x64 helper assets', () => {
  const windows = getManagedCloudflareRelease('win32', 'x64');
  const linux = getManagedCloudflareRelease('linux', 'x64');

  assert.equal(windows.assetName, 'flaresolverr_windows_x64.zip');
  assert.equal(windows.size, 325907053);
  assert.equal(windows.sha256, '76a6c3e43af7de3827b2ea1badf2bb607f664caa445cef3f14d624b421f7e01e');
  assert.equal(linux.assetName, 'flaresolverr_linux_x64.tar.gz');
  assert.equal(linux.size, 233715222);
  assert.equal(linux.sha256, '05551d5846cfffd62c3ea24e2d70af5de314470fc7fd5434b3ca130616092b33');
  assert.equal(getManagedCloudflareRelease('linux', 'arm64'), null);
});

test('uses XDG session directories for the Linux helper without replacing HOME', () => {
  const runtime = buildManagedCloudflareRuntime(
    { HOME: '/home/reader', KEEP_ME: 'yes' },
    '/home/reader/.config/akareader',
    '4321-123456',
    'linux',
  );

  assert.equal(runtime.env.HOME, '/home/reader');
  assert.equal(runtime.env.XDG_CACHE_HOME, runtime.sessionDir);
  assert.equal(runtime.env.XDG_CONFIG_HOME, runtime.sessionDir);
  assert.equal(runtime.env.XDG_DATA_HOME, runtime.sessionDir);
  assert.equal(runtime.env.APPDATA, undefined);
});

test('recognizes the reusable Suwayomi browser session in helper responses', () => {
  assert.equal(SUWAYOMI_CLOUDFLARE_SESSION, 'suwayomi');
  assert.equal(hasCloudflareSession({ sessions: ['suwayomi'] }), true);
  assert.equal(hasCloudflareSession({ sessions: [{ session: 'suwayomi' }] }), true);
  assert.equal(hasCloudflareSession({ sessions: ['another-session'] }), false);
});
