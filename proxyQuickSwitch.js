/**
 * Module de gestion rapide des proxies
 * Permet de changer de proxy en un clic sans configuration complexe
 */

const { session } = require('electron');
const proxyManager = require('./proxyManager');
const webshareProxyApi = require('./webshareProxyApi');
const Store = require('electron-store');

class ProxyQuickSwitch {
  constructor() {
    // Initialiser le stockage pour les configurations de proxy
    this.store = new Store({
      name: 'proxy-quick-switch',
      encryptionKey: 'your-encryption-key'
    });
    
    // Liste de proxies prédéfinis
    this.presetProxies = [
      {
        name: 'Direct (Aucun proxy)',
        enabled: false,
        protocol: 'http',
        host: '',
        port: '',
        username: '',
        password: '',
        bypassList: 'localhost,127.0.0.1'
      }
    ];
    
    // Charger les proxies sauvegardés
    const savedProxies = this.store.get('presetProxies', []);
    if (savedProxies && savedProxies.length > 0) {
      // Fusionner les proxies sauvegardés avec le proxy direct
      this.presetProxies = [this.presetProxies[0], ...savedProxies];
    }

    // Proxy actuellement sélectionné pour chaque vue
    this.currentProxyIndex = this.store.get('currentProxyIndex', {});
    
    // Initialiser l'API Webshare
    this.initWebshareProxies();
  }
  
  // Initialiser les proxies Webshare
  async initWebshareProxies() {
    try {
      // Récupérer les proxies Webshare
      const webshareProxies = await webshareProxyApi.getProxies();
      
      if (webshareProxies && webshareProxies.length > 0) {
        // Ajouter les proxies Webshare à la liste des proxies prédéfinis
        webshareProxies.forEach(proxy => {
          // Vérifier si le proxy existe déjà
          const existingProxyIndex = this.presetProxies.findIndex(p => 
            p.host === proxy.host && p.port === proxy.port && p.username === proxy.username
          );
          
          if (existingProxyIndex === -1) {
            // Ajouter le proxy s'il n'existe pas déjà
            this.presetProxies.push(proxy);
          } else {
            // Mettre à jour le proxy existant
            this.presetProxies[existingProxyIndex] = proxy;
          }
        });
        
        // Sauvegarder les proxies
        this.saveProxies();
        
        console.log(`${webshareProxies.length} proxies Webshare ajoutés/mis à jour`);
      }
    } catch (error) {
      console.error('Erreur lors de l\'initialisation des proxies Webshare:', error);
    }
  }

  // Sauvegarder les proxies dans le stockage local
  saveProxies() {
    // Ne pas sauvegarder le proxy direct (index 0)
    const proxiesToSave = this.presetProxies.slice(1);
    this.store.set('presetProxies', proxiesToSave);
    this.store.set('currentProxyIndex', this.currentProxyIndex);
  }

  // Obtenir la liste des proxies prédéfinis
  getPresetProxies() {
    return this.presetProxies;
  }

  // Ajouter un nouveau proxy prédéfini
  addPresetProxy(proxyConfig) {
    if (proxyConfig && typeof proxyConfig === 'object') {
      this.presetProxies.push(proxyConfig);
      this.saveProxies();
      return true;
    }
    return false;
  }

  // Supprimer un proxy prédéfini
  removePresetProxy(index) {
    if (index > 0 && index < this.presetProxies.length) { // Ne pas supprimer le proxy direct (index 0)
      this.presetProxies.splice(index, 1);
      
      // Mettre à jour les index actuels qui pointent vers des proxies supprimés
      Object.keys(this.currentProxyIndex).forEach(viewIndex => {
        if (this.currentProxyIndex[viewIndex] >= index) {
          // Si l'index est supérieur ou égal à l'index supprimé, le réduire
          this.currentProxyIndex[viewIndex] = Math.max(0, this.currentProxyIndex[viewIndex] - 1);
        }
      });
      
      this.saveProxies();
      return true;
    }
    return false;
  }

  // Obtenir le proxy actuellement utilisé pour une vue
  getCurrentProxy(viewIndex) {
    const index = this.currentProxyIndex[viewIndex] || 0;
    return this.presetProxies[index];
  }

  // Passer au proxy suivant pour une vue spécifique
  switchToNextProxy(viewIndex, viewSession) {
    // Obtenir l'index actuel ou 0 si non défini
    let currentIndex = this.currentProxyIndex[viewIndex] || 0;
    
    // Passer au proxy suivant
    currentIndex = (currentIndex + 1) % this.presetProxies.length;
    
    // Mettre à jour l'index actuel
    this.currentProxyIndex[viewIndex] = currentIndex;
    this.saveProxies();
    
    // Obtenir la configuration du proxy
    const proxyConfig = this.presetProxies[currentIndex];
    
    // Appliquer le proxy à la session
    if (viewSession) {
      this.applyProxyToSession(viewSession, proxyConfig, viewIndex);
      console.log(`Vue ${viewIndex}: Proxy changé pour "${proxyConfig.name}"`);
    }
    
    return proxyConfig;
  }

  // Appliquer un proxy spécifique à une vue
  applyProxyByIndex(viewIndex, viewSession, proxyIndex) {
    if (proxyIndex >= 0 && proxyIndex < this.presetProxies.length) {
      // Mettre à jour l'index actuel
      this.currentProxyIndex[viewIndex] = proxyIndex;
      this.saveProxies();
      
      // Obtenir la configuration du proxy
      const proxyConfig = this.presetProxies[proxyIndex];
      
      // Appliquer le proxy à la session
      if (viewSession) {
        this.applyProxyToSession(viewSession, proxyConfig, viewIndex);
        console.log(`Vue ${viewIndex}: Proxy défini sur "${proxyConfig.name}"`);
      }
      
      return proxyConfig;
    }
    
    return null;
  }
  
  // Méthode améliorée pour appliquer un proxy à une session
  applyProxyToSession(viewSession, proxyConfig, viewIndex) {
    if (!viewSession) {
      console.error(`Impossible d'appliquer le proxy: session invalide pour la vue ${viewIndex}`);
      return false;
    }
    
    try {
      // Configurer les règles de proxy
      let proxyRules = '';
      
      if (proxyConfig.enabled) {
        if (proxyConfig.username && proxyConfig.password) {
          // Proxy avec authentification
          proxyRules = `${proxyConfig.protocol}://${encodeURIComponent(proxyConfig.username)}:${encodeURIComponent(proxyConfig.password)}@${proxyConfig.host}:${proxyConfig.port}`;
        } else if (proxyConfig.host && proxyConfig.port) {
          // Proxy sans authentification
          proxyRules = `${proxyConfig.protocol}://${proxyConfig.host}:${proxyConfig.port}`;
        }
      }
      
      // Configurer la session avec les règles de proxy
      viewSession.setProxy({
        mode: proxyConfig.enabled ? 'fixed_servers' : 'direct',
        proxyRules: proxyRules,
        proxyBypassRules: proxyConfig.bypassList || 'localhost,127.0.0.1'
      }).then(() => {
        console.log(`Proxy appliqué avec succès à la vue ${viewIndex}:`, 
          proxyConfig.enabled ? proxyRules : 'Connexion directe');
      }).catch(error => {
        console.error(`Erreur lors de l'application du proxy à la vue ${viewIndex}:`, error);
      });
      
      return true;
    } catch (error) {
      console.error(`Erreur lors de la configuration du proxy pour la vue ${viewIndex}:`, error);
      return false;
    }
  }
}

// Exporter une instance unique
const proxyQuickSwitch = new ProxyQuickSwitch();
module.exports = proxyQuickSwitch;
