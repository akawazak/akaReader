/**
 * akaReader — Electron Main Process v3.0
 * Fixes: instant window, full process-tree kill, async service check
 */
const {
  app, BrowserWindow, Menu, shell, dialog,
  Tray, globalShortcut, ipcMain, screen, utilityProcess
} = require('electron');
const path  = require('path');
const http  = require('http');
const https = require('https');
const fs    = require('fs');
const cp    = require('child_process');

let autoUpdater = null;
try { autoUpdater = require('electron-updater').autoUpdater; } catch {}

const isDev = !app.isPackaged;

let mainWindow   = null;
let tray         = null;
let serverProc   = null;
let suwayomiProc = null;
let isQuitting   = false;
let serviceMode  = false;

// ── Single instance ──────────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); process.exit(0); }
app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show(); mainWindow.focus();
});

// ── Paths ────────────────────────────────────────────────────────────────────
const backendDir = isDev
  ? path.join(__dirname, '..', 'backend')
  : path.join(process.resourcesPath, 'backend');

const serverPath      = path.join(backendDir, 'server.js');
const iconPath        = path.join(__dirname, 'public', 'icon.ico');
const preloadPath     = path.join(__dirname, 'preload.js');
const userData        = app.getPath('userData');
const userExtDir      = path.join(userData, 'extensions');
const jarPath         = path.join(userData, 'suwayomi.jar');
const jreDir          = path.join(userData, 'jre');
const javaExe         = path.join(jreDir, 'bin', 'java.exe');
const nssmExe         = path.join(userData, 'nssm.exe');
const suwayomiPidFile = path.join(userData, 'suwayomi.pid');
const suwayomiConfigPath = path.join(userData, 'suwayomi-data', 'server.conf');
const defaultExtensionRepos = [
  'https://raw.githubusercontent.com/keiyoushi/extensions/repo/index.min.json',
];

fs.mkdirSync(userExtDir, { recursive: true });
fs.mkdirSync(path.join(userData, 'suwayomi-data'), { recursive: true });

// ── Settings ─────────────────────────────────────────────────────────────────
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
// Messages fired before the renderer finishes loading are queued and flushed
// the moment React is ready — otherwise early statuses (download progress etc.)
// are silently dropped and the startup screen never shows what's happening.
let _statusQueue = [];
function sendStatus(status) {
  console.log('[status]', status);
  if (!mainWindow || mainWindow.isDestroyed()) { _statusQueue.push(status); return; }
  if (mainWindow.webContents.isLoading()) { _statusQueue.push(status); return; }
  mainWindow.webContents.send('services-status', status);
}
function flushStatusQueue() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  _statusQueue.forEach(s => mainWindow.webContents.send('services-status', s));
  _statusQueue = [];
}

// ── HTTPS download with progress ──────────────────────────────────────────────
function download(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const doGet = (u) => {
      https.get(u, { headers: { 'User-Agent': 'akaReader/3.0' } }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return doGet(res.headers.location);
        }
        if (res.statusCode !== 200) {
          return reject(new Error('HTTP ' + res.statusCode + ' — ' + u));
        }
        const file = fs.createWriteStream(dest);
        const total = parseInt(res.headers['content-length'] || '0', 10);
        let received = 0;
        res.on('data', chunk => {
          received += chunk.length;
          if (total && onProgress) onProgress(Math.round(received / total * 100));
        });
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
        file.on('error', e => { fs.unlink(dest, () => {}); reject(e); });
      }).on('error', e => { reject(e); });
    };
    doGet(url);
  });
}

// ── Latest Suwayomi JAR URL from GitHub ──────────────────────────────────────
async function getLatestJarUrl() {
  return new Promise((resolve, reject) => {
    https.get(
      'https://api.github.com/repos/Suwayomi/Suwayomi-Server/releases/latest',
      { headers: { 'User-Agent': 'akaReader/3.0', Accept: 'application/vnd.github.v3+json' } },
      res => {
        let data = '';
        res.on('data', d => data += d);
        res.on('end', () => {
          try {
            const release = JSON.parse(data);
            const asset   = (release.assets || []).find(a => a.name.endsWith('.jar'));
            if (!asset) throw new Error('No JAR asset found in latest release');
            if (!asset.name || !asset.browser_download_url) throw new Error('Invalid JAR asset structure');
            resolve({ url: asset.browser_download_url, version: release.tag_name });
          } catch (e) { reject(e); }
        });
      }
    ).on('error', reject);
  });
}

