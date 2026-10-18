---
tags: [flow, offline, storage]
---
# Offline Downloads
Renderer-managed, **not** backend-managed. Up: [[Home]]

## Storage
- IndexedDB DB `akareader-downloads` v1, store `chapters`: raw page `Blob`s + compact source/title/chapter metadata. Old page-only records still readable.
- Queue manifest in `localStorage` key `downloadQueueV1` ([[Persistence Keys]]).

## Pipeline
1. Queue fetches chapter page URLs from backend.
2. `navigator.storage.estimate()` checks headroom before starting a chapter.
3. Pages fetched in renderer (concurrency 4), saved via `saveChapterBlobs()` in **one transaction** (no partial chapters).
4. Reopen: `loadChapterBlobs()` → object URLs.

## Recovery
- `downloading` at shutdown → restored as `pending`, resumes only after backend is healthy.
- Transient failures retry up to 3× with bounded delay; verification / client / low-storage errors stay visible for manual action.

## Management
`StorageManager.jsx` ([[Renderer Components]]): exact bytes/pages, origin quota, per-title cleanup, delete-read, delete-all; auto-delete-read setting reuses this path.

Utils: `downloadQueue.mjs`, `downloadStorage.mjs` ([[Renderer Utils]]). Risk: still runs inside React lifecycle ([[Known Risks]]).
Export → [[CBZ Export]]. Auto-download of new chapters → [[Chapter Updates]].
