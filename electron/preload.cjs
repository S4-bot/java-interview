const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('assistantAPI', {
  generateAnswer(payload) {
    return ipcRenderer.invoke('generate-answer', payload)
  },
  isDesktop: true,
})
