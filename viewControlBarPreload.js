const { contextBridge, ipcRenderer } = require('electron');

// Exposer les API sécurisées au renderer
contextBridge.exposeInMainWorld('electronAPI', {
  toggleFullscreen: () => {
    // Récupérer l'id de la vue depuis l'URL
    const urlParams = new URLSearchParams(window.location.search);
    const viewId = urlParams.get('viewId');
    
    if (viewId !== null) {
      // Envoyer l'événement au processus principal avec l'ID de la vue
      ipcRenderer.send('toggle-view-fullscreen', parseInt(viewId));
    }
  },
  
  openDevTools: (viewId) => {
    if (viewId !== null) {
      // Envoyer l'événement au processus principal avec l'ID de la vue
      ipcRenderer.send('open-view-devtools', parseInt(viewId));
    }
  },
  
  reloadView: (viewId) => {
    if (viewId !== null) {
      // Envoyer l'événement au processus principal avec l'ID de la vue
      ipcRenderer.send('reload-view', parseInt(viewId));
    }
  },
  
  // Fonctions de gestion des proxies
  getProxyForView: async (viewId) => {
    if (viewId !== null) {
      return await ipcRenderer.invoke('get-proxy-for-view', parseInt(viewId));
    }
    return null;
  },
  
  setProxyForView: async (viewId, proxyConfig) => {
    if (viewId !== null) {
      return await ipcRenderer.invoke('set-proxy-for-view', parseInt(viewId), proxyConfig);
    }
    return false;
  },
  
  removeProxyForView: async (viewId) => {
    if (viewId !== null) {
      return await ipcRenderer.invoke('remove-proxy-for-view', parseInt(viewId));
    }
    return false;
  },
  
  reloadAllViews: async () => {
    return await ipcRenderer.invoke('reload-all-views');
  },
  
  // Maintenir la compatibilité avec l'ancienne API
  applyProxiesToAllViews: async () => {
    return await ipcRenderer.invoke('apply-proxies-to-all-views');
  },
  
  // Ouvrir directement l'extension Webshare Proxy dans une vue
  openWebshareProxy: async (viewIndex) => {
    return await ipcRenderer.invoke('open-webshare-proxy-extension', viewIndex);
  },
  
  // Fonction simple pour configurer un proxy directement
  configureProxy: (viewId) => {
    if (viewId !== null) {
      ipcRenderer.send('configure-proxy-for-view', parseInt(viewId));
    }
  },
  
  // Fonctions pour le changement rapide de proxy
  getPresetProxies: async () => {
    return await ipcRenderer.invoke('get-preset-proxies');
  },
  
  getCurrentProxy: async (viewId) => {
    if (viewId !== null) {
      return await ipcRenderer.invoke('get-current-proxy', parseInt(viewId));
    }
    return null;
  },
  
  switchToNextProxy: async (viewId) => {
    if (viewId !== null) {
      return await ipcRenderer.invoke('switch-to-next-proxy', parseInt(viewId));
    }
    return null;
  },
  
  applyProxyByIndex: async (viewId, proxyIndex) => {
    if (viewId !== null) {
      return await ipcRenderer.invoke('apply-proxy-by-index', parseInt(viewId), proxyIndex);
    }
    return null;
  }
}); 