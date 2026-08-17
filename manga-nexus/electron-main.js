/**
 * akaReader — Electron Main Process v3.0
 * Fixes: instant window, full process-tree kill, async service check
 */
const {
  app, BrowserWindow, Menu, shell, WebContentsView,
  Tray, globalShortcut, ipcMain, screen, utilityProcess, dialog
} = require('electron');
const path  = require('path');
const http  = require('http');
const https = require('https');
const fs    = require('fs');
const cp    = require('child_process');
const crypto = require('crypto');
const {
  REQUIRED_JAVA_MAJOR,
  REQUIRED_JAVA_VERSION,
  classifySuwayomiFailure,
  isCompatibleJavaVersion,
  parseJavaVersionOutput,
} = require('./runtime/java-runtime.cjs');
const {
  DEFAULT_EXTENSION_STORES,
  buildSuwayomiConfig,
  configureCloudflareHelper,
  configuredExtensionStores,
  isValidExtensionStoreUrl,
  normalizeExtensionStoreUrls,
} = require('./runtime/extension-stores.cjs');
const {
  getSourceVerificationViewBounds,
  hasSourceChallengeSignals,
  isCloudflareClearanceCookie,
  isSourcePageReadyForReturn,
  normalizedHostname,
} = require('./runtime/source-verification.cjs');
const {
  FLARESOLVERR_VERSION,
  SUWAYOMI_CLOUDFLARE_SESSION,
  buildManagedCloudflareRuntime,
  getManagedCloudflareRelease,
  hasCloudflareSession,
} = require('./runtime/cloudflare-helper.cjs');
const { getMissingBackendFiles } = require('./runtime/backend-runtime.cjs');

let autoUpdater = null;
try { autoUpdater = require('electron-updater').autoUpdater; } catch {}

const isDev = !app.isPackaged;
const backendApiToken = crypto.randomBytes(32).toString('base64url');

let mainWindow   = null;
let verificationView = null;
let verificationPromise = null;
let cancelSourceVerification = null;
let completeSourceVerification = null;
let sourceVerificationState = { active: false };
let tray         = null;
let serverProc   = null;
let serverRestartTimer = null;
let serverRestartAttempts = 0;
let suwayomiProc = null;
let cloudflareHelperProc = null;
let cloudflareHelperInstallPromise = null;
let cloudflareSessionWarmupPromise = null;
let isQuitting   = false;
let serviceMode  = false;
let lastServiceIssue = null;
let updateState  = {
  checking: false,
  downloading: false,
  downloaded: false,
  version: null,
  lastCheckAt: 0,
};

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
const preloadPath     = path.join(__dirname, 'preload.js');
const userData        = app.getPath('userData');
const userExtDir      = path.join(userData, 'extensions');
const suwayomiRuntimeDir = path.join(userData, 'suwayomi-runtime');
const suwayomiWorkDir = path.join(suwayomiRuntimeDir, 'work');
const jarPath         = path.join(suwayomiRuntimeDir, 'suwayomi.jar');
const legacyJarPath   = path.join(userData, 'suwayomi.jar');
const jreDir          = path.join(userData, 'jre');
// Platform-aware Java binary path. Windows uses java.exe inside bin/;
// POSIX (Linux/macOS) uses the undecorated `java` binary.
const javaExe         = process.platform === 'win32'
  ? path.join(jreDir, 'bin', 'java.exe')
  : path.join(jreDir, 'bin', 'java');
const nssmExe         = path.join(userData, 'nssm.exe');
const suwayomiPidFile = path.join(userData, 'suwayomi.pid');
const suwayomiConfigPath = path.join(userData, 'suwayomi-data', 'server.conf');
const cloudflareHelperDir = path.join(userData, 'flaresolverr');
const cloudflareHelperPidFile = path.join(userData, 'flaresolverr.pid');
const managedCloudflareRelease = getManagedCloudflareRelease(process.platform, process.arch);
const cloudflareHelperArchive = path.join(
  userData,
  managedCloudflareRelease?.archiveName || 'flaresolverr-download.unsupported',
);
const cloudflareHelperRuntime = buildManagedCloudflareRuntime(
  process.env,
  userData,
  `${process.pid}-${Date.now()}`,
);
// Platform-aware icon paths. Linux/GTK trays expect a PNG; .ico works
// (mostly) on Windows/macOS. We keep the .ico as the canonical icon for
// packaging and fall back to a sibling PNG when the platform wants one.
const iconIcoPath     = path.join(__dirname, 'public', 'icon.ico');
const iconPngPath     = path.join(__dirname, 'public', 'icon.png');
const trayIconPath    = process.platform === 'win32'
  ? (fs.existsSync(iconIcoPath) ? iconIcoPath : iconPngPath)
  : (fs.existsSync(iconPngPath) ? iconPngPath : iconIcoPath);
const windowIconPath  = process.platform === 'win32' ? iconIcoPath : trayIconPath;

fs.mkdirSync(userExtDir, { recursive: true });
fs.mkdirSync(path.join(userData, 'suwayomi-data'), { recursive: true });

// ── Settings ─────────────────────────────────────────────────────────────────
const settingsPath = path.join(userData, 'electron-settings.json');
const statePath    = path.join(userData, 'window-state.json');

// The standalone Suwayomi server JAR has been 100+ MB across every release
// in recent history (Suwayomi-Launcher.jar is ~16 MB). Anything smaller
// is almost certainly the GUI launcher, which expects to find the real
// server at <install-root>/bin/Suwayomi-Server.jar (the .deb/.rpm layout)
// and crashes with "Could not find Suwayomi-Server.jar at ..." in our
// embedded layout. Use a generous threshold that comfortably separates
// the two and is robust against compression/junk bytes.
const MIN_SERVER_JAR_SIZE = 50 * 1024 * 1024; // 50 MB

function loadSettings() {
  try { return JSON.parse(fs.readFileSync(settingsPath, 'utf8')); }
  catch { return {}; }
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

let appSettings = {
  closeToTray: true,
  startWithWindows: false,
  cloudflareHelperEnabled: false,
  extensionRepos: [],
  ...loadSettings(),
};
appSettings.extensionRepos = normalizeExtensionStoreUrls(appSettings.extensionRepos);

// ── Status helper ─────────────────────────────────────────────────────────────
// Messages fired before the renderer finishes loading are queued and flushed
// the moment React is ready — otherwise early statuses (download progress etc.)
// are silently dropped and the startup screen never shows what's happening.
let _statusQueue = [];
let rendererStatusReady = false;
function sendStatus(status) {
  console.log('[status]', status);
  if (!mainWindow || mainWindow.isDestroyed() || !rendererStatusReady || mainWindow.webContents.isLoading()) {
    _statusQueue.push(status);
    return;
  }
  mainWindow.webContents.send('services-status', status);
}
function flushStatusQueue() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  rendererStatusReady = true;
  _statusQueue.forEach(s => mainWindow.webContents.send('services-status', s));
  _statusQueue = [];
}

function sendSourceVerificationState(state) {
  sourceVerificationState = { active: false, ...state };
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isLoading()) return;
  mainWindow.webContents.send('source-verification-state', sourceVerificationState);
}

function layoutSourceVerificationView() {
  if (!verificationView || !mainWindow || mainWindow.isDestroyed()) return;
  verificationView.setBounds(getSourceVerificationViewBounds(mainWindow.getContentSize()));
}

function removeSourceVerificationView() {
  const view = verificationView;
  verificationView = null;
  if (!view) return;
  try {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.contentView.removeChildView(view);
  } catch {}
  try {
    if (!view.webContents.isDestroyed()) view.webContents.close();
  } catch {}
}

function setServiceIssue(issue) {
  lastServiceIssue = {
    code: issue?.code || 'service-start-failed',
    title: issue?.title || 'Service could not start',
    message: issue?.message || 'akaReader could not start its local services.',
    detail: issue?.detail || '',
    canRepairJava: !!issue?.canRepairJava,
    requiredJavaMajor: REQUIRED_JAVA_MAJOR,
    requiredJavaVersion: REQUIRED_JAVA_VERSION,
    detectedJavaMajor: issue?.detectedJavaMajor ?? null,
    detectedJavaVersion: issue?.detectedJavaVersion || '',
    javaPath: issue?.javaPath || '',
    occurredAt: Date.now(),
  };
  sendStatus(`service-issue:${lastServiceIssue.code}`);
  return lastServiceIssue;
}

function clearServiceIssue() {
  lastServiceIssue = null;
}

// ── HTTPS download with progress ──────────────────────────────────────────────
function download(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    let file = null;
    const doGet = (u) => {
      https.get(u, { headers: { 'User-Agent': 'akaReader/3.0' } }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return doGet(res.headers.location);
        }
        if (res.statusCode !== 200) {
          return reject(new Error('HTTP ' + res.statusCode + ' — ' + u));
        }
        file = fs.createWriteStream(dest);
        const total = parseInt(res.headers['content-length'] || '0', 10);
        let received = 0;
        res.on('data', chunk => {
          received += chunk.length;
          if (total && onProgress) onProgress(Math.round(received / total * 100));
        });
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
        file.on('error', e => { fs.unlink(dest, () => {}); reject(e); });
      }).on('error', e => { if (file) fs.unlink(dest, () => {}); reject(e); });
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
  // Platform-aware JRE download. We pin the Temurin 21 LTS build that
  // matches what the bundled Windows installer is known to work with, but
  // swap the asset for the current platform.
  const version = '21.0.11';
  const build = '10';
  if (process.platform === 'win32') {
    return `https://github.com/adoptium/temurin21-binaries/releases/download/jdk-${version}%2B${build}/OpenJDK21U-jre_x64_windows_hotspot_${version}_${build}.zip`;
  }
  if (process.platform === 'darwin') {
    return `https://github.com/adoptium/temurin21-binaries/releases/download/jdk-${version}%2B${build}/OpenJDK21U-jre_x64_mac_hotspot_${version}_${build}.tar.gz`;
  }
  // Linux x64 (default). Other Linux arches (aarch64, etc.) would need a
  // different asset; fall back to x64 and let the user override via env.
  if (process.platform === 'linux') {
    const arch = process.arch === 'arm64' ? 'aarch64' : 'x64';
    return `https://github.com/adoptium/temurin21-binaries/releases/download/jdk-${version}%2B${build}/OpenJDK21U-jre_${arch}_linux_hotspot_${version}_${build}.tar.gz`;
  }
  // Unknown platform: stick with the Windows ZIP and let extraction fail
  // loudly so the user gets a real error message.
  return `https://github.com/adoptium/temurin21-binaries/releases/download/jdk-${version}%2B${build}/OpenJDK21U-jre_x64_windows_hotspot_${version}_${build}.zip`;
}

