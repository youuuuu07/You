const { session } = require('electron');
const fs = require('fs');
const path = require('path');

class ProxyManager {
    constructor() {
        // Map pour stocker les configurations de proxy par slot ID
        this.slotProxies = new Map();
        
        // Map pour stocker les configurations de proxy par URL (pour la compatibilité)
        this.proxySettings = new Map();
        
        // Chemin pour stocker les configurations de proxy de manière persistante
        this.configPath = path.join(app.getPath('userData'), 'proxy-config.json');
        
        // Charger les configurations sauvegardées
        this.loadConfig();
    }
    
    // Sauvegarder les configurations dans un fichier
    saveConfig() {
        try {
            // Convertir les Maps en objets pour la sérialisation
            const config = {
                slotProxies: Object.fromEntries(this.slotProxies),
                proxySettings: Object.fromEntries(this.proxySettings)
            };
            
            fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
            console.log('Configuration des proxies sauvegardée avec succès');
        } catch (error) {
            console.error('Erreur lors de la sauvegarde de la configuration des proxies:', error);
        }
    }
    
    // Charger les configurations depuis un fichier
    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
                
                // Convertir les objets en Maps
                if (config.slotProxies) {
                    this.slotProxies = new Map(Object.entries(config.slotProxies));
                }
                
                if (config.proxySettings) {
                    this.proxySettings = new Map(Object.entries(config.proxySettings));
                }
                
                console.log('Configuration des proxies chargée avec succès');
            }
        } catch (error) {
            console.error('Erreur lors du chargement de la configuration des proxies:', error);
        }
    }

    // Définir un proxy pour un slot spécifique
    setProxyForSlot(slotId, proxyConfig) {
        console.log(`Configuration du proxy pour le slot ${slotId}:`, proxyConfig);
        
        if (!proxyConfig || !proxyConfig.enabled || !proxyConfig.host || !proxyConfig.port) {
            // Désactiver le proxy pour ce slot
            this.slotProxies.delete(slotId.toString());
            console.log(`Proxy désactivé pour le slot ${slotId}`);
        } else {
            // Activer le proxy pour ce slot
            this.slotProxies.set(slotId.toString(), proxyConfig);
            console.log(`Proxy configuré pour le slot ${slotId}: ${proxyConfig.host}:${proxyConfig.port}`);
        }
        
        // Sauvegarder la configuration
        this.saveConfig();
        
        return true;
    }
    
    // Obtenir la configuration proxy pour un slot spécifique
    getProxyForSlot(slotId) {
        return this.slotProxies.get(slotId.toString());
    }
    
    // Supprimer le proxy pour un slot spécifique
    removeProxyForSlot(slotId) {
        const result = this.slotProxies.delete(slotId.toString());
        this.saveConfig();
        return result;
    }
    
    // Obtenir toutes les configurations proxy par slot
    getAllSlotProxies() {
        return Object.fromEntries(this.slotProxies);
    }
    
    // Appliquer un proxy à une session spécifique
    applyProxyToSession(sessionInstance, proxyConfig) {
        if (!proxyConfig || !proxyConfig.enabled || !proxyConfig.host || !proxyConfig.port) {
            // Désactiver le proxy pour cette session
            sessionInstance.setProxy({
                mode: 'direct'
            });
            return false;
        }
        
        // Construire la chaîne de proxy
        let proxyString = '';
        
        // Ajouter le protocole si spécifié
        if (proxyConfig.protocol) {
            proxyString = `${proxyConfig.protocol}://`;
        }
        
        // Ajouter les identifiants si spécifiés
        if (proxyConfig.username && proxyConfig.password) {
            proxyString += `${proxyConfig.username}:${proxyConfig.password}@`;
        }
        
        // Ajouter l'hôte et le port
        proxyString += `${proxyConfig.host}:${proxyConfig.port}`;
        
        // Configurer les règles de proxy
        const proxyRules = {
            proxyRules: proxyString,
            proxyBypassRules: proxyConfig.bypassList || 'localhost,127.0.0.1'
        };
        
        // Appliquer la configuration à la session
        sessionInstance.setProxy(proxyRules);
        
        console.log(`Proxy appliqué à la session: ${proxyString}`);
        return true;
    }

    // Méthodes de compatibilité avec l'ancien système
    setProxy(url, proxyConfig) {
        const sessionInstance = session.fromPartition('persist:main');
        
        if (!proxyConfig || !proxyConfig.host || !proxyConfig.port) {
            // Désactiver le proxy pour cette URL
            sessionInstance.setProxy({
                mode: 'direct'
            });
            this.proxySettings.delete(url);
            return;
        }

        const proxyString = `${proxyConfig.host}:${proxyConfig.port}`;
        const proxyRules = {
            proxyRules: proxyString,
            proxyBypassRules: 'localhost,127.0.0.1'
        };

        if (proxyConfig.username && proxyConfig.password) {
            proxyRules.proxyLogin = proxyConfig.username;
            proxyRules.proxyPassword = proxyConfig.password;
        }

        sessionInstance.setProxy(proxyRules);
        this.proxySettings.set(url, proxyConfig);
        
        // Sauvegarder la configuration
        this.saveConfig();
    }

    getProxy(url) {
        return this.proxySettings.get(url);
    }

    removeProxy(url) {
        const sessionInstance = session.fromPartition('persist:main');
        sessionInstance.setProxy({
            mode: 'direct'
        });
        const result = this.proxySettings.delete(url);
        
        // Sauvegarder la configuration
        this.saveConfig();
        
        return result;
    }

    getAllProxies() {
        return Object.fromEntries(this.proxySettings);
    }
    
    // Importer une configuration de proxies
    importConfig(config) {
        try {
            if (config.slotProxies) {
                this.slotProxies = new Map(Object.entries(config.slotProxies));
            }
            
            if (config.proxySettings) {
                this.proxySettings = new Map(Object.entries(config.proxySettings));
            }
            
            this.saveConfig();
            return true;
        } catch (error) {
            console.error('Erreur lors de l\'importation de la configuration des proxies:', error);
            return false;
        }
    }
    
    // Exporter la configuration des proxies
    exportConfig() {
        return {
            slotProxies: Object.fromEntries(this.slotProxies),
            proxySettings: Object.fromEntries(this.proxySettings)
        };
    }
    
    // Réinitialiser tous les proxies
    resetAllProxies() {
        this.slotProxies.clear();
        this.proxySettings.clear();
        this.saveConfig();
        return true;
    }
}

// Ajouter le module electron app
const { app } = require('electron');

module.exports = new ProxyManager();
