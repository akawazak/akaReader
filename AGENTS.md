# AGENTS.md

## Project Overview

akaReader is a desktop manga reader built around three cooperating parts:

1. An Electron shell in `manga-nexus/electron-main.js` that starts and supervises local services.
2. A React renderer in `manga-nexus/src` that owns nearly all UI and client state.
3. A Node/Express proxy in `backend/server.js` that normalizes Suwayomi APIs, proxies images, and exposes a simpler REST surface to the renderer.

The app's goal is to give users a polished local manga-reading experience on top of Suwayomi, including:

- source/extension management
- manga browsing and chapter reading
- offline chapter storage in IndexedDB
- desktop lifecycle management for the embedded Suwayomi runtime
- app update handling in packaged Electron builds

## Main Architecture

- `manga-nexus/electron-main.js`
  Starts the backend utility process, verifies Java 21.0.11+ compatibility, installs a private managed JRE when needed, ensures the Suwayomi JAR exists, configures extension stores, and can install/start a checksum-pinned loopback FlareSolverr helper on demand for protected sources. It also starts or attaches to Suwayomi, reports preparation progress, manages tray/window/update behavior, and exposes IPC through `preload.js`.
- `backend/server.js`
  Talks to Suwayomi GraphQL/REST, adds retry/caching layers, and serves `/api/*` routes consumed by React.
- `backend/source-errors.js`
  Classifies source failures into short structured responses so Suwayomi/Java stack traces never become renderer content.
- `manga-nexus/src/App.jsx`
  Contains the main application state machine, the `DataProvider`, many UI components, IndexedDB download helpers, and high-level navigation.
- `manga-nexus/src/components/reader/Reader.jsx`
  Handles the active reading session, page persistence, chapter preloading, UI controls, and reading-mode behavior.

## Important Folders

- `backend/`
  Local proxy server and bundled Suwayomi JAR.
- `manga-nexus/`
  Electron + Vite + React desktop app.
- `manga-nexus/src/components/`
  Reusable UI and feature components. `reader/Reader.jsx` is the most complex runtime file after `App.jsx`; `extensions/ExtensionsTab.jsx` owns extension filtering/list rendering.
- `manga-nexus/scripts/`
  Lightweight local validation helpers, including the hook dependency-order check that catches TDZ-style React crashes.
- `manga-nexus/src/views/`
  Larger presentation-level views such as `HomeView.jsx`.
- `manga-nexus/src/constants/` and `manga-nexus/src/utils/`
  Smaller shared helpers, although some equivalent logic is still duplicated inside `App.jsx`.
- `.github/workflows/`
  CI/release packaging workflow for Electron artifacts.
- `docs/`
  Repository memory for architecture, workflow, file map, and risk tracking. Keep this current.

## Data Flow

1. Electron boots and calls `ensureManagedServices()`.
2. Electron starts the Node backend on loopback port `3001` with a random per-launch API token, allowing up to roughly 30 seconds for a cold launch, and starts or attaches to Suwayomi on port `4567`.
3. The preload bridge gives the trusted renderer that token. React registers its service-status listener, explicitly announces renderer readiness, and only then receives Electron's queued startup events. Managed desktop startup does not poll the backend before it exists; React checks `/api/health` when the backend-ready event arrives and after the shared startup promise completes.
4. The renderer fetches sources/extensions from the backend.
5. User browsing actions call backend REST routes such as:
   - `/api/sources`
   - `/api/extensions`
   - `/api/source/:sourceId/search`
   - `/api/source/:sourceId/manga/:mangaId`
   - `/api/source/:sourceId/chapter/:chapterId`
