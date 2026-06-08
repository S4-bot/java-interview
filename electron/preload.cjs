const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('assistantAPI', {
  generateAnswer(payload) {
    return ipcRenderer.invoke('generate-answer', payload)
  },
  generateAnswerStream(payload, onEvent) {
    const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const channel = 'generate-answer-progress'
    const listener = (_event, message) => {
      if (message?.requestId !== requestId) return
      onEvent?.(message)
    }

    ipcRenderer.on(channel, listener)

    return ipcRenderer
      .invoke('generate-answer', { ...payload, requestId, stream: true })
      .finally(() => ipcRenderer.removeListener(channel, listener))
  },
  isDesktop: true,
})