function getJreUrl() {
  return 'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.4%2B7/OpenJDK21U-jre_x64_windows_hotspot_21.0.4_7.zip';
}

function extractZip(zipPath, destDir) {
  return new Promise((resolve, reject) => {
    cp.exec(
      `powershell -NoProfile -Command "Expand-Archive -Path \\"${zipPath}\\" -DestinationPath \\"${destDir}\\" -Force"`,
      { windowsHide: true },
      err => err ? reject(err) : resolve()
    );
  });
}

function findJava() {
  // 1. Check for downloaded JRE in userData
  if (fs.existsSync(javaExe)) return javaExe;
  
  // 2. Check for bundled JRE in backend resources
  const bundledJava = path.join(backendDir, 'jre', 'bin', 'java.exe');
  if (fs.existsSync(bundledJava)) return bundledJava;

  // 3. Check system environment
  if (process.env.JAVA_HOME) {
    const p = path.join(process.env.JAVA_HOME, 'bin', 'java.exe');
    if (fs.existsSync(p)) return p;
  }

  // 4. Check common Windows Java install roots. Electron can launch with a
  // trimmed PATH, so relying only on "java" can miss a perfectly good JDK/JRE.
  if (process.platform === 'win32') {
    const roots = [
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Eclipse Adoptium'),
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Java'),
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Microsoft'),
    ];
    for (const root of roots) {
      try {
        const dirs = fs.readdirSync(root, { withFileTypes: true })
          .filter(d => d.isDirectory())
          .map(d => path.join(root, d.name));
        for (const dir of dirs) {
          const candidate = path.join(dir, 'bin', 'java.exe');
          if (fs.existsSync(candidate)) return candidate;
        }
      } catch {}
    }
  }

  return 'java';
}

function hasUsableJava(javaPath = findJava()) {
  try {
    const result = cp.spawnSync(javaPath, ['-version'], {
      windowsHide: true,
      timeout: 10000,
      encoding: 'utf8',
    });
    return !result.error && result.status === 0;
  } catch {
    return false;
  }
}

function ensureSuwayomiConfig(dataRoot) {
  fs.mkdirSync(dataRoot, { recursive: true });

  const configPath = path.join(dataRoot, 'server.conf');
  const managedStart = '# akaReader managed settings';
  const managedEnd = '# /akaReader managed settings';
  const managedBlock = [
    managedStart,
    'server.initialOpenInBrowserEnabled = false',
    'server.systemTrayEnabled = false',
    `server.extensionRepos = ${JSON.stringify(defaultExtensionRepos)}`,
    managedEnd,
    '',
  ].join('\n');

  let existing = '';
  try {
    existing = fs.readFileSync(configPath, 'utf8');
  } catch {}

  const blockPattern = new RegExp(
    `${managedStart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${managedEnd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`,
    'm'
  );

  const next = existing.match(blockPattern)
    ? existing.replace(blockPattern, managedBlock)
    : `${existing.trimEnd()}${existing.trim() ? '\n\n' : ''}${managedBlock}`;

  if (next !== existing) {
    fs.writeFileSync(configPath, next, 'utf8');
  }

  return configPath;
}

