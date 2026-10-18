---
tags: [backend, high-risk]
file: backend/server.js
---
# Backend Proxy
`backend/server.js` (~700 lines) — Express translator/stabilizer in front of [[Suwayomi]]. Up: [[Runtime Stack]]

- Listens `127.0.0.1:${PORT||3001}`; `SUWAYOMI_URL` default `http://localhost:4567`.
- Middleware: helmet, compression, origin check, CORS, JSON (10 MB), `/api` token auth ([[Security Boundary]]).
- GraphQL adapter + retries around Suwayomi calls.
- In-memory, **source-aware** caches: extensions, search, manga (10 min), page lists.
- [[Image Proxy]] at `/api/img`.
- Extension install/update/uninstall.
- CBZ archive route (archiver) → [[CBZ Export]].
- Errors pass through [[Source Errors]] — no Java stack traces reach the UI.

Routes → [[API Routes]]. Started by [[Electron Main]] in [[Startup Flow]].

## Manga detail behavior
- Cache hit → serve (10-min TTL).
- Miss → `fetchManga` + actively `fetchChapters`; falls back to stored `manga(id)` only if refresh fails.
- `?force=1` bypasses cache and **errors** rather than returning stale chapters (used by refresh and [[Chapter Updates]]).
- Upload timestamps normalized to ISO `publishedAt`; `chapterListRefreshedAt` only after successful source fetch.
