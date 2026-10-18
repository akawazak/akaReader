---
tags: [reference, storage]
---
# Persistence Keys
Up: [[DataProvider]]

## localStorage (renderer, via the `storage` helper)
| Key | Holds |
|---|---|
| `library` | saved manga |
| `history` | reading history |
| `progress` | per-manga chapter/page progress |
| `readChapters` | unique read chapter IDs per manga |
| `readingTime` | reading-time stats |
| `categories`, `mangaCategories` | user categories + assignments |
| `appSettings` | renderer settings |
| `onboardingDone` | onboarding flag |
| `searchHistory` | search history |
| `chapterUpdateStateV1` | known/new chapters → [[Chapter Updates]] |
| `chapterUpdateSummaryV1` | last scan summary |
| `downloadQueueV1` | queue manifest → [[Offline Downloads]] |
| `keyMigrationV2` | key migration marker |

## IndexedDB
`akareader-downloads` v1 / store `chapters` → [[Offline Downloads]]

## Electron (main process)
- `electron-settings.json` — close-to-tray, start-with-Windows, Discord, custom stores ([[Extension Stores]])
- `userData/backups` — pre-update backups, last 5 ([[App Updates]])
- Data dir: managed JRE, `suwayomi-runtime/`, FlareSolverr install ([[FlareSolverr Helper]])

## Backend
In-memory caches only (lost on restart).
