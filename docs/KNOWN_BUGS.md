# KNOWN BUGS

Severity labels:

- `P0` critical crash/data loss/security risk
- `P1` high-risk incorrect behavior
- `P2` medium-risk instability or incorrect UX
- `P3` cleanup/refactor debt

## Audit Notes

Last deep scan: 2026-05-23.
Last stabilization pass: 2026-08-15.

Verification run:

- `node --check backend/server.js` passed after the backend fixes.
- `node --check manga-nexus/electron-main.js` passed after the Electron fixes and the cross-platform JRE/Java discovery pass.
- `node --check manga-nexus/preload.js` passed.
- `npm.cmd run build` passed after the reader/app fixes.
- `npm.cmd run check:hook-order` passed after the reader initialization-order fix.
- `npm.cmd run lint -- --quiet` passed after local ESLint dependencies and config scope were added.
- `npm.cmd run validate` passed after release validation scripting was added.
- `npm.cmd run dist -- --publish=never` produced Windows NSIS and portable artifacts.
- `npm.cmd audit --omit=dev --audit-level=high` passed for both `manga-nexus/` and `backend/`.
- `npm.cmd test` passed all backend local-API and image-proxy security regression cases.
- Full `npm.cmd audit` passed for both packages after the Electron, Vite, builder, updater, Axios, Express, and transitive dependency updates.

## Recently Fixed

### Fixed 2026-08-17: Interrupted downloads disappeared or failed permanently

- **Symptom:** Closing akaReader during a chapter download lost the queue, and brief network failures immediately required manual retry.
- **Cause:** Download jobs existed only in React memory and had no recovery metadata, retry budget, or storage headroom check.
- **Fix:** A bounded versioned queue manifest now persists locally. Interrupted active work recovers as pending after relaunch, waits for backend health, retries transient failures up to three times, avoids already-downloaded duplicates, checks storage headroom, and keeps the final IndexedDB chapter commit atomic.
- **Release:** `2.0.52`.

### Fixed 2026-08-17: Backup/restore omitted user state and updates had no safety snapshot

- **Symptom:** Export omitted categories, settings, reading time, and notes; import accepted loose JSON; an app update had no automatic state backup.
- **Cause:** Backup was implemented as a renderer download link with an incomplete ad-hoc object.
- **Fix:** Native Electron dialogs now read/write a size-limited version 3 allowlisted schema, validate value types, restore legacy v2 exports, and explain that IndexedDB images stay local. Update download/install creates private automatic backups and retains the latest five.
- **Release:** `2.0.52`.

### Improved 2026-08-17: Settings can diagnose and repair the local runtime

- **Change:** `System health` checks the local API, Java, Suwayomi, JAR, data-folder writability/free space, and optional protected-source helper, then shows component-level results.
- **Repair behavior:** One action installs or repairs only required managed components and restarts services; incomplete packaged backend files are reported as a reinstall requirement instead of entering another restart loop.
- **Release:** `2.0.52`.

### Fixed 2026-08-17: Corrupt local service could restart forever without a diagnosis

- **Symptom:** Missing or damaged backend files could make the utility process exit repeatedly while the app stayed disconnected.
- **Cause:** Release packaging was checked only indirectly, and the runtime supervisor restarted every exit at a fixed interval with no crash-loop limit.
- **Fix:** A shared backend-file manifest now powers both the post-package CI gate and Electron's preflight. Unexpected exits use bounded exponential backoff and become a visible reinstall/repair issue after five attempts.
- **Release:** `2.0.51`.

### Fixed 2026-08-17: Protected-source browser paid its cold-start cost on the first source click

- **Symptom:** Opening Aqua Manga after launching akaReader still waited while FlareSolverr and Chromium started, even though the helper had already been installed and enabled.
- **Cause:** akaReader overlapped the helper server startup with the source request, but did not start FlareSolverr's reusable named browser session until Suwayomi encountered the challenge.
- **Fix:** Previous protected-source users now warm the installed helper after backend readiness, alongside Java/Suwayomi startup, and pre-create the same `suwayomi` session configured in Suwayomi. The warm-up does not block main readiness. New users and installations that never enabled protected-source support still do no helper work at startup.
- **Release:** `2.0.51`.

### Fixed 2026-08-17: Packaged app opened with its local service permanently offline