function extractArchive(archivePath, destDir) {
  // Cross-platform archive extraction. We support ZIP (Windows JRE, nssm)
  // and tar.gz (Linux/macOS JRE) without pulling in a Node dep.
  //
  // - Windows: PowerShell's Expand-Archive handles ZIP.
  // - POSIX:   `tar` for tar.gz, `unzip` for ZIP — both ship by default on
  //            essentially every Linux/macOS desktop install.
  try {
    fs.mkdirSync(destDir, { recursive: true });
  } catch (err) {
    console.warn('[extract] Failed to create destination directory:', err.message);
  }
  return new Promise((resolve, reject) => {
    const lower = String(archivePath).toLowerCase();

    if (process.platform === 'win32') {
      if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) {
        // PowerShell 5+ ships tar.exe; fall back to Expand-Archive only for ZIP.
        cp.exec(
          `powershell -NoProfile -Command "tar -xzf '${archivePath}' -C '${destDir}' -Force"`,
          { windowsHide: true },
          err => err ? reject(err) : resolve()
        );
        return;
      }
      cp.exec(
        `powershell -NoProfile -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${destDir}' -Force"`,
        { windowsHide: true },
        err => err ? reject(err) : resolve()
      );
      return;
    }

    // POSIX path — ensure executable permissions before running
    const runCmd = (cmd, opts = {}) => {
      return new Promise((res, rej) => {
        cp.exec(cmd, { timeout: 300000, ...opts }, (err, stdout, stderr) => {
          if (err) {
            // Provide diagnostic context on failure
            const extra = stderr ? `\nstderr: ${stderr.slice(0, 500)}` : '';
            rej(new Error(`${err.message}${extra}`));
          } else {
            res();
          }
        });
      });
    };

    if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) {
      runCmd(`tar -xzf ${shellQuote(archivePath)} -C ${shellQuote(destDir)}`).then(resolve).catch(reject);
      return;
    }
    if (lower.endsWith('.zip')) {
      runCmd(`unzip -q -o ${shellQuote(archivePath)} -d ${shellQuote(destDir)}`).then(resolve).catch(reject);
      return;
    }
    reject(new Error(`Unsupported archive format: ${archivePath}`));
  });
}

// Minimal POSIX shell-arg quoter. On Windows the PowerShell layer already
// embeds the args in a quoted string, so this is only used for the POSIX
// path. We deliberately keep this lightweight: wrap in single quotes and
// escape any embedded single quotes.
function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function getJavaCandidates() {
  const candidates = [];
  const addCandidate = (candidatePath, source) => {
    if (!candidatePath) return;
    const key = process.platform === 'win32' ? candidatePath.toLowerCase() : candidatePath;
    if (candidates.some(candidate => candidate.key === key)) return;
    candidates.push({ key, path: candidatePath, source });
  };

  addCandidate(javaExe, 'managed');

  const bundledJava = process.platform === 'win32'
    ? path.join(backendDir, 'jre', 'bin', 'java.exe')
    : path.join(backendDir, 'jre', 'bin', 'java');
  addCandidate(bundledJava, 'bundled');

  if (process.env.JAVA_HOME) {
    const javaHomePath = process.platform === 'win32'
      ? path.join(process.env.JAVA_HOME, 'bin', 'java.exe')
      : path.join(process.env.JAVA_HOME, 'bin', 'java');
    addCandidate(javaHomePath, 'java-home');
  }

  // 4. Check common install roots for the active platform.
  // Electron can launch with a trimmed PATH, so a bare "java" lookup can
  // miss a perfectly good JDK/JRE installed on disk.
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
          addCandidate(candidate, 'system');
        }
      } catch {}
    }
  } else if (process.platform === 'linux') {
    const roots = ['/usr/lib/jvm', '/usr/local/lib/jvm', '/opt', '/snap/jdk/current'];
    for (const root of roots) {
      try {
        const entries = fs.readdirSync(root, { withFileTypes: true });
        for (const e of entries) {
          let base;
          if (e.isDirectory()) {
            base = path.join(root, e.name);
          } else if (e.isSymbolicLink()) {
            try { base = fs.realpathSync(path.join(root, e.name)); } catch { continue; }
          } else {
            continue;
          }
          const candidate = path.join(base, 'bin', 'java');
          addCandidate(candidate, 'system');
        }
      } catch {}
    }
  } else if (process.platform === 'darwin') {
    const roots = [
      '/Library/Java/JavaVirtualMachines',
      '/opt/homebrew/opt',
      '/usr/local/opt',
    ];
    for (const root of roots) {
      try {
        const entries = fs.readdirSync(root, { withFileTypes: true });
        for (const e of entries) {
          let base;
          if (e.isDirectory()) {
            base = path.join(root, e.name);
            if (base.includes('jdk') || base.includes('jre') || base.includes('openjdk')) {
              const candidate = path.join(base, 'Contents', 'Home', 'bin', 'java');
              addCandidate(candidate, 'system');
            }
          }
        }
      } catch {}
    }
  }

  addCandidate('java', 'path');
  return candidates.map(({ path: candidatePath, source }) => ({ path: candidatePath, source }));
}

function inspectJava(candidate) {
  const javaPath = typeof candidate === 'string' ? candidate : candidate.path;
  const source = typeof candidate === 'string' ? 'unknown' : candidate.source;
  if (javaPath !== 'java' && !fs.existsSync(javaPath)) {
    return { path: javaPath, source, available: false, version: '', major: null, compatible: false };
  }
  if (process.platform !== 'win32' && javaPath !== 'java') {
    try { fs.chmodSync(javaPath, 0o755); } catch {}
  }
  try {
    const result = cp.spawnSync(javaPath, ['-version'], {
      windowsHide: true,
      timeout: 10000,
      encoding: 'utf8',
    });
    const available = !result.error && result.status === 0;
    const parsed = parseJavaVersionOutput(`${result.stderr || ''}\n${result.stdout || ''}`);
    return {
      path: javaPath,
      source,
      available,
      version: parsed.version,
      major: parsed.major,
      compatible: available && isCompatibleJavaVersion(parsed.version),
    };
  } catch {
    return { path: javaPath, source, available: false, version: '', major: null, compatible: false };
  }
}

function getJavaRuntimeState() {
  const inspected = getJavaCandidates().map(inspectJava);
  const selected = inspected.find(candidate => candidate.compatible) || null;
  const detected = selected || inspected.find(candidate => candidate.available) || null;
  return { requiredMajor: REQUIRED_JAVA_MAJOR, requiredVersion: REQUIRED_JAVA_VERSION, selected, detected };
}

function findJava() {
  const state = getJavaRuntimeState();
  return state.selected?.path || state.detected?.path || 'java';
}

function publicJavaInfo() {
  const state = getJavaRuntimeState();
  const current = state.selected || state.detected;
  return {
    path: current?.path || '',
    source: current?.source || 'missing',
    version: current?.version || '',
    major: current?.major ?? null,
    compatible: !!state.selected,
    requiredMajor: REQUIRED_JAVA_MAJOR,
    requiredVersion: REQUIRED_JAVA_VERSION,
  };
}

function ensureSuwayomiConfig(dataRoot) {
  fs.mkdirSync(dataRoot, { recursive: true });

  const configPath = path.join(dataRoot, 'server.conf');
  let existing = '';
  try {
    existing = fs.readFileSync(configPath, 'utf8');
  } catch {}
  let next = buildSuwayomiConfig(existing, appSettings.extensionRepos);
  if (appSettings.cloudflareHelperEnabled) {
    next = configureCloudflareHelper(next);
  }

  if (next !== existing) {
    fs.writeFileSync(configPath, next, 'utf8');
  }

  return configPath;
}

async function installManagedJre() {
  sendStatus('downloading-jre');
  const jreUrl = getJreUrl();
  const isTarGz = jreUrl.endsWith('.tar.gz');
  const archivePath = path.join(userData, isTarGz ? 'jre-download.tar.gz' : 'jre-download.zip');
  let lastReportedPct = -1;
  await download(jreUrl, archivePath, pct => {
    if (pct % 10 === 0 && pct !== lastReportedPct) {
      lastReportedPct = pct;
      sendStatus('downloading-jre:' + pct);
    }
  });
  sendStatus('extracting-jre');
  const extractDir = path.join(userData, 'jre-installing');
  const backupDir = path.join(userData, 'jre-backup');
  try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch {}
  await extractArchive(archivePath, extractDir);
  const folder = fs.readdirSync(extractDir).find(e => e.startsWith('jdk') || e.startsWith('OpenJDK'));
  if (!folder) throw new Error('JRE folder not found');
  const stagedJreDir = path.join(extractDir, folder);
  const stagedJava = process.platform === 'win32'
    ? path.join(stagedJreDir, 'bin', 'java.exe')
    : path.join(stagedJreDir, 'bin', 'java');
  const stagedInfo = inspectJava({ path: stagedJava, source: 'managed' });
  if (!stagedInfo.compatible) {
    throw new Error(`Downloaded Java is not compatible. Java ${REQUIRED_JAVA_VERSION} or newer is required.`);
  }

  try { fs.rmSync(backupDir, { recursive: true, force: true }); } catch {}
  if (fs.existsSync(jreDir)) fs.renameSync(jreDir, backupDir);
  try {
    fs.renameSync(stagedJreDir, jreDir);
  } catch (error) {
    if (!fs.existsSync(jreDir) && fs.existsSync(backupDir)) fs.renameSync(backupDir, jreDir);
    throw error;
  }
  try { fs.rmSync(backupDir, { recursive: true, force: true }); } catch {}
  if (process.platform !== 'win32') {
    try { fs.chmodSync(javaExe, 0o755); } catch (e) { console.warn('[jre] Failed to chmod javaExe:', e.message); }
  }
  try { fs.unlinkSync(archivePath); } catch {}
  try { fs.rmSync(extractDir, { recursive: true }); } catch {}
  console.log('[jre] Ready at', jreDir);
  sendStatus('java-repaired');
  return publicJavaInfo();
}

