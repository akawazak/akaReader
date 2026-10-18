---
tags: [electron, ipc]
file: manga-nexus/preload.js
---
# Preload Bridge
`manga-nexus/preload.js` — exposes `window.electronAPI` via `contextBridge`. Up: [[Electron Main]]

Gives the trusted renderer: `platform`, `apiToken`, window controls, service ensure/restart, diagnostics/repair, Java info/install, Windows service mgmt, Discord, extension repos, CBZ export, backups, updater, Cloudflare helper, source verification, notifications, factory reset.

Full list → [[IPC Channels]]. Token use → [[Security Boundary]].