- **Symptom:** A development run worked, but an installed or portable release opened disconnected and kept retrying port 3001.
- **Cause:** Electron Builder copied the backend entry files but omitted `backend/node_modules`. The utility process exited immediately on its first `require('express')`.
- **Fix:** Backend dependencies now use their own `extraResources` mapping, and both Windows and Linux release jobs validate the unpacked runtime and launch it to prove port 3001 opens before artifacts are uploaded.
- **Release:** `2.0.51`.

### Fixed 2026-08-17: Release startup race and Windows-only protected-source helper

- Files: `manga-nexus/electron-main.js`, `manga-nexus/preload.js`, `manga-nexus/src/App.jsx`, `backend/server.js`, `manga-nexus/runtime/cloudflare-helper.cjs`, `.github/workflows/build.yml`
- Symptom: a fast renderer could poll the private backend before it bound its port, restored covers could fail while Suwayomi was still launching, and Linux builds could not install the managed FlareSolverr helper at all.
- Cause: startup events were flushed at document load before React registered its listener, managed desktop health polling started immediately, image retries allowed only about one second, and helper metadata was hard-coded to the Windows ZIP.
- Fix: React now explicitly announces readiness before Electron flushes queued service events; desktop health checks begin at backend readiness or shared startup completion; connection-refused cover requests remain cancellable while waiting up to 30 seconds; official FlareSolverr v3.5.0 Windows x64 and Linux x64 assets are independently size/SHA-256 pinned, with executable and private-XDG handling on Linux. Release CI now runs backend tests on both platforms.
- Release: the patch version is `2.0.51`; Windows installer/portable packaging and the Linux AppImage/deb workflow use the same startup code.

### Fixed 2026-08-16: Protected-source recovery still waited for Retry

- Files: `manga-nexus/src/App.jsx`, `manga-nexus/electron-main.js`, `manga-nexus/runtime/source-verification.cjs`
- Symptom: FlareSolverr could finish starting while manual verification was open, but akaReader deliberately skipped the automatic retry; manual verification could also remain open after Cloudflare had already accepted the human check.
- Cause: the helper and manual branches were treated as mutually exclusive at completion, and manual completion relied mainly on page content that ad/loader shells can obscure.
- Fix: helper readiness now completes an open manual flow or directly awaits the failed request retry, manga-detail errors join the same guarded automatic recovery used by browse and chapters, and Electron detects a newly written same-source `cf_clearance` cookie. `Load now` remains only as a fallback.
- Result: the normal recovery path no longer requires Retry or Done clicks; CAPTCHA interaction itself remains user-controlled.

### Fixed 2026-08-16: Helper cold start blocked the manual verification choice

- Files: `manga-nexus/src/App.jsx`, `manga-nexus/runtime/cloudflare-helper.cjs`
- Symptom: after a protected request failed, the user waited for FlareSolverr to launch before the same button—incorrectly labelled as an active manual verification—became usable again.
- Cause: automatic helper startup and the embedded manual browser shared one loading state, and the installed helper was not launched until after the source failure.
- Fix: selecting a source now warms an already-installed helper concurrently with the first request, deduplicates later recovery against that same promise, and disables unnecessary media in FlareSolverr. Automatic startup and manual verification have separate states, so `Verify manually` stays available with accurate wording.
- Scope: the helper is still never launched at ordinary app startup, and this warm-up never installs or downloads anything.

### Fixed 2026-08-16: Verification helper repeatedly reopened the awkward website flow

- Files: `manga-nexus/electron-main.js`, `manga-nexus/runtime/cloudflare-helper.cjs`, `manga-nexus/src/App.jsx`
- Symptom: after a previous helper crash, protected sources could open the embedded website again while FlareSolverr eventually failed with `Permission denied ... undetected_chromedriver\\chromedriver.exe`.
- Cause: the bundled helper reused the user's global undetected-chromedriver cache. A child left behind by an earlier crash could keep that shared executable locked, and startup waited for the full timeout even after the helper exited.
- Fix: before helper startup, akaReader enumerates `chromedriver.exe` processes and stops only the process whose executable path exactly matches FlareSolverr's known shared driver cache. Normal Chrome and unrelated WebDriver sessions are left untouched. The readiness wait also stops as soon as the helper exits, and chapter verification failures now use the same guarded automatic recovery path as browsing.
- Result: an installed helper is reused without showing the source website when it starts successfully; a helper startup failure is reported directly instead of silently falling into another automatic website loop.

### Fixed 2026-08-16: Chapter pages waited behind abandoned manga covers

