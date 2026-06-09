# Publishing Checklist

Use this checklist before creating a public GitHub release.

## Required Local Checks

Run from `manga-nexus/`:

```powershell
npm run validate
npm run dist -- --publish=never
npm audit --omit=dev --audit-level=high
```

Run from the repository root:

```powershell
node --check backend/server.js
node --check manga-nexus/electron-main.js
node --check manga-nexus/preload.js
```

Run from `backend/`:

```powershell
npm audit --omit=dev --audit-level=high
```

## Manual App Checks

- Launch the packaged `.exe`.
- Confirm first launch starts the backend and Suwayomi.
- Confirm `/api/health` becomes healthy.
- Install or refresh at least one source extension.
- Browse a source, open manga details, and load a chapter.
- Trigger the source verification popup on a challenge-heavy source and retry after closing it.
- Download a chapter, reopen it offline, and delete it.
- Restart services from settings.
- Confirm update banners do not block reading.

## Release Steps

1. Bump `manga-nexus/package.json` version.
2. Run `npm install --package-lock-only` in `manga-nexus/` if the lockfile needs syncing.
3. Commit the release changes.
4. Tag the commit as `vX.Y.Z`.
5. Push the tag to GitHub.
6. Confirm the `Build and Release` workflow uploads installer and portable artifacts.

## Publishing Notes

- akaReader is a reader/client, not a content provider.
- Do not describe releases as including licensed manga content.
- Monetization should stay limited to support and convenience features unless content licensing is handled separately.
- Unsigned Windows builds may show SmartScreen warnings until the app gains reputation or is code-signed.
