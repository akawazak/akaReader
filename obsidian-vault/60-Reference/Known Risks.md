---
tags: [reference, risks]
---
# Known Risks
Open items from `docs/KNOWN_BUGS.md`. Up: [[Home]] · History: [[Timeline]]

| Pri | Risk | Where |
|---|---|---|
| P1 | Huge single-file state container; giant `useMemo` provider value → rerenders, hidden retained closures | [[App-jsx|App.jsx]], [[DataProvider]] |
| P2 | Download queue runs inside the React lifecycle, not a worker | [[Offline Downloads]] |
| P2 | Service online state from two channels (`/api/health` polling + Electron events) can disagree | [[DataProvider]], [[Startup Flow]] |
| P2 | Reader adaptive-color image loads aren't cancellable | [[Reader]] |
| P2 | Helpers/constants duplicated (`proxyImg`, `timeAgo`, `storage`, `debounce`, `calculateStreak`, themes…) | [[App-jsx|App.jsx]], [[Renderer Utils]] |
| P2 | UI components exist both inline in App.jsx and as files | [[Renderer Components]] |
| P2 | `sourceId` parsed but unused for manga/page fetches | [[API Routes]] |
| P3 | Vite/esbuild can fail in sandboxes that block reading parent dirs | [[Commands]] |

## Suggested stabilization order
1. Move downloads out of the React lifecycle.
2. De-duplicate helpers/components.
3. Single owner for service status.
4. Split [[App-jsx|App.jsx]] into feature boundaries.
