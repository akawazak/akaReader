// electron-main.js
const { app, BrowserWindow, Menu, shell, dialog, Tray, globalShortcut, ipcMain, screen } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');

// Auto updater — gracefully skip if not available (dev mode)
let autoUpdater = null;
try { autoUpdater = require('electron-updater').autoUpdater; } catch {}

const isDev = !app.isPackaged;
let mainWindow, splashWindow, tray, suwayomiProcess, serverProcess;
let isQuitting = false;
let isRestarting = false;
let startupPhase = 'initializing'; // Track startup progress

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
  } else if (splashWindow) {
    splashWindow.focus();
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
  catch { return { closeToTray: true, startWithWindows: false }; }
}

function saveElectronSettings(obj) {
  try { fs.writeFileSync(settingsPath, JSON.stringify(obj)); } catch {}
}

let electronSettings = loadElectronSettings();

// ── Windows Startup Item ───────────────────────────────────────────────────
function setWindowsStartup(enable) {
  if (process.platform !== 'win32') return;
  
  const { exec } = require('child_process');
  const appName = 'akaReader';
  const appPath = process.execPath;
  
  if (enable) {
    // Add to startup registry
    exec(`reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "${appName}" /t REG_SZ /d "${appPath}" /f`, (err) => {
      if (err) console.error('[startup] Failed to add to startup:', err);
      else console.log('[startup] Added to Windows startup');
    });
  } else {
    // Remove from startup registry
    exec(`reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "${appName}" /f`, (err) => {
      if (err && !err.message.includes('unable to find')) console.error('[startup] Failed to remove from startup:', err);
      else console.log('[startup] Removed from Windows startup');
    });
  }
}

// ── IPC ────────────────────────────────────────────────────────────────────
ipcMain.on('set-close-to-tray', (_, val) => {
  electronSettings.closeToTray = val;
  saveElectronSettings(electronSettings);
});

ipcMain.handle('get-close-to-tray', () => electronSettings.closeToTray);

ipcMain.on('set-start-with-windows', (_, val) => {
  electronSettings.startWithWindows = val;
  saveElectronSettings(electronSettings);
  setWindowsStartup(val);
});

ipcMain.handle('get-start-with-windows', () => electronSettings.startWithWindows);

// Send startup progress to renderer
function sendProgress(status, message) {
  startupPhase = status;
  mainWindow?.webContents?.send('startup-progress', { status, message });
  console.log(`[startup] ${status}: ${message}`);
}

// ── Restart services IPC ───────────────────────────────────────────────────
ipcMain.handle('restart-services', async () => {
  if (isRestarting) {
    console.log('[restart] Already restarting, ignoring duplicate request');
    return false;
  }
  isRestarting = true;
  
  try {
    sendProgress('restarting', 'Stopping services...');
    killAll();
    await new Promise(r => setTimeout(r, 1000));
    
    sendProgress('starting', 'Starting Suwayomi...');
    const alreadyRunning = await isSuwayomiRunning();
    if (!alreadyRunning) {
      startSuwayomi();
      await new Promise(r => setTimeout(r, 4000)); // Reduced wait
    }
    
    sendProgress('starting', 'Starting backend...');
    startServer();
    
    sendProgress('connecting', 'Waiting for backend...');
    const ready = await waitFor('http://localhost:3001/api/health', 15, 1000);
    sendProgress(ready ? 'online' : 'offline', ready ? 'Services ready' : 'Failed to start');
    return ready;
  } catch (e) {
    sendProgress('error', e.message);
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
    req.setTimeout(1000, () => { req.destroy(); resolve(false); });
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
  
  // OPTIMIZED JVM flags for faster startup
  const javaFlags = [
    '-Djava.awt.headless=true',
    '-XX:+UseG1GC',
    '-XX:MaxRAM=512m',
    '-Xms64m',
    '-Xmx512m',
    '-XX:+UseStringDeduplication',
    '-XX:+OptimizeStringConcat',
    '-jar', jarPath
  ];
  
  suwayomiProcess = spawn('java', javaFlags, {
    cwd: backendDir,
    stdio: 'pipe',
    windowsHide: true,
  });
  
  suwayomiProcess.stdout.on('data', d => {
    const msg = d.toString().trim();
    if (msg.includes('Started Application')) {
      sendProgress('starting', 'Suwayomi ready');
    }
  });
  
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
async function waitFor(url, retries = 15, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try { 
      const res = await fetch(url); 
      if (res.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, delay));
  }
  return false;
}

// ── Splash Window ──────────────────────────────────────────────────────────
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    alwaysOnTop: true,
    center: true,
    resizable: false,
    skipTaskbar: true,
    backgroundColor: '#0a0a0f',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: iconPath,
    show: false
  });

  // Create inline splash HTML
  const splashHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          background: #0a0a0f;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          color: #f97316;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          overflow: hidden;
        }
        .logo {
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 40px;
          font-weight: bold;
          color: white;
          margin-bottom: 20px;
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.9; }
        }
        .title {
          font-size: 24px;
          font-weight: 600;
          margin-bottom: 10px;
          color: #fff;
        }
        .status {
          font-size: 14px;
          color: #888;
          margin-bottom: 20px;
        }
        .loader {
          width: 200px;
          height: 3px;
          background: #1a1a2e;
          border-radius: 3px;
          overflow: hidden;
          position: relative;
        }
        .loader-bar {
          position: absolute;
          left: 0;
          top: 0;
          height: 100%;
          width: 40%;
          background: linear-gradient(90deg, #f97316, #ea580c);
          border-radius: 3px;
          animation: slide 1.5s ease-in-out infinite;
        }
        @keyframes slide {
          0% { left: -40%; }
          100% { left: 100%; }
        }
      </style>
    </head>
    <body>
      <div class="logo">R</div>
      <div class="title">akaReader</div>
      <div class="status" id="status">Starting up...</div>
      <div class="loader"><div class="loader-bar"></div></div>
    </body>
    </html>
  `;
  
  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`);
  splashWindow.once('ready-to-show', () => splashWindow.show());
}

