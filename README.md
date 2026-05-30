# akaReader

akaReader is a Windows-first desktop manga reader powered by Suwayomi. It bundles an Electron app, a local Node/Express proxy, and managed Suwayomi startup so users can browse sources, read chapters, keep a local library, and save chapters for offline reading.

## Current Status

akaReader is usable as a beta-style desktop app. The renderer builds, the high-risk React hook-order guard passes, and Windows packaging is configured through Electron Builder.

The app is not a licensed manga store and does not provide content itself. It depends on user-installed Suwayomi source extensions and their upstream sites.

## Features

- Browse Suwayomi sources and extension catalogs
- Search, open manga details, and read chapters
- Library, history, categories, reading progress, and reading stats
- Paged, scroll, and webtoon-style reader modes
- Offline chapter downloads stored in IndexedDB
- Managed local backend and Suwayomi startup in Electron
- Source verification popup for sites that require browser challenges
- Windows installer, portable build, and packaged update flow

## Development

Install dependencies separately for the backend and desktop app:

```powershell
cd backend
npm install

cd ..\manga-nexus
npm install
```

Run the full Electron app:

```powershell
cd manga-nexus
npm run electron:dev
```

Useful validation commands:

```powershell
npm run lint -- --quiet
npm run check:hook-order
npm run build
```

## Packaging

From `manga-nexus/`:

```powershell
npm run validate
npm run dist
```

This creates Windows NSIS and portable artifacts in `manga-nexus/dist-electron`.

See `docs/PUBLISHING.md` before tagging a public release.

## Monetization Notes

The safest low-key monetization path is support and convenience, not content access:

- GitHub Sponsors, Ko-fi, or a small support link in settings
- Optional supporter themes or app polish features
- Paid convenience services such as encrypted settings sync or backup
- Early-access builds for supporters

Avoid monetizing access to manga/source content unless licensing is handled separately.