function findManagedCloudflareHelperExecutable(root = cloudflareHelperDir, depth = 0) {
  if (!managedCloudflareRelease || depth > 3 || !fs.existsSync(root)) return '';
  try {
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      const candidate = path.join(root, entry.name);
      if (entry.isFile() && entry.name.toLowerCase() === managedCloudflareRelease.executableName) return candidate;
      if (entry.isDirectory()) {
        const nested = findManagedCloudflareHelperExecutable(candidate, depth + 1);
        if (nested) return nested;
      }
    }
  } catch {}
  return '';
}

function hashFileSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function probeCloudflareHelper(timeoutMs = 1500) {
  return new Promise(resolve => {
    const req = http.get('http://127.0.0.1:8191/', res => {
      let body = '';
      res.on('data', chunk => { if (body.length < 8192) body += chunk; });
      res.on('end', () => {
        const location = String(res.headers.location || '').toLowerCase();
        const text = body.toLowerCase();
        const recognized = text.includes('flaresolverr') || text.includes('byparr') || location.startsWith('/docs');
        resolve(recognized ? { ready: true, kind: text.includes('byparr') || location.startsWith('/docs') ? 'Byparr' : 'FlareSolverr' } : { ready: false });
      });
    });
    req.on('error', () => resolve({ ready: false }));
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve({ ready: false }); });
  });
}

function callCloudflareHelper(body, timeoutMs = 90000) {
  return new Promise((resolve, reject) => {
    const payload = Buffer.from(JSON.stringify(body));
    const req = http.request({
      hostname: '127.0.0.1',
      port: 8191,
      path: '/v1',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': payload.length,
      },
    }, res => {
      let responseBody = '';
      res.on('data', chunk => {
        if (responseBody.length < 1024 * 1024) responseBody += chunk;
      });
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(responseBody); } catch {
          reject(new Error(`The Cloudflare helper returned an invalid response (${res.statusCode || 0}).`));
          return;
        }
        if ((res.statusCode || 500) >= 400 || parsed.status === 'error') {
          reject(new Error(parsed.message || `The Cloudflare helper returned ${res.statusCode || 500}.`));
          return;
        }
        resolve(parsed);
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error('The protected-source browser session took too long to start.')));
    req.end(payload);
  });
}

async function warmCloudflareSession() {
  if (cloudflareSessionWarmupPromise) return cloudflareSessionWarmupPromise;
  cloudflareSessionWarmupPromise = (async () => {
    const current = await callCloudflareHelper({ cmd: 'sessions.list' }, 10000);
    if (hasCloudflareSession(current)) return { ready: true, existing: true };

    sendStatus('warming-cloudflare-session');
    const created = await callCloudflareHelper({
      cmd: 'sessions.create',
      session: SUWAYOMI_CLOUDFLARE_SESSION,
    });
    if (created.status !== 'ok') {
      throw new Error(created.message || 'The protected-source browser session could not start.');
    }
    return { ready: true, existing: false };
  })().finally(() => { cloudflareSessionWarmupPromise = null; });
  return cloudflareSessionWarmupPromise;
}

async function waitForCloudflareHelper(timeoutMs = 90000, proc = cloudflareHelperProc) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const state = await probeCloudflareHelper();
    if (state.ready) return state;
    if (proc && (proc.exitCode !== null || proc.signalCode)) {
      throw new Error(`The Cloudflare helper stopped during startup${proc.exitCode !== null ? ` (exit ${proc.exitCode})` : ''}.`);
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('The Cloudflare helper did not become ready in time.');
}

async function installManagedCloudflareHelper() {
  if (cloudflareHelperInstallPromise) return cloudflareHelperInstallPromise;
  cloudflareHelperInstallPromise = (async () => {
    if (!managedCloudflareRelease) {
      throw new Error('Automatic Cloudflare helper setup is available on Windows x64 and Linux x64.');
    }

    sendStatus('downloading-cloudflare-helper');
    let lastReportedPct = -1;
    await download(managedCloudflareRelease.url, cloudflareHelperArchive, pct => {
      if (pct % 5 === 0 && pct !== lastReportedPct) {
        lastReportedPct = pct;
        sendStatus(`downloading-cloudflare-helper:${pct}`);
      }
    });

    const archiveSize = fs.statSync(cloudflareHelperArchive).size;
    if (archiveSize !== managedCloudflareRelease.size) {
      throw new Error('The downloaded Cloudflare helper has an unexpected size.');
    }
    const archiveDigest = await hashFileSha256(cloudflareHelperArchive);
    if (archiveDigest !== managedCloudflareRelease.sha256) {
      throw new Error('The downloaded Cloudflare helper failed its security check.');
    }

    sendStatus('extracting-cloudflare-helper');
    const stagingDir = path.join(userData, 'flaresolverr-installing');
    const backupDir = path.join(userData, 'flaresolverr-backup');
    try { fs.rmSync(stagingDir, { recursive: true, force: true }); } catch {}
    try { fs.rmSync(backupDir, { recursive: true, force: true }); } catch {}
    await extractArchive(cloudflareHelperArchive, stagingDir);
    if (!findManagedCloudflareHelperExecutable(stagingDir)) {
      throw new Error(`The downloaded Cloudflare helper did not contain ${managedCloudflareRelease.executableName}.`);
    }

    if (fs.existsSync(cloudflareHelperDir)) fs.renameSync(cloudflareHelperDir, backupDir);
    try {
      fs.renameSync(stagingDir, cloudflareHelperDir);
    } catch (error) {
      if (!fs.existsSync(cloudflareHelperDir) && fs.existsSync(backupDir)) fs.renameSync(backupDir, cloudflareHelperDir);
      throw error;
    }
    try { fs.rmSync(backupDir, { recursive: true, force: true }); } catch {}
    try { fs.unlinkSync(cloudflareHelperArchive); } catch {}
    const executable = findManagedCloudflareHelperExecutable();
    if (process.platform !== 'win32') fs.chmodSync(executable, 0o755);
    sendStatus('cloudflare-helper-installed');
    return executable;
  })().finally(() => { cloudflareHelperInstallPromise = null; });
  return cloudflareHelperInstallPromise;
}

