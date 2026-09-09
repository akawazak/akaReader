import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readerSource = await readFile(new URL('../src/components/reader/Reader.jsx', import.meta.url), 'utf8');

test('reader settings expose an accessible dialog and labelled controls', () => {
  assert.match(readerSource, /role="dialog" aria-modal="true" aria-labelledby="reader-settings-title"/);
  assert.match(readerSource, /role="switch" aria-checked=\{val\} aria-label=\{label\}/);
  assert.match(readerSource, /aria-label=\{label\}[\s\S]*aria-valuetext=\{fmt\(val\)\}/);
});

test('reader settings move focus into the dialog and preserve the trigger', () => {
  assert.match(readerSource, /panelCloseButtonRef\.current\?\.focus\(\)/);
  assert.match(readerSource, /previousFocusRef\.current\?\.isConnected/);
  assert.match(readerSource, /aria-haspopup="dialog" aria-expanded=\{panelOpen\}/);
});