async function ensureJre() {
  if (hasUsableJava()) {
    console.log('[jre] Using existing Java runtime:', findJava());
    sendStatus('using-system-java');
    return;
  }

  // Check if we have a bundled JRE in the backend directory
  const bundledJre = path.join(backendDir, 'jre');
  if (fs.existsSync(bundledJre)) {
    console.log('[jre] Found bundled JRE, copying...');
    sendStatus('installing-bundled-jre');
    fs.mkdirSync(jreDir, { recursive: true });
    // Note: Simple copy for directories is complex in Node, so we just use it directly if possible
    // or tell findJava to use it. Actually, better to just let findJava use it.
    return; 
  }

  sendStatus('downloading-jre');
  const zipPath = path.join(userData, 'jre-download.zip');
  await download(getJreUrl(), zipPath, pct => {
    if (pct % 10 === 0) sendStatus('downloading-jre:' + pct);
  });
  sendStatus('extracting-jre');
  const extractDir = path.join(userData, 'jre-extract');
  await extractZip(zipPath, extractDir);
  const folder = fs.readdirSync(extractDir).find(e => e.startsWith('jdk') || e.startsWith('OpenJDK'));
  if (!folder) throw new Error('JRE folder not found');
  if (fs.existsSync(jreDir)) fs.rmSync(jreDir, { recursive: true });
  fs.renameSync(path.join(extractDir, folder), jreDir);
  try { fs.unlinkSync(zipPath); } catch {}
  try { fs.rmSync(extractDir, { recursive: true }); } catch {}
  console.log('[jre] Ready at', jreDir);
}

async function ensureJar() {
  if (fs.existsSync(jarPath)) {
    sendStatus('using-existing-suwayomi');
    return;
  }

  // Check if we have a bundled JAR in the backend directory
  try {
    if (fs.existsSync(backendDir)) {
      const files = fs.readdirSync(backendDir);
      const bundledJar = files.find(f => f.startsWith('Suwayomi-Server') && f.endsWith('.jar'));
      if (bundledJar) {
        const bundledPath = path.join(backendDir, bundledJar);
        console.log('[jar] Found bundled JAR:', bundledJar);
        sendStatus('installing-bundled-suwayomi');
        fs.copyFileSync(bundledPath, jarPath);
        
        // Validate copied JAR exists and has content
        if (!fs.existsSync(jarPath) || fs.statSync(jarPath).size < 1000) {
          console.error('[jar] Bundled JAR copy failed or file too small');
          fs.unlinkSync(jarPath);
          throw new Error('Bundled JAR copy failed');
        }
        
        console.log('[jar] Bundled JAR copied to', jarPath, '- size:', fs.statSync(jarPath).size, 'bytes');
        return;
      }
    }
  } catch (e) {
    console.warn('[jar] Failed to check for bundled JAR:', e.message);
  }

  sendStatus('downloading-suwayomi');
  const { url, version } = await getLatestJarUrl();
  console.log('[jar] Latest:', version);
  await download(url, jarPath, pct => {
    if (pct % 5 === 0) sendStatus('downloading-suwayomi:' + pct);
  });
  console.log('[jar] Ready at', jarPath);
}

async function ensureNssm() {
  if (fs.existsSync(nssmExe)) return;
  const zipPath    = path.join(userData, 'nssm.zip');
  const extractDir = path.join(userData, 'nssm-extract');
  await download('https://nssm.cc/release/nssm-2.24.zip', zipPath, null);
  await extractZip(zipPath, extractDir);
  const src = path.join(extractDir, 'nssm-2.24', 'win64', 'nssm.exe');
  if (fs.existsSync(src)) fs.copyFileSync(src, nssmExe);
  try { fs.unlinkSync(zipPath); } catch {}
  try { fs.rmSync(extractDir, { recursive: true }); } catch {}
}

// ── Windows Service ──────────────────────────────────────────────────────────
// FIX: async — never blocks the main thread
async function isServiceRunning() {
  if (process.platform !== 'win32') return false;
  return new Promise(resolve => {
    cp.exec('sc query AkaReaderSuwayomi',
      { windowsHide: true, timeout: 5000 },
      (err, stdout) => resolve(!err && stdout.includes('RUNNING'))
    );
  });
}