- Files: `backend/server.js`, `manga-nexus/src/utils/helpers.js`, `manga-nexus/src/components/reader/Reader.jsx`
- Symptom: the chapter endpoint returned its page list quickly, but the reader stayed blank or loading while image-proxy requests from the previous large catalog continued for 20 seconds or more.
- Cause: unmounting the catalog cancelled browser image elements but the backend kept every upstream cover request alive. Those abandoned requests continued occupying Suwayomi while reader pages arrived.
- Fix: image proxy work now follows the renderer response lifetime. Reader URLs are marked as pages, and the first page request cancels outstanding cover work before fetching reader content.
- Regression proof: the backend test holds a synthetic cover request open, starts a page request, verifies the page succeeds immediately, and confirms the abandoned upstream cover connection is cancelled.

### Fixed 2026-08-16: Tall chapter images looked like unloaded slivers

- File: `manga-nexus/src/components/reader/Reader.jsx`
- Symptom: continuous-scroll chapters could return every page successfully but show very tall source images as a narrow strip in the middle of the reader.
- Cause: the global fit-to-height preference was also applied to unusually tall stitched images, reducing their width dramatically to keep the entire image inside one viewport.
- Fix: scroll and strip layouts detect images at least three times taller than they are wide and render those pages at a readable width while preserving the selected fit behavior for ordinary manga pages.

### Fixed 2026-08-16: Source results waited for bottom-of-page scrolling

- Files: `manga-nexus/src/App.jsx`, `manga-nexus/src/utils/browsePagination.mjs`
- Symptom: later manga result pages only started loading after the user scrolled close to the bottom, leaving a visible wait during continued browsing.
- Fix: source browsing now fetches later pages sequentially after the first page succeeds, with a short delay between requests, and stops when the source reports no next page. The production path also cancels stale searches, pauses while the app is hidden, deduplicates source/manga IDs, stops on repeated no-progress pages, and applies bounded backoff to transient later-page failures without clearing loaded cards.
- Result: scrolling reveals results that are already being prefetched instead of controlling whether pagination runs, while bad pagination metadata or a temporary network failure cannot create an endless loop or destroy the usable result set.

### Fixed 2026-08-16: Cold backend launch was marked offline too early

- File: `manga-nexus/electron-main.js`
- Symptom: after a desktop restart, Windows could delay the backend utility process long enough for akaReader to show `offline`, even though the backend became reachable a few seconds later.
- Fix: the authenticated loopback readiness window now allows roughly 30 seconds instead of roughly 10 seconds before startup is declared unavailable.
- Result: a cold security scan no longer strands the app offline before Suwayomi startup begins.

### Fixed 2026-08-16: Source browse rendered a raw Suwayomi stack trace

- Files:
  - `backend/server.js`
  - `backend/source-errors.js`
  - `manga-nexus/src/App.jsx`
  - `manga-nexus/src/utils/sourceErrors.mjs`
- Symptom: a Cloudflare-protected source could render the complete escaped Java/Kotlin stack trace as a giant page title.
- Fix: source routes now return short structured failures, source metadata includes `homeUrl`, and browse/manga/chapter screens normalize both new and legacy errors into a compact state. Browse challenges open verification directly once per source/URL inside the main app; completion retries immediately, and a still-blocked retry automatically installs the managed helper instead of looping or asking for a second confirmation.
- Regression proof: backend and renderer tests cover the exact `Cloudflare bypass currently disabled` failure and assert that interceptor/class-name stack details are absent from user-facing output.

### Fixed 2026-08-16: Browser verification could not unblock Suwayomi's separate request client

- Symptom: the source website loaded normally in Electron, but closing it still left Aqua Manga at zero results because Suwayomi reported `Cloudflare bypass currently disabled`.
- Cause: Electron's persistent verification session and Suwayomi's extension HTTP client do not share cookies. Suwayomi requires a compatible local FlareSolverr API for this source.
- Fix: reuse an already-running FlareSolverr/Byparr service when present; otherwise automatically perform an on-demand managed FlareSolverr setup after manual verification fails. The Windows archive is pinned to v3.5.0, exact-size and SHA-256 verified, bound to loopback, configured with external CAPTCHA solvers disabled, started only after a protected source needs it, and terminated with akaReader. Suwayomi configuration is updated and restarted only when required.
- Regression proof: unit tests cover canonical helper config and both disabled-helper and stopped-helper failure signatures. The live desktop pass confirmed verification triggering and the helper-repair state. The final download/start/source-result pass requires allowing the one-time 326 MB download to finish.