async function startManagedCloudflareHelper() {
  const existing = await probeCloudflareHelper();
  if (existing.ready) return existing;

  const executable = findManagedCloudflareHelperExecutable();
  if (!executable) return { ready: false, needsInstall: true };
  if (process.platform !== 'win32') {
    try { fs.chmodSync(executable, 0o755); } catch (error) {
      throw new Error(`The Cloudflare helper is not executable: ${error.message}`);
    }
  }
  if (cloudflareHelperProc) return waitForCloudflareHelper(90000, cloudflareHelperProc);

  killStaleCloudflareDriver();

  sendStatus('starting-cloudflare-helper');
  try {
    fs.mkdirSync(cloudflareHelperRuntime.rootDir, { recursive: true });
    for (const entry of fs.readdirSync(cloudflareHelperRuntime.rootDir, { withFileTypes: true })) {
      const candidate = path.join(cloudflareHelperRuntime.rootDir, entry.name);
      if (entry.isDirectory() && candidate !== cloudflareHelperRuntime.sessionDir) {
        try { fs.rmSync(candidate, { recursive: true, force: true }); } catch {}
      }
    }
    fs.mkdirSync(cloudflareHelperRuntime.sessionDir, { recursive: true });
  } catch (error) {
    throw new Error(`The Cloudflare helper profile could not be prepared: ${error.message}`);
  }
  const proc = cp.spawn(executable, [], {
    cwd: path.dirname(executable),
    env: {
      ...cloudflareHelperRuntime.env,
      HOST: '127.0.0.1',
      PORT: '8191',
      LOG_LEVEL: 'info',
      HEADLESS: 'true',
      CAPTCHA_SOLVER: 'none',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    detached: false,
  });
  cloudflareHelperProc = proc;
  fs.writeFileSync(cloudflareHelperPidFile, String(proc.pid));
  proc.stdout.on('data', data => {
    const line = data.toString().trim();
    if (line) console.log('[cloudflare-helper]', line.slice(0, 200));
  });
  proc.stderr.on('data', data => {
    const line = data.toString().trim();
    if (line) console.error('[cloudflare-helper:err]', line.slice(0, 200));
  });
  proc.on('exit', code => {
    console.log('[cloudflare-helper] exited', code);
    if (cloudflareHelperProc === proc) cloudflareHelperProc = null;
    try { fs.unlinkSync(cloudflareHelperPidFile); } catch {}
    if (code) killStaleCloudflareDriver();
  });
  proc.on('error', error => console.error('[cloudflare-helper] spawn error:', error.message));

  return waitForCloudflareHelper(90000, proc);
}

function enableCloudflareHelperConfig() {
  let existing = '';
  try { existing = fs.readFileSync(suwayomiConfigPath, 'utf8'); } catch {}
  const next = configureCloudflareHelper(existing);
  const changed = next !== existing;
  if (changed) fs.writeFileSync(suwayomiConfigPath, next, 'utf8');
  if (!appSettings.cloudflareHelperEnabled) {
    appSettings.cloudflareHelperEnabled = true;
    saveSettings(appSettings);
  }
  return changed;
}

async function prepareCloudflareHelper({ allowInstall = false } = {}) {
  let helper = await probeCloudflareHelper();
  if (!helper.ready) helper = await startManagedCloudflareHelper();
  if (!helper.ready && helper.needsInstall && !allowInstall) return helper;
  if (!helper.ready && helper.needsInstall) {
    await installManagedCloudflareHelper();
    helper = await startManagedCloudflareHelper();
  }
  if (!helper.ready) throw new Error('The Cloudflare helper could not start.');

  let sessionReady = false;
  try {
    sessionReady = (await warmCloudflareSession()).ready;
  } catch (error) {
    // Session warming is only an optimization. Suwayomi can still request the
    // named session when the first protected source is opened.
    console.warn('[cloudflare-helper] Session warm-up was unavailable:', error.message);
  }

  const configChanged = enableCloudflareHelperConfig();
  if (configChanged) {
    const restarted = await ensureManagedServices({ restart: true });
    if (!restarted) throw new Error('Suwayomi could not restart with the Cloudflare helper enabled.');
  }
  sendStatus('cloudflare-helper-ready');
  return { ready: true, kind: helper.kind || 'FlareSolverr', restarted: configChanged, sessionReady };
}

// Cross-platform recursive copy — replaces fs.cpSync for older Node.js
async function ensureJre() {
  const state = getJavaRuntimeState();
  if (state.selected) {
    console.log(`[jre] Using Java ${state.selected.version}:`, state.selected.path);
    sendStatus(state.selected.source === 'managed' ? 'using-managed-java' : 'using-system-java');
    return state.selected;
  }

  if (state.detected) {
    console.warn(`[jre] Java ${state.detected.version || 'unknown'} is too old; Java ${REQUIRED_JAVA_VERSION}+ is required.`);
    sendStatus(`java-incompatible:${state.detected.version || 'unknown'}`);
  } else {
    sendStatus('java-missing');
  }

  try {
    await installManagedJre();
    return getJavaRuntimeState().selected;
  } catch (error) {
    error.serviceIssue = {
      code: state.detected ? 'java-incompatible' : 'java-missing',
      title: state.detected ? 'Java needs an update' : 'Java is required',
      message: state.detected
        ? `Java ${state.detected.version || 'unknown'} was found, but Suwayomi requires Java ${REQUIRED_JAVA_VERSION} or newer.`
        : `Suwayomi requires Java ${REQUIRED_JAVA_VERSION} or newer.`,
      detail: `The automatic Java installation failed: ${error.message}`,
      canRepairJava: true,
      detectedJavaMajor: state.detected?.major ?? null,
      detectedJavaVersion: state.detected?.version || '',
      javaPath: state.detected?.path || '',
    };
    throw error;
  }
}

async function ensureJar() {
  fs.mkdirSync(suwayomiRuntimeDir, { recursive: true });
  if (!fs.existsSync(jarPath) && fs.existsSync(legacyJarPath)) {
    const legacySize = fs.statSync(legacyJarPath).size;
    if (legacySize >= MIN_SERVER_JAR_SIZE) {
      try {
        fs.renameSync(legacyJarPath, jarPath);
      } catch {
        fs.copyFileSync(legacyJarPath, jarPath);
      }
      console.log('[jar] Migrated cached Suwayomi JAR to its isolated runtime directory');
    }
  }
  if (fs.existsSync(jarPath)) {
    const sz = fs.statSync(jarPath).size;
    // The cached JAR must look like the actual Suwayomi server (100+ MB),
    // not the GUI launcher (~16 MB). A stale launcher in userData would
    // boot, fail to find the real server, and surface as
    // "Could not find Suwayomi-Server.jar at ..." — exactly the regression
    // we're guarding against here.
    if (sz >= MIN_SERVER_JAR_SIZE) {
      sendStatus('using-existing-suwayomi');
      return;
    }
    console.warn('[jar] Existing JAR is too small (', sz, 'bytes), replacing:', jarPath);
    try { fs.unlinkSync(jarPath); } catch {}
  }

  const bundled = findBundledSuwayomi(backendDir);
  if (bundled) {
    console.log('[jar] Found bundled JAR:', bundled.name);
    sendStatus('installing-bundled-suwayomi');
    try {
      fs.copyFileSync(bundled.path, jarPath);
      const sz = fs.statSync(jarPath).size;
      if (sz >= MIN_SERVER_JAR_SIZE) {
        console.log('[jar] Bundled JAR copied to', jarPath, '- size:', sz, 'bytes');
        return;
      }
      console.error('[jar] Copied JAR too small (', sz, 'bytes), removing and falling back to download');
      fs.unlinkSync(jarPath);
    } catch (e) {
      console.error('[jar] Copy failed:', e.message);
    }
  } else {
    console.log('[jar] No bundled Suwayomi JAR found in', backendDir);
  }

  sendStatus('downloading-suwayomi');
  const { url, version } = await getLatestJarUrl();
  console.log('[jar] Latest:', version);
  let lastReportedPct = -1;
  await download(url, jarPath, pct => {
    if (pct % 5 === 0 && pct !== lastReportedPct) {
      lastReportedPct = pct;
      sendStatus('downloading-suwayomi:' + pct);
    }
  });
  // Sanity-check what we just downloaded; a truncated/corrupt download
  // would otherwise be picked up on the next launch and silently fail.
  const downloadedSz = fs.statSync(jarPath).size;
  if (downloadedSz < MIN_SERVER_JAR_SIZE) {
    fs.unlinkSync(jarPath);
    throw new Error(`Downloaded Suwayomi JAR is suspiciously small (${downloadedSz} bytes); aborting.`);
  }
  console.log('[jar] Ready at', jarPath, '- size:', downloadedSz, 'bytes');
}

// Scan directory for a bundled Suwayomi server JAR.
//
// We intentionally ignore linux-assets.tar.gz here. That tarball ships
// with the .deb/.rpm-style system install and only contains:
//   - Suwayomi-Launcher.jar (a Compose Desktop GUI app, not a server)
//   - suwayomi-server.sh, suwayomi-server.service, .desktop, .tmpfiles, ...
// The launcher expects to find the real server at
// <install-root>/bin/Suwayomi-Server.jar (the .deb layout, e.g.
// /usr/share/java/suwayomi-server/bin/Suwayomi-Server.jar) and crashes
// with "Could not find Suwayomi-Server.jar at ..." in akaReader's
// embedded layout. Use the standalone Suwayomi-Server-v*.jar instead —
// it's the actual server, same asset Windows already uses.
function findBundledSuwayomi(dir) {
  try {
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir);
    // Prefer the standalone server JAR. Match the Suwayomi-Server prefix
    // (with or without version) but explicitly exclude the GUI launcher.
    const jar = files.find(f =>
      f.startsWith('Suwayomi-Server') &&
      f.endsWith('.jar') &&
      !f.toLowerCase().includes('launcher')
    );
    if (jar) return { name: jar, path: path.join(dir, jar), type: 'jar' };
    // Nested JAR (some releases unpack into a subfolder)
    for (const f of files) {
      if (f.endsWith('.jar') && f.includes('Suwayomi') && !f.toLowerCase().includes('launcher')) {
        return { name: f, path: path.join(dir, f), type: 'jar' };
      }
    }
  } catch (e) {
    console.warn('[jar] Scan failed:', e.message);
  }
  return null;
}

async function ensureNssm() {
  if (process.platform !== 'win32') return;
  if (fs.existsSync(nssmExe)) return;
  const zipPath    = path.join(userData, 'nssm.zip');
  const extractDir = path.join(userData, 'nssm-extract');
  await download('https://nssm.cc/release/nssm-2.24.zip', zipPath, null);
  await extractArchive(zipPath, extractDir);
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
  if (process.platform !== 'win32') return false;
  await ensureNssm();
  const java     = findJava();
  const dataRoot = path.join(userData, 'suwayomi-data');
  ensureSuwayomiConfig(dataRoot);
  const cmds = [
    `"${nssmExe}" install AkaReaderSuwayomi "${java}"`,
    `"${nssmExe}" set AkaReaderSuwayomi AppParameters "-Dsuwayomi.tachidesk.config.server.rootDir=\\"${dataRoot}\\" -jar \\"${jarPath}\\" --server.port=4567"`,
    `"${nssmExe}" set AkaReaderSuwayomi AppDirectory "${userData}"`,
    `"${nssmExe}" set AkaReaderSuwayomi Start SERVICE_AUTO_START`,
    `"${nssmExe}" set AkaReaderSuwayomi AppStdout "${path.join(userData, 'suwayomi.log')}"`,
    `"${nssmExe}" set AkaReaderSuwayomi AppStderr "${path.join(userData, 'suwayomi-err.log')}"`,
    `net start AkaReaderSuwayomi`,
  ];
  for (const cmd of cmds) cp.execSync(cmd, { windowsHide: true });
  return true;
}

async function uninstallWindowsService() {
  if (process.platform !== 'win32') return false;
  try { cp.execSync('net stop AkaReaderSuwayomi',  { windowsHide: true }); } catch {}
  try { cp.execSync('sc delete AkaReaderSuwayomi', { windowsHide: true }); } catch {}
  return true;
}

