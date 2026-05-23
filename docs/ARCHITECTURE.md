# ARCHITECTURE

## High-Level Structure

The repository contains two runtime applications:

- `backend/`
  A local Express proxy that fronts Suwayomi and exposes a simpler REST API for the UI.
- `manga-nexus/`
  The Electron desktop app. It contains:
  - the Electron main process
  - the preload bridge
  - the React/Vite renderer

At runtime, the stack looks like this:

`React renderer -> Express proxy (3001) -> Suwayomi (4567) -> source extensions`

Electron sits beside that flow and is responsible for booting and supervising both local services.

## Frontend / Backend Split

### Frontend

- Entry: `manga-nexus/src/main.jsx`
- Main app shell and state: `manga-nexus/src/App.jsx`
- Reader session logic: `manga-nexus/src/components/reader/Reader.jsx`
- Supporting presentational components: `manga-nexus/src/components/**`, `manga-nexus/src/views/**`

The renderer is not thin. It owns:

- UI state
- persisted user state
- chapter download queue
- offline chapter IndexedDB storage
- app navigation
- reader position tracking

### Backend

- Entry: `backend/server.js`

The backend is a translator and stabilizer layer. It adds:

- REST endpoints tailored to the UI
- retries around Suwayomi requests
- in-memory caching for extensions, search, manga, and page lists
- image proxying
- extension install/update/uninstall helpers

## Electron Main Process

`manga-nexus/electron-main.js` is effectively the runtime supervisor.

Responsibilities:

- single-instance lock
- window/tray lifecycle
- settings persistence for Electron-only preferences
- Java/JRE discovery or installation
- Suwayomi JAR discovery or download
- optional Windows service install/uninstall
- backend process startup via `utilityProcess.fork`
- Suwayomi startup/health wait loop
- updater integration with `electron-updater`
- IPC handlers exposed through `preload.js`

The preload contract in `manga-nexus/preload.js` gives the renderer access to:

- window controls
- service restart/ensure operations
- service installation status
- current desktop platform so Windows-only UI can stay hidden elsewhere
- data directory/runtime info
- packaged app updater actions

## State Management

There is no external state library. State is centralized in React.

Primary pattern:

- `DataContext` is defined in `src/contexts/DataContext.jsx`
- `DataProvider` actually lives in `src/App.jsx`
- `useData()` is the main access point for shared state/actions

Core persisted state in `DataProvider`:

- `library`
- `history`
- `progress`
- `mangaCategories`
- `readChapters`
- `readingTime`
- `settings`

Persistence layers:

- `localStorage`
  Stores app/user state such as library, progress, settings, and history.
- IndexedDB
  Stores offline chapter page payloads in the `chapters` object store.

Network/service state:

- `backendOnline`
- `suwayomiReady`
- `sources`
- `extensions`
- `updates`
- `downloadQueue`

## Reader Rendering Flow

Primary files:

- `manga-nexus/src/App.jsx`
- `manga-nexus/src/components/reader/Reader.jsx`

Flow:

1. User opens manga details in `openManga()`.
2. User opens a chapter in `openChapter()`.
3. `openChapter()` first checks IndexedDB via `loadChapterBlobs()`.
4. If offline pages exist, they are used immediately.
5. Otherwise the renderer requests `/api/source/:sourceId/chapter/:chapterId`.
6. `Reader.jsx` receives:
   - initial pages
   - current chapter
   - navigation callbacks
   - persisted initial page
7. `Reader.jsx` derives a flattened `allPages` list from loaded chapters.
8. In scroll/webtoon mode, an `IntersectionObserver` tracks the most visible page and persists progress.
9. In paged mode, keyboard/tap/wheel handlers drive page changes directly.
10. When the reader nears the end, it may call `fetchNextChapter()` and append the next chapter into the same reading session.
11. Reader-side next-chapter prefetch now uses an `AbortController` so stale prefetches can be canceled during teardown/navigation.

## Chapter Fetching / Loading

### Manga details and chapters

Route:

- `/api/source/:sourceId/manga/:mangaId`

Backend behavior:

- tries `fetchManga`
- falls back to direct `manga(id)` query
- tries chapter list query
- falls back to `fetchChapters`
- normalizes chapter metadata for the renderer

### Chapter pages

Route:

- `/api/source/:sourceId/chapter/:chapterId`

Backend behavior:

- GraphQL `fetchChapterPages`
- normalizes page URLs with `fixUrl()`
- caches page arrays in memory using source-aware keys

### In-session next chapter loading

The reader does not always leave and reopen for the next chapter. Instead:

- `Reader.jsx` watches a sentinel near the end of scroll mode
- or hits navigation in paged mode
- then calls `fetchNextChapter()` from `App.jsx`
- `fetchNextChapter()` checks IndexedDB first, then calls the backend
- both `openChapter()` and reader-side prefetch use abort signals to avoid stale async writes after navigation
- if successful, `Reader.jsx` appends the next chapter into `loadedChapters`

## Image Caching Pipeline

There are two distinct image paths:

### Online image delivery

1. Suwayomi/source returns a page or cover URL.
2. UI often passes it through `proxyImg()`.
3. `proxyImg()` rewrites local/Suwayomi URLs to `/api/img?url=...`.
4. Backend `/api/img` only allows loopback/Suwayomi hosts, then fetches the binary and returns it with cache headers.
5. Browser/Electron webview handles normal HTTP caching.

This is used for:

- covers
- chapter pages while online

### Offline chapter caching

1. Download queue fetches chapter page URLs.
2. Each page is fetched in the renderer.
3. `saveChapterBlobs()` stores the raw `Blob` payloads in IndexedDB.
4. `loadChapterBlobs()` converts stored blobs into temporary object URLs when reopening a chapter.
5. `App.jsx` revokes old blob URLs when pages change or the reader flow unmounts.

Important note: offline cache storage is renderer-managed, not backend-managed.

## Navigation And Routing

There is no router library.

Navigation is manual state-machine navigation inside `App.jsx` using values like:

- `tab`
- `view`

Common views:

- tabbed home
- browse/source results
- manga detail
- reader

Important consequences:

- back navigation is custom (`goBack()`)
- keyboard/back-button behavior is custom
- view transitions depend on coordinated state updates, not route URLs

## Important Dependencies

### Renderer / desktop

- `react`, `react-dom`
  UI rendering and state.
- `vite`
  Fast dev server and frontend build tool.
- `electron`
  Desktop shell.
- `electron-builder`
  Packaging and distributables.
- `electron-updater`
  In-app update checks/downloads for packaged builds.
- `lucide-react`
  Icon set used throughout the UI.
- `concurrently`, `wait-on`
  Local dev orchestration for running Vite and Electron together.

### Backend

- `express`
  HTTP API surface.
- `axios`
  Outbound HTTP/GraphQL requests to Suwayomi and upstream images.
- `cors`
  Cross-origin support for local dev and Electron renderer access.
- `compression`
  Response compression when available.
- `helmet`
  Basic hardening headers when available.
- `archiver`
  Intended CBZ/ZIP download packaging.

## Current Architectural Pressure Points

- `src/App.jsx` is the dominant state and UI container and should be treated as a high-risk file.
- `Reader.jsx` has sophisticated async/state behavior and several observer/timer-driven flows.
- `backend/server.js` mixes multiple concerns:
  - cache layer
  - GraphQL adapter
  - image proxy
  - extension management
  - archive download route

Those files should be the first places to document and test whenever behavior changes.