### Fixed 2026-08-16: Source verification opened as a detached popup

- Symptom: verification was visually separated from akaReader, and after the source website replaced its browser check with normal content the user could remain in the secondary window instead of seeing app results.
- Fix: verification now uses a sandboxed `WebContentsView` attached to the main akaReader window. A fixed app-owned toolbar remains visible with Done and Cancel actions, the source page stays fitted below it during resize, and successful readiness removes the view before retrying results in the underlying app. A same-host page stuck on Aqua Manga's post-verification loader also returns after three stable checks, or immediately after a challenge was observed. If Suwayomi remains blocked, the app automatically sets up the helper once instead of keeping the ad-filled website visible or showing another prompt. No CAPTCHA or page control is clicked automatically.
- Regression proof: focused tests accept a complete Aqua Manga content page and its post-challenge loader; reject visible Cloudflare challenges, password/login pages, incomplete loads, and unrelated redirects; and verify the embedded view remains below app controls. Electron explicitly closes the view's `webContents` during teardown.

### Fixed 2026-08-16: The built-in extension repository was not applied

- Files:
  - `manga-nexus/electron-main.js`
  - `manga-nexus/preload.js`
  - `manga-nexus/runtime/extension-stores.cjs`
  - `manga-nexus/src/App.jsx`
  - `manga-nexus/test/extensionStores.test.mjs`
- Cause: akaReader wrote the former `server.extensionRepos` key, while current Suwayomi reads `server.extensionStores`. The renderer's custom repository list was also local-only and never reached the server configuration. An early line-only migration could additionally replace the opening line of a multiline list while leaving quoted entries and `]` behind, preventing Suwayomi from parsing `server.conf` on the next launch.
- Fix: write the canonical setting before launch, always merge the maintained Keiyoushi store, validate and persist custom HTTP(S) stores in the Electron process, expose them through preload IPC, restart managed services after user changes, and replace/repair complete multiline assignments.
- Regression proof: focused tests cover default inclusion, invalid/duplicate filtering, canonical config output, removal of the obsolete managed block, and the exact malformed leftover tail. Live relaunch verification confirms the repaired config starts Suwayomi, the catalog loads, and protected source requests return the new compact verification state.

### Fixed 2026-08-15: Suwayomi GraphQL initialization failed with co-located runtime files

- File: `manga-nexus/electron-main.js`
- Cause: the standalone Suwayomi JAR was cached in the same top-level app-data directory as akaReader's managed Java. With that layout, the current Windows release consistently failed its GraphQL self-package scan with `InvalidPackagesException`, even though the JAR checksum and Java runtime were valid.
- Fix: migrate the cached JAR into `suwayomi-runtime/`, launch it from a dedicated `work/` child, and continue passing absolute Java, JAR, and configuration paths. The executable/working paths are now isolated from the managed Java and active Suwayomi data.
- Regression proof: with the same Java 21.0.11 runtime and isolated database, the checksum-identical official JAR failed from the old app-data location and successfully opened port 4567 from the isolated runtime location. A final full Electron launch reached online status and loaded sources and extensions.

### Fixed 2026-08-15: Suwayomi first-time setup could outlast the startup timer

- Files:
  - `manga-nexus/electron-main.js`
  - `manga-nexus/src/App.jsx`
- Cause: Suwayomi may download and prepare its own browser components on first launch; the previous 90-second readiness limit could expire while that healthy setup was still progressing.
- Fix: allow up to ten minutes for a live Suwayomi process to become ready and surface its setup-download percentage on akaReader's startup screen.
- Result: slow first launches remain visibly in progress instead of incorrectly presenting a failure and encouraging a duplicate retry.

### Fixed 2026-08-15: Outdated Java runtimes were accepted for the current Suwayomi build

- Files:
  - `manga-nexus/electron-main.js`
  - `manga-nexus/preload.js`
  - `manga-nexus/runtime/java-runtime.cjs`
  - `manga-nexus/src/App.jsx`
  - `manga-nexus/test/javaRuntime.test.mjs`
