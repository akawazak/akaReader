/**
 * akaReader — Electron Main Process v2.0
 * Adds: Suwayomi auto-download, JRE auto-download, Windows service support
 */
const {
  app, BrowserWindow, Menu, shell, dialog,
  Tray, globalShortcut, ipcMain, screen, utilityProcess
} = require('electron');
const path   = require('path');
const http   = require('http');
const https  = require('https');
const fs     = require('fs');
const cp     = require('child_process');

let autoUpdater = null;
try { autoUpdater = require('electron-updater').autoUpdater; } catch {}

const isDev = !app.isPackaged;

let mainWindow   = null;
let tray         = null;
let serverProc   = null;
let suwayomiProc = null;
let isQuitting   = false;
let serviceMode  = false;

// ── Single instance ───────────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); process.exit(0); }
app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show(); mainWindow.focus();
});

// ── Paths ─────────────────────────────────────────────────────────────────────
const backendDir = isDev
  ? path.join(__dirname, '..', 'backend')
  : path.join(process.resourcesPath, 'backend');

const serverPath  = path.join(backendDir, 'server.js');
const iconPath    = path.join(__dirname, 'public', 'icon.ico');
const preloadPath = path.join(__dirname, 'preload.js');
const userData    = app.getPath('userData');
const userExtDir  = path.join(userData, 'extensions');
const jarPath     = path.join(userData, 'suwayomi.jar');
const jreDir      = path.join(userData, 'jre');
const javaExe     = path.join(jreDir, 'bin', 'java.exe');
const nssmExe     = path.join(userData, 'nssm.exe');

fs.mkdirSync(userExtDir, { recursive: true });
fs.mkdirSync(path.join(userData, 'suwayomi-data'), { recursive: true });

// ── Settings ──────────────────────────────────────────────────────────────────
const settingsPath = path.join(userData, 'electron-settings.json');
const statePath    = path.join(userData, 'window-state.json');

function loadSettings() {
  try { return JSON.parse(fs.readFileSync(settingsPath, 'utf8')); }
  catch { return { closeToTray: true, startWithWindows: false }; }
}
function saveSettings(obj) {
  try { fs.writeFileSync(settingsPath, JSON.stringify(obj)); } catch {}
}
function loadWindowState() {
  try { return JSON.parse(fs.readFileSync(statePath, 'utf8')); }
  catch { return { width: 1400, height: 900 }; }
}
function saveWindowState(win) {
  try { fs.writeFileSync(statePath, JSON.stringify(win.getBounds())); } catch {}
}

let appSettings = loadSettings();

// ── Status helper ─────────────────────────────────────────────────────────────
function sendStatus(status) {
  if (mainWindow && !mainWindow.isDestroyed())
    mainWindow.webContents.send('services-status', status);
  console.log('[status]', status);
}

// ── HTTPS download with progress ──────────────────────────────────────────────
function download(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const doGet = (url) => {
      https.get(url, { headers: { 'User-Agent': 'akaReader/2.0' } }, res => {
        // Follow redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close(); return doGet(res.headers.location);
        }
        if (res.statusCode !== 200) {
          file.close(); fs.unlink(dest, () => {});
          return reject(new Error('Download failed: HTTP ' + res.statusCode + ' ' + url));
        }
        const total = parseInt(res.headers['content-length'] || '0', 10);
        let received = 0;
        res.on('data', chunk => {
          received += chunk.length;
          if (total && onProgress) onProgress(Math.round(received / total * 100));
        });
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
        file.on('error', e => { fs.unlink(dest, () => {}); reject(e); });
      }).on('error', e => { fs.unlink(dest, () => {}); reject(e); });
    };
    doGet(url);
  });
}

