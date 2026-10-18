---
tags: [build, ci]
---
# Packaging and CI
`.github/workflows/build.yml`, `manga-nexus/package.json` (electron-builder). Up: [[Home]]

- Targets: Windows one-click NSIS + portable; Linux AppImage + deb. Output `manga-nexus/dist-electron/`.
- Backend entry files and backend `node_modules` copied via **separate** `extraResources` mappings.
- CI runs `check:packaged-runtime` on unpacked Windows + Linux apps, then `smoke:packaged-runtime` launches them (temp Chromium profile) and requires port 3001 to open.
- Linux smoke runs under Xvfb after restoring `chrome-sandbox` to root + `4755` — never disables the sandbox.
- Tag-driven GitHub release publishing; checklist in `docs/PUBLISHING.md`.

Commands → [[Commands]]. Runtime preflight → [[Electron Runtime Modules#backend-runtime.cjs]].
