const { contextBridge, ipcRenderer } = require('electron');

const subscribe = (channel, listener) => {
  const handler = (_event, ...args) => listener(...args);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

contextBridge.exposeInMainWorld('antworkDesktop', {
  openDocumentation: () => ipcRenderer.send('antwork:open-docs'),
  openTimer: () => ipcRenderer.send('antwork:open-timer'),
  controlWindow: action => ipcRenderer.send('antwork:window-control', action),
  isWindowMaximized: () => ipcRenderer.invoke('antwork:window-maximized'),
  onMaximizedChanged: listener => subscribe('antwork:window-maximized', listener),
  getPendingPause: () => ipcRenderer.invoke('antwork:get-pause'),
  acknowledgePause: id => ipcRenderer.invoke('antwork:acknowledge-pause', id),
  reportTimer: (runningSince, deadline) => ipcRenderer.send('antwork:timer-state', runningSince, deadline),
  onPauseRequested: listener => subscribe('antwork:pause-requested', listener),
  onTimerDue: listener => subscribe('antwork:timer-due', listener),
  isWindowVisible: () => ipcRenderer.invoke('antwork:window-visible'),
  onVisibilityChanged: listener => subscribe('antwork:visibility-changed', listener),
});