- Cause: startup originally accepted any successful `java -version`, so Java 8 was selected and Suwayomi exited with `UnsupportedClassVersionError`.
- Fix: inspect and compare the full Java version, require the maintained Java 21.0.11 baseline, automatically stage and validate a private current Temurin runtime, preserve the previous managed runtime until validation succeeds, classify early Suwayomi exits, and expose structured diagnostics through preload IPC.
- User recovery: the error dialog explains the detected and required versions and offers `Install Java 21.0.11 & Retry`; Settings exposes the same repair when an incompatible runtime is detected.
- Regression proof: unit cases cover Java 8 parsing, full Java 21 maintenance-version comparison, unsupported class versions, and unrelated Suwayomi exits; a live isolated-data startup proved Java 21.0.11 can run the checksum-verified server.

### Fixed 2026-08-15: Reading totals and update scans depended on chapter numbers

- Files:
  - `manga-nexus/src/App.jsx`
  - `manga-nexus/src/utils/chapterTracking.mjs`
  - `manga-nexus/test/chapterTracking.test.mjs`
- Change: statistics now count unique stored chapter IDs, while library scans count unread chapter IDs using both local and Suwayomi read state.
- Result: decimal chapters, specials, non-linear numbering, and duplicate response entries no longer inflate or corrupt chapter totals.

### Fixed 2026-08-15: Local backend exposure and image-proxy SSRF

- Files:
  - `backend/server.js`
  - `backend/test/security-boundary.test.js`
  - `manga-nexus/electron-main.js`
  - `manga-nexus/preload.js`
  - renderer API/image helpers
- Vulnerable path: the unauthenticated backend listened without an explicit loopback host, accepted every CORS origin, and `/api/img` fetched any HTTP(S) URL while following redirects.
- Fix: bind to `127.0.0.1`, require a random per-launch Electron API token, enforce known renderer origins, restrict image targets and redirects to the configured Suwayomi origin, reject non-image responses, and cap image bodies at 50 MB.
- Regression proof: unauthorized, hostile-origin, direct-loopback, and redirect-escape requests are rejected; authenticated renderer traffic and configured-Suwayomi images still succeed.

### Fixed 2026-08-15: Production and release-tool dependency advisories

- Files:
  - `backend/package-lock.json`
  - `manga-nexus/package.json`
  - `manga-nexus/package-lock.json`
- Fix: refreshed backend production packages and upgraded the shipped Electron runtime and release toolchain to patched versions, including Electron 43, electron-builder 26, Vite 8, and electron-updater 6.8.9.
- Result: full npm audits report zero known vulnerabilities in both packages.

### Fixed 2026-08-14: Source verification could retry before the user finished

- Files:
  - `manga-nexus/electron-main.js`
  - `manga-nexus/src/App.jsx`
- Fix: repeated verification requests now await the already-open window, page-load failure cannot race with close into a false success, and the renderer retries only after the user explicitly confirms that the source loaded normally.
- Hardening: the external page runs in a sandboxed, dedicated persistent Electron partition; non-HTTP(S) navigation is blocked and CAPTCHA solving remains manual.
- Limitation: the Electron partition does not share cookies with Suwayomi extensions, so some protected sources still require Suwayomi's supported WebView/login or FlareSolverr/Byparr setup.
- Result: the user controls the verification step, cancellation is safe, and akaReader no longer reports a bypass merely because the verification surface was dismissed.

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

### Fixed 2026-06-22: Suwayomi download, extraction and execution failures on Linux/POSIX

- File: `manga-nexus/electron-main.js`
- Fix:
  - `extractArchive()` now recursively creates the destination directory (`destDir`) before running extraction commands. This prevents `tar` from failing on Linux/POSIX where target folders must exist.
  - Enforced executable permissions (`chmod +x` / `0o755`) on local and bundled Java binaries under `userData` and `backend/` directories when discovered/used in `findJava()`.
  - Added post-copy and post-extraction permission configuration to ensure the java binary has execute access.
  - Added an `'error'` event listener to the spawned Suwayomi process in `startSuwayomi()` to catch runtime launch issues (like EACCES permission denials) cleanly and prevent Electron crash loops.
- Result: Packages installed or extracted on Linux/Ubuntu can now download, extract, and spawn Suwayomi without permission errors or directory missing failures.

### Fixed 2026-06-22: Linux launcher/server JAR confusion (Ubuntu "Could not find Suwayomi-Server.jar at ..." crash)

- Files:
  - `manga-nexus/electron-main.js`
  - `.github/workflows/build.yml`
  - `manga-nexus/src/App.jsx`
  - `docs/KNOWN_BUGS.md`
