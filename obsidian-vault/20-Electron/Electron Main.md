---
tags: [electron, high-risk]
file: manga-nexus/electron-main.js
---
# Electron Main
`manga-nexus/electron-main.js` (~2.5k lines) — the runtime supervisor. Up: [[Runtime Stack]]

## Responsibilities
- Single-instance lock, window + tray lifecycle ([[Electron Runtime Modules#window-lifecycle.cjs|close-to-tray policy]])
- Electron-only settings in `electron-settings.json` (close-to-tray, start with Windows, Discord, custom stores)
- Java discovery/validation + managed Temurin 21 install
- Suwayomi JAR discovery/download, `server.conf` edits ([[Extension Stores]])
- Backend start via `utilityProcess.fork` + per-launch token ([[Security Boundary]])
- Suwayomi start/health wait ([[Startup Flow]])
- Optional Windows service install/uninstall
- `electron-updater` ([[App Updates]])
- [[FlareSolverr Helper]] install/start/cleanup
- Source-verification `WebContentsView` ([[Source Verification Flow]])
- Native dialogs: [[CBZ Export]], backup import/export, diagnostics/repair ([[Backup and Diagnostics]])
- [[Discord Rich Presence]] controller
- Desktop notifications for [[Chapter Updates]]
- All IPC handlers → [[IPC Channels]] via [[Preload Bridge]]

## Close handshake
Sends `before-window-close` → renderer synchronously flushes [[Reader]] progress → acks `window-close-flush-complete` → hide/quit. 400 ms timeout so a broken renderer can't trap the window.

Pure logic is factored into `manga-nexus/runtime/*.cjs` → [[Electron Runtime Modules]].
