# akaReader

**A polished desktop manga reader for Windows and Linux — powered by Suwayomi.**

akaReader gives you a native, offline-capable reading experience with a built-in Suwayomi runtime. Browse sources, manage your library, and read chapters even without internet — all from a single, self-contained Electron app.

<!-- Add a screenshot PNG to manga-nexus/public/screenshot.png to show it here -->

---

## Features

### Reading
- **Multiple reading modes** — paged, scroll, and webtoon styles
- **Chapter preloading** — seamless next-chapter continuation
- **Progress tracking** — remembers exactly where you left off
- **Reading stats** — time spent reading, history per manga

### Library
- **Personal library** — add manga to your own collection
- **Categories** — organize with custom tags
- **Search & browse** — explore any Suwayomi source and extension

### Offline
- **Download chapters** — save pages to IndexedDB
- **Crash-safe download queue** — interrupted chapters resume after relaunch and transient failures retry automatically
- **Read anywhere** — chapters load from local storage, no network needed
- **Cover and metadata** — cached alongside chapter data

### Desktop
- **Windows installer** — one-click NSIS setup
- **Portable build** — run from anywhere, no install required
- **Linux packages** — AppImage and Debian package builds
- **Auto-updates** — patches download in the background
- **Safety backups** — validated export/restore plus automatic backups before updates
- **One-click health check** — identifies and repairs local API, Java, Suwayomi, storage, and helper issues
- **System tray** — minimize to tray, keep Suwayomi running
- **Source verification** — handles browser-challenge sites (Cloudflare, etc.)

---

## Tech Stack

| Layer | Tech |
|---|---|
| Desktop shell | Electron 43 |
| Frontend | React 18 + Vite 8 |
| Backend proxy | Node.js + Express |
| Manga runtime | Suwayomi (bundled) |
| Icons | Lucide React |
| Packaging | electron-builder |
| Updates | electron-updater |

---

## Quick Start

### Prerequisites
- **Windows 10/11 or x64 Linux**
- **Node.js 22.12+**
- **Java 21.0.11+** (for Suwayomi — privately auto-installed if missing)

### Install dependencies

```powershell
cd backend
npm install

cd ..\manga-nexus
npm install
```

### Run in development

```powershell
cd manga-nexus
npm run electron:dev
```

> First run will download the Suwayomi JAR if it's not already present. Give it a minute — it only happens once.

### Validate before packaging

```powershell
cd manga-nexus
npm run validate
```

### Build Windows installer / portable

```powershell
cd manga-nexus
npm run dist
```

### Build Linux AppImage / Debian package

```bash
cd manga-nexus
npm run dist:linux
```

Output lands in `manga-nexus/dist-electron/`.

---

## Project Structure

```
akaReader/
├── backend/               # Express proxy + Suwayomi JAR
│   ├── server.js          # REST API fronting Suwayomi
│   └── package.json
├── manga-nexus/           # Electron app
│   ├── electron-main.js   # Main process, service startup
│   ├── preload.js         # IPC bridge
│   └── src/                # React renderer
│       ├── App.jsx         # Main state and UI
│       ├── components/     # Reader, extensions, etc.
│       └── views/          # Home, browse, detail views
├── docs/                  # Architecture & dev notes
└── README.md
```

---

## Architecture

```
React renderer → Express proxy (3001) → Suwayomi (4567) → Source extensions
                       ↑
                  Electron main process supervises both
```

The backend adds caching, retries, and a simplified REST surface. Offline chapters are stored in the renderer's IndexedDB — no backend involvement.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full picture.

---

## Configuration

Settings are stored in `localStorage` and cover:
- Reading mode defaults (paged / scroll / webtoon)
- Image quality and preload behavior
- Library view preferences
- App-level preferences (tray, minimize behavior)

Suwayomi source extensions are managed through the app's Extensions tab.

---

## Monetization

akaReader is free and open source. If you want to support development:

- GitHub Sponsors
- Ko-fi
- Convenience features (themes, encrypted settings sync) — never content access

The app does not provide manga content. It depends on user-installed Suwayomi extensions and their upstream sites.

---

## Contributing

Found a bug or want a feature? Open an issue. PRs welcome — run `npm run validate` before submitting to catch lint and hook-order issues.

---

## License

MIT — add a `LICENSE` file to the repo root to enable.
