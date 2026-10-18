---
tags: [backend, flow]
---
# Image Proxy
`GET /api/img?url=…` in [[Backend Proxy]].

## Online path
1. Suwayomi returns a page/cover URL.
2. Renderer `proxyImg()` rewrites Suwayomi/local URLs to `/api/img?url=…&api_token=…`.
3. Backend allows only the configured Suwayomi origin (incl. loopback aliases on same port), rejects credentials + off-origin redirects, ≤50 MB, image/binary types only.
4. Browser HTTP cache handles the rest.

## Priority + cancellation
- Reader page URLs carry a page-priority marker; the first page request cancels leftover cover work from the previous view.
- Every proxy request aborts when its renderer client disconnects.
- Persisted cover requests during startup wait up to ~30 s for Suwayomi instead of breaking.

## Not proxied
Source/extension icons load directly from `http://localhost:4567/...` (too many small requests).
Offline pages come from IndexedDB → [[Offline Downloads]].
