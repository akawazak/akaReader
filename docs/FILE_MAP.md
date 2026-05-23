# FILE MAP

This map intentionally excludes `node_modules`, `dist`, `build`, `.git`, cache folders, and bundled/generated artifacts that are not useful for day-to-day reasoning.

```text
akareader/
|- AGENTS.md
|- README.md
|- docs/
|  |- ARCHITECTURE.md
|  |- DEV_WORKFLOW.md
|  |- FILE_MAP.md
|  `- KNOWN_BUGS.md
|- .github/
|  `- workflows/
|     `- build-release.yml
|- backend/
|  |- package.json
|  `- server.js
`- manga-nexus/
   |- package.json
   |- vite.config.js
   |- eslint.config.js
   |- electron-main.js
   |- preload.js
   |- index.html
   |- scripts/
   |  `- check-hook-order.mjs
   |- public/
   |  |- icon.ico
   |  |- icon.icns
   |  `- icon.png
   `- src/
      |- main.jsx
      |- App.jsx
      |- App.css
      |- index.css
      |- constants/
      |  `- index.js
      |- contexts/
      |  `- DataContext.jsx
      |- utils/
      |  `- helpers.js
      |- views/
      |  `- HomeView.jsx
      `- components/
         |- extensions/
         |  `- ExtensionsTab.jsx
         |- manga/
         |  `- MangaCard.jsx
         |- reader/
         |  `- Reader.jsx
         `- ui/
            |- Badge.jsx
            |- Btn.jsx
            |- EmptyState.jsx
            `- Spin.jsx
```

## Purpose By Area

### Root

- `AGENTS.md`
  AI-specific project memory and repo-handling instructions.
- `README.md`
  Currently minimal and not a reliable source of project truth.
- `docs/`
  Durable internal documentation for architecture, risks, workflows, and file ownership.

### CI

- `.github/workflows/build-release.yml`
  Windows-focused Electron packaging and GitHub release publishing.

### Backend

- `backend/package.json`
  Backend runtime dependencies and start command.
- `backend/server.js`
  Entire backend service:
  - Suwayomi GraphQL adapter
  - caches
  - image proxy
  - extension routes
  - source search
  - manga/chapter routes
  - download/archive endpoint

### Desktop Shell

- `manga-nexus/package.json`
  Frontend/dev/build scripts plus Electron Builder config.
  Packaging is intentionally Windows-only at this point and uses one-click NSIS for smoother updates.
- `manga-nexus/electron-main.js`
  Main-process orchestration:
  - app startup
  - backend boot
  - Suwayomi boot
  - updater
  - tray/window lifecycle
  - Windows service installation
- `manga-nexus/preload.js`
  Safe IPC bridge exposed to the renderer via `window.electronAPI`.
- `manga-nexus/vite.config.js`
  Vite config and `/api` proxy to the local backend in development.
- `manga-nexus/eslint.config.js`
  Current lint rules.
- `manga-nexus/index.html`
  Renderer HTML entry.
- `manga-nexus/scripts/check-hook-order.mjs`
  Local guard for React hook dependency arrays that reference same-component `const` callbacks before declaration.

### Renderer Core

- `manga-nexus/src/main.jsx`
  React bootstrap.
- `manga-nexus/src/App.jsx`
  Main application file. It currently contains:
  - `DataProvider`
  - local storage persistence
  - IndexedDB download storage
  - navigation state machine
  - many UI sections and helper components
  - browse, manga detail, settings, download, and startup flows
- `manga-nexus/src/contexts/DataContext.jsx`
  Context definition and `useData()` hook.
- `manga-nexus/src/constants/index.js`
  Shared renderer constants used by helper/components such as `CONFIG`, `CATEGORIES`, and `THEMES`.
- `manga-nexus/src/utils/helpers.js`
  Shared helper utilities, still partially duplicated in `App.jsx`.

### Renderer Features

- `manga-nexus/src/components/reader/Reader.jsx`
  Reader session runtime:
  - paged/scroll/webtoon modes
  - progress persistence
  - next-chapter loading
  - keyboard/touch interaction
- `manga-nexus/src/components/extensions/ExtensionsTab.jsx`
  Extension management UI:
  - search/filter/sort controls
  - incremental extension list rendering
  - install/update/remove row actions
- `manga-nexus/src/components/manga/MangaCard.jsx`
  Shared card/list-card presentation used by library, browse, and history surfaces.
- `manga-nexus/src/views/HomeView.jsx`
  Home/dashboard experience.
- `manga-nexus/src/components/ui/*`
  Reusable UI primitives.

## Files To Treat Carefully

- `backend/server.js`
  Single-file backend with multiple responsibilities.
- `manga-nexus/electron-main.js`
  Process lifecycle and startup behavior.
- `manga-nexus/src/App.jsx`
  Largest concentration of renderer state and logic.
- `manga-nexus/src/components/reader/Reader.jsx`
  Async reader/session behavior with observer and timer interactions.

## Non-Core / Maintenance Files

- `manga-nexus/update_electron.js`
  One-off patching script, not part of runtime.
- `manga-nexus/extract.js`
  One-off extraction/refactor helper, not part of runtime.
- `manga-nexus/consts.txt`
  Appears to be a scratch/reference artifact, not runtime code.
- `manga-nexus/crash*.log`, `electron-startup*.log`
  Debug artifacts, only useful when investigating startup/runtime failures.
