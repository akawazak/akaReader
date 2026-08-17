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
- Extension management view: `manga-nexus/src/components/extensions/ExtensionsTab.jsx`
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
- Source error boundary: `backend/source-errors.js`

The backend is a translator and stabilizer layer. It adds:

- REST endpoints tailored to the UI
- retries around Suwayomi requests
- in-memory caching for extensions, search, manga, and page lists
- image proxying
- extension install/update/uninstall helpers
- structured, stack-free source failure responses

### Local API security boundary

The Express proxy binds to `127.0.0.1`, not every network interface. Electron generates a random API token for each app launch, passes it only to the backend process and trusted preload bridge, and the renderer supplies it in `X-AkaReader-Token`. Image elements use the same token as an `api_token` query parameter because they cannot attach custom headers. Electron allows roughly 30 seconds for the authenticated backend ping during cold startup because Windows security scanning can delay the utility process before it binds its loopback port. Backend entry files and production dependencies use separate Electron resource mappings; CI checks the unpacked package and then launches it on Windows and Linux, requiring the backend port to open before upload. Electron performs the same file check at runtime, backs off repeated utility-process restarts, and turns a persistent crash loop into a visible repair issue.

The backend rejects unapproved browser origins before route handling. Browser development remains supported from `http://localhost:5173` and `http://127.0.0.1:5173`; a standalone backend without `AKAREADER_API_TOKEN` remains available for local development but is still loopback-only and origin-restricted.

## Electron Main Process

`manga-nexus/electron-main.js` is effectively the runtime supervisor.

Responsibilities:

- single-instance lock
- window/tray lifecycle
- settings persistence for Electron-only preferences
- Java/JRE discovery, full-version validation, and managed Java 21.0.11 installation
- Suwayomi JAR discovery or download
- default/custom extension-store persistence and Suwayomi configuration
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
- an isolated source-verification `WebContentsView` embedded in the main window for sites that require a browser challenge
- lazy, automatic managed FlareSolverr installation and process lifecycle for sources that still require Suwayomi's helper API after human verification
- packaged app updater actions
- system diagnostics/repair and native backup import/export actions

Startup status delivery uses an explicit renderer-ready handshake. Electron queues status events while the window is loading; React first installs its listener and then signals readiness through preload IPC, at which point the queue is flushed. In managed desktop mode, the renderer does not begin health polling before the private backend exists. This prevents development and packaged launches from briefly presenting connection failures merely because the UI loaded faster than the local services. A restored cover request that still reaches the proxy early waits up to 30 seconds for connection-refused startup conditions while remaining cancellable.

Java discovery executes each candidate with `java -version` and accepts Java 21.0.11 or newer. An older system Java is left untouched. akaReader downloads and uses a private current Temurin 21 runtime under its data directory, validates the staged runtime before replacing an older managed copy, and exposes a renderer recovery action if automatic installation fails. Structured service issues keep the detected version, required version, explanation, and available repair action together so startup failures do not collapse into a generic offline message. The cached Suwayomi JAR is migrated into `suwayomi-runtime/`, with a dedicated `work/` child as the process working directory. This keeps the server executable and work path isolated from the managed Java and Suwayomi data paths, avoiding a reproducible Windows package-scan failure during GraphQL initialization. Suwayomi's first launch can also download browser components, so the readiness wait allows up to ten minutes while relaying the component-download percentage to the startup screen.

Extension discovery is initialized by Electron before Suwayomi starts. akaReader always writes the maintained Keiyoushi index to the current `server.extensionStores` setting, merges validated and deduplicated custom HTTP(S) stores from `electron-settings.json`, and removes the obsolete `server.extensionRepos` managed block if present. The writer replaces an entire multiline list, not just its opening line, and removes the orphaned quoted-entry/closing-bracket tail left by the earlier migration bug. Settings reads and writes this same main-process state through preload IPC; adding or removing a custom store restarts the managed services so the catalog is actually refreshed.

## App Update Flow

Packaged builds use `electron-updater` from the Electron main process. Before an update download and again immediately before an explicit restart/install, the renderer sends an allowlisted, versioned state snapshot to Electron. Electron size-checks it, writes it with a restricted file mode under `userData/backups`, and retains the latest five pre-update backups. Updates then download while the renderer stays interactive. Once downloaded, the banner tells the user the update will install when the app is closed; an explicit `Restart now` button remains available. Windows packaging uses a one-click NSIS installer so online update installs avoid a manual setup wizard.

## Diagnostics and Backup Flow

