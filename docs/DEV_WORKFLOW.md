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

The standalone backend is loopback-only. Electron normally adds a random `AKAREADER_API_TOKEN`; standalone browser development omits it and is limited to the fixed Vite origins.

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

On a cold Windows launch, the backend may take more than ten seconds to bind its loopback port while security scanning completes. The desktop startup supervisor waits for roughly 30 seconds before declaring the backend unavailable.

Suwayomi currently requires Java 21, and akaReader enforces a tested minimum of Java 21.0.11. Electron checks the full Java version rather than merely checking whether Java launches or whether its major version is 21. If the machine has an older runtime or no Java, akaReader installs a private Temurin 21.0.11 runtime in its data directory; it does not replace the user's system Java. If that automatic step fails, the recovery dialog and Settings runtime section provide an `Install Java 21.0.11` action. A fresh Suwayomi data directory may spend several minutes downloading its browser components; Electron reports that percentage and waits up to ten minutes before classifying startup as timed out.

Protected sources are handled adaptively. akaReader never downloads FlareSolverr at normal startup. Before protected-source support has been enabled, the helper also remains stopped. Once enabled, future launches warm the installed helper and its reusable `suwayomi` browser session after backend readiness, concurrently with Java/Suwayomi; this background task does not delay the main readiness promise, and selecting a source joins the same work instead of launching duplicates. When ready, the helper automatically retries the failed browse, manga-detail, or chapter request. If a challenge still appears, `Verify manually` remains usable while that warm-up runs. Electron watches for Cloudflare's same-source clearance cookie as well as page-readiness signals; after the user completes the check, the embedded website closes and the native request retries automatically, including when the source is stuck on its own loading/advertising shell. `Load now` remains only as a fallback. If that clean retry still fails and no helper exists, akaReader automatically downloads the pinned official Windows x64 ZIP (about 326 MB) or Linux x64 tar.gz (about 234 MB) without a second confirmation dialog. Electron verifies the platform-specific size and SHA-256, binds the helper to `127.0.0.1:8191`, runs it with `CAPTCHA_SOLVER=none` and media disabled, enables Suwayomi's helper settings, and retries. Linux installs restore executable permissions and use private XDG directories. The helper stops with akaReader.

Electron also writes the built-in Keiyoushi catalog to Suwayomi's `server.extensionStores` setting before launch. Additional repositories added in Settings are validated as HTTP(S) URLs, persisted in `electron-settings.json`, and applied by restarting the managed local services. The built-in entry is intentionally visible but cannot be removed from the UI. Startup rewrites the complete list and automatically removes the dangling list tail created by the old line-only migration, so a previously malformed `server.conf` self-recovers.

## Build Commands

From `manga-nexus/`:

```powershell
npm run build
```

Builds the renderer into `manga-nexus/dist`.

```powershell
npm run lint -- --quiet
```

Runs the local ESLint gate using checked-in dev dependencies. The full lint output still includes warnings for existing hook dependency and cleanup work, so use `--quiet` for the current release gate.

```powershell
npm run validate
```

Runs the current release validation bundle: renderer unit tests, lint release gate, hook-order check, and renderer build.

```powershell
npm test
```

Runs the renderer's focused Node tests, including chapter-stat and update-detection regression cases.

```powershell
npm run check:hook-order
```

Checks React hook dependency arrays in the high-risk renderer files for callbacks referenced before they are declared. Run this after moving callbacks in `App.jsx` or `Reader.jsx`.

```powershell
npm run check:packaged-runtime -- dist-electron/win-unpacked
```

Checks that an unpacked release contains the backend entry files and production dependencies.

```powershell
npm run smoke:packaged-runtime -- dist-electron/win-unpacked
```

Launches the unpacked release and requires its backend to bind port 3001 within 60 seconds. Run it only while another akaReader instance is not using that port.

```powershell
npm run electron:build
```

Builds the renderer and packages the Windows Electron app.

```powershell
npm run dist
```

Runs the Windows packaging flow used by the repo today.

See `docs/PUBLISHING.md` for the pre-tag release checklist.

Packaged Windows builds use a one-click NSIS installer. `electron-updater` downloads updates in the background; downloaded updates install on app quit unless the user chooses `Restart now`.

## Testing Reality

Current state:

- the backend has focused tests for local API authentication, origin checks, image-proxy target/redirect restrictions, and source-error sanitization
- the renderer package has focused unit coverage for chapter-ID statistics, unread-update detection, Java version parsing, startup-failure classification, extension-store configuration migration, and source-error presentation
- no dedicated e2e runner is present
- validation is primarily manual/runtime-driven, plus local lint/build/hook-order checks

