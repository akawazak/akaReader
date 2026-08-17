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
|  |- KNOWN_BUGS.md
|  `- PUBLISHING.md
|- .github/
|  `- workflows/
|     `- build.yml
|- backend/
|  |- package.json
|  |- source-errors.js
|  |- server.js
|  `- test/
|     |- security-boundary.test.js
|     `- source-errors.test.js
`- manga-nexus/
   |- package.json
   |- vite.config.js
   |- eslint.config.js
   |- electron-main.js
   |- preload.js
   |- index.html
   |- scripts/
   |  `- check-hook-order.mjs
   |- test/
   |  |- chapterTracking.test.mjs
   |  `- sourceErrors.test.mjs
   |- public/
   |  |- icon.ico
   |  `- vite.svg
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
      |  |- helpers.js
      |  `- sourceErrors.mjs
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
  Public project overview, development commands, packaging notes, and monetization guidance.
- `docs/`
  Durable internal documentation for architecture, risks, workflows, and file ownership.
- `docs/PUBLISHING.md`
  Pre-tag release checklist and publishing notes.

### CI

- `.github/workflows/build.yml`
  Windows-focused Electron packaging and GitHub release publishing.

### Backend

- `backend/package.json`
  Backend runtime dependencies plus start and focused security-test commands.
- `backend/server.js`
  Entire backend service:
  - Suwayomi GraphQL adapter
  - caches
  - image proxy
  - extension routes
  - source search
  - manga/chapter routes
  - download/archive endpoint
  - loopback binding, renderer token authentication, origin enforcement, and restricted image targets
- `backend/source-errors.js`
  Converts Suwayomi source exceptions into stable, short API errors and detects user-driven browser-verification cases without exposing runtime stack traces.
- `backend/test/security-boundary.test.js`
  Starts temporary loopback backend/Suwayomi servers and proves unauthorized API access and image-proxy escapes are blocked while legitimate renderer and image traffic remains intact.
- `backend/test/source-errors.test.js`
  Regression coverage for Cloudflare classification, JSON error parsing, and stack-trace removal.

### Desktop Shell

- `manga-nexus/package.json`
  Frontend/dev/build scripts plus Electron Builder config.
  Windows uses one-click NSIS plus portable packaging; Linux release targets are AppImage and Debian packages.
- `manga-nexus/electron-main.js`
  Main-process orchestration:
  - app startup
  - backend boot, including a cold-start readiness window that tolerates delayed Windows security scanning
  - per-launch backend API-token generation
  - Suwayomi boot, long first-run readiness, and setup progress
  - Java 21.0.11 compatibility diagnosis and managed-runtime recovery
  - automatic on-demand, platform-pinned Windows/Linux x64 FlareSolverr download, size/SHA-256 verification, lazy loopback startup, PID cleanup, Suwayomi configuration/restart, and embedded-verification clearance-cookie detection
  - built-in/custom extension-store validation, persistence, and configuration
  - updater
  - native backup dialogs, automatic pre-update backup rotation, system diagnostics, and conditional repair
  - tray/window lifecycle
  - Windows service installation
  - automatic/manual source-verification `WebContentsView`, in-window layout and teardown, challenge-to-source readiness detection, explicit Done/Cancel actions, and isolated persistent browser session
- `manga-nexus/preload.js`
  Safe IPC bridge exposed to the renderer via `window.electronAPI`.
  Supplies the trusted renderer with the per-launch local API token.
  Includes `verifySourceUrl`, embedded-verification state/events, completion/cancellation controls, plus `ensureCloudflareHelper` / `setupCloudflareHelper` for lazy reuse or automatic managed setup after verification still leaves a source blocked.

- `manga-nexus/runtime/source-verification.cjs`
  Pure source-page readiness classification plus embedded-view bounds, used to distinguish Cloudflare/Turnstile and login states from meaningful content or a stable same-host post-challenge loader before the in-app verification surface is removed.

- `manga-nexus/test/sourceVerification.test.mjs`
  Regression coverage for automatic return-to-app readiness, post-challenge source loaders, visible challenges, login forms, unrelated redirects, and in-window verification bounds.
- `manga-nexus/runtime/java-runtime.cjs`
  Pure Java-version parsing/comparison and Suwayomi startup-failure classification shared by Electron and regression tests.
