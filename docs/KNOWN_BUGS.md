# KNOWN BUGS

Severity labels:

- `P0` critical crash/data loss/security risk
- `P1` high-risk incorrect behavior
- `P2` medium-risk instability or incorrect UX
- `P3` cleanup/refactor debt

## Audit Notes

Last deep scan: 2026-05-23.
Last stabilization pass: 2026-05-30.

Verification run:

- `node --check backend/server.js` passed after the backend fixes.
- `node --check manga-nexus/electron-main.js` passed after the Electron fixes.
- `node --check manga-nexus/preload.js` passed.
- `npm.cmd run build` passed after the reader/app fixes.
- `npm.cmd run check:hook-order` passed after the reader initialization-order fix.
- `npm.cmd run lint -- --quiet` passed after local ESLint dependencies and config scope were added.
- `npm.cmd run validate` passed after release validation scripting was added.
- `npm.cmd run dist -- --publish=never` produced Windows NSIS and portable artifacts.
- `npm.cmd audit --omit=dev --audit-level=high` passed for both `manga-nexus/` and `backend/`.

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

### Improved 2026-05-30: Concurrent offline chapter downloads

- File: `manga-nexus/src/App.jsx`
- Change: offline page fetching now uses bounded concurrency instead of serial page requests.
- Result: large chapter downloads should finish faster while still avoiding unbounded network work.

### Improved 2026-05-30: Concurrent library update scans

- File: `manga-nexus/src/App.jsx`
- Change: update checks now scan the library with a small concurrency limit.
- Result: large libraries no longer wait on one manga request at a time.

### Fixed 2026-05-30: Download cancellation references live abort controller

- File: `manga-nexus/src/App.jsx`
- Fix: download cancellation now goes through DataProvider actions instead of referencing an out-of-scope abort ref from the App component.
- Result: cancel actions no longer risk runtime `dlAbortRef is not defined` crashes.

### Improved 2026-05-30: Source verification popup

- Files:
  - `manga-nexus/electron-main.js`
  - `manga-nexus/preload.js`
  - `manga-nexus/src/App.jsx`
  - `backend/server.js`
- Change: source search results now carry source URLs, Cloudflare/challenge-style failures show a `Verify Source` action, and Electron opens a dedicated verification window before retrying.
- Result: users can complete source verification inside the app instead of being sent to an unrelated browser session.

### Fixed 2026-05-30: Reproducible local lint gate

- Files:
  - `manga-nexus/package.json`
  - `manga-nexus/package-lock.json`
  - `manga-nexus/eslint.config.js`
- Fix: installed the ESLint packages the config already referenced and added `npm run lint`.
- Result: `npm run lint -- --quiet` can run locally without `npx` fetching missing packages.

### Improved 2026-05-30: Publishing workflow and checklist

- Files:
  - `.github/workflows/build.yml`
  - `docs/PUBLISHING.md`
  - `README.md`
  - `PRIVACY.md`
- Change: CI now installs with `npm ci`, validates the renderer before packaging, fails tag releases if the tag version and package version disagree, and documents the manual release checklist.
- Result: public release builds are less likely to ship with stale dependencies, skipped validation, or unclear user-facing expectations.

### Fixed 2026-05-30: Backend production dependency audit

- File: `backend/package-lock.json`
- Fix: refreshed the backend lockfile with `npm audit fix`.
- Result: backend production audit reports zero high-severity vulnerabilities.

### Fixed 2026-05-23: Stale extracted component set removed

- Files:
  - deleted orphaned files under `manga-nexus/src/components/` that were no longer part of the active bundle
- Fix: removed the stale alternative component set that had drifted away from the real app state surface.
- Result: future work is less likely to accidentally re-import outdated implementations.

## Confirmed / Highly Likely Open Problems

## Risky Async / State Code

### `P2` Download queue still runs inside renderer lifecycle

- Files:
  - `manga-nexus/src/App.jsx`
- Risk:
  - bounded concurrent downloads are faster now, but long-running download work still lives inside React rather than a dedicated worker/process

### `P2` Update scan still uses chapter count heuristics

- File: `manga-nexus/src/App.jsx`
- Risk:
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
