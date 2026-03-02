const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("DesktopAssistant", {
  getCapabilities: () => ipcRenderer.invoke("assistant:get_capabilities"),
  executeAction: (action) => ipcRenderer.invoke("assistant:execute_action", action),

  reportEvolutionDelta: (lines, context) =>
    ipcRenderer.invoke("evolution:report_delta", {
      lines,
      context,
    }),
  listEvolution: () => ipcRenderer.invoke("evolution:list"),
  approveEvolution: (proposalId) => ipcRenderer.invoke("evolution:approve", proposalId),
  getEvolutionAudit: () => ipcRenderer.invoke("evolution:audit"),
});
