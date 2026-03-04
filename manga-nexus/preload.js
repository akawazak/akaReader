// preload.js — sits between Electron and React
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  setCloseToTray: (val) => ipcRenderer.send('set-close-to-tray', val),
  getCloseToTray: () => ipcRenderer.invoke('get-close-to-tray'),
  restartServices: () => ipcRenderer.invoke('restart-services'),
  onServicesStatus: (cb) => ipcRenderer.on('services-status', (_, status) => cb(status)),
});