Settings can request a full health report through the preload bridge. Electron performs bounded checks of the authenticated local API, compatible Java runtime, Suwayomi GraphQL endpoint, managed server JAR, writable/free data storage, and optional protected-source helper. The report contains user-facing statuses and repair hints but never exposes the per-launch API token. `Repair automatically` verifies packaged backend files, installs Java only when incompatible, repairs the JAR/config only when required, starts the helper only when it was previously enabled, and restarts the managed services.

Manual backups use Electron save/open dialogs rather than renderer-created download links. The version 3 schema allowlists library, history, progress, categories, reading state/time, app settings, onboarding state, duplicate dismissals, and manga notes. Restore validates types and file size before writing local state, and still migrates the earlier version 2 export format. IndexedDB chapter image blobs are excluded because they can be hundreds of megabytes and are recoverable by downloading again.

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
- `localStorage` key `downloadQueueV1`
  Stores a bounded serializable queue manifest so interrupted downloads can be recovered after relaunch.

Network/service state:

- `backendOnline`
- `suwayomiReady`
- `sources`
- `extensions`
- `updates`
- `downloadQueue`

Library update scans fetch each manga's current chapter list with bounded concurrency. Availability is calculated from stable chapter IDs: a chapter is considered unread when neither akaReader's `readChapters` state nor Suwayomi's `isRead` flag marks that ID as read. Chapter numbers and labels are presentation data only, so decimals, specials, and non-linear numbering do not affect update counts.

Reading-stat totals use the unique chapter IDs stored in `readChapters` for each manga. They do not infer a total from the latest chapter label in `progress`.

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
3. `proxyImg()` rewrites local/Suwayomi URLs to `/api/img?url=...` and includes the per-launch API token in Electron.
4. Backend `/api/img` only allows the configured Suwayomi origin (including equivalent loopback aliases on the same port), rejects credentials and redirects to other origins, limits responses to 50 MB, and accepts only image or binary content types.
5. Browser/Electron webview handles normal HTTP caching.

This is used for:

- covers
- chapter pages while online

Source and extension icons are different: renderer code normalizes Suwayomi-relative icon paths to absolute `http://localhost:4567/...` URLs and loads them directly. That avoids routing hundreds of small extension-icon requests through the React dev proxy or backend image proxy.

The extension list is rendered by `ExtensionsTab.jsx`, which owns its search/filter/sort state, defers search input rendering work, incrementally reveals rows, and uses `content-visibility` for cheaper offscreen cards.

### Offline chapter caching

1. Download queue fetches chapter page URLs.
2. Each page is fetched in the renderer.
3. `saveChapterBlobs()` stores the raw `Blob` payloads in IndexedDB.
4. `loadChapterBlobs()` converts stored blobs into temporary object URLs when reopening a chapter.
5. `App.jsx` revokes old blob URLs when pages change or the reader flow unmounts.
6. Queue state is persisted after transitions. A job that was `downloading` at shutdown is restored as `pending`, waits for backend health, and resumes. Transient failures retry with bounded delay; source-verification, client, and low-storage failures remain visible for manual action.
7. `navigator.storage.estimate()` reserves headroom before a chapter starts, and the IndexedDB write remains one transaction so a failed save cannot publish a partial chapter.

Important note: offline cache storage is renderer-managed, not backend-managed.

## Source Verification Flow

Some source websites require a browser challenge before Suwayomi can fetch metadata or pages. akaReader treats this as a user-driven verification step rather than a silent bypass:

