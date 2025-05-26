const { contextBridge, ipcRenderer } = require('electron');

// Exposer les fonctions nécessaires au processus de rendu
contextBridge.exposeInMainWorld('proxyAPI', {
  // Obtenir les informations sur tous les slots et leurs proxies
  getSlotInfo: () => ipcRenderer.invoke('get-all-slots-proxy-info'),
  
  // Ouvrir la fenêtre de configuration pour un slot spécifique
  openProxyConfig: (slotId) => ipcRenderer.invoke('open-proxy-config', slotId),
  
  // Supprimer le proxy d'un slot spécifique
  removeProxy: (slotId) => ipcRenderer.invoke('remove-proxy-for-slot', slotId),
  
  // Appliquer tous les proxies configurés
  applyAllProxies: () => ipcRenderer.invoke('apply-proxies-to-all-views'),
  
  // Réinitialiser tous les proxies
  resetAllProxies: () => ipcRenderer.invoke('reset-all-proxies'),
  
  // Ouvrir la fenêtre d'import/export de configurations proxy
  openImportExport: () => ipcRenderer.invoke('open-proxy-import-export')
});

console.log('Preload du panneau de configuration des proxies chargé');
