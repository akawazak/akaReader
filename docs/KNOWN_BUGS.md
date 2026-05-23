# KNOWN BUGS

Severity labels:

- `P0` critical crash/data loss/security risk
- `P1` high-risk incorrect behavior
- `P2` medium-risk instability or incorrect UX
- `P3` cleanup/refactor debt

## Audit Notes

Last deep scan: 2026-05-23.
Last stabilization pass: 2026-05-23.

Verification run:

- `node --check backend/server.js` passed after the backend fixes.
- `node --check manga-nexus/electron-main.js` passed after the Electron fixes.
- `node --check manga-nexus/preload.js` passed.
- `npm.cmd run build` passed after the reader/app fixes.
- `npm.cmd run check:hook-order` passed after the reader initialization-order fix.
- `npx.cmd eslint .` could not run locally because `eslint` is not installed in `manga-nexus/node_modules`; `npx` attempted a registry fetch.

## Recently Fixed

### Fixed 2026-05-23: Reader next-chapter initialization-order crash

- File: `manga-nexus/src/components/reader/Reader.jsx`
- Fix: moved `loadNextChapter` before `go`, because `go` includes `loadNextChapter` in its hook dependency array.
- Result: reader render no longer throws `Cannot access 'loadNextChapter' before initialization`.

### Fixed 2026-05-23: Hook dependency order guard added

- Files:
  - `manga-nexus/scripts/check-hook-order.mjs`
  - `manga-nexus/package.json`
- Fix: added `npm run check:hook-order` to detect same-component hook dependency arrays that reference later-declared `const` callbacks.
- Result: the specific class of TDZ/runtime crash that hit the reader is now checked locally.

### Fixed 2026-05-23: Source and extension icon paths normalized

- File: `manga-nexus/src/App.jsx`
- Fix: Suwayomi-relative source/extension icon URLs are converted to absolute Suwayomi URLs before rendering.
- Result: extension icons no longer accidentally request `/api/v1/extension/icon/...` from the React dev server/backend proxy path.

### Fixed 2026-05-23: Oversized loading spinner with named sizes

- Files:
  - `manga-nexus/src/App.jsx`
  - `manga-nexus/src/components/ui/Spin.jsx`
- Fix: `Spin` now maps named sizes like `lg` to numeric pixel sizes before passing them to Lucide.
- Result: loading icons no longer balloon when a component passes `size="lg"`.

### Improved 2026-05-23: Extensions tab extracted and optimized

- Files:
  - `manga-nexus/src/App.jsx`
  - `manga-nexus/src/components/extensions/ExtensionsTab.jsx`
- Change: extension search/filter/sort/display-count state moved out of `App.jsx`; extension rows now use deferred search input, incremental rendering, async image decoding, and `content-visibility`.
- Result: the largest list view is easier to reason about and should feel lighter with large extension catalogs.

### Improved 2026-05-23: Update flow stays interactive by default

- Files:
  - `manga-nexus/src/App.jsx`
  - `manga-nexus/package.json`
- Change: downloaded updates now present as "installs when you close the app" with an optional `Restart now` button, and the NSIS installer is one-click.
- Result: users can keep reading after an update downloads and should avoid a manual setup wizard during online update installs.

### Fixed 2026-05-23: Reader previous-chapter shortcut crash

- File: `manga-nexus/src/components/reader/Reader.jsx`
- Fix: added the missing `hasPrevRef` live ref used by the keyboard shortcut path.
- Result: `p` / `Ctrl+ArrowLeft` no longer reads an undefined symbol.

### Fixed 2026-05-23: Chapter archive download route

- File: `backend/server.js`
- Fix: `/api/source/:sourceId/chapter/:chapterId/download` now returns `501` only when `archiver` is actually unavailable.
- Result: the CBZ/ZIP route is reachable again in environments where `archiver` is present.

### Fixed 2026-05-23: Reader end-of-chapter completion and parent sync

- Files:
  - `manga-nexus/src/components/reader/Reader.jsx`
  - `manga-nexus/src/App.jsx`
