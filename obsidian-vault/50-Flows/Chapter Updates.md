---
tags: [flow, library]
---
# Chapter Updates
Up: [[Home]] · Utils: `chapterUpdates.mjs` ([[Renderer Utils]])

- Library scan fetches each manga with `?force=1` (bypasses 10-min cache, fails visibly) at concurrency 4. → [[Backend Proxy#Manga detail behavior]]
- `chapterUpdateStateV1`: known chapter IDs + compact pending-new metadata per source/manga key.
- `chapterUpdateSummaryV1`: last scan time (schedule survives relaunch).
- **First scan = baseline** (old unread backlog isn't "new"); later scans add only unseen IDs; read/removed chapters leave the pending set; failed titles keep earlier notifications.
- Intervals: manual, 15m, 30m, 1h, 3h, 6h — one-shot timer rescheduled from last completed scan.
- Optional desktop notification (main process) and auto-download of new chapters ([[Offline Downloads]]).
- Chapter numbers/labels are presentation only.
- **Updates Center** (`UpdatesTab`): per-chapter rows, date/source/search filters, open / download / mark-read.

Feeds [[Library Smart Views]] (Updated).
