---
tags: [reference, backend]
---
# API Routes
All in `backend/server.js` ([[Backend Proxy]]). All `/api/*` require the token ([[Security Boundary]]).

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/ping` | liveness (Electron startup ping) |
| GET | `/api/health` | backend + Suwayomi health |
| GET | `/api/img?url=` | [[Image Proxy]] |
| GET | `/api/extensions` | list extensions (cached) |
| POST | `/api/extensions/install/:pkgName` | install |
| POST | `/api/extensions/uninstall/:pkgName` | uninstall |
| POST | `/api/extensions/update/:pkgName` | update |
| GET | `/api/sources` | sources incl. `homeUrl` |
| GET | `/api/source/:sourceId/search` | browse/search page → [[Browse Pagination]] |
| GET | `/api/source/:sourceId/manga/:mangaId` | detail + chapters (`?force=1`) → [[Backend Proxy#Manga detail behavior]] |
| GET | `/api/source/:sourceId/chapter/:chapterId` | page list (`fetchChapterPages`, `fixUrl()`) |
| GET | `/api/source/:sourceId/chapter/:chapterId/download` | CBZ stream → [[CBZ Export]] |

Errors: structured via [[Source Errors]]. Unknown → 404 JSON.
