---
tags: [architecture]
---
# Runtime Stack
Up: [[Home]]

Three cooperating processes plus an external JVM:

1. **[[Electron Main]]** (`manga-nexus/electron-main.js`, ~2.5k lines) — supervisor. Boots the backend via `utilityProcess.fork`, ensures Java + the Suwayomi JAR, starts/attaches to [[Suwayomi]], owns tray/window/updater, native dialogs, [[Discord Rich Presence]], [[FlareSolverr Helper]].
2. **[[Backend Proxy]]** (`backend/server.js`, ~700 lines) — Express on `127.0.0.1:3001`. Translates Suwayomi GraphQL/REST into a small REST surface ([[API Routes]]), caches, retries, proxies images ([[Image Proxy]]), sanitizes errors ([[Source Errors]]).
3. **React renderer** (`manga-nexus/src`) — *not thin*. Owns UI, navigation, persisted user state, the download queue and IndexedDB offline store. Centered on [[App-jsx|App.jsx]] / [[DataProvider]] and [[Reader]].
4. **[[Suwayomi]]** — Java server on `:4567` that runs source extensions.

The renderer reaches Electron only through the [[Preload Bridge]] (`window.electronAPI`) and the backend only with the per-launch token ([[Security Boundary]]).

## Pressure points
- [[App-jsx|App.jsx]] is the dominant state + UI container.
- [[Reader]] has observer/timer-heavy async behavior.
- [[Backend Proxy]] mixes cache, GraphQL adapter, image proxy, extensions, archive route.
See [[Known Risks]].

## Dependencies
Renderer: react 18, vite 8, electron 43, electron-builder, electron-updater, lucide-react, concurrently, wait-on.
Backend: express, axios, cors, compression, helmet, archiver.
