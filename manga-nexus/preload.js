const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,

  // Window controls
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close:    () => ipcRenderer.invoke('window-close'),

  // Settings
  getCloseToTray:      () => ipcRenderer.invoke('get-close-to-tray'),
  setCloseToTray:      (v) => ipcRenderer.invoke('set-close-to-tray', v),
  getStartWithWindows: () => ipcRenderer.invoke('get-start-with-windows'),
  setStartWithWindows: (v) => ipcRenderer.send('set-start-with-windows', v),

  // Services
  ensureServices:   () => ipcRenderer.invoke('ensure-services'),
  restartServices:  () => ipcRenderer.invoke('restart-services'),
  onServicesStatus: (cb) => {
    const listener = (_, status) => cb(status);
    ipcRenderer.on('services-status', listener);
    return () => ipcRenderer.removeListener('services-status', listener);
  },

  // Windows service management
  checkService:     () => ipcRenderer.invoke('check-service'),
  installService:   () => ipcRenderer.invoke('install-service'),
  uninstallService: () => ipcRenderer.invoke('uninstall-service'),

  // Paths / info
  openDataDir: () => ipcRenderer.invoke('open-data-dir'),
  getJarPath:  () => ipcRenderer.invoke('get-jar-path'),
  getJavaPath: () => ipcRenderer.invoke('get-java-path'),
  getSuwayomiConfigPath: () => ipcRenderer.invoke('get-suwayomi-config-path'),

  // App version (reads from package.json via Electron — always accurate)
  getVersion:  () => ipcRenderer.invoke('get-version'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  verifySourceUrl: (url) => ipcRenderer.invoke('verify-source-url', url),
  checkForAppUpdate: () => ipcRenderer.invoke('check-for-app-update'),
  downloadAppUpdate: () => ipcRenderer.invoke('download-app-update'),
  installAppUpdate: () => ipcRenderer.invoke('install-app-update'),
  reinstallBackend: () => ipcRenderer.invoke('reinstall-backend'),
  factoryReset: () => ipcRenderer.invoke('factory-reset')
});
