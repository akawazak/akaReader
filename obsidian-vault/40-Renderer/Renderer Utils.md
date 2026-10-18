---
tags: [renderer, pure-logic]
---
# Renderer Utils
`manga-nexus/src/utils/` — pure, unit-tested helpers ([[Tests]]).

| Module | Used by |
|---|---|
| `appBackup.mjs` | versioned allowlist, v2 migration, restore → [[Backup and Diagnostics]] |
| `browsePagination.mjs` | merge/dedupe/retry/backoff → [[Browse Pagination]] |
| `chapterTracking.mjs` | chapter-ID based reading totals → [[Reader Flow]] |
| `chapterUpdates.mjs` | known/new reconciliation, scheduling, date labels → [[Chapter Updates]] |
| `downloadQueue.mjs` | queue normalize, interrupted recovery, storage headroom → [[Offline Downloads]] |
| `downloadStorage.mjs` | key parsing, per-manga summaries → [[Offline Downloads]] |
| `libraryFilters.mjs` | smart views → [[Library Smart Views]] |
| `readerProgress.mjs` | Continue target resolution → [[Reader Flow]] |
| `readerZoom.mjs` | zoom clamp 50–500% → [[Reader]] |
| `sourceErrors.mjs` | compact error states → [[Source Errors]] |
| `helpers.js` | `proxyImg`, `timeAgo`, `storage`, `debounce`… (duplicated in App.jsx) |