6. The backend translates those requests into Suwayomi GraphQL/REST calls and caches some responses in memory.
7. Reader progress, categories, history, settings, and library state are persisted in `localStorage`.
8. Offline chapter pages are persisted in IndexedDB and rehydrated as blob URLs when reopened. The serializable download queue is separately persisted in `localStorage`; an interrupted active job becomes pending after relaunch, resumes only after the backend is healthy, retries transient failures up to three times, and checks available browser storage before fetching a chapter.
9. Source routes classify Cloudflare/CAPTCHA/helper-connection failures as `source-verification-required`; the renderer shows a compact action state instead of raw Suwayomi stack output. Once the optional helper has been installed, selecting a source starts it in parallel with the first source request, rather than waiting for a failed request and a separate Retry. After protected-source support has been enabled once, later app launches warm the installed helper and its named `suwayomi` browser session in the background alongside Java/Suwayomi startup; users who never enabled it still pay no startup cost, and helper readiness never blocks the main service promise. When the helper becomes ready, the failed browse, manga-detail, or chapter request retries automatically, including when the manual verification view is already open. If verification is required, the error state keeps a distinct `Verify manually` action available even while the automatic helper is starting. Manual verification uses an isolated `WebContentsView` inside the main akaReader window, below an app-owned verification toolbar; Electron watches both page readiness and a same-source `cf_clearance` cookie, removes the embedded site as soon as the human check succeeds, and retries in akaReader. The toolbar retains `Load now` as a fallback plus Cancel. If no helper is installed and Suwayomi remains blocked after manual verification, the UI automatically performs the one-time, checksum-verified managed FlareSolverr setup and retry. Official v3.5.0 binaries are pinned independently for Windows x64 ZIP and Linux x64 tar.gz; Linux extraction restores executable permissions and uses private XDG session directories without changing `HOME`. The helper binds to loopback, exits with akaReader, disables external CAPTCHA solvers and unnecessary media loading, and stops only a stale Windows `chromedriver.exe` whose executable path exactly matches FlareSolverr's managed cache.
10. The backend accepts browser origins only from the packaged renderer or the fixed Vite development origin. Its image proxy accepts only the configured Suwayomi origin and does not follow redirects away from it. Persisted cover requests that arrive during service startup wait briefly for Suwayomi instead of immediately becoming broken images; reader-page requests still cancel abandoned cover work, and all proxy requests abort when their renderer client disconnects.
11. Electron always seeds the maintained Keiyoushi extension store through Suwayomi's `server.extensionStores` setting. Additional user stores are validated, persisted in Electron settings, and applied through the preload bridge with a managed service restart. The config writer replaces complete multiline assignments and repairs the dangling quoted-entry tail produced by the old line-only migration.
12. Source browse pagination is automatic. After page 1 renders, the renderer fetches one subsequent page at a time with a short delay, appends only unique manga, and continues until Suwayomi reports `hasNextPage: false`. Requests are cancelled when the source/search/view changes or the app becomes hidden, transient later-page failures use bounded retries without removing loaded results, and repeated pages stop the loop safely; scrolling is not the trigger.
13. Settings exposes a main-process system-health check for the local API, Java, Suwayomi, managed JAR, writable/free data storage, and the optional protected-source helper. Automatic repair only reinstalls or restarts components that diagnostics show are needed. Backup export/import uses native dialogs, a size-limited versioned schema, an allowlist of restorable state, and compatibility with the older v2 export. App updates create and rotate private safety backups before download and install; offline image blobs are intentionally not included.
14. Release packages copy backend entry files and backend `node_modules` through separate `extraResources` mappings. CI runs `check:packaged-runtime` against unpacked Windows and Linux apps so a release cannot silently ship without the packages needed to bind port 3001, then launches each unpacked app and requires port 3001 to open. Before the Linux Xvfb launch, CI restores Electron's required root ownership and `4755` mode on the unpacked `chrome-sandbox`; it never disables Chromium's sandbox to make the test pass. Electron repeats the same backend-runtime preflight before forking, retries unexpected crashes with bounded exponential backoff, and stops a crash loop with a repair-oriented service issue instead of restarting forever.

## Rules For Future AI Agents

- Understand first, edit second. Read the relevant docs in `docs/` before changing code.
- Do not treat this as a generic React app. Electron startup and Suwayomi orchestration are part of the core behavior.
- Prefer targeted edits. `manga-nexus/src/App.jsx` is large and easy to destabilize.
- Preserve current architecture unless explicitly asked to refactor it.
- When touching reader behavior, inspect both:
  - `manga-nexus/src/App.jsx`
  - `manga-nexus/src/components/reader/Reader.jsx`
- In React components, declare callbacks before any hook dependency array references them. Run `npm run check:hook-order` from `manga-nexus/` after moving reader/app callbacks.
- When touching service startup, inspect all of:
  - `manga-nexus/electron-main.js`
  - `manga-nexus/preload.js`
  - `backend/server.js`
- Keep offline behavior in mind. Some chapters are loaded from IndexedDB before network fetches.
- Assume local worktrees may be dirty. Never revert unrelated user changes.

## Scope Control

Do not scan unrelated/generated/vendor files unless the task explicitly requires it.

Skip by default:

- `**/node_modules/**`
- `manga-nexus/dist/**`
- `**/build/**`
- `.git/**`
- crash logs and startup logs unless debugging launch/runtime issues:
  - `manga-nexus/crash.log`
  - `manga-nexus/crash_utf8.log`
  - `manga-nexus/electron-startup*.log`
- large bundled binaries unless packaging/runtime setup is the task:
  - `backend/Suwayomi-Server-*.jar`
- one-off maintenance scripts unless the task is about them:
  - `manga-nexus/extract.js`
  - `manga-nexus/update_electron.js`

## Documentation Maintenance

Whenever a major change lands, update the docs in the same change set:

- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/FILE_MAP.md`
- `docs/KNOWN_BUGS.md`
- `docs/DEV_WORKFLOW.md`

Major change means any change to:

- startup/service orchestration
- backend routes or caching
- reader loading/persistence flow
- offline storage format
- navigation/state ownership
- packaging/build commands

If code and docs disagree, fix the docs immediately rather than leaving stale project memory behind.
