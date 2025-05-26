// proxyHandlers.js - Gestionnaires IPC pour les proxies
const { ipcMain, BrowserWindow, session, app } = require('electron');

// Configuration des constantes
const PROXY_CONFIG = {
  RELOAD_DELAY: 500,
  RELOAD_OFFSET: 100,
  AUTH_TIMEOUT: 30000
};

// Cache pour éviter les fuites mémoire
const sessionListeners = new Map();
const authCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Utilitaires pour la gestion des erreurs et logs
const ProxyLogger = {
  info: (message, data = null) => {
    console.log(`[PROXY-INFO] ${message}`, data || '');
  },
  error: (message, error = null) => {
    console.error(`[PROXY-ERROR] ${message}`, error || '');
  },
  warn: (message, data = null) => {
    console.warn(`[PROXY-WARN] ${message}`, data || '');
  }
};

// Gestionnaire d'erreurs centralisé
function handleProxyError(operation, error) {
  ProxyLogger.error(`Erreur lors de ${operation}:`, error);
  return {
    success: false,
    error: error.message || 'Erreur inconnue'
  };
}

// Validation des paramètres proxy
function validateProxyConfig(config) {
  if (!config || typeof config !== 'object') {
    return { valid: false, error: 'Configuration proxy invalide' };
  }
  
  if (!config.host || typeof config.host !== 'string') {
    return { valid: false, error: 'Host proxy manquant ou invalide' };
  }
  
  if (!config.port || isNaN(parseInt(config.port))) {
    return { valid: false, error: 'Port proxy manquant ou invalide' };
  }
  
  if (config.username && !config.password) {
    return { valid: false, error: 'Mot de passe manquant pour l\'authentification' };
  }
  
  return { valid: true };
}

// Variable pour stocker la référence à la fenêtre principale
let mainViewWindow = null;

// Fonction pour initialiser les gestionnaires de proxy
function initializeProxyHandlers(mainWindow) {
  mainViewWindow = mainWindow;
  
  // Tous les gestionnaires IPC ici...
  // (Copiez tout le contenu des ipcMain.handle() de l'artifact précédent)
  
  ProxyLogger.info('Gestionnaires de proxy initialisés');
}

// Gestionnaire d'authentification proxy
function handleProxyAuth(authInfo, callback) {
  const authKey = `${authInfo.host}:${authInfo.port}`;
  
  ProxyLogger.info('Authentification proxy requise:', {
    host: authInfo.host,
    port: authInfo.port,
    isProxy: authInfo.isProxy
  });
  
  if (!authInfo.isProxy) {
    callback();
    return;
  }
  
  // Vérifier le cache
  const cached = authCache.get(authKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    callback(cached.username, cached.password);
    return;
  }
  
  try {
    const proxyManager = require('./proxyManager');
    const allProxies = proxyManager.getAllSlotProxies();
    
    for (const [slotId, proxyConfig] of Object.entries(allProxies)) {
      if (proxyConfig?.enabled && 
          proxyConfig.host === authInfo.host && 
          proxyConfig.port.toString() === authInfo.port.toString() &&
          proxyConfig.username && proxyConfig.password) {
        
        authCache.set(authKey, {
          username: proxyConfig.username,
          password: proxyConfig.password,
          timestamp: Date.now()
        });
        
        callback(proxyConfig.username, proxyConfig.password);
        return;
      }
    }
    
    callback();
  } catch (error) {
    ProxyLogger.error('Erreur authentification:', error);
    callback();
  }
}

// Configuration des sessions
function setupSessionListeners(sessionInstance) {
  if (sessionListeners.has(sessionInstance.partition)) {
    return;
  }
  
  sessionInstance.on('login', handleProxyAuth);
  sessionListeners.set(sessionInstance.partition, true);
}

// Initialiser les écouteurs de session
if (session.defaultSession) {
  setupSessionListeners(session.defaultSession);
}

app.on('session-created', setupSessionListeners);

// Nettoyage
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of authCache.entries()) {
    if ((now - value.timestamp) > CACHE_TTL) {
      authCache.delete(key);
    }
  }
}, CACHE_TTL);

app.on('before-quit', () => {
  authCache.clear();
  sessionListeners.clear();
});

module.exports = {
  initializeProxyHandlers,
  ProxyLogger,
  validateProxyConfig,
  handleProxyError,
  PROXY_CONFIG
};