// ── Get latest Suwayomi JAR URL from GitHub releases ─────────────────────────
async function getLatestJarUrl() {
  return new Promise((resolve, reject) => {
    https.get('https://api.github.com/repos/Suwayomi/Suwayomi-Server/releases/latest',
      { headers: { 'User-Agent': 'akaReader/2.0', 'Accept': 'application/vnd.github.v3+json' } },
      res => {
        let data = '';
        res.on('data', d => data += d);
        res.on('end', () => {
          try {
            const release = JSON.parse(data);
            const asset   = (release.assets || []).find(a => a.name.endsWith('.jar'));
            if (asset) resolve({ url: asset.browser_download_url, version: release.tag_name });
            else reject(new Error('No JAR found in latest release'));
          } catch (e) { reject(e); }
        });
      }
    ).on('error', reject);
  });
}

// ── Get latest JRE download URL (Eclipse Temurin 21 Windows x64) ─────────────
function getJreUrl() {
  return 'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.4%2B7/OpenJDK21U-jre_x64_windows_hotspot_21.0.4_7.zip';
}

// ── Extract ZIP ───────────────────────────────────────────────────────────────
function extractZip(zipPath, destDir) {
  return new Promise((resolve, reject) => {
    // Use PowerShell to extract — always available on Windows
    const cmd = `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`;
    cp.exec(cmd, { windowsHide: true }, (err) => {
      if (err) reject(err); else resolve();
    });
  });
}

// ── Find java.exe ─────────────────────────────────────────────────────────────
function findJava() {
  if (fs.existsSync(javaExe)) return javaExe;
  if (process.env.JAVA_HOME) {
    const p = path.join(process.env.JAVA_HOME, 'bin', 'java.exe');
    if (fs.existsSync(p)) return p;
  }
  return 'java'; // fallback to system PATH
}

// ── Ensure JRE is downloaded ──────────────────────────────────────────────────
async function ensureJre() {
  if (fs.existsSync(javaExe)) return; // already have it
  sendStatus('downloading-jre');
  console.log('[jre] Downloading JRE...');

  const zipPath = path.join(userData, 'jre-download.zip');
  await download(getJreUrl(), zipPath, pct => {
    if (pct % 10 === 0) sendStatus('downloading-jre:' + pct);
  });

  sendStatus('extracting-jre');
  const extractDir = path.join(userData, 'jre-extract');
  await extractZip(zipPath, extractDir);

  // Find the extracted JRE folder (name varies by version)
  const entries = fs.readdirSync(extractDir);
  const jreFolder = entries.find(e => e.startsWith('jdk') || e.startsWith('OpenJDK'));
  if (!jreFolder) throw new Error('Could not find JRE folder in ZIP');

  if (fs.existsSync(jreDir)) fs.rmSync(jreDir, { recursive: true });
  fs.renameSync(path.join(extractDir, jreFolder), jreDir);

  // Cleanup
  try { fs.unlinkSync(zipPath); } catch {}
  try { fs.rmSync(extractDir, { recursive: true }); } catch {}

  console.log('[jre] JRE ready at', jreDir);
}

// ── Ensure Suwayomi JAR is downloaded ────────────────────────────────────────
async function ensureJar() {
  if (fs.existsSync(jarPath)) return; // already have it
  sendStatus('downloading-suwayomi');
  console.log('[jar] Downloading Suwayomi...');

  const { url, version } = await getLatestJarUrl();
  console.log('[jar] Latest version:', version, url);

  await download(url, jarPath, pct => {
    if (pct % 5 === 0) sendStatus('downloading-suwayomi:' + pct);
  });

  console.log('[jar] Suwayomi JAR ready at', jarPath);
}

// ── Ensure NSSM is available ──────────────────────────────────────────────────
async function ensureNssm() {
  if (fs.existsSync(nssmExe)) return;
  const zipPath = path.join(userData, 'nssm.zip');
  await download('https://nssm.cc/release/nssm-2.24.zip', zipPath, null);
  const extractDir = path.join(userData, 'nssm-extract');
  await extractZip(zipPath, extractDir);
  const src = path.join(extractDir, 'nssm-2.24', 'win64', 'nssm.exe');
  if (fs.existsSync(src)) fs.copyFileSync(src, nssmExe);
  try { fs.unlinkSync(zipPath); } catch {}
  try { fs.rmSync(extractDir, { recursive: true }); } catch {}
}