Run the backend security regression from `backend/`:

```powershell
npm test
```

The release workflow runs this backend suite on both Windows and Linux before packaging, in addition to the renderer validation bundle. After packaging, it checks each unpacked app for the backend entry files and production dependencies, then actually launches it and requires port 3001 to open; Linux uses Xvfb. Missing dependencies or a non-starting backend fail the build instead of producing a disconnected release. Electron shares the required-file manifest and checks installed files before starting the utility process, while repeated runtime crashes use bounded backoff and end in an actionable repair state.

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
5. `backend/source-errors.js` when the response reports `source-verification-required` or a raw upstream trace
6. `src/components/extensions/ExtensionsTab.jsx` if the issue is only in the extension list UI

For multi-page sources, confirm page 2 and later requests begin automatically after page 1 without scrolling, remain sequential, append rather than replace results, and stop when `hasNextPage` becomes false. Also change the query/source while a later page is in flight and confirm the stale response never appears; minimize/restore the app and confirm background loading pauses/resumes; simulate a temporary later-page failure and confirm loaded cards remain while bounded retries run; and return a repeated page with `hasNextPage: true` to confirm the loop stops without duplicates. Run `npm test` for the pure merge/retry regressions.

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
5. the persisted `downloadQueueV1` manifest and whether backend health has become true
6. `navigator.storage.estimate()` results when the failure says storage is nearly full

Interrupted jobs are expected to resume after a relaunch. The queue stores metadata only; page blobs are committed atomically to IndexedDB when the entire chapter finishes. Transient network/server failures receive up to three attempts, while client errors, verification requirements, and low-storage errors wait for user action.

### Diagnostics and backup issues

Check the Settings `System health` report first. Its main-process checks distinguish incomplete packaged backend files, incompatible Java, an unavailable Suwayomi endpoint, a missing/short server JAR, a non-writable or low-space data directory, and a stopped optional helper. `Repair automatically` may download Java, the Suwayomi JAR, or the protected-source helper only when that component is absent and required.

Backup files use schema `akareader-backup` version 3 and are capped at 10 MB. Restore accepts the old top-level version 2 export, but only allowlisted state and `aka:note:*` entries are applied. Offline chapter blobs are never imported/exported. Before testing update install, confirm `userData/backups` receives a new safety file and older automatic backups are pruned to five.

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
- When testing a large automatically loaded catalog, open a manga while covers are still loading, then open a chapter. Confirm the old cover requests are cancelled and the first reader page appears without waiting for the abandoned catalog images. Navigate back during an image load and confirm the backend does not keep fetching it.
- For a source challenge, first confirm an already-installed helper begins warming as soon as a source is selected, that a later recovery reuses the same launch, and that results return without clicking Retry. Confirm the compact state never shows a raw Java/Kotlin trace and keeps `Verify manually` enabled with accurate wording while the helper starts. Complete a human check only when needed; verify a new same-source clearance cookie or the existing page signals close the embedded view and native results return without clicking `Load now`. Confirm the fallback `Load now`, Cancel, and Escape actions remain safe. A first-time setup must still verify the archive, bind only to loopback, restart Suwayomi only when configuration changes, and load results.
- Force-close akaReader while its helper browser is starting, relaunch, and revisit the protected source. Confirm akaReader stops the stale process only when its executable exactly matches FlareSolverr's managed `undetected_chromedriver` path, becomes ready without a shared-driver permission error, and returns quickly with a readable error if the helper process itself exits. Also open a protected chapter directly from history/library and confirm recovery retries the chapter rather than leaving the reader stranded.
- Read forward until next-chapter prefetch triggers.
- Download a chapter for offline use, reopen it offline, and verify IndexedDB-backed blob loading.
- Cancel an in-progress download and confirm it stops instead of finishing in the background.
- Force-close during a chapter download, relaunch, wait for backend readiness, and confirm the recovered queue resumes without re-queuing the chapter manually.
- In Settings, run the full system check. Confirm each component has a readable result, repair appears only when needed, and the report does not contain the API token.
- Export a backup, inspect its schema/version, restore it, and confirm library, progress, categories, settings, reading time, and notes return. Also import a legacy v2 export. Confirm offline image blobs are unchanged.
- Start an app update and verify an automatic backup is written before download; use `Restart now` and verify a second current backup exists before install.
- Restart services from settings and confirm the renderer recovers.