// ── Process-tree kill ────────────────────────────────────────────────────────
// FIX: On Windows, /F /T kills the parent AND all child processes (entire Java tree)
function killPid(pid) {
  if (!pid) return;
  if (process.platform === 'win32') {
    try { cp.spawnSync('taskkill', ['/F', '/T', '/PID', String(pid)], { windowsHide: true, timeout: 5000 }); } catch {}
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

function killStaleCloudflareDriver() {
  if (process.platform !== 'win32') return [];
  const command = [
    "Get-Process chromedriver -ErrorAction SilentlyContinue",
    "Where-Object { $_.Path -eq $env:AKAREADER_FLARESOLVERR_DRIVER }",
    'ForEach-Object { $_.Id }',
  ].join(' | ');
  let result;
  try {
    result = cp.spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
      env: { ...process.env, AKAREADER_FLARESOLVERR_DRIVER: cloudflareHelperRuntime.sharedDriverPath },
      windowsHide: true,
      encoding: 'utf8',
      timeout: 5000,
    });
  } catch {
    return [];
  }
  const pids = String(result.stdout || '')
    .split(/\s+/)
    .map(value => Number.parseInt(value, 10))
    .filter(Number.isInteger);
  for (const pid of pids) killPid(pid);
  if (pids.length) console.log('[cloudflare-helper] removed stale managed driver process', pids.join(', '));
  return pids;
}

function killCloudflareHelper() {
  const pid = cloudflareHelperProc?.pid;
  cloudflareHelperProc = null;
  if (pid) killPid(pid);
  try { fs.unlinkSync(cloudflareHelperPidFile); } catch {}
  try { fs.rmSync(cloudflareHelperRuntime.sessionDir, { recursive: true, force: true }); } catch {}
}

function killOrphanedCloudflareHelper() {
  try {
    if (!fs.existsSync(cloudflareHelperPidFile)) return;
    const pid = parseInt(fs.readFileSync(cloudflareHelperPidFile, 'utf8').trim(), 10);
    if (!Number.isNaN(pid)) {
      killPid(pid);
      console.log('[cleanup] Killed orphaned Cloudflare helper PID', pid);
    }
    fs.unlinkSync(cloudflareHelperPidFile);
  } catch {}
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
const SUWAYOMI_STARTUP_TIMEOUT_MS = 10 * 60 * 1000;

function waitForSuwayomi(timeoutMs = SUWAYOMI_STARTUP_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const start   = Date.now();
    const attempt = () => {
      if (Date.now() - start > timeoutMs) return reject(new Error('Suwayomi timeout'));
      const req = http.request('http://localhost:4567/api/graphql', {
        method: 'POST',
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
          setTimeout(attempt, 1500);
        });
      });
      req.on('error', () => setTimeout(attempt, 1500));
      req.setTimeout(3000, () => req.destroy());
      req.write(JSON.stringify({ query: 'query { aboutServer { version } }' }));
      req.end();
    };
    attempt();
  });
}

async function startSuwayomi() {
  try {
    await Promise.race([
      waitForSuwayomi(2000),
      new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 2500))
    ]);
    console.log('[suwayomi] Already running');
    serviceMode = true;
    return true;
  } catch {}

  const java     = findJava();
  const dataRoot = path.join(userData, 'suwayomi-data');
  sendStatus('configuring-suwayomi');
  ensureSuwayomiConfig(dataRoot);
  fs.mkdirSync(suwayomiWorkDir, { recursive: true });
  sendStatus('starting-suwayomi');
  console.log('[suwayomi] Launching…');

  const proc = cp.spawn(java, [
    `-Dsuwayomi.tachidesk.config.server.rootDir=${dataRoot}`,
    '-Xmx512m', '-jar', jarPath,
    '--server.port=4567',
  ], {
    // Keep the executable JAR and working directory isolated from the managed
    // Java and user data. Current Windows standalone releases can otherwise
    // fail their migration/GraphQL self-scan even with a valid JAR and Java.
    cwd: suwayomiWorkDir, stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true, detached: false,
  });
  suwayomiProc = proc;
  let stderrBuffer = '';
  let startupComplete = false;
  let rejectEarlyExit;
  const earlyExit = new Promise((_, reject) => { rejectEarlyExit = reject; });

  // FIX: write PID immediately so cleanup works even after forced kill
  fs.writeFileSync(suwayomiPidFile, String(proc.pid));

  proc.on('error', err => {
    console.error('[suwayomi] spawn error:', err.message);
    if (!startupComplete) rejectEarlyExit(err);
  });

  proc.stdout.on('data', d => {
    const l = d.toString().trim();
    if (l) console.log('[suwayomi]', l.slice(0, 120));
    const setupProgress = [...l.matchAll(/Downloading\s+(\d{1,3})%\s+of/gi)].at(-1);
    if (setupProgress) sendStatus(`preparing-suwayomi:${Math.min(100, Number(setupProgress[1]))}`);
  });
  proc.stderr.on('data', d => {
    const l = d.toString().trim();
    if (l) console.error('[suwayomi:err]', l.slice(0, 120));
    stderrBuffer += `${l}\n`;
  });
  proc.on('exit', code => {
    console.log('[suwayomi] exited', code);
    if (suwayomiProc === proc) suwayomiProc = null;
    try { fs.unlinkSync(suwayomiPidFile); } catch {}
    if (isQuitting) return;
    const issue = classifySuwayomiFailure(stderrBuffer, code);
    const error = new Error(issue.message);
    error.serviceIssue = issue;
    if (!startupComplete) rejectEarlyExit(error);
    else {
      setServiceIssue(issue);
      sendStatus('crashed');
    }
  });

  try {
    await Promise.race([waitForSuwayomi(), earlyExit]);
    startupComplete = true;
    console.log('[suwayomi] Ready!');
    return true;
  } catch (e) {
    console.error('[suwayomi] Failed:', e.message);
    throw e;
  }
}

// ── Backend server ────────────────────────────────────────────────────────────
function assertBackendRuntime() {
  const missing = getMissingBackendFiles(backendDir);
  if (!missing.length) return;
  const error = new Error(`The local service installation is incomplete (${missing.join(', ')}).`);
  error.serviceIssue = {
    code: 'backend-runtime-incomplete',
    title: 'akaReader needs repair',
    message: 'The local service files are incomplete.',
    detail: 'Reinstall akaReader using the latest installer or portable package.',
    canRepairJava: false,
  };
  throw error;
}

function scheduleServerRestart(stderrBuffer = '') {
  if (isQuitting || serverRestartTimer) return;
  serverRestartAttempts += 1;
  if (serverRestartAttempts > 5) {
    const firstErrorLine = String(stderrBuffer).split(/\r?\n/).find(Boolean) || '';
    setServiceIssue({
      code: 'backend-crash-loop',
      title: 'Local service keeps stopping',
      message: 'akaReader could not keep its local service running.',
      detail: firstErrorLine || 'Restart akaReader. If this continues, reinstall the latest release.',
      canRepairJava: false,
    });
    sendStatus('service-issue:backend-crash-loop');
    return;
  }
  const delayMs = Math.min(3000 * (2 ** (serverRestartAttempts - 1)), 30000);
  sendStatus(`backend-restarting:${serverRestartAttempts}`);
  serverRestartTimer = setTimeout(() => {
    serverRestartTimer = null;
    try { startServer(); } catch (error) {
      setServiceIssue(error.serviceIssue || {
        code: 'backend-start-failed',
        title: 'Local service could not start',
        message: error.message,
        detail: 'Reinstall akaReader using the latest release.',
        canRepairJava: false,
      });
      sendStatus('service-issue:backend-start-failed');
    }
  }, delayMs);
}

function startServer() {
  if (serverProc) return;
  assertBackendRuntime();
  console.log('[server] starting at', backendDir);

  const env = {
    ...process.env,
    PORT: '3001',
    HOST: '127.0.0.1',
    AKAREADER_API_TOKEN: backendApiToken,
    EXT_DIR: userExtDir,
    SUWAYOMI_EXT_DIR: path.join(userData, 'suwayomi-data', 'extensions'),
    SUWAYOMI_URL: 'http://localhost:4567',
  };

  serverProc = utilityProcess.fork(serverPath, [], {
    cwd: backendDir,
    env,
    stdio: 'pipe',
    serviceName: 'akaReader-backend',
  });

  let stderrBuffer = '';
  serverProc.stdout.on('data', d => {
    const l = d.toString().trim();
    if (l) console.log('[server]', l);
  });
  serverProc.stderr.on('data', d => {
    const l = d.toString().trim();
    if (l) console.error('[server:err]', l);
    stderrBuffer += l + '\n';
  });

  serverProc.on('spawn', () => {
    console.log('[server] spawned (pid:', serverProc.pid, ')');
    sendStatus('backend-spawned');
  });
  serverProc.on('error', err => {
    console.error('[server] fork error:', err.message);
    sendStatus('backend-error:' + err.message);
  });
  serverProc.on('exit', (code, signal) => {
    console.log('[server] exited', code, signal ? `(${signal})` : '');
    if (stderrBuffer) console.error('[server] final stderr:\n', stderrBuffer.slice(0, 1000));
    serverProc = null;
    scheduleServerRestart(stderrBuffer);
  });
}

function killServer() {
  if (serverRestartTimer) clearTimeout(serverRestartTimer);
  serverRestartTimer = null;
  serverRestartAttempts = 0;
  if (!serverProc) return;
  const p = serverProc; serverProc = null;
  try { p.kill(); } catch {}
}

const SERVER_PORT = '3001';