// ── Windows Service ───────────────────────────────────────────────────────────
function isServiceRunning() {
  try {
    const out = cp.execSync('sc query AkaReaderSuwayomi', { encoding: 'utf8', windowsHide: true });
    return out.includes('RUNNING');
  } catch { return false; }
}

async function installWindowsService() {
  await ensureNssm();
  const java     = findJava();
  const dataRoot = path.join(userData, 'suwayomi-data');
  const cmds = [
    `"${nssmExe}" install AkaReaderSuwayomi "${java}"`,
    `"${nssmExe}" set AkaReaderSuwayomi AppParameters "-jar \\"${jarPath}\\" --server.port=4567 --dataRoot=\\"${dataRoot}\\""`,
    `"${nssmExe}" set AkaReaderSuwayomi AppDirectory "${userData}"`,
    `"${nssmExe}" set AkaReaderSuwayomi Start SERVICE_AUTO_START`,
    `"${nssmExe}" set AkaReaderSuwayomi AppStdout "${path.join(userData, 'suwayomi.log')}"`,
    `"${nssmExe}" set AkaReaderSuwayomi AppStderr "${path.join(userData, 'suwayomi-err.log')}"`,
    `net start AkaReaderSuwayomi`,
  ];
  for (const cmd of cmds) {
    cp.execSync(cmd, { windowsHide: true });
  }
}

async function uninstallWindowsService() {
  try { cp.execSync('net stop AkaReaderSuwayomi', { windowsHide: true }); } catch {}
  try { cp.execSync('sc delete AkaReaderSuwayomi', { windowsHide: true }); } catch {}
}

// ── Start Suwayomi ────────────────────────────────────────────────────────────
function waitForSuwayomi(timeoutMs = 90000) {
  return new Promise((resolve, reject) => {
    const start   = Date.now();
    const attempt = () => {
      if (Date.now() - start > timeoutMs) return reject(new Error('Suwayomi startup timeout'));
      http.get('http://localhost:4567/api/v1/settings', res => {
        res.resume();
        if (res.statusCode < 500) return resolve(true);
        setTimeout(attempt, 1500);
      }).on('error', () => setTimeout(attempt, 1500));
    };
    attempt();
  });
}

async function startSuwayomi() {
  // Already running? (service mode)
  try {
    await Promise.race([waitForSuwayomi(2000), new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 2500))]);
    console.log('[suwayomi] Already running');
    serviceMode = true;
    return true;
  } catch {}

  const java     = findJava();
  const dataRoot = path.join(userData, 'suwayomi-data');

  console.log('[suwayomi] Launching JAR...');
  sendStatus('starting-suwayomi');

  suwayomiProc = cp.spawn(java, [
    '-Xmx512m',
    '-jar', jarPath,
    '--server.port=4567',
    '--dataRoot=' + dataRoot,
  ], {
    cwd:         userData,
    stdio:       ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    detached:    false,
  });

  suwayomiProc.stdout.on('data', d => {
    const line = d.toString().trim();
    if (line) console.log('[suwayomi]', line.slice(0, 120));
  });
  suwayomiProc.stderr.on('data', d => {
    const line = d.toString().trim();
    if (line) console.error('[suwayomi:err]', line.slice(0, 120));
  });
  suwayomiProc.on('exit', code => {
    console.log('[suwayomi] exited', code);
    suwayomiProc = null;
    if (!isQuitting) sendStatus('crashed');
  });

  try {
    await waitForSuwayomi(90000);
    console.log('[suwayomi] Ready!');
    return true;
  } catch (e) {
    console.error('[suwayomi] Failed:', e.message);
    sendStatus('suwayomi-failed');
    return false;
  }
}

