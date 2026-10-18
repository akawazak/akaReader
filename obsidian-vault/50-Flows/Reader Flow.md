---
tags: [flow, reader]
---
# Reader Flow
Files: [[App-jsx|App.jsx]] + [[Reader]]. Up: [[Home]]

1. `openManga()` → `/api/source/:sourceId/manga/:mangaId` ([[API Routes]]).
2. `openChapter()` checks IndexedDB via `loadChapterBlobs()` first ([[Offline Downloads]]).
3. Offline pages → used immediately as blob URLs. Else → `/api/source/:sourceId/chapter/:chapterId`.
4. [[Reader]] renders; progress written synchronously through [[DataProvider]].
5. Near end → `fetchNextChapter()` (IndexedDB first, then backend) appends into the same session.
6. Abort signals on `openChapter()` and prefetch prevent stale writes after navigation.
7. Old blob URLs revoked when pages change / reader unmounts.

## Continue / progress
- Continue target resolved by **normalized chapter ID**, resumes exact saved page; removed provider chapter → first reading chapter (`readerProgress.mjs`).
- Never advances just because a chapter is marked read.
- Reading totals = unique chapter IDs in `readChapters` (not chapter labels) — `chapterTracking.mjs`.
- Electron close → flush handshake ([[Electron Main#Close handshake]]).