- `manga-nexus/runtime/extension-stores.cjs`
  Pure extension-store URL validation, deduplication, default-store merging, canonical `server.conf` updates, and repair of malformed multiline migration tails.
- `manga-nexus/test/javaRuntime.test.mjs`
  Regression coverage for legacy/current Java versions, minimum-version enforcement, repairable startup diagnosis, and canonical loopback Cloudflare-helper configuration.
- `manga-nexus/test/extensionStores.test.mjs`
  Regression coverage for the built-in Keiyoushi store, custom-store normalization, migration from `extensionRepos` to `extensionStores`, and malformed multiline-tail repair.
- `manga-nexus/vite.config.js`
  Vite config and `/api` proxy to the local backend in development.
- `manga-nexus/eslint.config.js`
  Current lint rules. The practical release gate is `npm run lint -- --quiet`.
- `manga-nexus/index.html`
  Renderer HTML entry.
- `manga-nexus/scripts/check-hook-order.mjs`
  Local guard for React hook dependency arrays that reference same-component `const` callbacks before declaration.
- `manga-nexus/scripts/check-packaged-runtime.mjs`
  Verifies the unpacked Electron release contains the backend entry points and required production packages before CI uploads it.
- `manga-nexus/scripts/smoke-packaged-runtime.mjs`
  Launches an unpacked release, requires its loopback backend port to open, and terminates the test process tree; CI runs it on Windows and under Xvfb on Linux.

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
  - browse, concurrent installed-helper warm-up, automatic protected-request retries, independently available manual source verification, on-demand helper repair, manga detail, settings, download, and startup flows
  - sequential automatic source-result pagination with stale-request cancellation, hidden-window pause, bounded retries, and no-progress protection
- `manga-nexus/src/contexts/DataContext.jsx`
  Context definition and `useData()` hook.
- `manga-nexus/src/constants/index.js`
  Shared renderer constants used by helper/components such as `CONFIG`, `CATEGORIES`, and `THEMES`.
- `manga-nexus/src/utils/helpers.js`
  Shared helper utilities, still partially duplicated in `App.jsx`.
- `manga-nexus/src/utils/chapterTracking.mjs`
  Pure chapter-ID helpers used for accurate reading totals and unread-update detection.
- `manga-nexus/src/utils/browsePagination.mjs`
  Pure source-result merge, duplicate detection, retry classification, and bounded-delay helpers.
- `manga-nexus/runtime/cloudflare-helper.cjs`
  Describes the managed FlareSolverr launch environment and reusable Suwayomi browser session, pins official Windows x64 and Linux x64 assets, gives Linux a private XDG session, disables unnecessary headless-browser media, and provides the exact shared driver path used for narrowly scoped stale-process cleanup on Windows.
- `manga-nexus/runtime/backend-runtime.cjs`
  Shared required-file manifest used by Electron's local-service preflight and the post-package CI gate.
- `manga-nexus/src/utils/sourceErrors.mjs`
  Renderer-side normalization for structured or legacy source failures, producing compact verification/error states.
- `manga-nexus/src/utils/downloadQueue.mjs`
  Pure persisted-queue normalization, interrupted-job recovery, storage headroom checks, and byte formatting.
- `manga-nexus/src/utils/appBackup.mjs`
  Versioned allowlist, validation, legacy-v2 migration, and restore helpers for app-state backups.
- `manga-nexus/test/downloadQueue.test.mjs`
  Regression coverage for interrupted-job recovery, cancelled-job pruning, and storage reserve decisions.
- `manga-nexus/test/appBackup.test.mjs`
  Regression coverage for safe backup round trips, manga notes, legacy exports, and malformed input.
- `manga-nexus/test/browsePagination.test.mjs`
  Regression coverage for unique page merging, repeated-page termination signals, cross-source IDs, retry classification, and bounded backoff.
- `manga-nexus/test/cloudflareHelper.test.mjs`
  Regression coverage for platform asset pins, isolated helper state, Linux XDG handling, and reusable-session detection.
- `manga-nexus/test/backendRuntime.test.mjs`
  Regression coverage for complete and incomplete packaged backend detection.
- `manga-nexus/test/chapterTracking.test.mjs`
  Regression tests for duplicate IDs, malformed state, decimal/special labels, provider read flags, and replaced chapter IDs.
- `manga-nexus/test/sourceErrors.test.mjs`
  Regression coverage proving raw Suwayomi stack traces never become user-facing source error copy.

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