- Fix:
  - `persistPage()` now uses `pInfo.total` instead of `chapter.total`
  - `Reader.jsx` now invokes `onPageChange(localIndex, pInfo)`
- Result: chapter completion and parent reader state both update correctly as page/chapter context changes.

### Fixed 2026-05-23: Auto-scroll control now scrolls

- File: `manga-nexus/src/components/reader/Reader.jsx`
- Fix: added an animation-frame auto-scroll loop for non-paged modes, with cleanup and next-chapter prefetch at the bottom edge.
- Result: the play/pause control now has real behavior instead of being a dead toggle.

### Fixed 2026-05-23: Reader render-time debug toast

- File: `manga-nexus/src/App.jsx`
- Fix: removed the `toast(...)` call from the reader render branch.
- Result: reader rerenders no longer emit repeated debug notifications.

### Fixed 2026-05-23: Source-aware history/library/cache checks

- Files:
  - `manga-nexus/src/App.jsx`
  - `backend/server.js`
- Fix:
  - history deduplication now matches on `id + sourceId`
  - major `inLibrary(...)` call sites now pass source identity
  - backend manga/page cache keys now include `sourceId`
- Result: same-ID manga from different sources are less likely to overwrite or misreport each other.

### Fixed 2026-05-23: Windows service handlers no longer no-op as success on non-Windows

- File: `manga-nexus/electron-main.js`
- Fix: `installWindowsService()` / `uninstallWindowsService()` now early-return off Windows, and IPC returns the real function result instead of always returning `true`.
- Result: non-Windows builds no longer claim successful service installation while attempting Windows-only command paths.

### Fixed 2026-05-23: Reader/download lifecycle cleanup and cancellation

- Files:
  - `manga-nexus/src/components/reader/Reader.jsx`
  - `manga-nexus/src/App.jsx`
- Fix:
  - reader next-chapter prefetch now uses `AbortController`
  - reader timeout refs are cleared on unmount
  - chapter-download fetches now use `AbortController`
  - download cancel actions now abort active network work
- Result: reader/download async work is less likely to outlive the active screen or keep downloading after cancellation.

### Fixed 2026-05-23: Offline chapter storage now stores blobs instead of base64 strings

- File: `manga-nexus/src/App.jsx`
- Fix: `saveChapterBlobs()` now stores raw `Blob` objects in IndexedDB, `loadChapterBlobs()` supports both old string payloads and new blobs, and blob URLs are revoked when no longer needed.
- Result: offline chapter persistence uses less storage and avoids the prior base64 conversion churn.

### Fixed 2026-05-23: Toast/provider and image-proxy cleanup

- Files:
  - `manga-nexus/src/App.jsx`
  - `backend/server.js`
  - `manga-nexus/src/components/extensions/ExtCard.jsx`
- Fix:
  - toast timers are tracked and cleared on provider unmount
  - `/api/img` no longer sets `Content-Type` twice
  - the orphaned `ExtCard.jsx` no longer imports a missing `ToastContext`
- Result: fewer teardown leaks and fewer stale/broken helper modules.

### Fixed 2026-05-23: Packaging claims narrowed to Windows-only

- File: `manga-nexus/package.json`
- Fix: the generic `dist` command and builder targets now align with the Windows-first managed-runtime behavior of the app.
- Result: the repo no longer advertises unsupported macOS/Linux packaging paths.

### Fixed 2026-05-23: Unsupported browse filters removed from the live UI

- Files:
  - `manga-nexus/src/App.jsx`
  - `backend/server.js`
- Fix: the browse filter bar now exposes only the supported browse mode (`latest` / `popular`) and the backend cache/request path follows that mode.
- Result: the app no longer presents status/content-type/tag filters that it does not truly enforce.

### Fixed 2026-05-23: Stale extracted component set removed

- Files:
  - deleted orphaned files under `manga-nexus/src/components/` that were no longer part of the active bundle
- Fix: removed the stale alternative component set that had drifted away from the real app state surface.
- Result: future work is less likely to accidentally re-import outdated implementations.

## Confirmed / Highly Likely Open Problems

