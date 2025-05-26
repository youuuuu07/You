const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const proxyManager = require('./proxyManager');

// Fonction pour créer une fenêtre de configuration de proxy simple
function createProxyConfigWindow(parentWindow, slotId, slotLabel) {
  // Créer une fenêtre pour la configuration du proxy
  const proxyWindow = new BrowserWindow({
    width: 400,
    height: 450,
    title: `Configuration du Proxy - ${slotLabel}`,
    parent: parentWindow,
    modal: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Charger le HTML directement dans la fenêtre
  const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>Configuration du Proxy</title>
    <style>
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        background-color: #1a1a1a;
        color: #f0f0f0;
        margin: 0;
        padding: 20px;
      }
      h2 {
        color: #881337;
        margin-top: 0;
        border-bottom: 2px solid #b91c1c;
        padding-bottom: 10px;
      }
      .form-group {
        margin-bottom: 15px;
      }
      label {
        display: block;
        margin-bottom: 5px;
        font-weight: 500;
      }
      input, select {
        width: 100%;
        padding: 8px;
        border-radius: 4px;
        border: 1px solid #444;
        background-color: #2a2a2a;
        color: #f0f0f0;
        box-sizing: border-box;
      }
      .button-group {
        display: flex;
        justify-content: space-between;
        margin-top: 20px;
      }
      button {
        padding: 8px 15px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 500;
      }
      .save-btn {
        background-color: #881337;
        color: white;
      }
      .clear-btn {
        background-color: #555;
        color: white;
      }
      .cancel-btn {
        background-color: #333;
        color: white;
      }
      .slot-info {
        background-color: #2a2a2a;
        padding: 10px;
        border-radius: 4px;
        margin-bottom: 15px;
        border-left: 3px solid #881337;
      }
    </style>
  </head>
  <body>
    <h2>Configuration du Proxy</h2>
    <div class="slot-info">
      <strong>${slotLabel}</strong>
    </div>
    <div class="form-group">
      <label>
        <input type="checkbox" id="proxy-enabled"> Activer le proxy
      </label>
    </div>
    <div class="form-group">
      <label for="proxy-protocol">Protocole:</label>
      <select id="proxy-protocol">
        <option value="http">HTTP</option>
        <option value="https">HTTPS</option>
        <option value="socks4">SOCKS4</option>
        <option value="socks5">SOCKS5</option>
      </select>
    </div>
    <div class="form-group">
      <label for="proxy-host">Hôte:</label>
      <input type="text" id="proxy-host" placeholder="127.0.0.1">
    </div>
    <div class="form-group">
      <label for="proxy-port">Port:</label>
      <input type="number" id="proxy-port" placeholder="8080">
    </div>
    <div class="form-group">
      <label for="proxy-username">Nom d'utilisateur (facultatif):</label>
      <input type="text" id="proxy-username" placeholder="utilisateur">
    </div>
    <div class="form-group">
      <label for="proxy-password">Mot de passe (facultatif):</label>
      <input type="password" id="proxy-password" placeholder="mot de passe">
    </div>
    <div class="form-group">
      <label for="proxy-bypass">Liste de contournement (facultatif):</label>
      <input type="text" id="proxy-bypass" placeholder="localhost, 127.0.0.1">
    </div>
    <div class="button-group">
      <button id="save-btn" class="save-btn">Enregistrer</button>
      <button id="clear-btn" class="clear-btn">Supprimer</button>
      <button id="cancel-btn" class="cancel-btn">Annuler</button>
    </div>

    <script>
      const { ipcRenderer } = require('electron');
      const proxyManager = require('./proxyManager');
      const slotId = ${slotId};
      
      // Éléments du formulaire
      const proxyEnabled = document.getElementById('proxy-enabled');
      const proxyProtocol = document.getElementById('proxy-protocol');
      const proxyHost = document.getElementById('proxy-host');
      const proxyPort = document.getElementById('proxy-port');
      const proxyUsername = document.getElementById('proxy-username');
      const proxyPassword = document.getElementById('proxy-password');
      const proxyBypass = document.getElementById('proxy-bypass');
      const saveBtn = document.getElementById('save-btn');
      const clearBtn = document.getElementById('clear-btn');
      const cancelBtn = document.getElementById('cancel-btn');
      
      // Charger la configuration existante
      const proxyConfig = proxyManager.getProxyForSlot(slotId);
      if (proxyConfig) {
        proxyEnabled.checked = proxyConfig.enabled || false;
        proxyProtocol.value = proxyConfig.protocol || 'http';
        proxyHost.value = proxyConfig.host || '';
        proxyPort.value = proxyConfig.port || '';
        proxyUsername.value = proxyConfig.username || '';
        proxyPassword.value = proxyConfig.password || '';
        proxyBypass.value = proxyConfig.bypassList || '';
      }
      
      // Enregistrer la configuration
      saveBtn.addEventListener('click', () => {
        // Valider les entrées
        if (proxyEnabled.checked && (!proxyHost.value || !proxyPort.value)) {
          alert('Veuillez saisir l\'hôte et le port du proxy.');
          return;
        }
        
        // Créer l'objet de configuration
        const newProxyConfig = {
          enabled: proxyEnabled.checked,
          protocol: proxyProtocol.value,
          host: proxyHost.value,
          port: proxyPort.value,
          username: proxyUsername.value,
          password: proxyPassword.value,
          bypassList: proxyBypass.value
        };
        
        // Enregistrer la configuration dans le gestionnaire de proxies
        proxyManager.setProxyForSlot(slotId, newProxyConfig);
        
        // Appliquer le proxy à la vue
        ipcRenderer.invoke('apply-proxy-to-slot', slotId, newProxyConfig)
          .then(() => {
            // Fermer la fenêtre
            window.close();
          })
          .catch(err => {
            console.error('Erreur lors de l\'application du proxy:', err);
            alert('Erreur lors de l\'application du proxy. Veuillez réessayer.');
          });
      });
      
      // Supprimer la configuration
      clearBtn.addEventListener('click', () => {
        // Supprimer la configuration dans le gestionnaire de proxies
        proxyManager.removeProxyForSlot(slotId);
        
        // Réinitialiser le proxy pour la vue
        ipcRenderer.invoke('remove-proxy-for-slot', slotId)
          .then(() => {
            // Fermer la fenêtre
            window.close();
          })
          .catch(err => {
            console.error('Erreur lors de la suppression du proxy:', err);
            alert('Erreur lors de la suppression du proxy. Veuillez réessayer.');
          });
      });
      
      // Annuler
      cancelBtn.addEventListener('click', () => {
        window.close();
      });
    </script>
  </body>
  </html>
  `;

  // Charger le contenu HTML directement
  proxyWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

  return proxyWindow;
}

// Ajouter un gestionnaire IPC pour appliquer un proxy à un slot spécifique
ipcMain.handle('apply-proxy-to-slot', async (event, slotId, proxyConfig) => {
  try {
    const mainViewWindow = global.mainViewWindow;
    if (!mainViewWindow || !mainViewWindow.views) {
      console.error('Fenêtre principale ou vues non disponibles');
      return false;
    }
    
    const view = mainViewWindow.views[slotId];
    if (!view || !view.webContents || view.webContents.isDestroyed()) {
      console.error(`Vue ${slotId} non disponible ou détruite`);
      return false;
    }
    
    // Appliquer le proxy à la session de la vue
    const sessionInstance = view.webContents.session;
    
    // Utiliser le gestionnaire de proxies pour appliquer la configuration
    proxyManager.applyProxyToSession(sessionInstance, proxyConfig);
    
    // Recharger la vue pour appliquer les changements
    view.webContents.reload();
    
    console.log(`Proxy appliqué avec succès à la vue ${slotId}`);
    return true;
  } catch (error) {
    console.error(`Erreur lors de l'application du proxy à la vue ${slotId}:`, error);
    return false;
  }
});