async function installWindowsService() {
  await ensureNssm();
  const java     = findJava();
  const dataRoot = path.join(userData, 'suwayomi-data');
  ensureSuwayomiConfig(dataRoot);
  
  // Clean up any existing service first to avoid "service already exists" errors
  try { cp.execSync(`"${nssmExe}" stop AkaReaderSuwayomi`, { windowsHide: true, timeout: 5000 }); } catch {}
  try { cp.execSync(`"${nssmExe}" remove AkaReaderSuwayomi confirm`, { windowsHide: true, timeout: 5000 }); } catch {}

  const cmds = [
    `"${nssmExe}" install AkaReaderSuwayomi "${java}"`,
    `"${nssmExe}" set AkaReaderSuwayomi AppParameters "-Dsuwayomi.tachidesk.config.server.rootDir=\\"${dataRoot}\\" -jar \\"${jarPath}\\" --server.port=4567"`,
    `"${nssmExe}" set AkaReaderSuwayomi AppDirectory "${userData}"`,
    `"${nssmExe}" set AkaReaderSuwayomi Start SERVICE_AUTO_START`,
    `"${nssmExe}" set AkaReaderSuwayomi AppStdout "${path.join(userData, 'suwayomi.log')}"`,
    `"${nssmExe}" set AkaReaderSuwayomi AppStderr "${path.join(userData, 'suwayomi-err.log')}"`,
    `"${nssmExe}" start AkaReaderSuwayomi`,
  ];
  
  for (const cmd of cmds) {
    console.log('[service] Executing:', cmd);
    cp.execSync(cmd, { windowsHide: true, timeout: 10000 });
  }
}

async function uninstallWindowsService() {
  try { cp.execSync('net stop AkaReaderSuwayomi',  { windowsHide: true }); } catch {}
  try { cp.execSync('sc delete AkaReaderSuwayomi', { windowsHide: true }); } catch {}
}

// ── Process-tree kill ────────────────────────────────────────────────────────
// FIX: On Windows, /F /T kills the parent AND all child processes (entire Java tree)
function killPid(pid) {
  if (!pid) return;
  if (process.platform === 'win32') {
    try { cp.spawn('taskkill', ['/F', '/T', '/PID', String(pid)], { windowsHide: true, stdio: 'ignore' }); } catch {}
  } else {
    try { process.kill(-pid, 'SIGKILL'); } catch {
      try { process.kill(pid, 'SIGKILL'); } catch {}
    }
  }
}

function killSuwayomi() {
  if (serviceMode) return;
  const pid = suwayomiProc?.pid;
  suwayomiProc = null;
  if (pid) {
    killPid(pid);
    try { fs.unlinkSync(suwayomiPidFile); } catch {}
  }
}

// Cleanup orphaned process from a previous forced-quit (Task Manager kill, power cut, etc.)
function killOrphanedSuwayomi() {
  try {
    if (!fs.existsSync(suwayomiPidFile)) return;
    const pid = parseInt(fs.readFileSync(suwayomiPidFile, 'utf8').trim(), 10);
    if (!isNaN(pid)) { killPid(pid); console.log('[cleanup] Killed orphaned PID', pid); }
    fs.unlinkSync(suwayomiPidFile);
  } catch {}
}

// ── Suwayomi ─────────────────────────────────────────────────────────────────
function waitForSuwayomi(timeoutMs = 90000) {
  return new Promise((resolve, reject) => {
    const start   = Date.now();
    const attempt = () => {
      if (Date.now() - start > timeoutMs) return reject(new Error('Suwayomi timeout'));
      const req = http.request('http://localhost:4567/api/graphql', {
        method: 'POST',
        timeout: 2000,
        headers: { 'Content-Type': 'application/json' },
      }, res => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(body);
              if (parsed?.data?.aboutServer?.version) return resolve(true);
            } catch {}
          }
          setTimeout(attempt, 2000);
        });
      });
      req.on('error', () => setTimeout(attempt, 2000));
      req.setTimeout(2000, () => req.destroy());
      req.write(JSON.stringify({ query: 'query { aboutServer { version } }' }));
      req.end();
    };
    attempt();
  });
}

