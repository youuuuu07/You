/**
 * Module pour l'intégration de l'API Webshare
 * Permet de récupérer et gérer les proxies depuis un compte Webshare
 */

const axios = require('axios');
const Store = require('electron-store');

class WebshareProxyApi {
  constructor(apiKey) {
    this.apiKey = apiKey || '';
    this.baseUrl = 'https://proxy.webshare.io/api';
    this.store = new Store({
      name: 'webshare-proxies',
      encryptionKey: 'your-encryption-key'
    });
    
    // Charger la clé API depuis le stockage si elle existe
    if (!this.apiKey) {
      this.apiKey = this.store.get('apiKey', '');
    }
  }

  // Définir la clé API
  setApiKey(apiKey) {
    this.apiKey = apiKey;
    this.store.set('apiKey', apiKey);
    return true;
  }

  // Obtenir la clé API actuelle
  getApiKey() {
    return this.apiKey;
  }

  // Récupérer la liste des proxies depuis l'API Webshare
  async getProxies() {
    if (!this.apiKey) {
      throw new Error('Clé API non définie');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/v2/proxy/list/`, {
        headers: {
          'Authorization': `Token ${this.apiKey}`
        }
      });

      if (response.data && response.data.results) {
        // Convertir les proxies au format attendu par l'application
        const proxies = response.data.results.map((proxy, index) => {
          return {
            name: `Webshare Proxy ${index + 1}`,
            enabled: true,
            protocol: 'http',
            host: proxy.proxy_address,
            port: proxy.port,
            username: proxy.username,
            password: proxy.password,
            bypassList: 'localhost,127.0.0.1'
          };
        });

        // Sauvegarder les proxies dans le stockage local
        this.store.set('proxies', proxies);

        return proxies;
      }

      return [];
    } catch (error) {
      console.error('Erreur lors de la récupération des proxies Webshare:', error.message);
      
      // En cas d'erreur, retourner les proxies en cache
      return this.getCachedProxies();
    }
  }

  // Récupérer les proxies en cache
  getCachedProxies() {
    return this.store.get('proxies', []);
  }

  // Tester un proxy spécifique
  async testProxy(proxyConfig) {
    try {
      const proxyUrl = `http://${proxyConfig.username}:${proxyConfig.password}@${proxyConfig.host}:${proxyConfig.port}`;
      
      const response = await axios.get('https://api.ipify.org?format=json', {
        proxy: {
          host: proxyConfig.host,
          port: proxyConfig.port,
          auth: {
            username: proxyConfig.username,
            password: proxyConfig.password
          },
          protocol: 'http'
        },
        timeout: 10000 // 10 secondes de timeout
      });

      return {
        success: true,
        ip: response.data.ip
      };
    } catch (error) {
      console.error('Erreur lors du test du proxy:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Exporter une instance unique avec la clé API par défaut
const webshareProxyApi = new WebshareProxyApi('3ftsy67qgqj2vnayxrpku429lb6o9hxfvbltq7ht');
module.exports = webshareProxyApi;
