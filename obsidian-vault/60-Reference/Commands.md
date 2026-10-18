---
tags: [reference, dev]
---
# Commands
Up: [[Home]] · Details: `docs/DEV_WORKFLOW.md`

Prereqs: Node 22.12+, Java 21.0.11+ (auto-installed privately if missing).

## manga-nexus/
| Script | Does |
|---|---|
| `npm run electron:dev` | Vite (5173) + Electron — full dev app |
| `npm run dev` | Vite only (browser dev; run backend separately) |
| `npm test` | `node --test test/*.test.mjs` |
| `npm run lint:release` | eslint quiet (release gate) |
| `npm run check:hook-order` | TDZ hook-order guard ([[Agent Rules]]) |
| `npm run validate` | test + lint:release + hook-order + build — **run before PRs** |
| `npm run build` | vite build |
| `npm run dist` | Windows NSIS + portable |
| `npm run dist:linux` | AppImage + deb |
| `npm run check:packaged-runtime` / `smoke:packaged-runtime` | CI packaging gates ([[Packaging and CI]]) |

## backend/
| `npm start` | `node server.js` (port 3001) |
|---|---|
| `npm test` | `node --test test/*.test.js` |

Root: `scripts/check-ci.ps1` — local CI helper (PowerShell).
