const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
    start: (args) => ipcRenderer.send('start', args),
    stop: () => ipcRenderer.send('stop'),
    stoped: (args) => ipcRenderer.on('stoped',args),
    activity: (args) => ipcRenderer.on('activity',args),
    statusUpdate: (args) => ipcRenderer.on('statusUpdate',args)
})