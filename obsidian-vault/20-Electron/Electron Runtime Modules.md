---
tags: [electron, pure-logic]
---
# Electron Runtime Modules
`manga-nexus/runtime/*.cjs` — small pure modules used by [[Electron Main]] and unit-tested in `manga-nexus/test/` ([[Tests]]).

## backend-runtime.cjs
Required-file manifest for the packaged backend. Used by Electron's preflight before forking and by CI's `check:packaged-runtime` ([[Packaging and CI]]).

## chapter-export.cjs
Validation + filesystem-safe naming for [[CBZ Export]].

## cloudflare-helper.cjs
[[FlareSolverr Helper]] launch env, pinned Windows/Linux x64 assets (size + SHA-256), Linux private XDG dirs, media disabled, exact Windows chromedriver path for stale-process cleanup.

## discord-presence.cjs
Local-RPC controller; only `Browsing manga` / `Reading manga`. → [[Discord Rich Presence]]

## extension-stores.cjs
URL validation, dedupe, Keiyoushi default merge, canonical `server.conf` rewrite, repair of the broken multiline migration tail. → [[Extension Stores]]

## java-runtime.cjs
Java version parse/compare (min 21.0.11) and Suwayomi startup-failure classification. → [[Startup Flow]]

## source-verification.cjs
Page-readiness classification (Cloudflare/Turnstile markers, login forms, stable same-host loader) + embedded view bounds. → [[Source Verification Flow]]

## window-lifecycle.cjs
Close-to-tray decision + 400 ms renderer-flush timeout constant. → [[Electron Main#Close handshake]]