async function startSuwayomi() {
  const logFile = path.join(userData, 'suwayomi-startup.log');
  try { fs.writeFileSync(logFile, `--- Startup ${new Date().toISOString()} ---\n`); } catch {}

  try {
    const isRunning = await Promise.race([
      waitForSuwayomi(3000),
      new Promise(r => setTimeout(() => r(false), 3500))
    ]);
    if (isRunning) {
      console.log('[suwayomi] Already running');
      serviceMode = true;
      return true;
    }
  } catch {}

  const java = findJava();
  const dataRoot = path.join(userData, 'suwayomi-data');
  let lastError = '';
  
  if (!fs.existsSync(jarPath) || fs.statSync(jarPath).size < 1000) {
    throw new Error('Suwayomi JAR is missing or corrupted. Please try checking for updates.');
  }

  sendStatus('starting-suwayomi');
  console.log('[suwayomi] Launching from:', userData);

  const args = [
    `-Dsuwayomi.tachidesk.config.server.rootDir=${dataRoot}`,
    '-Xmx512m', 
    '-jar', jarPath,
    '--server.port=4567'
  ];

  try { fs.appendFileSync(logFile, `Command: "${java}" ${args.join(' ')}\n\n`); } catch {}

  suwayomiProc = cp.spawn(java, args, {
    cwd: userData,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    detached: false
  });

  if (!suwayomiProc || !suwayomiProc.pid) {
    throw new Error('Failed to spawn Suwayomi. Check if Java is installed correctly.');
  }

  fs.writeFileSync(suwayomiPidFile, String(suwayomiProc.pid));

  suwayomiProc.stdout.on('data', d => {
    const l = d.toString();
    try { fs.appendFileSync(logFile, l); } catch {}
    if (l.trim()) console.log('[suwayomi]', l.trim().slice(0, 120));
  });

  suwayomiProc.stderr.on('data', d => {
    const l = d.toString();
    try { fs.appendFileSync(logFile, '[ERR] ' + l); } catch {}
    if (l.trim()) {
      console.error('[suwayomi:err]', l.trim().slice(0, 120));
      lastError = l.trim().slice(0, 200);
    }
  });

  suwayomiProc.on('exit', (code, signal) => {
    console.log('[suwayomi] exited', code, signal);
    suwayomiProc = null;
    try { fs.unlinkSync(suwayomiPidFile); } catch {}
    if (!isQuitting) {
      const msg = code !== 0 ? `Suwayomi crashed (code ${code}). ${lastError}` : 'Suwayomi stopped unexpectedly.';
      sendStatus('suwayomi-failed:' + msg);
    }
  });

  try {
    await waitForSuwayomi(90000);
    console.log('[suwayomi] Ready!');
    return true;
  } catch (e) {
    console.error('[suwayomi] Failed to become ready:', e.message);
    throw new Error(`Suwayomi started but didn't respond in time. ${lastError}`);
  }
}

// ── Backend server ────────────────────────────────────────────────────────────
function startServer() {
  if (serverProc) return;
  const logFile = path.join(userData, 'backend-startup.log');
  try { fs.writeFileSync(logFile, `--- Backend Startup ${new Date().toISOString()} ---\n`); } catch {}

  console.log('[server] starting');
  serverProc = utilityProcess.fork(serverPath, [], {
    cwd: backendDir,
    env: { ...process.env, PORT: '3001', EXT_DIR: userExtDir },
    stdio: 'pipe',
    serviceName: 'akaReader-backend',
  });

  serverProc.stdout.on('data', d => {
    const l = d.toString();
    try { fs.appendFileSync(logFile, l); } catch {}
    if (l.trim()) console.log('[server]', l.trim());
  });

  serverProc.stderr.on('data', d => {
    const l = d.toString();
    try { fs.appendFileSync(logFile, '[ERR] ' + l); } catch {}
    if (l.trim()) console.error('[server:err]', l.trim());
  });

  serverProc.on('spawn', () => console.log('[server] spawned'));
  serverProc.on('exit', code => {
    const msg = `[server] exited with code ${code}`;
    console.log(msg);
    try { fs.appendFileSync(logFile, msg + '\n'); } catch {}
    serverProc = null;
    if (!isQuitting) setTimeout(startServer, 3000);
  });
}

function killServer() {
  if (!serverProc) return;
  const p = serverProc; serverProc = null;
  try { p.kill(); } catch {}
}

