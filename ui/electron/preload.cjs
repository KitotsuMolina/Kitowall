const {contextBridge, ipcRenderer} = require('electron');

contextBridge.exposeInMainWorld('kitowallDesktop', {
  invoke(command, args) {
    return ipcRenderer.invoke('kitowall:invoke', command, args ?? {});
  }
});
