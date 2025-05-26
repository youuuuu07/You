const { contextBridge, ipcRenderer } = require('electron');

// Exposer les fonctions IPC nécessaires au renderer pour la gestion native du proxy
contextBridge.exposeInMainWorld('proxyAPI', {
  
  // Définir un proxy pour une vue spécifique
  applyProxyToView: (viewId, proxyDetails) => ipcRenderer.invoke('apply-proxy-to-view', { viewId, proxyDetails }),
  
  // Supprimer un proxy pour une vue spécifique
  removeProxyForView: (viewId) => ipcRenderer.invoke('remove-proxy-for-view', viewId),
  
  // Recharger toutes les vues
  reloadAllViews: () => ipcRenderer.invoke('reload-all-views'),
  
  // Obtenir la liste des vues disponibles
  getViewsList: () => ipcRenderer.invoke('get-views-list'),
  
  // Fermer le panneau de proxy
  closePanel: () => ipcRenderer.send('close-proxy-panel'),
  
});

// Écouter les événements du processus principal (peut être retiré si non utilisé)
// ipcRenderer.on('proxy-updated', (event, data) => {
//   // Déclencher un événement personnalisé pour informer l'interface utilisateur
//   document.dispatchEvent(new CustomEvent('proxy-updated', { detail: data }));
// });

// Informer le processus principal que le préchargement est terminé
window.addEventListener('DOMContentLoaded', () => {
  ipcRenderer.send('proxy-panel-ready');
});
