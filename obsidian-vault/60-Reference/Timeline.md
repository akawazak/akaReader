---
tags: [reference, history]
---
# Timeline
Fixes & improvements from `docs/KNOWN_BUGS.md` (sorted by date, newest first). Open items → [[Known Risks]].


## 2026-09-09
- **Fixed** — Packaged launch smoke test could reuse a locked user profile

## 2026-08-30
- **Improved** — Optional privacy-safe Discord Rich Presence

## 2026-08-28
- **Improved** — Offline storage management, native CBZ export, and smart library views
- **Fixed** — Chapter release details and reliable new-chapter discovery

## 2026-08-26
- **Fixed** — Native close acknowledgement and reader control accessibility

## 2026-08-25
- **Fixed** — Continue, Alt+F4 persistence, and reader zoom reliability

## 2026-08-17
- **Fixed** — Linux packaged-runtime validation could not reach the app
- **Fixed** — Interrupted downloads disappeared or failed permanently
- **Fixed** — Backup/restore omitted user state and updates had no safety snapshot
- **Improved** — Settings can diagnose and repair the local runtime
- **Fixed** — Corrupt local service could restart forever without a diagnosis
- **Fixed** — Protected-source browser paid its cold-start cost on the first source click
- **Fixed** — Packaged app opened with its local service permanently offline
- **Fixed** — Release startup race and Windows-only protected-source helper

## 2026-08-16
- **Fixed** — Protected-source recovery still waited for Retry
- **Fixed** — Helper cold start blocked the manual verification choice
- **Fixed** — Verification helper repeatedly reopened the awkward website flow
- **Fixed** — Chapter pages waited behind abandoned manga covers
- **Fixed** — Tall chapter images looked like unloaded slivers
- **Fixed** — Source results waited for bottom-of-page scrolling
- **Fixed** — Cold backend launch was marked offline too early
- **Fixed** — Source browse rendered a raw Suwayomi stack trace
- **Fixed** — Browser verification could not unblock Suwayomi's separate request client
- **Fixed** — Source verification opened as a detached popup
- **Fixed** — The built-in extension repository was not applied

## 2026-08-15
- **Fixed** — Suwayomi GraphQL initialization failed with co-located runtime files
- **Fixed** — Suwayomi first-time setup could outlast the startup timer
- **Fixed** — Outdated Java runtimes were accepted for the current Suwayomi build
- **Fixed** — Reading totals and update scans depended on chapter numbers
- **Fixed** — Local backend exposure and image-proxy SSRF
- **Fixed** — Production and release-tool dependency advisories

## 2026-08-14
- **Fixed** — Source verification could retry before the user finished

## 2026-06-22
- **Fixed** — Suwayomi download, extraction and execution failures on Linux/POSIX
- **Fixed** — Linux launcher/server JAR confusion (Ubuntu "Could not find Suwayomi-Server.jar at ..." crash)

## 2026-06-09
- **Improved** — Cross-platform service startup (Linux/macOS local dev)

## 2026-05-30
- **Improved** — Concurrent offline chapter downloads
- **Improved** — Concurrent library update scans
- **Fixed** — Download cancellation references live abort controller
- **Improved** — Source verification popup
- **Fixed** — Reproducible local lint gate
- **Improved** — Publishing workflow and checklist
- **Fixed** — Backend production dependency audit

## 2026-05-23
- **Fixed** — Reader next-chapter initialization-order crash
- **Fixed** — Hook dependency order guard added
- **Fixed** — Source and extension icon paths normalized
- **Fixed** — Oversized loading spinner with named sizes
- **Improved** — Extensions tab extracted and optimized
- **Improved** — Update flow stays interactive by default
- **Fixed** — Reader previous-chapter shortcut crash
- **Fixed** — Chapter archive download route
- **Fixed** — Reader end-of-chapter completion and parent sync
- **Fixed** — Auto-scroll control now scrolls
- **Fixed** — Reader render-time debug toast
- **Fixed** — Source-aware history/library/cache checks
- **Fixed** — Windows service handlers no longer no-op as success on non-Windows
- **Fixed** — Reader/download lifecycle cleanup and cancellation
- **Fixed** — Offline chapter storage now stores blobs instead of base64 strings
- **Fixed** — Toast/provider and image-proxy cleanup
- **Fixed** — Packaging claims narrowed to Windows-only
- **Fixed** — Unsupported browse filters removed from the live UI
- **Fixed** — Stale extracted component set removed
