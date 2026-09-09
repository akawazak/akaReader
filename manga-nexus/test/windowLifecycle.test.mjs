import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const {
  WINDOW_CLOSE_FLUSH_TIMEOUT_MS,
  resolveWindowCloseAction,
} = require('../runtime/window-lifecycle.cjs');

test('Alt+F4 hides only when close-to-tray is enabled', () => {
  assert.equal(resolveWindowCloseAction({ isQuitting: false, closeToTray: true }), 'hide');
  assert.equal(resolveWindowCloseAction({ isQuitting: false, closeToTray: false }), 'quit');
});

test('an in-progress quit is allowed through the native close event', () => {
  assert.equal(resolveWindowCloseAction({ isQuitting: true, closeToTray: true }), 'allow');
});

test('renderer close flushing has a short bounded fallback', () => {
  assert.ok(WINDOW_CLOSE_FLUSH_TIMEOUT_MS >= 100);
  assert.ok(WINDOW_CLOSE_FLUSH_TIMEOUT_MS <= 1000);
});

test('Electron and preload wire the renderer flush acknowledgement', async () => {
  const [mainSource, preloadSource] = await Promise.all([
    readFile(new URL('../electron-main.js', import.meta.url), 'utf8'),
    readFile(new URL('../preload.js', import.meta.url), 'utf8'),
  ]);
  assert.match(mainSource, /requestRendererCloseFlush\(\)/);
  assert.match(mainSource, /window-close-flush-complete/);
  assert.match(preloadSource, /onBeforeWindowClose/);
  assert.match(preloadSource, /completeWindowCloseFlush/);
  assert.match(mainSource, /show-notification/);
  assert.match(preloadSource, /showNotification/);
});