function waitForServer(retries = 30, delayMs = 300) {
  return new Promise(resolve => {
    let attempts = 0;
    const check = () => {
      const req = http.get({
        hostname: '127.0.0.1',
        port: SERVER_PORT,
        path: '/api/ping',
        headers: { 'X-AkaReader-Token': backendApiToken },
      }, res => { resolve(res.statusCode === 200); });
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
  // A retry during a slow first-run download must join the existing work.
  // Starting a second attempt would make both downloads write the same file.
  if (servicesPromise) return servicesPromise;

  servicesPromise = (async () => {
    try {
      clearServiceIssue();
      if (restart) {
        if (suwayomiProc) killSuwayomi();
        killServer();
        serviceMode = false;
        await new Promise(r => setTimeout(r, 500));
      }

      sendStatus('starting-backend');
      startServer();
      // Cold Windows starts can spend more than ten seconds loading the
      // backend through Defender before the loopback listener is available.
      const serverOk = await waitForServer(120, 250);
      if (!serverOk) {
        sendStatus('offline');
        return false;
      }
      serverRestartAttempts = 0;
      sendStatus('backend-ready');

      if (appSettings.cloudflareHelperEnabled && findManagedCloudflareHelperExecutable()) {
        // Only previous protected-source users pay this cost. Start it beside
        // Java/Suwayomi so Chromium is ready by the time browsing is usable;
        // this detached warm-up never blocks the main readiness path.
        prepareCloudflareHelper({ allowInstall: false }).catch(error => {
          console.warn('[cloudflare-helper] Background warm-up was unavailable:', error.message);
        });
      }

      sendStatus('suwayomi-starting');
      // Wrap JRE/JAR setup in try/catch to avoid unhandled rejections
      try {
        await ensureJre();
        await ensureJar();
      } catch (e) {
        console.error('[startup] JRE/JAR setup failed:', e.message);
        sendStatus('setup-failed:' + e.message);
        throw e;
      }

      if (await isServiceRunning()) {
        console.log('[startup] Service already running, waiting for it to be ready...');
        serviceMode = true;
        await waitForSuwayomi();
      } else {
        serviceMode = false;
        const started = await startSuwayomi();
        if (!started) return false;
      }

      clearServiceIssue();
      sendStatus('suwayomi-ready');
      sendStatus('online');
      return true;
    } catch (e) {
      console.error('[startup] Service error:', e.message);
      setServiceIssue(e.serviceIssue || {
        code: 'service-start-failed',
        title: 'Local service could not start',
        message: e.message || 'akaReader could not start Suwayomi.',
        detail: 'Retry the service. If the problem continues, open the data folder and check the Suwayomi logs.',
        canRepairJava: false,
      });
      sendStatus('suwayomi-failed:' + e.message);
      return false;
    } finally {
      servicesPromise = null;
    }
  })();

  return servicesPromise;
}

const BACKUP_SCHEMA = 'akareader-backup';
const BACKUP_VERSION = 3;
const BACKUP_MAX_BYTES = 10 * 1024 * 1024;
const AUTO_BACKUP_LIMIT = 5;

function validateBackupPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('The backup data is invalid.');
  }
  const isLegacyV2 = !payload.schema && payload.version === 2
    && (Array.isArray(payload.library) || Array.isArray(payload.history));
  if (!isLegacyV2 && (payload.schema !== BACKUP_SCHEMA || !Number.isInteger(payload.version) || payload.version < 2 || payload.version > BACKUP_VERSION)) {
    throw new Error('The backup format is not supported.');
  }
  if (!isLegacyV2 && (!payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data))) {
    throw new Error('The backup contains no app data.');
  }
  const text = JSON.stringify(payload, null, 2);
  if (Buffer.byteLength(text, 'utf8') > BACKUP_MAX_BYTES) {
    throw new Error('The backup is unexpectedly large and was not saved.');
  }
  return text;
}

