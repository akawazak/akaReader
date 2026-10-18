---
tags: [flow, settings]
---
# Backup and Diagnostics
Up: [[Home]]

## System health (Settings)
[[Electron Main]] checks: local API, Java, Suwayomi GraphQL, managed JAR, writable/free storage, optional helper. Never exposes the token.
**Repair automatically** fixes only what's needed: verify backend files, install Java if incompatible, repair JAR/config, start helper if previously enabled, restart services.
IPC: `getSystemDiagnostics`, `repairSystem`.

## Backups
- Native save/open dialogs (not renderer download links).
- Schema **v3**, size-limited allowlist: library, history, progress, categories, reading state/time, settings, onboarding, duplicate dismissals, manga notes, chapter-update baseline + last summary.
- Still imports **v2**.
- IndexedDB image blobs excluded (re-downloadable).
- Automatic pre-update backups, rotated (5) → [[App Updates]].

Code: `appBackup.mjs` ([[Renderer Utils]]). IPC: `exportAppBackup`, `importAppBackup`, `saveAutomaticBackup`.