const SERVER_PORT = '3001';

function waitForServer(retries = 30, delayMs = 300) {
  return new Promise(resolve => {
    let attempts = 0;
    const check = () => {
      const req = http.get(`http://localhost:${SERVER_PORT}/api/ping`, res => { resolve(res.statusCode === 200); });
      req.on('error', () => {
        attempts++;
        if (attempts >= retries) return resolve(false);
        setTimeout(check, delayMs);
      });
      req.setTimeout(1000, () => req.destroy());
    };
    check();
  });
}

function seedExtensions() {
  const bundled = path.join(backendDir, 'extensions');
  if (!fs.existsSync(bundled)) return;
  fs.readdirSync(bundled).forEach(f => {
    const dest = path.join(userExtDir, f);
    if (!fs.existsSync(dest)) try { fs.copyFileSync(path.join(bundled, f), dest); } catch {}
  });
}

function setWindowsStartup(enable) {
  if (process.platform !== 'win32') return;
  const key = `"HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run"`;
  if (enable) cp.exec(`reg add ${key} /v "akaReader" /t REG_SZ /d "${process.execPath}" /f`);
  else        cp.exec(`reg delete ${key} /v "akaReader" /f`);
}

let servicesPromise = null;
async function ensureManagedServices({ restart = false } = {}) {
  if (servicesPromise && !restart) return servicesPromise;

  servicesPromise = (async () => {
    try {
      if (restart) {
        if (suwayomiProc) killSuwayomi();
        killServer();
        serviceMode = false;
        await new Promise(r => setTimeout(r, 100));
      }

      sendStatus('starting-backend');
      startServer();
      const serverOk = await waitForServer(40, 250);
      if (!serverOk) {
        sendStatus('offline');
        return false;
      }
      sendStatus('backend-ready');

      sendStatus('suwayomi-starting');
      await ensureJre();
      await ensureJar();

      if (await isServiceRunning()) {
        console.log('[startup] Service already running, waiting for it to be ready...');
        serviceMode = true;
        await waitForSuwayomi(90000);
      } else {
        serviceMode = false;
        const started = await startSuwayomi();
        if (!started) return false;
      }

      sendStatus('suwayomi-ready');
      sendStatus('online');
      return true;
    } catch (e) {
      console.error('[startup] Service error:', e.message);
      const detail = e.message || 'Unknown startup error';
      sendStatus('suwayomi-failed:' + detail);
      
      // Fallback: If Suwayomi fails but backend proxy is up, 
      // we could technically proceed offline, but it's better to show the error first.
      return false;
    } finally {
      servicesPromise = null;
    }
  })();

  return servicesPromise;
}

// ── IPC ───────────────────────────────────────────────────────────────────────
ipcMain.handle('get-close-to-tray',      ()    => appSettings.closeToTray);
ipcMain.handle('set-close-to-tray',      (_, v) => { appSettings.closeToTray = v; saveSettings(appSettings); });
ipcMain.handle('get-start-with-windows', ()    => appSettings.startWithWindows);
ipcMain.on(    'set-start-with-windows', (_, v) => { appSettings.startWithWindows = v; saveSettings(appSettings); setWindowsStartup(v); });

ipcMain.handle('window-minimize', ()     => mainWindow?.minimize());
ipcMain.handle('window-maximize', ()     => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize());
ipcMain.handle('window-close',    ()     => {
  if (!isQuitting && appSettings.closeToTray) mainWindow?.hide();
  else { isQuitting = true; app.quit(); }
});

ipcMain.handle('ensure-services', () => ensureManagedServices());
ipcMain.handle('restart-services', () => ensureManagedServices({ restart: true }));

