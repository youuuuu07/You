/**
 * Module pour ouvrir directement l'extension Webshare Proxy dans les vues
 */

const { session } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { pipeline } = require('stream');
const { promisify } = require('util');
const streamPipeline = promisify(pipeline);
const zlib = require('zlib');
const gunzip = promisify(zlib.gunzip);
const { exec } = require('child_process');
const execAsync = promisify(exec);
const AdmZip = require('adm-zip');

// ID de l'extension Webshare Proxy
const WEBSHARE_PROXY_EXTENSION_ID = 'bdokeillmfmaogjpficejjcjekcflkdh';

// Dossier pour stocker l'extension téléchargée et décompressée
const EXTENSIONS_DIR = path.join(__dirname, '..', '..', 'extensions');

/**
 * Classe pour gérer l'ouverture de l'extension Webshare Proxy
 */
class WebshareProxyOpener {
  constructor() {
    // Créer le dossier des extensions s'il n'existe pas
    if (!fs.existsSync(EXTENSIONS_DIR)) {
      fs.mkdirSync(EXTENSIONS_DIR, { recursive: true });
    }
    
    // Chemin du dossier de l'extension décompressée
    this.extensionDir = path.join(EXTENSIONS_DIR, WEBSHARE_PROXY_EXTENSION_ID);
    
    // Indiquer si le téléchargement a déjà été tenté dans cette session (moins pertinent maintenant)
    // this.downloadAttempted = false;
  }
  
  /**
   * Initialiser l'installateur de l'extension.
   * S'attend à ce que le dossier décompressé soit déjà présent pour l'installation.
   */
  async initialize() {
    console.log('Initialisation du WebshareProxyOpener. Tentative d\'installation depuis le dossier décompressé.');
    // La logique d'installation dans installForAllSessions vérifiera la présence du dossier/manifeste.
    await this.installForAllSessions();
  }