function writeJsonAtomically(targetPath, text) {
  const temporaryPath = `${targetPath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, text, { encoding: 'utf8', mode: 0o600 });
  try {
    fs.renameSync(temporaryPath, targetPath);
  } catch (error) {
    try { fs.unlinkSync(temporaryPath); } catch {}
    throw error;
  }
}

function automaticBackupPath() {
  const backupDir = path.join(userData, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(backupDir, `akareader-before-update-${stamp}.json`);
}

function pruneAutomaticBackups() {
  const backupDir = path.join(userData, 'backups');
  if (!fs.existsSync(backupDir)) return;
  const backups = fs.readdirSync(backupDir, { withFileTypes: true })
    .filter(entry => entry.isFile() && /^akareader-before-update-.*\.json$/i.test(entry.name))
    .map(entry => ({ name: entry.name, path: path.join(backupDir, entry.name) }))
    .sort((left, right) => right.name.localeCompare(left.name));
  for (const backup of backups.slice(AUTO_BACKUP_LIMIT)) {
    try { fs.unlinkSync(backup.path); } catch {}
  }
}

function probeSuwayomiOnce(timeoutMs = 1500) {
  return new Promise(resolve => {
    const req = http.request('http://127.0.0.1:4567/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, res => {
      let body = '';
      res.on('data', chunk => { if (body.length < 32768) body += chunk; });
      res.on('end', () => {
        try {
          const version = JSON.parse(body)?.data?.aboutServer?.version || '';
          resolve({ ready: res.statusCode >= 200 && res.statusCode < 300 && !!version, version });
        } catch {
          resolve({ ready: false, version: '' });
        }
      });
    });
    req.on('error', () => resolve({ ready: false, version: '' }));
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve({ ready: false, version: '' }); });
    req.write(JSON.stringify({ query: 'query { aboutServer { version } }' }));
    req.end();
  });
}

function getDiskSpace() {
  try {
    const stat = fs.statfsSync(userData);
    return {
      freeBytes: Number(stat.bavail) * Number(stat.bsize),
      totalBytes: Number(stat.blocks) * Number(stat.bsize),
    };
  } catch {
    return { freeBytes: null, totalBytes: null };
  }
}

function testDataDirectoryWritable() {
  const checkPath = path.join(userData, `.akareader-write-check-${process.pid}-${Date.now()}`);
  try {
    fs.writeFileSync(checkPath, 'ok', { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    fs.unlinkSync(checkPath);
    return true;
  } catch {
    try { fs.unlinkSync(checkPath); } catch {}
    return false;
  }
}

async function getSystemDiagnostics() {
  const [backendReady, suwayomi, helper] = await Promise.all([
    waitForServer(1, 0),
    probeSuwayomiOnce(),
    probeCloudflareHelper(),
  ]);
  const java = publicJavaInfo();
  const missingBackendFiles = getMissingBackendFiles(backendDir);
  const jarSize = fs.existsSync(jarPath) ? fs.statSync(jarPath).size : 0;
  const disk = getDiskSpace();
  const writable = testDataDirectoryWritable();
  const checks = [
    {
      id: 'backend', label: 'Local API',
      status: missingBackendFiles.length ? 'fail' : backendReady ? 'pass' : 'fail',
      detail: missingBackendFiles.length
        ? `Packaged files are missing: ${missingBackendFiles.join(', ')}`
        : backendReady ? 'The local API is responding.' : 'The local API is not responding.',
      repair: missingBackendFiles.length ? 'reinstall-app' : 'restart-services',
    },
    {
      id: 'java', label: 'Java runtime', status: java.compatible ? 'pass' : 'fail',
      detail: java.compatible
        ? `Java ${java.version || java.major} is compatible (${java.source}).`
        : `Java ${REQUIRED_JAVA_VERSION} or newer is required.`,
      repair: java.compatible ? null : 'install-java',
    },
    {
      id: 'suwayomi', label: 'Suwayomi server', status: suwayomi.ready ? 'pass' : 'fail',
      detail: suwayomi.ready ? `Suwayomi ${suwayomi.version} is responding.` : 'Suwayomi is not responding.',
      repair: 'restart-services',
    },
    {
      id: 'jar', label: 'Embedded server files', status: jarSize >= MIN_SERVER_JAR_SIZE ? 'pass' : 'fail',
      detail: jarSize >= MIN_SERVER_JAR_SIZE ? 'The Suwayomi server package is present.' : 'The Suwayomi server package is missing or incomplete.',
      repair: 'restart-services',
    },
    {
      id: 'storage', label: 'Data storage',
      status: !writable ? 'fail' : (disk.freeBytes !== null && disk.freeBytes < 512 * 1024 * 1024) ? 'warn' : 'pass',
      detail: !writable
        ? 'akaReader cannot write to its data folder.'
        : disk.freeBytes === null ? 'The data folder is writable.' : `${Math.round(disk.freeBytes / 1024 / 1024)} MB free; the data folder is writable.`,
      repair: !writable ? 'open-data-folder' : null,
    },
    {
      id: 'cloudflare', label: 'Protected-source helper',
      status: !appSettings.cloudflareHelperEnabled ? 'pass' : helper.ready ? 'pass' : 'warn',
      detail: !appSettings.cloudflareHelperEnabled
        ? 'Optional; it will only be installed when a protected source needs it.'
        : helper.ready ? `${helper.kind || 'The helper'} is ready.` : 'The helper is enabled but is not ready yet.',
      repair: appSettings.cloudflareHelperEnabled && !helper.ready ? 'restart-services' : null,
    },
  ];
  const status = checks.some(check => check.status === 'fail')
    ? 'fail'
    : checks.some(check => check.status === 'warn') ? 'warn' : 'pass';
  return {
    status,
    checkedAt: new Date().toISOString(),
    app: { version: app.getVersion(), platform: process.platform, arch: process.arch, packaged: app.isPackaged },
    checks,
    serviceIssue: lastServiceIssue,
  };
}

// ── IPC ───────────────────────────────────────────────────────────────────────
ipcMain.handle('get-close-to-tray',      ()    => appSettings.closeToTray);
ipcMain.on('get-api-token', event => { event.returnValue = backendApiToken; });
ipcMain.handle('set-close-to-tray',      (_, v) => { appSettings.closeToTray = v; saveSettings(appSettings); });
ipcMain.handle('get-start-with-windows', ()    => appSettings.startWithWindows);
ipcMain.on(    'set-start-with-windows', (_, v) => { appSettings.startWithWindows = v; saveSettings(appSettings); setWindowsStartup(v); });
ipcMain.handle('get-extension-repos', () => ({
  defaults: [...DEFAULT_EXTENSION_STORES],
  custom: [...appSettings.extensionRepos],
  all: configuredExtensionStores(appSettings.extensionRepos),
}));
ipcMain.handle('set-extension-repos', (_, repos) => {
  if (!Array.isArray(repos)) throw new Error('Extension repositories must be a list.');
  const requested = repos.map(value => typeof value === 'string' ? value.trim() : '').filter(Boolean);
  const invalid = requested.find(url => !isValidExtensionStoreUrl(url));
  if (invalid) throw new Error('Use a valid http:// or https:// extension repository URL.');
  appSettings.extensionRepos = normalizeExtensionStoreUrls(requested);
  saveSettings(appSettings);
  ensureSuwayomiConfig(path.join(userData, 'suwayomi-data'));
  return {
    defaults: [...DEFAULT_EXTENSION_STORES],
    custom: [...appSettings.extensionRepos],
    all: configuredExtensionStores(appSettings.extensionRepos),
  };
});

ipcMain.handle('window-minimize', ()     => mainWindow?.minimize());
ipcMain.handle('window-maximize', ()     => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize());
ipcMain.handle('window-close',    ()     => {
  if (!isQuitting && appSettings.closeToTray) mainWindow?.hide();
  else { isQuitting = true; app.quit(); }
});

ipcMain.handle('ensure-services', () => ensureManagedServices());
ipcMain.handle('restart-services', () => ensureManagedServices({ restart: true }));
ipcMain.handle('get-system-diagnostics', () => getSystemDiagnostics());
ipcMain.handle('repair-system', async () => {
  const missingBackendFiles = getMissingBackendFiles(backendDir);
  if (missingBackendFiles.length) {
    return { ok: false, error: 'The installed app files are incomplete. Reinstall the latest akaReader release.', diagnostics: await getSystemDiagnostics() };
  }
  try {
    if (!getJavaRuntimeState().selected) await installManagedJre();
    await ensureJar();
    ensureSuwayomiConfig(path.join(userData, 'suwayomi-data'));
    if (appSettings.cloudflareHelperEnabled && !findManagedCloudflareHelperExecutable()) {
      await prepareCloudflareHelper({ allowInstall: true });
    }
    const ready = await ensureManagedServices({ restart: true });
    return { ok: ready, diagnostics: await getSystemDiagnostics(), error: ready ? null : 'The services did not become ready.' };
  } catch (error) {
    return { ok: false, error: error?.message || 'Repair failed.', diagnostics: await getSystemDiagnostics() };
  }
});
ipcMain.on('renderer-ready', event => {
  if (!mainWindow || mainWindow.isDestroyed() || event.sender.id !== mainWindow.webContents.id) return;
  flushStatusQueue();
});
ipcMain.handle('get-service-issue', () => lastServiceIssue);
ipcMain.handle('get-java-info', () => publicJavaInfo());
ipcMain.handle('install-managed-java', async () => {
  try {
    const info = await installManagedJre();
    clearServiceIssue();
    return { ok: true, java: info };
  } catch (error) {
    const state = getJavaRuntimeState();
    const issue = setServiceIssue({
      code: 'java-install-failed',
      title: 'Java installation failed',
      message: `akaReader could not install its managed Java ${REQUIRED_JAVA_VERSION} runtime.`,
      detail: error.message,
      canRepairJava: true,
      detectedJavaMajor: state.detected?.major ?? null,
      detectedJavaVersion: state.detected?.version || '',
      javaPath: state.detected?.path || '',
    });
    return { ok: false, error: issue.message, detail: issue.detail };
  }
});

ipcMain.handle('check-service',     ()    => isServiceRunning());
ipcMain.handle('install-service',   async () => installWindowsService());
ipcMain.handle('uninstall-service', async () => uninstallWindowsService());
ipcMain.handle('open-data-dir',     ()    => shell.openPath(userData));
ipcMain.handle('export-app-backup', async (_, payload) => {
  try {
    const text = validateBackupPayload(payload);
    const defaultName = `akareader-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export akaReader backup',
      defaultPath: path.join(app.getPath('documents'), defaultName),
      filters: [{ name: 'akaReader backup', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false, cancelled: true };
    writeJsonAtomically(result.filePath, text);
    return { ok: true, filePath: result.filePath };
  } catch (error) {
    return { ok: false, error: error?.message || 'The backup could not be saved.' };
  }
});
ipcMain.handle('import-app-backup', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Restore akaReader backup',
      properties: ['openFile'],
      filters: [{ name: 'akaReader backup', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePaths[0]) return { ok: false, cancelled: true };
    const filePath = result.filePaths[0];
    const stat = fs.statSync(filePath);
    if (stat.size > BACKUP_MAX_BYTES) throw new Error('This backup is too large to import safely.');
    const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    validateBackupPayload(payload);
    return { ok: true, payload };
  } catch (error) {
    return { ok: false, error: error?.message || 'The backup could not be opened.' };
  }
});
ipcMain.handle('save-automatic-backup', (_, payload) => {
  try {
    const text = validateBackupPayload(payload);
    const filePath = automaticBackupPath();
    writeJsonAtomically(filePath, text);
    pruneAutomaticBackups();
    return { ok: true, filePath };
  } catch (error) {
    return { ok: false, error: error?.message || 'The safety backup could not be created.' };
  }
});
ipcMain.handle('get-version',       ()    => app.getVersion());
ipcMain.handle('get-java-path',     ()    => findJava());
ipcMain.handle('get-jar-path',      ()    => jarPath);
ipcMain.handle('get-suwayomi-config-path', () => suwayomiConfigPath);
ipcMain.handle('open-external',      (_, url) => shell.openExternal(url));
ipcMain.handle('get-cloudflare-helper-info', async () => {
  const running = await probeCloudflareHelper();
  return {
    supported: running.ready || !!managedCloudflareRelease,
    installed: !!findManagedCloudflareHelperExecutable(),
    running: running.ready,
    kind: running.kind || '',
    version: FLARESOLVERR_VERSION,
  };
});
ipcMain.handle('ensure-cloudflare-helper', async () => {
  try {
    const helper = await prepareCloudflareHelper({ allowInstall: false });
    return helper.ready
      ? { ok: true, helper }
      : { ok: false, needsInstall: !!helper.needsInstall };
  } catch (error) {
    return {
      ok: false,
      installed: !!findManagedCloudflareHelperExecutable(),
      error: error.message || 'The Cloudflare helper could not start.',
    };
  }
});
ipcMain.handle('setup-cloudflare-helper', async () => {
  try {
    const helper = await prepareCloudflareHelper({ allowInstall: true });
    return { ok: true, helper };
  } catch (error) {
    console.error('[cloudflare-helper] setup failed:', error.message);
    return { ok: false, error: error.message || 'The Cloudflare helper could not be set up.' };
  }
});
ipcMain.handle('get-source-verification-state', () => sourceVerificationState);
ipcMain.handle('cancel-source-verification', () => {
  if (!cancelSourceVerification) return { ok: false, active: false };
  cancelSourceVerification();
  return { ok: true, cancelled: true };
});
ipcMain.handle('complete-source-verification', () => {
  if (!completeSourceVerification) return { ok: false, active: false };
  completeSourceVerification();
  return { ok: true, completed: true };
});
ipcMain.handle('verify-source-url', async (_, request) => {
  const url = request && typeof request === 'object' ? request.url : request;
  const automatic = !!(request && typeof request === 'object' && request.automatic);
  let target;
  try {
    target = new URL(String(url || ''));
  } catch {
    return { ok: false, error: 'No verification URL is available for this source.' };
  }
  if (!['http:', 'https:'].includes(target.protocol)) {
    return { ok: false, error: 'Unsupported verification URL.' };
  }

  if (verificationPromise) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      verificationView?.webContents.focus();
    }
    return verificationPromise;
  }

  verificationPromise = (async () => {
    const owner = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
    if (!owner) return { ok: false, error: 'The akaReader window is not available.' };

    return new Promise(resolve => {
      let settled = false;
      let verificationCheckTimer = null;
      let verificationCheckInFlight = false;
      let challengeObserved = false;
      let consecutiveNonChallengeChecks = 0;
      let view = null;
      let verificationSession = null;
      let verificationCookieListener = null;

      const stopVerificationChecks = () => {
        if (verificationCheckTimer) clearInterval(verificationCheckTimer);
        verificationCheckTimer = null;
      };
      const finish = result => {
        if (settled) return;
        settled = true;
        stopVerificationChecks();
        cancelSourceVerification = null;
        completeSourceVerification = null;
        if (verificationSession && verificationCookieListener) {
          verificationSession.cookies.removeListener('changed', verificationCookieListener);
        }
        removeSourceVerificationView();
        sendSourceVerificationState({ active: false });
        if (!owner.isDestroyed()) {
          owner.show();
          owner.focus();
        }
        resolve(result);
      };
      const isWebUrl = nextUrl => {
        try {
          return ['http:', 'https:'].includes(new URL(nextUrl).protocol);
        } catch {
          return false;
        }
      };
      const isAbortedLoad = error => (
        error?.code === 'ERR_ABORTED'
        || error?.errno === -3
        || /ERR_ABORTED|\(-3\)/i.test(error?.message || '')
      );

      cancelSourceVerification = () => finish({ ok: false, cancelled: true });
      completeSourceVerification = () => finish({ ok: true, completed: true, userConfirmed: true });

      try {
        view = new WebContentsView({
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            webSecurity: true,
            partition: 'persist:akareader-source-verification',
          },
        });
        verificationView = view;
        verificationSession = view.webContents.session;
        view.setBackgroundColor('#0a0a0f');
        owner.contentView.addChildView(view);
        layoutSourceVerificationView();
      } catch (error) {
        finish({ ok: false, error: error?.message || 'Could not show source verification inside akaReader.' });
        return;
      }

      sendSourceVerificationState({
        active: true,
        hostname: target.hostname.replace(/^www\./i, ''),
        automatic,
      });

      // Cloudflare writes this cookie after the user passes its human check.
      // Listening for it lets akaReader return to native results immediately,
      // even when the source website itself stays on a loading or ad shell.
      verificationCookieListener = (_event, cookie, _cause, removed) => {
        if (removed || !isCloudflareClearanceCookie(cookie, target.toString())) return;
        finish({ ok: true, completed: true, clearanceCookie: true });
      };
      verificationSession.cookies.on('changed', verificationCookieListener);

      view.webContents.setWindowOpenHandler(({ url: nextUrl }) => {
        if (isWebUrl(nextUrl)) {
          view.webContents.loadURL(nextUrl).catch(error => {
            console.error('[verification] embedded navigation failed:', error?.message || error);
          });
        }
        return { action: 'deny' };
      });
      view.webContents.on('will-navigate', (event, nextUrl) => {
        if (!isWebUrl(nextUrl)) event.preventDefault();
      });
      view.webContents.on('before-input-event', (_, input) => {
        if (input.key === 'Escape') cancelSourceVerification?.();
      });
      view.webContents.on('render-process-gone', (_, details) => {
        finish({ ok: false, error: `The verification page stopped unexpectedly (${details.reason}).` });
      });
      view.webContents.on('did-fail-load', (_, errorCode, errorDescription, _validatedUrl, isMainFrame) => {
        if (!isMainFrame || errorCode === -3) return;
        finish({ ok: false, error: errorDescription || 'The source verification page could not load.' });
      });

      const checkVerificationPage = async () => {
        if (settled || verificationCheckInFlight || view.webContents.isDestroyed()) return;
        verificationCheckInFlight = true;
        try {
          const snapshot = await view.webContents.executeJavaScript(`(() => {
            const bodyText = document.body?.innerText || '';
            return {
              url: location.href,
              title: document.title,
              text: bodyText.slice(0, 12000),
              bodyTextLength: bodyText.length,
              readyState: document.readyState,
              hasChallengeWidget: !!document.querySelector('iframe[src*="challenges.cloudflare.com"], .cf-turnstile, [data-sitekey], input[name="cf-turnstile-response"]'),
              hasPasswordField: !!document.querySelector('input[type="password"]'),
              hasMainContent: !!document.querySelector('main, article, [role="main"]'),
            };
          })()`, true);
          if (hasSourceChallengeSignals(snapshot)) {
            challengeObserved = true;
            consecutiveNonChallengeChecks = 0;
          } else if (
            normalizedHostname(snapshot.url) === normalizedHostname(target.toString())
            && snapshot.readyState === 'complete'
            && !snapshot.hasPasswordField
            && Number(snapshot.bodyTextLength || 0) >= 20
          ) {
            consecutiveNonChallengeChecks += 1;
          } else {
            consecutiveNonChallengeChecks = 0;
          }

          if (isSourcePageReadyForReturn(snapshot, target.toString(), {
            challengeObserved,
            consecutiveNonChallengeChecks,
          })) {
            finish({ ok: true, completed: true, pageReady: true });
          }
        } catch (error) {
          console.warn('[verification] page readiness check failed:', error?.message || error);
        } finally {
          verificationCheckInFlight = false;
        }
      };

      view.webContents.on('did-finish-load', () => setTimeout(checkVerificationPage, 1000));
      verificationCheckTimer = setInterval(checkVerificationPage, 1500);
      view.webContents.loadURL(target.toString()).catch(error => {
        if (isAbortedLoad(error)) return;
        finish({ ok: false, error: error?.message || 'The source verification page could not load.' });
      });
    });
  })();

  try {
    return await verificationPromise;
  } finally {
    verificationPromise = null;
  }
});

