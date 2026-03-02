const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("DesktopAssistant", {
  getCapabilities: () => ipcRenderer.invoke("assistant:get_capabilities"),
  executeAction: (action) => ipcRenderer.invoke("assistant:execute_action", action),
});
