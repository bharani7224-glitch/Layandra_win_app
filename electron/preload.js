const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  closeWidget: () => ipcRenderer.send('widget:close'),
  hideWidget: () => ipcRenderer.send('widget:hide'),
  getStartupStatus: () => ipcRenderer.invoke('widget:get-startup'),
  toggleStartup: (enable) => ipcRenderer.invoke('widget:set-startup', enable),
  setIgnoreMouseEvents: (ignore, options) => {
    ipcRenderer.send('widget:set-ignore-mouse-events', ignore, options);
  },
  onVisibilityChange: (callback) => {
    ipcRenderer.on('widget:visibility', (_event, isVisible) => callback(isVisible));
  },
  onSetCharm: (callback) => {
    ipcRenderer.on('widget:set-charm', (_event, charmId) => callback(charmId));
  },
  openFileDialog: () => ipcRenderer.invoke('widget:open-file-dialog'),
  updateActiveCharmInTray: (charmId) => {
    ipcRenderer.send('widget:active-charm-changed', charmId);
  },
});