## Risky Async / State Code

### `P1` Download queue still processes pages serially in the renderer

- Files:
  - `manga-nexus/src/App.jsx:839-882`
- Risk:
  - serial fetches are slow for large chapters
  - long-running downloads happen inside React lifecycle instead of a dedicated worker/process

### `P1` Update scan is sequential across the entire library

- File: `manga-nexus/src/App.jsx:884-907`
- Risk:
  - one-by-one network requests can make update checks slow on large libraries
  - scan compares `totalChapters` against last read `chapterNum`, which may be semantically wrong for non-linear numbering

### `P2` Online/offline service state comes from multiple channels

- Files:
  - `manga-nexus/src/App.jsx:579-588`
  - `manga-nexus/src/App.jsx:3886-3895`
  - `manga-nexus/electron-main.js`
- Risk: renderer state is derived from both polling `/api/health` and Electron status events, which can temporarily disagree.

## Memory Leak / Resource Risks

### `P1` Large single-file state container increases accidental retained closures and repeated work

- File: `manga-nexus/src/App.jsx`
- Risk: the giant `useMemo` provider value and many inline component/function definitions increase rerender surface area and make lifecycle leaks harder to spot.

### `P2` Reader adaptive color extraction creates image loads with no cancellation

- File: `manga-nexus/src/components/reader/Reader.jsx:270-272`
- Risk: usually harmless, but still async image work tied to changing chapters/covers.

## Duplicated Logic / Drift Risks

### `P2` Helpers/constants are duplicated between `App.jsx` and shared modules

- Files:
  - `manga-nexus/src/App.jsx`
  - `manga-nexus/src/utils/helpers.js`
  - `manga-nexus/src/constants/index.js`
- Duplicated examples:
  - `proxyImg`
  - `timeAgo`
  - `storage`
  - `debounce`
  - `calculateStreak`
  - config/theme/language/category constants
- Impact: easy for behavior to diverge silently.

### `P2` UI components exist both inside `App.jsx` and in separate component files

- Files:
  - `manga-nexus/src/App.jsx`
  - `manga-nexus/src/components/**`
- Impact: ownership boundaries are blurry, making refactors riskier and docs harder to keep accurate.

## Backend-Specific Risks

### `P2` Backend route includes `sourceId` for manga/pages but does not use it after parsing

- Files:
  - `backend/server.js:389-435`
  - `backend/server.js:438-449`
- Issue: the `sourceId` path segment is not used to fetch manga details or pages.
- Impact: if Suwayomi IDs are global, this is harmless. If IDs collide or stale cache data exists, source-specific routes can return wrong data.

## Tooling / Workflow Problems

### `P2` ESLint config exists but ESLint is not installed

- Files:
  - `manga-nexus/eslint.config.js`
  - `manga-nexus/package.json`
- Issue: running `npx.cmd eslint .` attempted to fetch `eslint` from the registry because there is no local `eslint` dependency.
- Impact: linting is not reproducible offline and likely not part of the normal local workflow.

### `P3` Build can fail under restricted environments because Vite/esbuild reads outside the sandbox

- Observed command: `npm.cmd run build`
- Issue: inside the workspace sandbox, esbuild reported `Cannot read directory "../../../..": Access is denied`; the same build passed when run outside the sandbox.
- Impact: not an app bug, but it affects local agent/CI-like validation in restricted environments.

## Existing TODO / FIXME / HACK Inventory

Search result as of this documentation pass:

- No active `TODO`, `FIXME`, `XXX`, or `HACK` markers were found in tracked source files outside ignored folders.

There are many comments labeled `FIX:` in the codebase, but those describe prior changes rather than open work items.

## Suggested Stabilization Order

1. Move chapter downloads out of the React lifecycle if download throughput or reliability becomes a bigger product concern.
2. Reduce duplicated helper/component logic between `App.jsx` and extracted modules.
3. Consolidate service-status ownership so polling and Electron events cannot temporarily disagree.
4. Split `App.jsx` into smaller state/feature boundaries to reduce future regression risk.