// ── Backend server ────────────────────────────────────────────────────────────
function startServer() {
  if (serverProc) return;
  console.log('[server] starting:', serverPath);
  // utilityProcess.fork() is required in packaged Electron — process.execPath is
  // the Electron binary, not Node.js, so spawn(process.execPath) would re-launch
  // a full Electron window causing the memory leak / many-processes bug.
  serverProc = utilityProcess.fork(serverPath, [], {
    cwd:         backendDir,
    env:         { ...process.env, PORT: '3001', EXT_DIR: userExtDir },
    stdio:       'pipe',
    serviceName: 'akaReader-backend',
  });
  serverProc.on('spawn', () => console.log('[server] spawned OK'));
  serverProc.on('exit', code => {
    console.log('[server] exited', code);
    serverProc = null;
    if (!isQuitting) setTimeout(startServer, 3000);
  });
}

function killServer() {
  if (!serverProc) return;
  const p = serverProc; serverProc = null;
  try { p.kill(); } catch {}
}



function waitForServer(retries = 30, delayMs = 300) {
  return new Promise(resolve => {
    let attempts = 0;
    const check = () => {
      const req = http.get('http://localhost:3001/api/health', res => { resolve(res.statusCode === 200); });
      req.on('error', () => { attempts++; if (attempts >= retries) return resolve(false); setTimeout(check, delayMs); });
      req.setTimeout(1000, () => req.destroy());
    };
    check();
  });
}

// ── Seed extensions ───────────────────────────────────────────────────────────
function seedExtensions() {
  const bundled = path.join(backendDir, 'extensions');
  if (!fs.existsSync(bundled)) return;
  fs.readdirSync(bundled).forEach(f => {
    const dest = path.join(userExtDir, f);
    if (!fs.existsSync(dest)) { try { fs.copyFileSync(path.join(bundled, f), dest); } catch {} }
  });
}

// ── Windows startup ───────────────────────────────────────────────────────────
function setWindowsStartup(enable) {
  if (process.platform !== 'win32') return;
  const key = `"HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run"`;
  if (enable) cp.exec(`reg add ${key} /v "akaReader" /t REG_SZ /d "${process.execPath}" /f`);
  else        cp.exec(`reg delete ${key} /v "akaReader" /f`);
}

// ── IPC ───────────────────────────────────────────────────────────────────────
ipcMain.on('set-close-to-tray',       (_, v) => { appSettings.closeToTray = v; saveSettings(appSettings); });
ipcMain.handle('get-close-to-tray',   ()     => appSettings.closeToTray);
ipcMain.on('set-start-with-windows',  (_, v) => { appSettings.startWithWindows = v; saveSettings(appSettings); setWindowsStartup(v); });
ipcMain.handle('get-start-with-windows', ()  => appSettings.startWithWindows);

ipcMain.handle('restart-services', async () => {
  try {
    if (suwayomiProc) { suwayomiProc.kill(); suwayomiProc = null; }
    killServer();
    await new Promise(r => setTimeout(r, 500));
    startServer();
    if (!serviceMode) await startSuwayomi();
    const ok = await waitForServer(15, 500);
    sendStatus(ok ? 'online' : 'offline');
    return ok;
  } catch (e) { sendStatus('offline'); return false; }
});

// Service management
ipcMain.handle('check-service',     () => isServiceRunning());
ipcMain.handle('install-service',   async () => { await installWindowsService(); return true; });
ipcMain.handle('uninstall-service', async () => { await uninstallWindowsService(); return true; });
ipcMain.handle('open-data-dir',     () => shell.openPath(userData));
ipcMain.handle('get-java-path',     () => findJava());
ipcMain.handle('get-jar-path',      () => jarPath);

// ── Tray ──────────────────────────────────────────────────────────────────────
function createTray() {
  if (tray) { try { tray.destroy(); } catch {} }
  try {
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
  } catch (e) { console.warn('[tray] failed:', e.message); }
}

