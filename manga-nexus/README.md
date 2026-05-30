# akaReader Desktop

This folder contains the Electron shell and React/Vite renderer for akaReader.

## Scripts

```powershell
npm run dev
```

Starts the Vite renderer only. The backend and Suwayomi must already be running for full functionality.

```powershell
npm run electron:dev
```

Starts Vite and Electron together. Electron manages the local backend and Suwayomi runtime.

```powershell
npm run lint -- --quiet
npm run validate
npm run check:hook-order
npm run build
```

Runs the practical local validation set.

```powershell
npm run dist
```

Builds the Windows installer and portable app.

## Runtime Notes

- `electron-main.js` supervises backend and Suwayomi startup.
- `preload.js` exposes the safe renderer IPC surface.
- `src/App.jsx` owns most app state, navigation, downloads, and persistence.
- `src/components/reader/Reader.jsx` owns the active reading session.
- Source sites that require browser verification open in a dedicated Electron popup through `window.electronAPI.verifySourceUrl`.
