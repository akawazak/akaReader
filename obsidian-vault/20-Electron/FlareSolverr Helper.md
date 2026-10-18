---
tags: [electron, external, protected-sources]
---
# FlareSolverr Helper
Optional managed helper for Cloudflare-protected sources. Up: [[Source Verification Flow]]

- **v3.5.0**, official binaries pinned: Windows x64 ZIP, Linux x64 tar.gz (exact size + SHA-256). See [[Electron Runtime Modules#cloudflare-helper.cjs]].
- Installed **on demand** only — automatically after manual verification still leaves [[Suwayomi]] blocked. Guarded per source/URL so it can't loop.
- Binds `127.0.0.1:8191`; Suwayomi config updated; Suwayomi restarts only if config changed.
- `CAPTCHA_SOLVER=none`, media loading disabled; never solves CAPTCHAs.
- Once enabled: later launches warm it + pre-create the `suwayomi` browser session in parallel with startup (never blocks). Selecting a source also starts it in parallel with the first request.
- Exits with akaReader; PID recorded and cleaned up. On Windows, kills only a stale `chromedriver.exe` whose path exactly matches FlareSolverr's cache.
- Linux: restores exec perms; private XDG cache/config/data (doesn't change `HOME`).

IPC: `getCloudflareHelperInfo`, `ensureCloudflareHelper`, `setupCloudflareHelper` ([[IPC Channels]]).
