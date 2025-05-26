/**
 * Module pour la fenêtre de configuration des proxies Webshare
 */

const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const directWebshareProxy = require('./directWebshareProxy');

let proxyWindow = null;
// Variable pour suivre si les gestionnaires d'événements ont été configurés
let handlersRegistered = false;

/**
 * Créer une fenêtre de configuration des proxies Webshare
 */
function createWebshareProxyWindow(parentWindow) {
  // Si la fenêtre existe déjà, la montrer
  if (proxyWindow) {
    proxyWindow.show();
    return proxyWindow;
  }
  
  // Créer une nouvelle fenêtre
  proxyWindow = new BrowserWindow({
    width: 600,
    height: 500,
    title: 'Configuration des proxies Webshare',
    parent: parentWindow,
    modal: true,
    resizable: true,
    minimizable: false,
    maximizable: false,
    backgroundColor: '#1e1e1e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload', 'webshareProxyPreload.js')
    }
  });
  
  // Charger l'interface HTML
  proxyWindow.loadFile(path.join(__dirname, '..', 'renderer', 'webshareProxy.html'));
  
  // Gérer la fermeture de la fenêtre
  proxyWindow.on('closed', () => {
    proxyWindow = null;
  });
  
  // Désactiver le menu
  proxyWindow.setMenu(null);
  
  // Configurer les gestionnaires d'événements IPC seulement s'ils n'ont pas encore été configurés
  if (!handlersRegistered) {
    setupIPCHandlers();
    handlersRegistered = true;
  }
  
  return proxyWindow;
}

/**
 * Configurer les gestionnaires d'événements IPC pour la fenêtre de configuration des proxies
 */
function setupIPCHandlers() {
  // Obtenir tous les proxies disponibles
  ipcMain.handle('webshare-get-proxies', async () => {
    return directWebshareProxy.getProxies();
  });
  
  // Recharger les proxies depuis l'API Webshare
  ipcMain.handle('webshare-reload-proxies', async () => {
    return await directWebshareProxy.loadProxies();
  });
  
  // Obtenir le proxy actuellement utilisé pour une vue
  ipcMain.handle('webshare-get-proxy-for-view', async (event, viewIndex) => {
    return directWebshareProxy.getProxyForView(viewIndex);
  });
  
  // Définir un proxy pour une vue spécifique
  ipcMain.handle('webshare-set-proxy-for-view', async (event, viewIndex, proxyIndex) => {
    // Définir le proxy pour cette vue
    directWebshareProxy.setProxyForView(viewIndex, proxyIndex);
    
    // Émettre un événement pour informer le processus principal
    ipcMain.emit('set-proxy-for-view', event, viewIndex, proxyIndex);
    
    return true;
  });
  
  // Fermer la fenêtre de configuration des proxies
  ipcMain.on('webshare-close-window', () => {
    if (proxyWindow) {
      proxyWindow.close();
    }
  });
}

module.exports = {
  createWebshareProxyWindow
};
