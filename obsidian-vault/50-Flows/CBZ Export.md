---
tags: [flow, offline]
---
# CBZ Export
Up: [[Offline Downloads]]

- Manga details: export one chapter (native **save** dialog) or all chapters (native **folder** picker).
- [[Electron Main]] validates/sanitizes metadata ([[Electron Runtime Modules#chapter-export.cjs]]), streams the authenticated backend's CBZ (`/api/source/:sourceId/chapter/:chapterId/download`) straight to disk — never buffered in the renderer.
- Partial files removed on failure; non-colliding filenames in batch.

IPC: `exportChapterCbz`, `exportMangaCbz`. Test: `chapterExport.test.mjs`.
