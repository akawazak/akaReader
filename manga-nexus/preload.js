const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
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
  restartServices:  () => ipcRenderer.invoke('restart-services'),
  onServicesStatus: (cb) => {
    ipcRenderer.removeAllListeners('services-status');
    ipcRenderer.on('services-status', (_, status) => cb(status));
  },

  // Windows service management
  checkService:     () => ipcRenderer.invoke('check-service'),
  installService:   () => ipcRenderer.invoke('install-service'),
  uninstallService: () => ipcRenderer.invoke('uninstall-service'),

  // Paths / info
  openDataDir: () => ipcRenderer.invoke('open-data-dir'),
  getJarPath:  () => ipcRenderer.invoke('get-jar-path'),
  getJavaPath: () => ipcRenderer.invoke('get-java-path'),
});