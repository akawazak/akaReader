// electron-main.js
const { app, BrowserWindow, Menu, shell, dialog, Tray, globalShortcut, ipcMain, screen } = require('electron');
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
let isRestarting = false;

// SINGLE INSTANCE LOCK - Prevent multiple app instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log('[app] Another instance is already running, quitting...');
  app.quit();
  process.exit(0);
}

app.on('second-instance', (event, commandLine, workingDirectory) => {
  console.log('[app] Second instance detected, focusing existing window');
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

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
  if (isRestarting) {
    console.log('[restart] Already restarting, ignoring duplicate request');
    return false;
  }
  isRestarting = true;
  
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
  } finally {
    isRestarting = false;
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
  
  if (suwayomiProcess) {
    console.log('[suwayomi] Killing existing process first');
    suwayomiProcess.kill('SIGTERM');
    suwayomiProcess = null;
  }
  
  suwayomiProcess = spawn('java', ['-Djava.awt.headless=true', '-jar', jarPath], {
    cwd: backendDir,
    stdio: 'pipe',
    windowsHide: true,
  });
  
  suwayomiProcess.stdout.on('data', d => console.log('[suwayomi]', d.toString().trim()));
  suwayomiProcess.stderr.on('data', d => console.log('[suwayomi:err]', d.toString().trim()));
  
  suwayomiProcess.on('close', code => {
    console.log('[suwayomi] exited', code);
    suwayomiProcess = null;
  });
  
  suwayomiProcess.on('error', err => {
    console.error('[suwayomi] failed to start:', err.message);
    suwayomiProcess = null;
  });
}

// ── Start backend ──────────────────────────────────────────────────────────
function startServer() {
  console.log('[server] starting:', serverPath);
  
  if (serverProcess) {
    console.log('[server] Killing existing process first');
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
  
  // CRITICAL FIX: Use 'node' command instead of process.execPath
  // process.execPath in production is the Electron EXE, not Node!
  const nodeCommand = isDev ? process.execPath : 'node';
  
  serverProcess = spawn(nodeCommand, [serverPath], {
    cwd: backendDir,
    env: { ...process.env, PORT: '3001', SUWAYOMI_URL: 'http://localhost:4567' },
    stdio: 'pipe',
    windowsHide: true,
  });
  
  serverProcess.stdout.on('data', d => console.log('[server]', d.toString().trim()));
  serverProcess.stderr.on('data', d => console.log('[server:err]', d.toString().trim()));
  
  serverProcess.on('close', code => {
    console.log('[server] exited', code);
    serverProcess = null;
    if (!isQuitting && !isRestarting) {
      mainWindow?.webContents?.send('services-status', 'crashed');
    }
  });
  
  serverProcess.on('error', err => {
    console.error('[server] failed to start:', err.message);
    serverProcess = null;
  });
}

// ── Wait for URL ───────────────────────────────────────────────────────────
async function waitFor(url, retries = 40, delay = 1500) {
  for (let i = 0; i < retries; i++) {
    try { 
      const res = await fetch(url); 
      if (res.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, delay));
  }
  return false;
}

// ── Tray ────────────────────────────────────────────────────────────
function createTray() {
  if (tray) {
    console.log('[tray] Already exists, destroying old one');
    tray.destroy();
  }
  
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
  if (mainWindow) {
    console.log('[window] Already exists, focusing');
    mainWindow.show();
    mainWindow.focus();
    return;
  }
  
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
  
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { 
    shell.openExternal(url); 
    return { action: 'deny' }; 
  });

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
  console.log('[killAll] Terminating child processes...');
  
  if (serverProcess) { 
    serverProcess.kill('SIGTERM');
    setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        console.log('[killAll] Force killing server');
        serverProcess.kill('SIGKILL');
      }
    }, 2000);
    serverProcess = null; 
  }
  
  if (suwayomiProcess) { 
    suwayomiProcess.kill('SIGTERM');
    setTimeout(() => {
      if (suwayomiProcess && !suwayomiProcess.killed) {
        console.log('[killAll] Force killing suwayomi');
        suwayomiProcess.kill('SIGKILL');
      }
    }, 2000);
    suwayomiProcess = null; 
  }
}

// ── Start ──────────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);

  createTray();
  createMainWindow();

  const suwayomiRunning = await isSuwayomiRunning();
  const serverRunning = await waitFor('http://localhost:3001/api/health', 1, 500).catch(() => false);
  
  if (!suwayomiRunning) {
    console.log('[startup] Starting Suwayomi...');
    startSuwayomi();
  } else {
    console.log('[startup] Suwayomi already running, skipping');
  }

  if (!serverRunning) {
    console.log('[startup] Starting backend server...');
    startServer();
  } else {
    console.log('[startup] Backend already running, skipping');
  }

  const ready = await waitFor('http://localhost:3001/api/health', 30, 1000);
  if (!ready) {
    dialog.showErrorBox('Startup failed', 'Backend did not respond.\n\nCheck Java is installed: java -version\n\nThen relaunch akaReader.');
  } else {
    console.log('[startup] All services ready');
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
    setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 1000 * 60 * 60 * 4);
  }

  app.on('activate', () => {
    if (!mainWindow) createMainWindow();
    else { mainWindow.show(); mainWindow.focus(); }
  });
});

app.on('window-all-closed', () => { /* stay in tray */ });

app.on('before-quit', () => { 
  isQuitting = true; 
  globalShortcut.unregisterAll(); 
  killAll(); 
});

process.on('exit', killAll);
process.on('SIGINT', () => { isQuitting = true; killAll(); process.exit(0); });
process.on('SIGTERM', () => { isQuitting = true; killAll(); process.exit(0); });