ipcMain.handle('check-service',     ()    => isServiceRunning());
ipcMain.handle('install-service',   async () => {
  try {
    await installWindowsService();
    return { ok: true };
  } catch (e) {
    console.error('[service] Install error:', e.message);
    let msg = e.message;
    if (msg.includes('Access is denied') || msg.includes('exit code 1')) {
      msg = 'Access denied. Please run akaReader as Administrator to install the service.';
    }
    return { ok: false, error: msg };
  }
});
ipcMain.handle('uninstall-service', async () => {
  try {
    await uninstallWindowsService();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});
ipcMain.handle('open-data-dir',     ()    => shell.openPath(userData));
ipcMain.handle('get-version',       ()    => app.getVersion());
ipcMain.handle('get-java-path',     ()    => findJava());
ipcMain.handle('get-jar-path',      ()    => jarPath);
ipcMain.handle('get-suwayomi-config-path', () => suwayomiConfigPath);
ipcMain.handle('open-external',      (_, url) => shell.openExternal(url));

ipcMain.handle('check-for-app-update', async () => {
  if (!autoUpdater) return { ok: false, error: 'Updater is not available in this build.' };
  if (isDev) return { ok: false, error: 'Updater only runs in a packaged app.' };
  try {
    const result = await autoUpdater.checkForUpdates();
    return { ok: true, version: result?.updateInfo?.version || null };
  } catch (e) {
    return { ok: false, error: e?.message || 'Failed to check for updates.' };
  }
});
ipcMain.handle('download-app-update', async () => {
  if (!autoUpdater) return { ok: false, error: 'Updater is not available in this build.' };
  if (isDev) return { ok: false, error: 'Updater only runs in a packaged app.' };
  try {
    await autoUpdater.downloadUpdate();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || 'Failed to download update.' };
  }
});
ipcMain.handle('install-app-update', () => {
  if (!autoUpdater || isDev) return { ok: false };
  isQuitting = true;
  autoUpdater.quitAndInstall();
  return { ok: true };
});

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
// FIX: show: true + backgroundColor matching React's bg = window appears
//      immediately as a dark frame. Zero white flash, zero wait.
//      React's SplashScreen handles the loading animation inside.
function createMainWindow() {
  if (mainWindow) { mainWindow.show(); mainWindow.focus(); return; }

  const state = loadWindowState();
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  let { x, y } = state;
  if (x !== undefined && (x < -100 || x > sw)) x = undefined;
  if (y !== undefined && (y < -100 || y > sh)) y = undefined;

  mainWindow = new BrowserWindow({
    width:  state.width  || 1400,
    height: state.height || 900,
    minWidth: 960, minHeight: 640,
    x, y,
    show: true,             // FIX: show immediately
    backgroundColor: '#0a0a0f', // matches React's --bg so no white flash
    titleBarStyle:   process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    // No titleBarOverlay — the React UI renders its own min/max/close buttons
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      webSecurity: true, preload: preloadPath,
    },
    icon: iconPath,
  });

  mainWindow.webContents.on('did-finish-load', flushStatusQueue);

  ['resize', 'move'].forEach(ev => mainWindow.on(ev, () => saveWindowState(mainWindow)));
  mainWindow.on('close', e => {
    if (!isQuitting && appSettings.closeToTray) { e.preventDefault(); mainWindow.hide(); }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // Open DevTools manually with F12 — auto-opening is noisy on every launch
    mainWindow.webContents.on('before-input-event', (_, input) => {
      if (input.key === 'F12') mainWindow.webContents.toggleDevTools();
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);

  // Set Content-Security-Policy to silence Electron security warnings
  // and prevent XSS — allows our localhost backend and Vite dev server
  const { session } = require('electron');
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' http://localhost:* file:",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com data:",
          "img-src 'self' data: blob: http://localhost:* file:",
          "script-src 'self' 'unsafe-inline' http://localhost:*",
          "connect-src 'self' http://localhost:* ws://localhost:*"
        ].join('; ')
      }
    });
  });

  // Kill any zombie Suwayomi from a previous forced-exit
  killOrphanedSuwayomi();

  seedExtensions();
  createTray();
  createMainWindow(); // window appears instantly
  ensureManagedServices();

  if (appSettings.startWithWindows) setWindowsStartup(true);

  globalShortcut.register('CommandOrControl+Shift+M', () => {
    if (!mainWindow) return;
    mainWindow.isVisible() && mainWindow.isFocused()
      ? mainWindow.hide()
      : (mainWindow.show(), mainWindow.focus());
  });

  if (autoUpdater && !isDev) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    // Track whether this is a manual check (from settings) or automatic
    let isManualCheck = false;

    autoUpdater.on('checking-for-update', () => {
      console.log('[updater] Checking for updates...');
      sendStatus('update-checking');
      // Show a native notification so the user knows it's checking
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setProgressBar(0.05, { mode: 'indeterminate' });
      }
    });

    autoUpdater.on('update-available', i => {
      console.log('[updater] Update available:', i.version);
      sendStatus('update-available:' + i.version);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setProgressBar(0.1);
      }
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Available',
        message: `akaReader v${i.version} is available and downloading now.`,
        detail: 'The update will download in the background. You\'ll be prompted to restart when it\'s ready.',
        buttons: ['OK'],
      }).catch(() => {});
    });

    autoUpdater.on('update-not-available', () => {
      console.log('[updater] No updates available');
      sendStatus('update-not-available');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setProgressBar(-1);
      }
      // Only show the "up to date" dialog on manual checks, not every 2h auto-check
      if (isManualCheck) {
        isManualCheck = false;
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'You\'re Up to Date',
          message: `akaReader v${app.getVersion()} is the latest version.`,
          buttons: ['OK'],
        }).catch(() => {});
      }
    });

    autoUpdater.on('download-progress', p => {
      const pct = Math.round(p.percent || 0);
      sendStatus('update-downloading:' + pct);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setProgressBar(pct / 100);
      }
    });

    autoUpdater.on('update-downloaded', (i) => {
      console.log('[updater] Update downloaded:', i?.version);
      sendStatus('update-downloaded');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setProgressBar(-1);
      }
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Ready — akaReader v' + (i?.version || 'new'),
        message: `akaReader v${i?.version || 'latest'} has been downloaded and is ready to install.`,
        detail: 'The app will restart to apply the update. Your data and settings are safe.',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
      }).then(({ response }) => {
        if (response === 0) { isQuitting = true; autoUpdater.quitAndInstall(); }
      });
    });

    autoUpdater.on('error', e => {
      console.error('[updater]', e.message);
      sendStatus('update-error:' + (e?.message || 'unknown'));
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setProgressBar(-1);
      }
    });

    // Check immediately on launch, then every 2 hours
    autoUpdater.checkForUpdates().catch(() => {});
    setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 2 * 60 * 60 * 1000);

    // Allow manual check from renderer
    ipcMain.handle('manual-check-update', async () => {
      isManualCheck = true;
      try { await autoUpdater.checkForUpdates(); } catch {}
    });
  }

  app.on('activate', () => {
    if (!mainWindow) createMainWindow(); else { mainWindow.show(); mainWindow.focus(); }
  });
});

