/**
 * Module pour la gestion des extensions Chrome dans l'application
 */

const { session } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { pipeline } = require('stream');
const { promisify } = require('util');
const streamPipeline = promisify(pipeline);

// ID des extensions
const EXTENSIONS = {
  WEBSHARE_PROXY: 'bdokeillmfmaogjpficejjcjekcflkdh'
};

// Dossier pour stocker les extensions téléchargées
const EXTENSIONS_DIR = path.join(__dirname, '..', '..', 'extensions');

/**
 * Classe pour gérer les extensions Chrome
 */
class ExtensionManager {
  constructor() {
    // Créer le dossier des extensions s'il n'existe pas
    if (!fs.existsSync(EXTENSIONS_DIR)) {
      fs.mkdirSync(EXTENSIONS_DIR, { recursive: true });
    }
  }

  /**
   * Télécharger une extension depuis le Chrome Web Store
   * @param {string} extensionId - ID de l'extension à télécharger
   * @returns {Promise<string>} - Chemin vers l'extension téléchargée
   */
  async downloadExtension(extensionId) {
    const extensionDir = path.join(EXTENSIONS_DIR, extensionId);
    
    // Vérifier si l'extension est déjà téléchargée
    if (fs.existsSync(extensionDir)) {
      console.log(`Extension ${extensionId} déjà téléchargée`);
      return extensionDir;
    }
    
    // Créer le dossier pour l'extension
    fs.mkdirSync(extensionDir, { recursive: true });
    
    // URL pour télécharger l'extension depuis le Chrome Web Store
    const downloadUrl = `https://clients2.google.com/service/update2/crx?response=redirect&acceptformat=crx2,crx3&prodversion=${process.versions.chrome}&x=id%3D${extensionId}%26installsource%3Dondemand%26uc`;
    
    // Chemin du fichier CRX
    const crxFilePath = path.join(extensionDir, `${extensionId}.crx`);
    
    console.log(`Téléchargement de l'extension ${extensionId}...`);
    
    // Télécharger le fichier CRX
    try {
      const response = await new Promise((resolve, reject) => {
        https.get(downloadUrl, (res) => {
          if (res.statusCode === 200) {
            resolve(res);
          } else {
            reject(new Error(`Impossible de télécharger l'extension ${extensionId}: ${res.statusCode}`));
          }
        }).on('error', reject);
      });
      
      // Enregistrer le fichier CRX
      const fileStream = fs.createWriteStream(crxFilePath);
      await streamPipeline(response, fileStream);
      
      console.log(`Extension ${extensionId} téléchargée avec succès`);
      
      return extensionDir;
    } catch (error) {
      console.error(`Erreur lors du téléchargement de l'extension ${extensionId}:`, error);
      throw error;
    }
  }

  /**
   * Installer une extension pour une session spécifique
   * @param {Electron.Session} sessionInstance - Instance de session Electron
   * @param {string} extensionId - ID de l'extension à installer
   * @returns {Promise<Electron.Extension>} - Informations sur l'extension installée
   */
  async installExtension(sessionInstance, extensionId) {
    try {
      // Vérifier si l'extension est déjà installée dans cette session
      const extensions = await sessionInstance.getAllExtensions();
      const isInstalled = extensions.some(ext => ext.id === extensionId);
      
      if (isInstalled) {
        console.log(`Extension ${extensionId} déjà installée dans la session`);
        return sessionInstance.getExtension(extensionId);
      }
      
      // Télécharger l'extension si nécessaire
      const extensionDir = await this.downloadExtension(extensionId);
      
      // Installer l'extension dans la session
      console.log(`Installation de l'extension ${extensionId} dans la session...`);
      const extension = await sessionInstance.loadExtension(extensionDir, {
        allowFileAccess: true
      });
      
      console.log(`Extension ${extensionId} installée avec succès dans la session`);
      
      return extension;
    } catch (error) {
      console.error(`Erreur lors de l'installation de l'extension ${extensionId}:`, error);
      throw error;
    }
  }

  /**
   * Installer l'extension Webshare Proxy pour une session spécifique
   * @param {Electron.Session} sessionInstance - Instance de session Electron
   * @returns {Promise<Electron.Extension>} - Informations sur l'extension installée
   */
  async installWebshareProxy(sessionInstance) {
    return this.installExtension(sessionInstance, EXTENSIONS.WEBSHARE_PROXY);
  }
  
  /**
   * Installer l'extension Webshare Proxy pour toutes les sessions
   * @returns {Promise<void>}
   */
  async installWebshareProxyForAllSessions() {
    try {
      // Installer l'extension dans la session par défaut
      await this.installWebshareProxy(session.defaultSession);
      
      // Installer l'extension dans toutes les sessions de partition
      const partitions = ['persist:xbox1', 'persist:xbox2', 'persist:xbox3', 'persist:xbox4', 'persist:xbox5',
                          'persist:xbox6', 'persist:xbox7', 'persist:xbox8', 'persist:xbox9', 'persist:xbox10'];
      
      for (const partition of partitions) {
        const partitionSession = session.fromPartition(partition);
        await this.installWebshareProxy(partitionSession);
      }
      
      console.log('Extension Webshare Proxy installée dans toutes les sessions');
    } catch (error) {
      console.error('Erreur lors de l\'installation de l\'extension Webshare Proxy pour toutes les sessions:', error);
    }
  }
}

// Exporter une instance unique
const extensionManager = new ExtensionManager();
module.exports = extensionManager;
