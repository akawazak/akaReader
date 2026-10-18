---
tags: [moc]
---
# akaReader — Map of Content

Desktop manga reader: **Electron shell + React renderer + Express proxy on top of Suwayomi**.

```
React renderer → Express proxy (3001) → Suwayomi (4567) → source extensions
                        ↑
            Electron main process supervises both
```

## Start here
- [[Runtime Stack]] — the three cooperating parts and how they talk
- [[Startup Flow]] — what happens from double-click to first render
- [[Agent Rules]] — the house rules for editing this repo
- [[Known Risks]] — open problems ranked P1–P3

## Parts
| Layer | Notes |
|---|---|
| Electron main | [[Electron Main]] · [[Preload Bridge]] · [[Electron Runtime Modules]] |
| Backend | [[Backend Proxy]] · [[Source Errors]] · [[API Routes]] · [[Image Proxy]] |
| Renderer | [[App-jsx|App.jsx]] · [[DataProvider]] · [[Reader]] · [[Renderer Components]] · [[Renderer Utils]] |
| External | [[Suwayomi]] · [[FlareSolverr Helper]] · [[Discord Rich Presence]] |

## Flows
- [[Startup Flow]] · [[Reader Flow]] · [[Navigation]]
- [[Offline Downloads]] · [[CBZ Export]]
- [[Source Verification Flow]] · [[Browse Pagination]]
- [[Chapter Updates]] · [[Library Smart Views]]
- [[Backup and Diagnostics]] · [[App Updates]] · [[Extension Stores]]
- [[Packaging and CI]]

## Reference
- [[API Routes]] · [[IPC Channels]] · [[Persistence Keys]] · [[Security Boundary]]
- [[Commands]] · [[Tests]] · [[Glossary]] · [[Timeline]]

## Source docs in the repo
`AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/FILE_MAP.md`, `docs/KNOWN_BUGS.md`, `docs/DEV_WORKFLOW.md`, `docs/PUBLISHING.md` — this vault is a navigable index over those; when they disagree, the repo docs win.