// ── Main window ───────────────────────────────────────────────────────────────
function createMainWindow() {
  if (mainWindow) { mainWindow.show(); mainWindow.focus(); return; }

  const state = loadWindowState();
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  let { x, y } = state;
  if (x !== undefined && (x < -100 || x > sw)) x = undefined;
  if (y !== undefined && (y < -100 || y > sh)) y = undefined;

  mainWindow = new BrowserWindow({
    width: state.width || 1400, height: state.height || 900,
    minWidth: 960, minHeight: 640,
    x, y,
    backgroundColor: '#0a0a0f',
    show: false,
    titleBarStyle:   process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    titleBarOverlay: { color: '#0f0f18', symbolColor: '#f97316', height: 36 },
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      webSecurity: true, preload: preloadPath,
    },
    icon: iconPath,
  });

  ['resize','move'].forEach(ev => mainWindow.on(ev, () => saveWindowState(mainWindow)));
  mainWindow.on('close', e => { if (!isQuitting && appSettings.closeToTray) { e.preventDefault(); mainWindow.hide(); } });
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });

  if (isDev) { mainWindow.loadURL('http://localhost:5173'); mainWindow.webContents.openDevTools(); }
  else        { mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html')); }

  mainWindow.once('ready-to-show', () => mainWindow.show());
}

// ── Startup sequence ──────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  seedExtensions();
  createTray();
  createMainWindow();
  startServer();

  try {
    // Step 1: Ensure JRE exists (download if needed ~50MB, once ever)
    await ensureJre();

    // Step 2: Ensure Suwayomi JAR exists (download if needed ~100MB, once ever)
    await ensureJar();

    // Step 3: Check if service is already running (subsequent launches = instant)
    if (isServiceRunning()) {
      console.log('[startup] Service running — instant start');
      serviceMode = true;
      sendStatus('online');
    } else {
      // Step 4: First time or no service — ask user to install service
      const firstRun = !fs.existsSync(path.join(userData, '.service-installed'));
      if (firstRun && process.platform === 'win32') {
        // Launch Suwayomi directly now so app works immediately
        await startSuwayomi();
        // Offer to install service in background (no UAC prompt on first run — we skip for now)
        fs.writeFileSync(path.join(userData, '.service-installed'), '1');
      } else {
        await startSuwayomi();
      }
      sendStatus('online');
    }
  } catch (e) {
    console.error('[startup] Error:', e.message);
    sendStatus('offline');
  }

  // Notify React once backend is confirmed
  waitForServer(30, 200).then(ok => sendStatus(ok ? 'online' : 'offline'));

  if (appSettings.startWithWindows) setWindowsStartup(true);

  globalShortcut.register('CommandOrControl+Shift+M', () => {
    if (!mainWindow) return;
    mainWindow.isVisible() && mainWindow.isFocused() ? mainWindow.hide() : (mainWindow.show(), mainWindow.focus());
  });

  // Auto updater
  if (autoUpdater && !isDev) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('update-available', info => sendStatus('update-available:' + info.version));
    autoUpdater.on('update-downloaded', () => {
      dialog.showMessageBox(mainWindow, {
        type: 'info', title: 'Update ready',
        message: 'A new version of akaReader has been downloaded. Restart to install.',
        buttons: ['Restart now', 'Later'],
      }).then(({ response }) => { if (response === 0) { isQuitting = true; autoUpdater.quitAndInstall(); } });
    });
    autoUpdater.on('error', e => console.error('[updater]', e.message));
    setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 10000);
    setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 4 * 60 * 60 * 1000);
  }

  app.on('activate', () => { if (!mainWindow) createMainWindow(); else { mainWindow.show(); mainWindow.focus(); } });
});

app.on('window-all-closed', () => { /* keep alive in tray */ });
app.on('before-quit', () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
  killServer();
  if (suwayomiProc && !serviceMode) { try { suwayomiProc.kill(); } catch {} }
  try { tray?.destroy(); } catch {}
});

process.on('SIGINT',  () => { isQuitting = true; killServer(); process.exit(0); });
process.on('SIGTERM', () => { isQuitting = true; killServer(); process.exit(0); });