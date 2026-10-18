---
tags: [rules]
---
# Agent Rules
From `AGENTS.md`. Up: [[Home]]

- Understand first, edit second — read `docs/` before changing code.
- Not a generic React app: [[Electron Main]] startup and [[Suwayomi]] orchestration are core behavior.
- Prefer targeted edits. [[App-jsx|App.jsx]] (~7k lines) is easy to destabilize.
- Reader changes → inspect both [[App-jsx|App.jsx]] and [[Reader]].
- Service startup changes → inspect [[Electron Main]], [[Preload Bridge]], [[Backend Proxy]].
- Declare callbacks **before** any hook dependency array references them; run `npm run check:hook-order` (see [[Commands]]). Violations cause minified TDZ crashes: `Cannot access 'x' before initialization`.
- Keep offline in mind — chapters may load from IndexedDB first ([[Offline Downloads]]).
- Never revert unrelated user changes.

## Docs maintenance
A "major change" (startup, backend routes/caching, reader persistence, offline format, navigation/state ownership, packaging) must update `AGENTS.md` + `docs/ARCHITECTURE.md`, `FILE_MAP.md`, `KNOWN_BUGS.md`, `DEV_WORKFLOW.md` in the same change.

## Skip by default
`node_modules`, `dist`, `build`, crash/startup logs, `backend/Suwayomi-Server-*.jar`, `manga-nexus/extract.js`, `manga-nexus/update_electron.js`, `consts.txt`.
