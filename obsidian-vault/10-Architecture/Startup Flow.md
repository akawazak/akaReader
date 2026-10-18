---
tags: [flow, startup]
---
# Startup Flow
Up: [[Home]] · Related: [[Electron Main]], [[Preload Bridge]], [[Backend Proxy]]

1. Electron takes the single-instance lock and calls `ensureManagedServices()`.
2. Generates a random **API token**, forks the [[Backend Proxy]] on loopback `3001` (after the [[Electron Runtime Modules#backend-runtime.cjs|backend-runtime preflight]]). Allows ~30 s for the authenticated ping (Windows AV scanning can delay cold start). Crashes retry with bounded exponential backoff; a crash loop becomes a repair-oriented service issue.
3. Java check: runs `java -version`, needs **21.0.11+**. Older system Java is left alone; a private Temurin 21 is installed under the data dir if needed ([[Electron Runtime Modules#java-runtime.cjs|java-runtime.cjs]]).
4. Ensures the Suwayomi JAR (in `suwayomi-runtime/`, cwd `work/`), writes [[Extension Stores]] into `server.conf`, starts/attaches [[Suwayomi]] on `4567`. First launch may download browser components — readiness wait up to **10 min** with progress relayed to the startup screen.
5. If protected-source support was ever enabled, warms the [[FlareSolverr Helper]] in parallel (never blocks the main promise).
6. **Renderer-ready handshake**: Electron queues `services-status` events; React installs its listener then calls `rendererReady()`; the queue flushes. Managed mode never polls `/api/health` before the backend exists — it checks health on the backend-ready event and after the startup promise resolves.
7. Renderer fetches sources/extensions → `StartupScreen` → main tabs.

Failure UI: `ServiceErrorModal` with structured issues (detected vs required Java version, repair action). See [[Backup and Diagnostics]] for repair.

Debugging: `docs/DEV_WORKFLOW.md` → "Service startup issues".
