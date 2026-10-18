---
tags: [flow, browse]
---
# Browse Pagination
Owned by [[App-jsx|App.jsx]]; helpers in `browsePagination.mjs`. Up: [[Navigation]]

- Page 1 renders immediately; then a short-delay **sequential** loop fetches later pages until `hasNextPage: false`.
- **Not** scroll-triggered.
- Each search has an `AbortController` + monotonic request ID → stale responses never commit.
- Pauses when the document is hidden; cancels on source/search/view change.
- Transient later-page failures: bounded retries, already-loaded results kept.
- Dedupe by source+manga identity; a page with no unique progress stops the loop.

Route: `/api/source/:sourceId/search` ([[API Routes]]).