// Ajouter un gestionnaire IPC pour appliquer tous les proxies configurés
ipcMain.handle('apply-proxies-to-all-views', async (event) => {
  try {
    const mainViewWindow = global.mainViewWindow;
    if (!mainViewWindow || !mainViewWindow.views) {
      console.error('Fenêtre principale ou vues non disponibles');
      return false;
    }
    
    // Parcourir toutes les vues et appliquer leurs proxies respectifs
    for (let i = 0; i < mainViewWindow.views.length; i++) {
      const view = mainViewWindow.views[i];
      if (view && view.webContents && !view.webContents.isDestroyed()) {
        // Récupérer la configuration proxy pour ce slot
        const proxyConfig = proxyManager.getProxyForSlot(i);
        
        // Si une configuration existe, l'appliquer
        if (proxyConfig && proxyConfig.enabled) {
          const sessionInstance = view.webContents.session;
          proxyManager.applyProxyToSession(sessionInstance, proxyConfig);
          
          // Recharger la vue pour appliquer les changements
          view.webContents.reload();
          
          console.log(`Proxy appliqué avec succès à la vue ${i}`);
        }
      }
    }
    
    return true;
  } catch (error) {
    console.error('Erreur lors de l\'application des proxies à toutes les vues:', error);
    return false;
  }
});

module.exports = { createProxyConfigWindow };
