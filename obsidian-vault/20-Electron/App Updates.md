---
tags: [flow, electron]
---
# App Updates
Up: [[Electron Main]]

- Packaged builds use `electron-updater`.
- Before download **and** before restart/install, renderer sends an allowlisted state snapshot → Electron size-checks it, writes it (restricted mode) under `userData/backups`, keeps latest **5**. See [[Backup and Diagnostics]].
- Download runs while the UI stays interactive; banner says it installs on close; `Restart now` available.
- Windows: one-click NSIS installer. → [[Packaging and CI]]

IPC: `checkForAppUpdate`, `downloadAppUpdate`, `installAppUpdate`, `saveAutomaticBackup`.
