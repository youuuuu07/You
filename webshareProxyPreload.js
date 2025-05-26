/**
 * Préchargement pour la fenêtre de configuration des proxies Webshare
 */

const { contextBridge, ipcRenderer } = require('electron');

// Exposer les fonctions IPC au renderer
contextBridge.exposeInMainWorld('webshareProxyAPI', {
  // Obtenir tous les proxies disponibles
  getProxies: async () => {
    return await ipcRenderer.invoke('webshare-get-proxies');
  },
  
  // Recharger les proxies depuis l'API Webshare
  reloadProxies: async () => {
    return await ipcRenderer.invoke('webshare-reload-proxies');
  },
  
  // Obtenir le proxy actuellement utilisé pour une vue
  getProxyForView: async (viewIndex) => {
    return await ipcRenderer.invoke('webshare-get-proxy-for-view', viewIndex);
  },
  
  // Obtenir le proxy actuellement utilisé pour une vue (compatibilité)
  getCurrentProxy: async (viewIndex) => {
    return await ipcRenderer.invoke('get-current-proxy', viewIndex);
  },
  
  // Définir un proxy pour une vue spécifique
  setProxyForView: async (viewIndex, proxyIndex) => {
    return await ipcRenderer.invoke('webshare-set-proxy-for-view', viewIndex, proxyIndex);
  },
  
  // Fermer la fenêtre de configuration des proxies
  closeWindow: () => {
    ipcRenderer.send('webshare-close-window');
  }
});

// Exposer également les fonctions de l'API proxyAPI pour la compatibilité
contextBridge.exposeInMainWorld('proxyAPI', {
  // Obtenir tous les proxies configurés
  getAllProxies: async () => {
    return await ipcRenderer.invoke('get-all-proxies');
  },
  
  // Obtenir la configuration d'un proxy pour une vue spécifique
  getProxyForView: async (viewIndex) => {
    return await ipcRenderer.invoke('get-proxy-for-view', viewIndex);
  },
  
  // Définir un proxy pour une vue spécifique
  setProxyForView: async (viewIndex, proxyIndex) => {
    return await ipcRenderer.invoke('set-proxy-for-view', viewIndex, proxyIndex);
  },
  
  // Supprimer un proxy pour une vue spécifique
  removeProxyForView: async (viewIndex) => {
    return await ipcRenderer.invoke('remove-proxy-for-view', viewIndex);
  },
  
  // Appliquer les proxies à toutes les vues
  applyProxiesToAllViews: async () => {
    return await ipcRenderer.invoke('apply-proxies-to-all-views');
  },
  
  // Recharger toutes les vues
  reloadAllViews: async () => {
    return await ipcRenderer.invoke('reload-all-views');
  },
  
  // Obtenir la liste des vues disponibles
  getViewsList: async () => {
    return await ipcRenderer.invoke('get-views-list');
  },
  
  // Fermer le panneau de proxy
  closePanel: () => {
    ipcRenderer.send('close-proxy-panel');
  }
});
