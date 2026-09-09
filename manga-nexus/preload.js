const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  apiToken: ipcRenderer.sendSync('get-api-token'),

  // Window controls
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close:    () => ipcRenderer.invoke('window-close'),
  onBeforeWindowClose: (cb) => {
    const listener = (_, payload) => cb(payload);
    ipcRenderer.on('before-window-close', listener);
    return () => ipcRenderer.removeListener('before-window-close', listener);
  },
  completeWindowCloseFlush: requestId => ipcRenderer.send('window-close-flush-complete', requestId),

  // Settings
  getCloseToTray:      () => ipcRenderer.invoke('get-close-to-tray'),
  setCloseToTray:      (v) => ipcRenderer.invoke('set-close-to-tray', v),
  getStartWithWindows: () => ipcRenderer.invoke('get-start-with-windows'),
  setStartWithWindows: (v) => ipcRenderer.send('set-start-with-windows', v),
  getDiscordPresence: () => ipcRenderer.invoke('get-discord-presence'),
  setDiscordPresenceEnabled: (v) => ipcRenderer.invoke('set-discord-presence-enabled', Boolean(v)),
  retryDiscordPresence: () => ipcRenderer.invoke('retry-discord-presence'),
  setDiscordPresenceMode: (mode) => ipcRenderer.invoke('set-discord-presence-mode', mode),
  getExtensionRepos:   () => ipcRenderer.invoke('get-extension-repos'),
  setExtensionRepos:   (repos) => ipcRenderer.invoke('set-extension-repos', repos),

  // Services
  ensureServices:   () => ipcRenderer.invoke('ensure-services'),
  restartServices:  () => ipcRenderer.invoke('restart-services'),
  getSystemDiagnostics: () => ipcRenderer.invoke('get-system-diagnostics'),
  repairSystem:     () => ipcRenderer.invoke('repair-system'),
  rendererReady:    () => ipcRenderer.send('renderer-ready'),
  getServiceIssue:  () => ipcRenderer.invoke('get-service-issue'),
  getJavaInfo:      () => ipcRenderer.invoke('get-java-info'),
  installManagedJava: () => ipcRenderer.invoke('install-managed-java'),
  onServicesStatus: (cb) => {
    const listener = (_, status) => cb(status);
    ipcRenderer.on('services-status', listener);
    return () => ipcRenderer.removeListener('services-status', listener);
  },
  onDiscordPresenceStatus: (cb) => {
    const listener = (_, state) => cb(state);
    ipcRenderer.on('discord-presence-status', listener);
    return () => ipcRenderer.removeListener('discord-presence-status', listener);
  },

  // Windows service management
  checkService:     () => ipcRenderer.invoke('check-service'),
  installService:   () => ipcRenderer.invoke('install-service'),
  uninstallService: () => ipcRenderer.invoke('uninstall-service'),

  // Paths / info
  openDataDir: () => ipcRenderer.invoke('open-data-dir'),
  exportChapterCbz: (payload) => ipcRenderer.invoke('export-chapter-cbz', payload),
  exportMangaCbz: (payload) => ipcRenderer.invoke('export-manga-cbz', payload),
  exportAppBackup: (payload) => ipcRenderer.invoke('export-app-backup', payload),
  importAppBackup: () => ipcRenderer.invoke('import-app-backup'),
  saveAutomaticBackup: (payload) => ipcRenderer.invoke('save-automatic-backup', payload),
  getJarPath:  () => ipcRenderer.invoke('get-jar-path'),
  getJavaPath: () => ipcRenderer.invoke('get-java-path'),
  getSuwayomiConfigPath: () => ipcRenderer.invoke('get-suwayomi-config-path'),

  // App version (reads from package.json via Electron — always accurate)
  getVersion:  () => ipcRenderer.invoke('get-version'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  showNotification: (payload) => ipcRenderer.invoke('show-notification', payload),
  getCloudflareHelperInfo: () => ipcRenderer.invoke('get-cloudflare-helper-info'),
  ensureCloudflareHelper: () => ipcRenderer.invoke('ensure-cloudflare-helper'),
  setupCloudflareHelper: () => ipcRenderer.invoke('setup-cloudflare-helper'),
  verifySourceUrl: (url, options = {}) => ipcRenderer.invoke('verify-source-url', { url, ...options }),
  getSourceVerificationState: () => ipcRenderer.invoke('get-source-verification-state'),
  cancelSourceVerification: () => ipcRenderer.invoke('cancel-source-verification'),
  completeSourceVerification: () => ipcRenderer.invoke('complete-source-verification'),
  onSourceVerificationState: (cb) => {
    const listener = (_, state) => cb(state);
    ipcRenderer.on('source-verification-state', listener);
    return () => ipcRenderer.removeListener('source-verification-state', listener);
  },
  checkForAppUpdate: () => ipcRenderer.invoke('check-for-app-update'),
  downloadAppUpdate: () => ipcRenderer.invoke('download-app-update'),
  installAppUpdate: () => ipcRenderer.invoke('install-app-update'),
  reinstallBackend: () => ipcRenderer.invoke('reinstall-backend'),
  factoryReset: () => ipcRenderer.invoke('factory-reset')
});