1. `backend/source-errors.js` recognizes Cloudflare/CAPTCHA/challenge failures and returns the stable `source-verification-required` code. Other source failures are reduced to a short first-line explanation; Java/Kotlin stack traces are not sent as UI copy.
2. `/api/sources` includes each source's `homeUrl`, allowing verification before any manga result has loaded.
3. The renderer shows a compact error state with `Retry` and, for challenge failures, a distinct `Verify manually` action on source browsing, manga details, or chapter failures. Automatic helper startup and manual browser verification use separate state, so starting the helper never disables or mislabels the manual choice. While recovery is running, Retry is disabled and labelled as automatic work rather than implying that another click is required.
4. On browse, manga-detail, and chapter challenges, the renderer automatically invokes recovery once for the affected item. A ref guard prevents repeated recovery attempts if the retry is still blocked; the manual button remains available throughout helper startup. When the helper becomes ready, the failed request is awaited and retried automatically. If the manual view is already open, Electron completes that view so its existing success path performs the retry instead of waiting for a button press.
5. Electron opens the source in a sandboxed, persistent-partition `WebContentsView` attached to the main `BrowserWindow`. The native view begins below akaReader's title bar and verification toolbar, keeping window controls plus fallback `Load now` and Cancel actions available while the source page is interactive.
6. The app waits for that same embedded view if verification is triggered again while it is active. Resize events keep the view fitted to the main window, and teardown explicitly closes its `webContents` to avoid leaks.
7. The embedded page periodically exposes only readiness signals: requested hostname, completed load, Cloudflare/Turnstile markers, password fields, and visible text length. Its isolated session also listens for a newly written same-source `cf_clearance` cookie. Electron never clicks or solves the page. It removes the view immediately after that clearance signal, once meaningful source content is ready, or once a same-host non-challenge page remains stable for three checks; after a challenge was actually observed, the first completed non-challenge page is enough. This prevents Aqua Manga's own ad/loader shell from becoming the user experience. The user can still use `Load now`, Cancel, or Escape as safe fallbacks.
8. If a previously installed helper exists, selecting a source starts it concurrently with the first source request. After protected-source support has been enabled, subsequent app launches also start the installed helper after backend readiness, in parallel with Java/Suwayomi startup, and pre-create FlareSolverr's named `suwayomi` browser session. This moves Chromium's cold-start cost into existing startup time without blocking the main readiness promise; installations that never enabled the helper still do no helper work. A later protected-source failure reuses the same in-flight promise and retries without launching duplicate helper processes. If no helper exists, normal browser verification proceeds first.
9. If the clean Suwayomi retry is still blocked, akaReader automatically downloads the pinned official FlareSolverr archive on demand. Windows x64 uses the official ZIP and Linux x64 uses the official tar.gz; each has its own exact release size and SHA-256. The archive is extracted under the app data directory, Linux executable permissions are restored, the helper binds to `127.0.0.1:8191`, Suwayomi settings are updated, Suwayomi restarts only when the config changed, and the renderer retries. The one-time setup is guarded per source/URL so it cannot start at normal launch or repeat in a failure loop.
10. The managed helper is launched at startup only after it was previously enabled for protected sources; that warm-up begins after backend and Suwayomi readiness and never blocks the main app. It remains alive for that app session, and Electron cleans up its process tree and recorded PID on quit or recovery from a forced exit. Media loading is disabled in its headless browser because akaReader only consumes returned HTML and cookies. Linux uses private XDG cache/config/data roots for each helper session without replacing the user's `HOME`. On Windows, Electron enumerates `chromedriver.exe` processes and stops only one whose executable path exactly matches FlareSolverr's known `%APPDATA%\\undetected_chromedriver` driver. Startup also stops waiting immediately if the helper process exits.
11. Verification errors raised while opening a chapter enter the same guarded recovery path as browse errors: reuse the installed helper first, otherwise request human verification once, then retry the native chapter request.

The Electron verification view never clicks or solves a CAPTCHA. Its sandboxed persistent partition is separate from the trusted renderer and from Suwayomi's extension cookie store. The managed helper uses Suwayomi's supported FlareSolverr API with `CAPTCHA_SOLVER=none`; an actual human CAPTCHA still requires user action and may remain unsupported by the source extension.

Chapter images continue to flow through the authenticated loopback image proxy. Reader image URLs carry a page-priority marker. When the first page request arrives, the backend cancels cover-image work left behind by the previous browse/detail view, and every proxy request is tied to the renderer response lifetime. This prevents slow, abandoned thumbnails from occupying Suwayomi while the reader waits for its first pages.

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

Source browse results also own their pagination state in `App.jsx`. The first page renders immediately, then a short-delay sequential loop fetches and appends later pages until the source returns `hasNextPage: false`. Each search owns an `AbortController` and monotonically increasing request ID, so a source/search/view change cannot commit a stale response. Background loading pauses while the document is hidden, keeps already-rendered results through transient later-page failures, and retries those failures with bounded backoff. Page merging uses source-and-manga identity to remove duplicates; a page that makes no unique progress terminates pagination even if a faulty source continues reporting another page. Pagination is intentionally not tied to viewport intersection, so users can scroll through already-prefetched results instead of waiting at the bottom.

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
- Hook dependency arrays are evaluated during render. A callback must be declared before another hook dependency array references it, otherwise production bundles can throw `Cannot access '<minified name>' before initialization`.
- `backend/server.js` mixes multiple concerns:
  - cache layer
  - GraphQL adapter
  - image proxy
  - extension management
  - archive download route

Those files should be the first places to document and test whenever behavior changes.
