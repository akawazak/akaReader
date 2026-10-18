---
tags: [architecture, security]
---
# Security Boundary
Up: [[Runtime Stack]]

- [[Backend Proxy]] binds **127.0.0.1** only.
- Per-launch random token: Electron → backend env (`AKAREADER_API_TOKEN`) and → [[Preload Bridge]] (`apiToken`, via sync `get-api-token`).
- Renderer sends header `X-AkaReader-Token`; `<img>` tags use `?api_token=` query.
- Allowed browser origins: packaged renderer, `http://localhost:5173`, `http://127.0.0.1:5173`. Others rejected before routing.
- Standalone backend without a token still works for dev but stays loopback + origin restricted.
- [[Image Proxy]] only fetches the configured Suwayomi origin; no redirects away; ≤50 MB; image/binary only (SSRF fix 2026-08-15).
- Source verification runs in a sandboxed `WebContentsView` with its own persistent partition ([[Source Verification Flow]]).
- [[Discord Rich Presence]] never sends titles/chapters/sources/URLs.
- Diagnostics never expose the token.

Tests: `backend/test/security-boundary.test.js` ([[Tests]]).
