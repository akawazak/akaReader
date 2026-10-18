---
tags: [electron, privacy]
---
# Discord Rich Presence
Off by default. Up: [[Electron Main]]

- Main process only, via local Discord RPC — no bot token, OAuth, or backend route.
- Renderer may request only `browsing` | `reading` → shown as `Browsing manga` / `Reading manga`.
- Never sends titles, chapters, sources, history, tokens, URLs.
- Discord missing/closed is non-fatal; retries in background while enabled; clears on disable/exit.

Code: [[Electron Runtime Modules#discord-presence.cjs]]. Test: `discordPresence.test.mjs`.
