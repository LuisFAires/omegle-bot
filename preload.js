const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
    start: (args) => ipcRenderer.send('start', args),
    stop: () => ipcRenderer.send('stop'),
    stopped: (args) => ipcRenderer.on('stopped',args),
    activity: (args) => ipcRenderer.on('activity',args),
    statusUpdate: (args) => ipcRenderer.on('statusUpdate',args),
    maximize: () => ipcRenderer.send('maximize'),
    readedConfig: (args) => ipcRenderer.on('readedConfig', args)
})