- Symptom: on Ubuntu the app would sometimes surface an uncaught
  exception dialog reading
  `Could not find Suwayomi-Server.jar at '.../akareader/bin/Suwayomi-Server.jar'`
  even though the UI had just reported
  `Using downloaded Suwayomi server...`.
- Root cause: the Linux CI build was downloading
  `suwayomi-linux-assets.tar.gz` and bundling it as the Suwayomi payload.
  That tarball is the .deb/.rpm system-install layout and only contains:
  - `Suwayomi-Launcher.jar` (a Compose Desktop GUI app, not a server)
  - `suwayomi-server.sh` / `suwayomi-server.service` /
    `.desktop` / `.tmpfiles` / `.sysusers`
  It does NOT contain the actual Suwayomi server, and it does NOT
  contain a bundled JRE — both assumptions were baked into the runtime
  and a prior changelog entry.
  `findBundledSuwayomi()` preferred the tarball over any standalone JAR,
  so the launcher was copied to `~/.config/akareader/suwayomi.jar` and
  spawned. The launcher then tried to find the real server at the .deb
  install root (`<install-root>/bin/Suwayomi-Server.jar`), which doesn't
  exist in akaReader's embedded layout, and crashed with the error above.
- Fix:
  - `findBundledSuwayomi()` no longer returns the tarball — it prefers
    any standalone `Suwayomi-Server*.jar` and explicitly skips
    `*Launcher*.jar`.
  - `ensureJar()` enforces a `MIN_SERVER_JAR_SIZE` floor (50 MB) on both
    the cached and bundled JAR before accepting it. A cached launcher
    (~16 MB) or truncated download is rejected and replaced.
  - `ensureJar()` also validates the post-download size so a corrupted
    network fetch surfaces immediately instead of failing later.
  - `ensureJre()` no longer walks the linux-assets.tar.gz path for a
    bundled `jre/` folder (it never had one) — it goes straight to the
    Temurin 21 download, which is the path that actually works.
  - Linux CI now downloads the standalone server JAR
    (`Suwayomi-Server-v*.jar`) the same way the Windows job does,
    instead of bundling `suwayomi-linux-assets.tar.gz`.
  - Startup status string for `using-existing-suwayomi` is now
    `Using cached Suwayomi server...` (was misleadingly
    `Using downloaded Suwayomi server...` regardless of where the JAR
    came from).
- Result: Linux AppImage / .deb installs start the real Suwayomi server
  out of the box; users who already had a launcher cached in `userData`
  are auto-recovered on the next launch (the size guard invalidates it
  and triggers the GitHub fallback download). The misleading crash
  dialog no longer fires on Ubuntu.

### Improved 2026-06-09: Cross-platform service startup (Linux/macOS local dev)

- File: `manga-nexus/electron-main.js`
- Change:
  - `findJava()` now also scans `/usr/lib/jvm`, `/usr/local/lib/jvm`, `/opt`, and `/snap/jdk/current` (Linux) plus `/Library/Java/JavaVirtualMachines` and Homebrew (macOS) before falling back to `java` on PATH.
  - `JAVA_HOME` is now resolved with `bin/java` on POSIX and `bin/java.exe` on Windows, instead of always appending `java.exe`.
  - The bundled/downloaded JRE path uses the same platform-aware binary name.
  - `getJreUrl()` now returns the platform-appropriate Temurin 21 asset: Windows ZIP, macOS tar.gz, Linux x64/aarch64 tar.gz.
  - `extractZip()` was replaced by `extractArchive()`, which uses `powershell Expand-Archive` / `tar` on Windows and `tar` / `unzip` on POSIX. The Linux JRE tarball is now extracted by `tar -xzf` instead of PowerShell.
  - Tray and BrowserWindow icons now prefer a sibling `public/icon.png` on non-Windows so Linux/GTK does not have to parse a Windows `.ico`.
- Result: `npm run electron:dev` can complete JRE discovery, JRE download, and Suwayomi startup on a Linux desktop with a system Java installed; previously it failed at the JRE step because the Windows-only JRE ZIP was extracted by `powershell Expand-Archive`.

## Confirmed / Highly Likely Open Problems

## Risky Async / State Code

### `P2` Download queue still runs inside renderer lifecycle

- Files:
  - `manga-nexus/src/App.jsx`
- Risk:
  - bounded concurrent downloads are faster now, but long-running download work still lives inside React rather than a dedicated worker/process

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
