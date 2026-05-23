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
  Starts the backend utility process, ensures Java/JRE and the Suwayomi JAR exist, starts or attaches to Suwayomi, manages tray/window/update behavior, and exposes IPC through `preload.js`.
- `backend/server.js`
  Talks to Suwayomi GraphQL/REST, adds retry/caching layers, and serves `/api/*` routes consumed by React.
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
  Reusable UI and reader components. `reader/Reader.jsx` is the most complex runtime file after `App.jsx`.
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
2. Electron starts the Node backend on port `3001` and starts or attaches to Suwayomi on port `4567`.
3. React starts, checks `/api/health`, and listens for service status events through `window.electronAPI`.
4. The renderer fetches sources/extensions from the backend.
5. User browsing actions call backend REST routes such as:
   - `/api/sources`
   - `/api/extensions`
   - `/api/source/:sourceId/search`
   - `/api/source/:sourceId/manga/:mangaId`
   - `/api/source/:sourceId/chapter/:chapterId`
6. The backend translates those requests into Suwayomi GraphQL/REST calls and caches some responses in memory.
7. Reader progress, categories, history, settings, and library state are persisted in `localStorage`.
8. Offline chapter pages are persisted in IndexedDB and rehydrated as blob URLs when reopened.

## Rules For Future AI Agents

- Understand first, edit second. Read the relevant docs in `docs/` before changing code.
- Do not treat this as a generic React app. Electron startup and Suwayomi orchestration are part of the core behavior.
- Prefer targeted edits. `manga-nexus/src/App.jsx` is large and easy to destabilize.
- Preserve current architecture unless explicitly asked to refactor it.
- When touching reader behavior, inspect both:
  - `manga-nexus/src/App.jsx`
  - `manga-nexus/src/components/reader/Reader.jsx`
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
