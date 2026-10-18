---
tags: [flow, electron, suwayomi]
---
# Extension Stores
Up: [[Electron Main]]

- Electron always writes the maintained **Keiyoushi** index into Suwayomi's `server.extensionStores` before Suwayomi starts.
- Custom HTTP(S) stores: validated, deduped, persisted in `electron-settings.json`, merged in.
- Removes the obsolete `server.extensionRepos` block.
- Writer replaces the whole multiline assignment and repairs the dangling quoted-entry tail left by an old line-only migration bug.
- Adding/removing a store from Settings restarts managed services so the catalog refreshes.

Code: [[Electron Runtime Modules#extension-stores.cjs]]. UI: `ExtensionsTab.jsx` ([[Renderer Components]]). IPC: `getExtensionRepos` / `setExtensionRepos`.