ipcMain.handle('check-for-app-update', async () => {
  if (!autoUpdater) return { ok: false, error: 'Updater is not available in this build.' };
  if (isDev) return { ok: false, error: 'Updater only runs in a packaged app.' };
  if (updateState.downloaded) return { ok: true, downloaded: true, version: updateState.version };
  if (updateState.checking) return { ok: true, checking: true, version: updateState.version };
  if (updateState.downloading) return { ok: true, downloading: true, version: updateState.version };
  try {
    updateState.checking = true;
    updateState.lastCheckAt = Date.now();
    const result = await autoUpdater.checkForUpdates();
    return { ok: true, version: result?.updateInfo?.version || null, downloaded: updateState.downloaded };
  } catch (e) {
    return { ok: false, error: e?.message || 'Failed to check for updates.' };
  } finally {
    updateState.checking = false;
  }
});
ipcMain.handle('download-app-update', async () => {
  if (!autoUpdater) return { ok: false, error: 'Updater is not available in this build.' };
  if (isDev) return { ok: false, error: 'Updater only runs in a packaged app.' };
  if (updateState.downloaded) return { ok: true, downloaded: true, version: updateState.version };
  // Guard against concurrent downloads. updateState.downloading is managed by
  // event listeners; also use a local flag to cover the race window between
  // the user click and the first download-progress event.
  if (updateState.downloading) return { ok: true, downloading: true, version: updateState.version };
  try {
    await autoUpdater.downloadUpdate();
    return { ok: true, version: updateState.version };
  } catch (e) {
    return { ok: false, error: e?.message || 'Failed to download update.' };
  }
});
ipcMain.handle('install-app-update', () => {
  if (!autoUpdater || isDev) return { ok: false, error: 'Updater is not available in this build.' };
  if (!updateState.downloaded) return { ok: false, error: 'No downloaded update is ready to install.' };
  isQuitting = true;
  autoUpdater.quitAndInstall(true, true);
  return { ok: true };
});

// ── Tray ──────────────────────────────────────────────────────────────────────
function createTray() {
  if (tray) { try { tray.destroy(); } catch {} }
  try {
    tray = new Tray(trayIconPath);
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
    icon: windowIconPath,
  });

  mainWindow.webContents.on('did-start-loading', () => { rendererStatusReady = false; });

  mainWindow.on('resize', () => {
    saveWindowState(mainWindow);
    layoutSourceVerificationView();
  });
  mainWindow.on('move', () => saveWindowState(mainWindow));
  mainWindow.on('close', e => {
    if (!isQuitting && appSettings.closeToTray) { e.preventDefault(); mainWindow.hide(); }
  });
  mainWindow.on('closed', () => {
    cancelSourceVerification?.();
    removeSourceVerificationView();
    mainWindow = null;
  });
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
    let requestUrl;
    try { requestUrl = new URL(details.url); } catch {}
    const isAppPage = details.url.startsWith('file:') ||
      (requestUrl && ['localhost', '127.0.0.1', '[::1]'].includes(requestUrl.hostname));
    if (!isAppPage) {
      callback({ responseHeaders: details.responseHeaders });
      return;
    }

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' http://localhost:* file:;",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;",
          "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com;",
          "font-src 'self' https://fonts.gstatic.com data:;",
          "img-src 'self' data: blob: http://localhost:* file:;",
          "script-src 'self' 'unsafe-inline' http://localhost:*;",
          "connect-src 'self' http://localhost:* ws://localhost:*;"
        ].join(' ')
      }
    });
  });

  // Kill any zombie Suwayomi from a previous forced-exit
  killOrphanedSuwayomi();
  killOrphanedCloudflareHelper();

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
    // Don't autoDownload — we want update-available to fire so the UI shows
    // the notification banner. The user clicks "Restart now" to trigger install.
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;

    autoUpdater.on('checking-for-update', () => {
      console.log('[updater] Checking for updates...');
      updateState.checking = true;
      updateState.lastCheckAt = Date.now();
      sendStatus('update-checking');
    });

    autoUpdater.on('update-available', i => {
      console.log('[updater] Update available:', i.version);
      updateState.checking = false;
      updateState.downloading = autoUpdater.autoDownload;
      updateState.downloaded = false;
      updateState.version = i.version || null;
      sendStatus('update-available:' + i.version);
    });

    autoUpdater.on('update-not-available', () => {
      console.log('[updater] No updates available');
      updateState.checking = false;
      updateState.downloading = false;
      updateState.downloaded = false;
      updateState.version = null;
      sendStatus('update-not-available');
    });

    autoUpdater.on('download-progress', p => {
      const pct = Math.round(p.percent || 0);
      updateState.checking = false;
      updateState.downloading = true;
      sendStatus('update-downloading:' + pct);
      // Show progress on the Windows taskbar icon
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setProgressBar(pct / 100);
      }
    });

    autoUpdater.on('update-downloaded', (i) => {
      console.log('[updater] Update downloaded:', i?.version);
      updateState.checking = false;
      updateState.downloading = false;
      updateState.downloaded = true;
      updateState.version = i?.version || updateState.version;
      sendStatus('update-downloaded');
      // Clear taskbar progress
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setProgressBar(-1);
      }
    });

    autoUpdater.on('error', e => {
      console.error('[updater]', e.message);
      updateState.checking = false;
      updateState.downloading = false;
      sendStatus('update-error:' + (e?.message || 'unknown'));
      // Clear taskbar progress on error
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setProgressBar(-1);
      }
    });

    // Check immediately on launch, then every 2 hours
    autoUpdater.checkForUpdates().catch(() => {});
    setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 2 * 60 * 60 * 1000);
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
  killCloudflareHelper();
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
  const helperPid = cloudflareHelperProc?.pid;
  if (helperPid && process.platform === 'win32') {
    try { cp.spawnSync('taskkill', ['/F', '/T', '/PID', String(helperPid)], { windowsHide: true }); } catch {}
  }
  try {
    if (fs.existsSync(cloudflareHelperPidFile)) {
      const savedHelperPid = fs.readFileSync(cloudflareHelperPidFile, 'utf8').trim();
      if (savedHelperPid && process.platform === 'win32') {
        cp.spawnSync('taskkill', ['/F', '/T', '/PID', savedHelperPid], { windowsHide: true });
      }
      fs.unlinkSync(cloudflareHelperPidFile);
    }
  } catch {}
});

process.on('SIGINT',  () => { isQuitting = true; killServer(); killSuwayomi(); killCloudflareHelper(); process.exit(0); });
process.on('SIGTERM', () => { isQuitting = true; killServer(); killSuwayomi(); killCloudflareHelper(); process.exit(0); });
