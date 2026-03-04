// electron-main.js
const { app, BrowserWindow, Menu, shell, dialog, Tray, globalShortcut, ipcMain, screen, utilityProcess } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

// Auto updater — gracefully skip if not available (dev mode)
let autoUpdater = null;
try { autoUpdater = require('electron-updater').autoUpdater; } catch {}

const isDev = !app.isPackaged;
let mainWindow, tray, suwayomiProcess, serverProcess;
let isQuitting = false;

// ── Paths ──────────────────────────────────────────────────────────────────
const backendDir = isDev
  ? path.join(__dirname, '..', 'backend')
  : path.join(process.resourcesPath, 'backend');

const jarPath    = path.join(backendDir, 'Suwayomi-Server-v2.1.1867.jar');
const serverPath = path.join(backendDir, 'server.js');
const iconPath   = path.join(__dirname, 'public', 'icon.ico');
const preloadPath = path.join(__dirname, 'preload.js');

// ── Persist window state ───────────────────────────────────────────────────
const statePath    = path.join(app.getPath('userData'), 'window-state.json');
const settingsPath = path.join(app.getPath('userData'), 'electron-settings.json');

function loadWindowState() {
  try { return JSON.parse(fs.readFileSync(statePath, 'utf8')); }
  catch { return { width: 1400, height: 900 }; }
}

function saveWindowState(win) {
  try { fs.writeFileSync(statePath, JSON.stringify(win.getBounds())); } catch {}
}

function loadElectronSettings() {
  try { return JSON.parse(fs.readFileSync(settingsPath, 'utf8')); }
  catch { return { closeToTray: true }; }
}

function saveElectronSettings(obj) {
  try { fs.writeFileSync(settingsPath, JSON.stringify(obj)); } catch {}
}

let electronSettings = loadElectronSettings();

// ── IPC ────────────────────────────────────────────────────────────────────
ipcMain.on('set-close-to-tray', (_, val) => {
  electronSettings.closeToTray = val;
  saveElectronSettings(electronSettings);
});

ipcMain.handle('get-close-to-tray', () => electronSettings.closeToTray);

// ── Restart services IPC ───────────────────────────────────────────────────
ipcMain.handle('restart-services', async () => {
  try {
    killAll();
    await new Promise(r => setTimeout(r, 1500));
    const alreadyRunning = await isSuwayomiRunning();
    if (!alreadyRunning) {
      startSuwayomi();
      await new Promise(r => setTimeout(r, 6000));
    }
    startServer();
    const ready = await waitFor('http://localhost:3001/api/health', 20, 1500);
    mainWindow?.webContents?.send('services-status', ready ? 'online' : 'offline');
    return ready;
  } catch (e) {
    mainWindow?.webContents?.send('services-status', 'offline');
    return false;
  }
});

// ── Check if Suwayomi already running ─────────────────────────────────────
function isSuwayomiRunning() {
  return new Promise(resolve => {
    const req = http.get('http://localhost:4567', () => resolve(true));
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => { req.destroy(); resolve(false); });
  });
}

// ── Start Suwayomi ─────────────────────────────────────────────────────────
function startSuwayomi() {
  console.log('[suwayomi] starting:', jarPath);
  suwayomiProcess = spawn('java', ['-Djava.awt.headless=true', '-jar', jarPath], {
    cwd: backendDir,
    stdio: 'pipe',
    windowsHide: true,
  });
  suwayomiProcess.stdout.on('data', d => console.log('[suwayomi]', d.toString().trim()));
  suwayomiProcess.stderr.on('data', d => console.log('[suwayomi:err]', d.toString().trim()));
  suwayomiProcess.on('close', code => console.log('[suwayomi] exited', code));
}

// ── Start backend ──────────────────────────────────────────────────────────
// IMPORTANT: utilityProcess.fork() instead of spawn(process.execPath, [...]).
// In packaged Electron, process.execPath IS the Electron binary (akaReader.exe).
// spawn(process.execPath, ['server.js']) re-launches a full Electron instance
// for every call — that's the "too many processes / memory leak" you saw.
// utilityProcess.fork() is Electron's proper API: runs server.js as a lightweight
// background Node.js worker with no browser window attached.
function startServer() {
  if (serverProcess) return; // guard: never double-spawn
  console.log('[server] starting:', serverPath);
  serverProcess = utilityProcess.fork(serverPath, [], {
    cwd: backendDir,
    env: { ...process.env, PORT: '3001', SUWAYOMI_URL: 'http://localhost:4567' },
    stdio: 'pipe',
    serviceName: 'akaReader-backend',
  });
  serverProcess.on('spawn', () => console.log('[server] spawned OK'));
  serverProcess.on('exit', code => {
    console.log('[server] exited', code);
    serverProcess = null;
    if (!isQuitting) mainWindow?.webContents?.send('services-status', 'crashed');
  });
}