  /**
   * Télécharger et décompresser l'extension depuis le Chrome Web Store
   * Cette méthode est désormais un fallback si le dossier n'est pas prêt.
   */
  async downloadExtension() {
    const extensionDir = this.extensionDir;
    const manifestPath = path.join(extensionDir, 'manifest.json');

    // Si le dossier décompressé existe, ne rien faire (devrait être géré par initialize, mais double vérification).
    if (fs.existsSync(extensionDir) && fs.existsSync(manifestPath)) {
        console.log('Dossier d\'extension décompressée trouvé pendant le téléchargement. Annulation du téléchargement.');
        return extensionDir;
    }

    try {
      // NE PAS supprimer le dossier ici. L'utilisateur l'a peut-être mis manuellement.
      // Si le dossier existe mais est incomplet, l'installation échouera proprement.
      // if (fs.existsSync(extensionDir)) {
      //   console.log(`Suppression du dossier d'extension incomplet : ${extensionDir}`);
      //   fs.rmSync(extensionDir, { recursive: true, force: true });
      // }
      
      // Créer le dossier pour l'extension si absent (devrait l'être si on arrive ici sans dossier)
      if (!fs.existsSync(extensionDir)) {
         fs.mkdirSync(extensionDir, { recursive: true });
      }
      
      // URL initiale pour télécharger l'extension depuis le Chrome Web Store
      let downloadUrl = `https://clients2.google.com/service/update2/crx?response=redirect&acceptformat=crx2,crx3&prodversion=${process.versions.chrome}&x=id%3D${WEBSHARE_PROXY_EXTENSION_ID}%26installsource%3Dondemand%26uc`;
      
      // Chemin du fichier CRX temporaire
      const crxFilePath = path.join(extensionDir, `${WEBSHARE_PROXY_EXTENSION_ID}.crx`);
      
      console.log('Téléchargement de l\'extension Webshare Proxy...');
      
      // Fonction récursive pour suivre les redirections
      const followRedirects = (url) => {
        return new Promise((resolve, reject) => {
          https.get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              // Gérer la redirection
              console.log(`Redirection (${res.statusCode}) vers ${res.headers.location}`);
              followRedirects(res.headers.location).then(resolve).catch(reject);
            } else if (res.statusCode === 200) {
              // Fichier trouvé
              resolve(res);
            } else {
              // Erreur
              reject(new Error(`Impossible de télécharger l\'extension Webshare Proxy: ${res.statusCode}`));
            }
          }).on('error', reject);
        });
      };
      
      // Démarrer le téléchargement en suivant les redirections
      const response = await followRedirects(downloadUrl);
      
      // Enregistrer le fichier CRX
      const fileStream = fs.createWriteStream(crxFilePath);
      await streamPipeline(response, fileStream);
      
      console.log('Extension Webshare Proxy téléchargée avec succès');
      
      // Lire le fichier CRX
      const crxBuffer = fs.readFileSync(crxFilePath);
      
      // Gérer l'en-tête CRX (format CRX3)
      const magic = crxBuffer.slice(0, 4).toString();
      if (magic !== 'Cr24') {
        throw new Error('Format de fichier CRX invalide: en-tête magic incorrect');
      }
      
      const version = crxBuffer.readInt32LE(4);
      if (version !== 3) {
         console.warn(`Version CRX inattendue: ${version}. Tentative de traitement.`);
      }

      const publicKeySize = crxBuffer.readInt32LE(8);
      const signatureSize = crxBuffer.readInt32LE(12);
      const headerSize = 16 + publicKeySize + signatureSize; // Taille totale de l'en-tête

      // Extraire le contenu ZIP (après l'en-tête)
      const zipContent = crxBuffer.slice(headerSize);
      
      // Écrire le contenu décompressé dans un fichier ZIP temporaire
      const zipFilePath = path.join(extensionDir, 'extension.zip');
      fs.writeFileSync(zipFilePath, zipContent);
      
      // Extraire le contenu du ZIP en utilisant adm-zip
      console.log('Extraction des fichiers de l\'extension avec adm-zip...');
      try {
        const zip = new AdmZip(zipFilePath);
        zip.extractAllTo(extensionDir, true); // true écrase les fichiers existants
      } catch (error) {
        console.error('Erreur lors de l\'extraction du ZIP avec adm-zip:', error);
        throw error; // Remonter l'erreur
      }
      
      // Supprimer les fichiers temporaires (sauf le zip si extraction échoue)
      fs.unlinkSync(crxFilePath);
      const finalManifestPath = path.join(extensionDir, 'manifest.json');
      if (fs.existsSync(finalManifestPath)) { // Supprimer le zip seulement si l'extraction semble avoir réussi
         fs.unlinkSync(zipFilePath);
      }
      
      console.log('Extension Webshare Proxy décompressée avec succès');
      
      // Vérifier que le fichier manifest.json existe (devrait toujours le faire si pas d'erreur avant)
      if (!fs.existsSync(finalManifestPath)) {
        throw new Error('Le fichier manifest.json est manquant après la décompression');
      }
      
      return extensionDir;
    } catch (error) {
      console.error('Erreur lors du téléchargement ou de l\'extraction de l\'extension Webshare Proxy:', error);
      // L'erreur sera propagée si le dossier final est incomplet.
      return null; // Retourne null en cas d'échec grave du téléchargement/extraction
    }
  }
  
  /**
   * Installer l'extension pour une session spécifique
   * @param {Electron.Session} sessionInstance - Instance de session Electron
   */
  async installExtension(sessionInstance) {
    try {
      // Vérifier si l'extension est déjà installée dans cette session
      const extensions = await sessionInstance.getAllExtensions();
      const isInstalled = extensions.some(ext => ext.id === WEBSHARE_PROXY_EXTENSION_ID);
      
      if (isInstalled) {
        // console.log('Extension Webshare Proxy déjà installée dans la session'); // Moins verbeux
        return sessionInstance.getExtension(WEBSHARE_PROXY_EXTENSION_ID);
      }
      
      // L'extension est censée être dans le dossier décompressé à ce stade
      const manifestPath = path.join(this.extensionDir, 'manifest.json');
      if (!fs.existsSync(this.extensionDir) || !fs.existsSync(manifestPath)) {
        console.error(`Dossier de l\'extension décompressée non trouvé ou incomplet à l\'emplacement attendu : ${this.extensionDir}`);
        // Impossible d'installer si le dossier n'est pas là
        return null;
      }
      
      // Installer l'extension à partir du dossier décompressé
      console.log(`Installation de l\'extension Webshare Proxy depuis ${this.extensionDir} dans la session...`);
      const extension = await sessionInstance.loadExtension(this.extensionDir, {
        allowFileAccess: true
      });
      
      console.log('Extension Webshare Proxy installée avec succès dans la session');
      
      return extension;
    } catch (error) {
      console.error('Erreur lors de l\'installation de l\'extension Webshare Proxy:', error);
      // L'installation a échoué, retourner null
      return null;
    }
  }
  
  /**
   * Installer l'extension Webshare Proxy pour toutes les sessions
   */
  async installForAllSessions() {
    try {
      console.log('Début de l\'installation de l\'extension pour toutes les sessions...');
      
      // Vérifier si le dossier décompressé est prêt avant de tenter d'installer
      const manifestPath = path.join(this.extensionDir, 'manifest.json');
      if (!fs.existsSync(this.extensionDir) || !fs.existsSync(manifestPath)) {
         console.error('Dossier de l\'extension décompressée non prêt. Installation impossible.');
         return false; // Impossible de continuer l'installation si le dossier n'est pas là
      }

      // Installer l'extension dans la session par défaut
      await this.installExtension(session.defaultSession);
      
      // Installer l'extension dans toutes les sessions de partition
      const partitions = [
        'persist:xbox1', 'persist:xbox2', 'persist:xbox3', 'persist:xbox4', 'persist:xbox5',
        'persist:xbox6', 'persist:xbox7', 'persist:xbox8', 'persist:xbox9', 'persist:xbox10'
      ];
      
      // Lancer les installations en parallèle pour toutes les sessions de partition
      const installPromises = partitions.map(async (partition) => {
        const partitionSession = session.fromPartition(partition);
        // installExtension gère s'il y a déjà un manifest.json
        await this.installExtension(partitionSession);
      });

      // Attendre que toutes les installations se terminent
      await Promise.all(installPromises);
      
      console.log('Processus d\'installation de l\'extension pour toutes les sessions terminé.');
      return true;
    } catch (error) {
      console.error('Erreur lors de l\'installation de l\'extension Webshare Proxy pour toutes les sessions:', error);
      return false;
    }
   }

   /**
    * Définit la configuration proxy pour une session de partition spécifiée.
    * @param {string} sessionName - Le nom de la partition de session (e.g., 'persist:xbox1').
    * @param {object} proxyDetails - Les détails du proxy.
    * @param {'http' | 'socks4' | 'socks5'} proxyDetails.type - Le type de proxy.
    * @param {string} proxyDetails.host - L'adresse de l'hôte du proxy.
    * @param {number} proxyDetails.port - Le port du proxy.
    * @param {string} [proxyDetails.username] - Nom d'utilisateur pour l'authentification (optionnel).
    * @param {string} [proxyDetails.password] - Mot de passe pour l'authentification (optionnel).
    */
   async setProxyForSession(sessionName, proxyDetails) {
     try {
       console.log(`Tentative de configuration du proxy pour la session ${sessionName}`);

       const targetSession = session.fromPartition(sessionName);

       let proxyRules = `${proxyDetails.type}=${proxyDetails.host}:${proxyDetails.port}`;

       // Note: L'authentification proxy avec setProxy peut nécessiter la gestion de l'événement 'login'
       // sur l'application Electron plutôt qu'ici directement avec username/password dans proxyRules.
       // Pour l'instant, nous configurons juste les règles.
       console.log(`Configuration des règles proxy pour ${sessionName}: ${proxyRules}`);

       await targetSession.setProxy({
         proxyRules: proxyRules
         // On peut aussi ajouter proxyForFtp, proxyForHttp, proxyForHttps, proxyForSocks
         // bypassRules pour exclure certains hôtes.
       });

       console.log(`Proxy configuré avec succès pour la session ${sessionName}.`);
     } catch (error) {
       console.error(`Erreur lors de la configuration du proxy pour la session ${sessionName}:`, error);
     }
   }

   /**
    * Ouvre l'extension Webshare Proxy dans la vue spécifiée.
    * Note: Les extensions n'ont pas une URL directement navigable comme une page web.
    * Une approche courante est d'ouvrir une fenêtre popup de l'extension ou
    * d'utiliser chrome.runtime.sendMessage si la vue est capable de communiquer.
    * Pour cet exemple, nous allons garder la logique d'envoi de message.
    * @param {Electron.WebContents} webContents - Les contenus web de la vue cible.
    */
   async openExtension(webContents) {
    try {
      console.log('Tentative d\'ouverture de l\'extension Webshare Proxy via message.');
      // Assurez-vous que l'extension est chargée dans cette session
      const extension = await this.installExtension(webContents.session);

      if (extension) {
        // Envoyer un message à l'extension chargée dans la vue
        // L'extension doit avoir un script d'arrière-plan ou un script de contenu
        // qui écoute les messages envoyés via chrome.runtime.sendMessage
        // Le message spécifique et sa gestion dépendent de l'implémentation de l'extension.
        // Electron permet l'exécution de scripts dans le contexte de l'extension.
        webContents.executeJavaScript(`chrome.runtime.sendMessage('${WEBSHARE_PROXY_EXTENSION_ID}', { action: 'open' }, function(response) {
          if (chrome.runtime.lastError) {
            console.error('Erreur lors de l\'envoi du message à l\'extension:', chrome.runtime.lastError);
          } else {
            console.log('Réponse de l\'extension:', response);
          }
        });`);
        console.log('Message envoyé à l\'extension Webshare Proxy.');
        return true;
      } else {
        console.error('Impossible d\'ouvrir l\'extension: extension non chargée ou dossier manquant.');
        return false;
      }
    } catch (error) {
      console.error('Erreur lors de l\'ouverture de l\'extension Webshare Proxy:', error);
      return false;
    }
   }
}

// Exporter une instance unique
const webshareProxyOpener = new WebshareProxyOpener();
module.exports = webshareProxyOpener;
