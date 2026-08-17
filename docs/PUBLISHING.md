# Publishing Checklist

Use this checklist before creating a public GitHub release.

## Required Local Checks

Run from `manga-nexus/`:

```powershell
npm run validate
npm run dist -- --publish=never
npm audit --audit-level=high
```

Run from the repository root:

```powershell
node --check backend/server.js
node --check manga-nexus/electron-main.js
node --check manga-nexus/preload.js
```

Run from `backend/`:

```powershell
npm test
npm audit --audit-level=high
```

## Manual App Checks

- Launch the packaged Windows `.exe` and Linux AppImage/deb from their native operating systems.
- Confirm first launch starts the backend and Suwayomi.
- Confirm `/api/health` becomes healthy.
- Confirm unauthenticated requests to the Electron-managed backend return `401`, while the renderer loads normally with its per-launch token.
- Install or refresh at least one source extension.
- Browse a source, open manga details, and load a chapter.
- Trigger source verification on a challenge-heavy source and confirm the site appears inside the main akaReader window below its verification toolbar. Complete the check manually and confirm the view returns to results automatically. Verify fallback `Load now`, Cancel, and Escape.
- On Windows x64 and Linux x64, confirm the platform-specific managed FlareSolverr archive passes size/SHA-256 verification, starts on loopback, and retries the protected request automatically.
- Download a chapter, reopen it offline, and delete it.
- Restart services from settings.
- Confirm update banners do not block reading.

## Release Steps

1. Bump `manga-nexus/package.json` version.
2. Run `npm install --package-lock-only` in `manga-nexus/` if the lockfile needs syncing.
3. Commit the release changes.
4. Tag the commit as `vX.Y.Z`.
5. Push the tag to GitHub.
6. Confirm the `Build and Release` workflow passes renderer and backend tests on both operating systems, then uploads Windows installer/portable plus Linux AppImage/deb artifacts.

## Publishing Notes

- akaReader is a reader/client, not a content provider.
- Do not describe releases as including licensed manga content.
- Monetization should stay limited to support and convenience features unless content licensing is handled separately.
- Unsigned Windows builds may show SmartScreen warnings until the app gains reputation or is code-signed.
