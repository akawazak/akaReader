# DEV WORKFLOW

## Run The App

Open two terminals for the clearest local workflow.

### Backend only

From `backend/`:

```powershell
npm install
npm start
```

This starts the local proxy on port `3001`.

### Frontend in browser

From `manga-nexus/`:

```powershell
npm install
npm run dev
```

Vite runs on `http://localhost:5173` and proxies `/api` to `http://localhost:3001`.

Important:

- the browser preview does not manage Electron services automatically
- for full functionality, Suwayomi must also be available on `http://localhost:4567`

### Full Electron app in development

From `manga-nexus/`:

```powershell
npm run electron:dev
```

This starts:

- the Vite dev server
- the Electron shell

When run through Electron, `electron-main.js` is responsible for starting the backend and Suwayomi.

## Build Commands

From `manga-nexus/`:

```powershell
npm run build
```

Builds the renderer into `manga-nexus/dist`.

```powershell
npm run check:hook-order
```

Checks React hook dependency arrays in the high-risk renderer files for callbacks referenced before they are declared. Run this after moving callbacks in `App.jsx` or `Reader.jsx`.

```powershell
npm run electron:build
```

Builds the renderer and packages the Windows Electron app.

```powershell
npm run dist
```

Runs the Windows packaging flow used by the repo today.

## Testing Reality

Current state:

- no formal unit/integration test suite is configured
- no dedicated e2e runner is present
- validation is primarily manual/runtime-driven

That means safe debugging depends on targeted manual verification.

## Recommended Debugging Flow

### Service startup issues

Inspect first:

- `manga-nexus/electron-main.js`
- `manga-nexus/preload.js`
- `backend/server.js`
- `manga-nexus/electron-startup.err.log`
- `manga-nexus/crash.log`

Check these milestones:

1. Electron window opens.
2. Backend responds at `http://localhost:3001/api/ping`.
3. `/api/health` returns `{ ok: true }`.
4. Suwayomi responds at `http://localhost:4567/api/graphql`.
5. Renderer receives `services-status` events.

### Browse/source issues

Check in order:

1. `/api/extensions`
2. `/api/sources`
3. `/api/source/:sourceId/search`
4. whether the extension is actually installed and visible in Suwayomi
5. `src/components/extensions/ExtensionsTab.jsx` if the issue is only in the extension list UI

### Manga detail / chapter loading issues

Check:

1. `/api/source/:sourceId/manga/:mangaId`
2. `/api/source/:sourceId/chapter/:chapterId`
3. `openManga()` and `openChapter()` in `src/App.jsx`
4. `fetchNextChapter()` in `src/App.jsx` if the failure happens while chaining chapters
5. `Reader.jsx` if the failure is inside the reading session
6. `npm run check:hook-order` if the error says `Cannot access '<name>' before initialization`

### Offline download issues

Check:

1. `downloadQueue` logic in `src/App.jsx`
2. IndexedDB helpers:
   - `openDB()`
   - `saveChapterBlobs()`
   - `loadChapterBlobs()`
   - `deleteChapterBlobs()`
3. whether blob URLs are being revoked too early or not at all
4. whether the chapter was fetched online first

## How Future AI Agents Should Approach Debugging

- Reproduce with the smallest scope possible.
- Determine which layer owns the bug before editing:
  - Electron boot/lifecycle
  - backend proxy/Suwayomi adapter
  - renderer state/navigation
  - reader session
  - offline storage
- Prefer tracing one full user path end-to-end instead of scanning the whole repo.
- For renderer bugs, inspect `src/App.jsx` and `src/components/reader/Reader.jsx` first.
- For startup/runtime bugs, inspect `electron-main.js` first.
- For data/API bugs, inspect `backend/server.js` first.
- Avoid broad refactors while debugging. This codebase has a few large hub files where unrelated edits can easily create regressions.
- If you discover a major behavioral change, update all docs in `docs/` and `AGENTS.md` in the same patch.

## Useful Manual Checks

- Launch Electron and verify the startup screen progresses to online.
- Open extensions, install/uninstall one extension, and confirm source refresh.
- Browse a source, open a manga, and load a chapter.
- Read forward until next-chapter prefetch triggers.
- Download a chapter for offline use, reopen it offline, and verify IndexedDB-backed blob loading.
- Cancel an in-progress download and confirm it stops instead of finishing in the background.
- Restart services from settings and confirm the renderer recovers.
