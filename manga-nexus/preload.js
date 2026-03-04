// preload.js — sits between Electron and React
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  
  // Settings
  setCloseToTray: (val) => ipcRenderer.send('set-close-to-tray', val),
  getCloseToTray: () => ipcRenderer.invoke('get-close-to-tray'),
  
  // NEW: Windows startup setting
  setStartWithWindows: (val) => ipcRenderer.send('set-start-with-windows', val),
  getStartWithWindows: () => ipcRenderer.invoke('get-start-with-windows'),
  
  // Services
  restartServices: () => ipcRenderer.invoke('restart-services'),
  
  // Listeners
  onServicesStatus: (cb) => ipcRenderer.on('services-status', (_, status) => cb(status)),
  
  // NEW: Startup progress updates
  onStartupProgress: (cb) => ipcRenderer.on('startup-progress', (_, data) => cb(data)),
  
  // Cleanup
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('services-status');
    ipcRenderer.removeAllListeners('startup-progress');
  }
});