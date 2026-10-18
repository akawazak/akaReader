---
tags: [renderer, high-risk]
file: manga-nexus/src/App.jsx
---
# App.jsx
`manga-nexus/src/App.jsx` (~7k lines) — the main renderer: state, UI, navigation. **Highest-risk file.** Up: [[Runtime Stack]]

## Major pieces (approx. order in file)
- Constants: `CONFIG`, `UPDATE_INTERVAL_OPTIONS`, `DOWNLOAD_PAGE_CONCURRENCY=4`, `UPDATE_SCAN_CONCURRENCY=4`, `LANGUAGES`, `DEFAULT_CATEGORIES`, `THEMES`, `SORT_OPTIONS`, `BUILT_IN_EXTENSION_STORES` (duplicated elsewhere → [[Known Risks]])
- `GlobalStyles`, `ToastProvider`
- **[[DataProvider]]** — shared state/actions
- Inline UI primitives (`Spin`, `Btn`, `Badge`, `EmptyState`, `ContextMenu`, `MangaCard`, `MangaListCard`, `ExtCard`…) — also exist as separate files ([[Renderer Components]])
- `SettingsPage` (large), `GlobalSearch`, `UpdatesTab` ([[Chapter Updates]]), `DownloadsTab` ([[Offline Downloads]]), `BrowseFilterBar`
- IndexedDB helpers: DB `akareader-downloads` v1, `saveChapterBlobs()` / `loadChapterBlobs()`
- `Onboarding`, `ServiceErrorModal`, `ReleaseNotesModal`, `StartupScreen` ([[Startup Flow]])
- Discover: `DiscoverRow`, `DiscoverTab`, `MoodDiscovery`
- Manga extras: `MangaNotes`, `SourceMigrationModal`, `CatchUpModal`, `DuplicateBanner`, `ReadingReceipt`, `ShareCardModal`, `StatsStrip`
- **`App`** — navigation state machine ([[Navigation]]), `openManga()`, `openChapter()`, `fetchNextChapter()` ([[Reader Flow]]), browse ([[Browse Pagination]]), protected-source recovery ([[Source Verification Flow]])
- `RootInner` / `Root`

## Editing rules
Targeted edits only; declare callbacks before hook deps reference them; run `check:hook-order`. See [[Agent Rules]].