function updateSplashStatus(message) {
  if (!splashWindow || splashWindow.isDestroyed()) return;
  splashWindow.webContents.executeJavaScript(`
    document.getElementById('status').textContent = ${JSON.stringify(message)};
  `).catch(() => {});
}

function closeSplash() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
}

// ── Tray ────────────────────────────────────────────────────────────
function createTray() {
  if (tray) {
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
    show: false, // Don't show until ready
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

  // Show main window when content is ready, then close splash
  mainWindow.webContents.on('dom-ready', () => {
    mainWindow.show();
    closeSplash();
  });
}

// ── Kill all ───────────────────────────────────────────────────────────────
function killAll() {
  console.log('[killAll] Terminating child processes...');
  
  if (serverProcess) { 
    serverProcess.kill('SIGTERM');
    setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        serverProcess.kill('SIGKILL');
      }
    }, 2000);
    serverProcess = null; 
  }
  
  if (suwayomiProcess) { 
    suwayomiProcess.kill('SIGTERM');
    setTimeout(() => {
      if (suwayomiProcess && !suwayomiProcess.killed) {
        suwayomiProcess.kill('SIGKILL');
      }
    }, 2000);
    suwayomiProcess = null; 
  }
}

// ── Fast Startup Check ─────────────────────────────────────────────────────
async function fastStartupCheck() {
  // Quick check if services are already running (from previous session)
  const [suwayomiRunning, serverRunning] = await Promise.all([
    isSuwayomiRunning(),
    waitFor('http://localhost:3001/api/health', 1, 500).catch(() => false)
  ]);
  
  return { suwayomiRunning, serverRunning };
}

// ── Start ──────────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  
  // 1. SHOW SPLASH IMMEDIATELY (within 100ms)
  createSplashWindow();
  updateSplashStatus('Checking services...');
  
  // 2. Check if already running (fast path)
  const { suwayomiRunning, serverRunning } = await fastStartupCheck();
  
  // 3. Create main window in background (hidden)
  createTray();
  createMainWindow();
  
  // 4. Start services if needed (async, don't block UI)
  if (!suwayomiRunning) {
    updateSplashStatus('Starting Suwayomi...');
    startSuwayomi();
    // Reduced wait time - don't block for 6 seconds
    await new Promise(r => setTimeout(r, 2000));
  } else {
    updateSplashStatus('Suwayomi already running');
  }

  if (!serverRunning) {
    updateSplashStatus('Starting backend...');
    startServer();
  } else {
    updateSplashStatus('Backend already running');
  }

  // 5. Wait for backend in background with progress updates
  updateSplashStatus('Connecting...');
  let attempts = 0;
  const maxAttempts = 20;
  
  while (attempts < maxAttempts) {
    const ready = await waitFor('http://localhost:3001/api/health', 1, 800);
    if (ready) {
      sendProgress('online', 'Ready');
      updateSplashStatus('Ready!');
      // Splash closes when main window dom-ready fires
      break;
    }
    attempts++;
    updateSplashStatus(`Connecting... (${attempts}/${maxAttempts})`);
  }
  
  if (attempts >= maxAttempts) {
    updateSplashStatus('Connection failed');
    sendProgress('offline', 'Failed to connect');
    // Still show main window, let user retry
    setTimeout(closeSplash, 2000);
  }

  // Setup Windows startup if enabled
  if (electronSettings.startWithWindows) {
    setWindowsStartup(true);
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