// ── Wait for URL ───────────────────────────────────────────────────────────
async function waitFor(url, retries = 40, delay = 1500) {
  for (let i = 0; i < retries; i++) {
    try { await fetch(url); return true; } catch {}
    await new Promise(r => setTimeout(r, delay));
  }
  return false;
}

// ── Main window ────────────────────────────────────────────────────────────
function createTray() {
  tray = new Tray(iconPath);
  tray.setToolTip('akaReader');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open akaReader', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { type: 'separator' },
    { label: 'Quit', click: () => { isQuitting = true; app.quit(); } },
  ]));
  tray.on('click', () => {
    if (!mainWindow) return;
    mainWindow.isVisible() ? mainWindow.hide() : (mainWindow.show(), mainWindow.focus());
  });
}

// ── Main window ────────────────────────────────────────────────────────────
function createMainWindow() {
  const state = loadWindowState();
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  let { x, y } = state;
  if (x !== undefined && (x < 0 || x > sw)) x = undefined;
  if (y !== undefined && (y < 0 || y > sh)) y = undefined;

  mainWindow = new BrowserWindow({
    width: state.width || 1400,
    height: state.height || 900,
    x, y,
    minWidth: 960, minHeight: 640,
    backgroundColor: '#0a0a0f',
    show: false,
    titleBarStyle: 'hiddenInset',
    titleBarOverlay: { color: '#0f0f18', symbolColor: '#f97316', height: 36 },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      preload: preloadPath,
    },
    icon: iconPath,
  });

  ['resize', 'move'].forEach(e => mainWindow.on(e, () => saveWindowState(mainWindow)));

  mainWindow.on('close', e => {
    if (!isQuitting && electronSettings.closeToTray) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());
}

// ── Kill all ───────────────────────────────────────────────────────────────
function killAll() {
  if (serverProcess)   { serverProcess.kill();   serverProcess = null; }
  if (suwayomiProcess) { suwayomiProcess.kill(); suwayomiProcess = null; }
}

// ── Start ──────────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);

  const alreadyRunning = await isSuwayomiRunning();
  if (!alreadyRunning) {
    startSuwayomi();
    await new Promise(r => setTimeout(r, 6000));
  } else {
    console.log('[suwayomi] already running, skipping');
  }

  startServer();

  // Create main window immediately — it shows the built-in startup screen
  // while the backend warms up (no blank black rectangle)
  createTray();
  createMainWindow();

  const ready = await waitFor('http://localhost:3001/api/health');
  if (!ready) {
    dialog.showErrorBox('Startup failed', 'Backend did not respond.\n\nCheck Java is installed: java -version\n\nThen relaunch akaReader.');
  }

  globalShortcut.register('CommandOrControl+Shift+M', () => {
    if (!mainWindow) return;
    mainWindow.isVisible() && mainWindow.isFocused() ? mainWindow.hide() : (mainWindow.show(), mainWindow.focus());
  });

  // ── Auto-updater ────────────────────────────────────────────────────────
  if (autoUpdater && !isDev) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('update-available', (info) => {
      mainWindow?.webContents?.send('services-status', `update-available:${info.version}`);
    });
    autoUpdater.on('update-downloaded', () => {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update ready',
        message: 'A new version of akaReader has been downloaded. Restart to install it.',
        buttons: ['Restart now', 'Later'],
      }).then(({ response }) => {
        if (response === 0) { isQuitting = true; autoUpdater.quitAndInstall(); }
      });
    });
    autoUpdater.on('error', e => console.error('[updater]', e.message));
    setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 10000);
    setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 1000 * 60 * 60 * 4); // every 4h
  }

  app.on('activate', () => {
    if (!mainWindow) createMainWindow();
    else { mainWindow.show(); mainWindow.focus(); }
  });
});

app.on('window-all-closed', () => { /* stay in tray */ });
app.on('before-quit', () => { isQuitting = true; globalShortcut.unregisterAll(); killAll(); });