app.on('window-all-closed', () => { /* stay alive in tray */ });

// FIX: kill full Suwayomi process tree before quit
app.on('before-quit', () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
  killServer();
  killSuwayomi();
  try { tray?.destroy(); } catch {}
});

// FIX: synchronous last-resort cleanup — runs even if the above is skipped
// (e.g., process.exit() called directly). spawnSync is allowed here.
process.on('exit', () => {
  const pid = suwayomiProc?.pid;
  if (pid && !serviceMode && process.platform === 'win32') {
    try { cp.spawnSync('taskkill', ['/F', '/T', '/PID', String(pid)], { windowsHide: true }); } catch {}
  }
  try {
    if (fs.existsSync(suwayomiPidFile)) {
      const savedPid = fs.readFileSync(suwayomiPidFile, 'utf8').trim();
      if (savedPid && process.platform === 'win32') {
        cp.spawnSync('taskkill', ['/F', '/T', '/PID', savedPid], { windowsHide: true });
      }
      fs.unlinkSync(suwayomiPidFile);
    }
  } catch {}
});

process.on('SIGINT',  () => { isQuitting = true; killServer(); killSuwayomi(); process.exit(0); });
process.on('SIGTERM', () => { isQuitting = true; killServer(); killSuwayomi(); process.exit(0); });
