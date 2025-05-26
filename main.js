const { app, BrowserWindow, ipcMain, Menu, session } = require('electron');
const path = require('path');
const SelectionWindow = require('./selectionWindow');
const MainViewWindow = require('./mainViewWindow');
const { createMainViewWindow } = require('./mainViewWindow');

// Activer les flags pour le support des extensions Chrome
app.commandLine.appendSwitch('enable-features', 'CSSColorSchemeUARendering');
app.commandLine.appendSwitch('enable-features', 'ImpulseScrollAnimations');
app.commandLine.appendSwitch('disable-features', 'CrossOriginOpenerPolicy');
app.commandLine.appendSwitch('disable-site-isolation-trials');
app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors');

// Désactiver la vérification des certificats pour les proxies
app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('allow-insecure-localhost', 'true');

// Définir le chemin de l'icône de l'application
const iconPath = path.join(__dirname, '../../build/icon.ico');

let selectionWindow = null;
let mainViewWindow = null;
let macroActive = false;
let macroInterval = null;

// Fonction pour créer le menu de l'application
function createApplicationMenu() {
  const template = [
    {
      label: 'Fichier',
      submenu: [
        { role: 'quit', label: 'Quitter' }
      ]
    },
    {
      label: 'Édition',
      submenu: [
        { role: 'undo', label: 'Annuler' },
        { role: 'redo', label: 'Rétablir' },
        { type: 'separator' },
        { role: 'cut', label: 'Couper' },
        { role: 'copy', label: 'Copier' },
        { role: 'paste', label: 'Coller' }
      ]
    },
    {
      label: 'Affichage',
      submenu: [
        { role: 'reload', label: 'Recharger' },
        { role: 'toggleDevTools', label: 'Outils de développement' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom normal' },
        { role: 'zoomIn', label: 'Zoom avant' },
        { role: 'zoomOut', label: 'Zoom arrière' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Plein écran' }
      ]
    },
    {
      label: 'Outils',
      submenu: [
        {
          label: 'Panneau de Synchronisation',
          click: () => {
            if (mainViewWindow) {
              mainViewWindow.openSyncPanel();
            }
          }
        },
      ]
    },
    {
      role: 'help',
      label: 'Aide',
      submenu: [
        {
          label: 'À propos',
          click: () => {
            // Afficher une fenêtre avec des informations sur l'application
            const aboutWindow = new BrowserWindow({
              width: 300,
              height: 200,
              title: 'À propos',
              autoHideMenuBar: true,
              resizable: false,
              webPreferences: {
                nodeIntegration: true
              }
            });
            aboutWindow.loadFile(path.join(__dirname, '../renderer/about.html'));
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createSelectionWindow() {
  selectionWindow = new SelectionWindow();
  selectionWindow.window.on('closed', () => {
    selectionWindow = null;
  });
}

// Ajouter les écouteurs d'événements IPC
function setupIPCHandlers() {
  // Gestionnaires pour la configuration des proxies par slot
  ipcMain.handle('get-all-slots-proxy-info', async (event) => {
    if (!mainViewWindow) return [];
    
    // Récupérer les informations sur tous les slots
    const slots = [];
    const proxyManager = require('./proxyManager');
    
    for (let i = 0; i < mainViewWindow.views.length; i++) {
      const view = mainViewWindow.views[i];
      if (view) {
        // Récupérer la configuration proxy pour ce slot
        const proxyConfig = proxyManager.getProxyForSlot(i);
        
        slots.push({
          id: i,
          active: true,
          proxy: proxyConfig
        });
      }
    }
    
    return slots;
  });
  
  // Ouvrir la fenêtre de configuration de proxy pour un slot spécifique
  ipcMain.handle('open-proxy-config', async (event, slotId) => {
    if (!mainViewWindow) return false;
    
    const { createProxyConfigWindow } = require('./proxyConfigWindow');
    const view = mainViewWindow.views[slotId];
    
    if (view) {
      const viewLabel = `Slot ${slotId + 1}`;
      createProxyConfigWindow(mainViewWindow.window, slotId, viewLabel);
      return true;
    }
    
    return false;
  });
  
  // Supprimer le proxy pour un slot spécifique
  ipcMain.handle('remove-proxy-for-slot', async (event, slotId) => {
    const proxyManager = require('./proxyManager');
    const result = proxyManager.removeProxyForSlot(slotId);
    
    // Si le slot existe, appliquer les changements
    if (mainViewWindow && mainViewWindow.views[slotId]) {
      const view = mainViewWindow.views[slotId];
      if (view && view.webContents && !view.webContents.isDestroyed()) {
        // Réinitialiser le proxy pour cette session
        await view.webContents.session.setProxy({ mode: 'direct' });
        // Recharger la vue
        view.webContents.reload();
      }
    }
    
    return result;
  });
  
  // Réinitialiser tous les proxies
  ipcMain.handle('reset-all-proxies', async (event) => {
    const proxyManager = require('./proxyManager');
    const result = proxyManager.resetAllProxies();
    
    // Appliquer les changements à toutes les vues
    if (mainViewWindow) {
      for (const view of mainViewWindow.views) {
        if (view && view.webContents && !view.webContents.isDestroyed()) {
          // Réinitialiser le proxy pour cette session
          await view.webContents.session.setProxy({ mode: 'direct' });
          // Recharger la vue
          view.webContents.reload();
        }
      }
    }
    
    return result;
  });
  
  // Ouvrir la fenêtre d'import/export de configurations proxy
  ipcMain.handle('open-proxy-import-export', async (event) => {
    if (!mainViewWindow) return false;
    
    // Créer une fenêtre pour l'import/export
    const importExportWindow = new BrowserWindow({
      width: 600,
      height: 500,
      title: 'Import/Export de Configurations Proxy',
      parent: mainViewWindow.window,
      modal: true,
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
      <title>Import/Export de Configurations Proxy</title>
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
        .section {
          margin-bottom: 20px;
        }
        textarea {
          width: 100%;
          height: 200px;
          background-color: #2a2a2a;
          color: #f0f0f0;
          border: 1px solid #444;
          border-radius: 4px;
          padding: 10px;
          font-family: monospace;
          resize: vertical;
        }
        button {
          padding: 8px 15px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
          margin-top: 10px;
          margin-right: 10px;
        }
        .export-btn, .import-btn {
          background-color: #881337;
          color: white;
        }
        .export-btn:hover, .import-btn:hover {
          background-color: #9f1239;
        }
        .close-btn {
          background-color: #333;
          color: white;
        }
        .close-btn:hover {
          background-color: #444;
        }
        .message {
          margin-top: 10px;
          padding: 10px;
          border-radius: 4px;
        }
        .success {
          background-color: #166534;
          color: white;
        }
        .error {
          background-color: #991b1b;
          color: white;
        }
      </style>
    </head>
    <body>
      <h2>Import/Export de Configurations Proxy</h2>
      
      <div class="section">
        <h3>Exporter les configurations</h3>
        <button id="export-btn" class="export-btn">Exporter</button>
        <textarea id="export-area" placeholder="Les configurations exportées apparaîtront ici..."></textarea>
      </div>
      
      <div class="section">
        <h3>Importer des configurations</h3>
        <textarea id="import-area" placeholder="Collez ici les configurations à importer..."></textarea>
        <button id="import-btn" class="import-btn">Importer</button>
      </div>
      
      <div id="message" style="display: none;" class="message"></div>
      
      <button id="close-btn" class="close-btn">Fermer</button>
      
      <script>
        const { ipcRenderer } = require('electron');
        const proxyManager = require('../main/proxyManager');
        
        // Éléments du DOM
        const exportBtn = document.getElementById('export-btn');
        const exportArea = document.getElementById('export-area');
        const importBtn = document.getElementById('import-btn');
        const importArea = document.getElementById('import-area');
        const messageDiv = document.getElementById('message');
        const closeBtn = document.getElementById('close-btn');
        
        // Fonction pour afficher un message
        function showMessage(text, isSuccess = true) {
          messageDiv.textContent = text;
          messageDiv.className = isSuccess ? 'message success' : 'message error';
          messageDiv.style.display = 'block';
          
          // Masquer le message après 3 secondes
          setTimeout(() => {
            messageDiv.style.display = 'none';
          }, 3000);
        }
        
        // Exporter les configurations
        exportBtn.addEventListener('click', () => {
          try {
            const config = proxyManager.exportConfig();
            exportArea.value = JSON.stringify(config, null, 2);
            showMessage('Configurations exportées avec succès!');
          } catch (error) {
            console.error('Erreur lors de l\'exportation:', error);
            showMessage('Erreur lors de l\'exportation: ' + error.message, false);
          }
        });
        
        // Importer des configurations
        importBtn.addEventListener('click', () => {
          try {
            const configText = importArea.value.trim();
            if (!configText) {
              showMessage('Veuillez entrer une configuration valide', false);
              return;
            }
            
            const config = JSON.parse(configText);
            const result = proxyManager.importConfig(config);
            
            if (result) {
              showMessage('Configurations importées avec succès!');
            } else {
              showMessage('Erreur lors de l\'importation', false);
            }
          } catch (error) {
            console.error('Erreur lors de l\'importation:', error);
            showMessage('Erreur lors de l\'importation: ' + error.message, false);
          }
        });
        
        // Fermer la fenêtre
        closeBtn.addEventListener('click', () => {
          window.close();
        });
      </script>
    </body>
    </html>
    `;
    
    // Charger le contenu HTML directement
    importExportWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    
    return true;
  });

  // Événement pour démarrer une session
  ipcMain.on('start-session', (event, config) => {
    // Créer la fenêtre principale et stocker la référence
    mainViewWindow = createMainViewWindow(config);
    selectionWindow.window.close();
  });
  
  // --- Gestionnaires IPC déplacés depuis MainViewWindow.js ---

  // Gestionnaires pour le défilement
  ipcMain.on('container-scrolled', (event, position) => {
    if (mainViewWindow) {
      mainViewWindow.throttledUpdateViewPositions(position);
    }
  });

  ipcMain.on('wheel-scrolled', (event, delta) => {
    if (mainViewWindow) {
      mainViewWindow.handleWheelScroll(delta);
    }
  });

  ipcMain.on('keyboard-scroll', (event, data) => {
    if (mainViewWindow) {
      mainViewWindow.handleKeyboardScroll(data);
    }
  });

  // Gestionnaire pour l'événement 'execute-macro'
  ipcMain.on('execute-macro', (event, data) => {
    console.log('Demande d\'exécution de la macro:', data);
    if (mainViewWindow) {
      mainViewWindow.macroManager.executeMacro(data.macroId, data.gameMode);
    }
  });

  // Gestionnaire pour l'événement 'open-sync-panel'
  ipcMain.on('open-sync-panel', () => {
    if (mainViewWindow) {
      mainViewWindow.openSyncPanel();
    }
  });

  // Gestionnaire pour l'événement 'open-macro-panel'
  ipcMain.on('open-macro-panel', (event, gameMode) => {
     if (mainViewWindow) {
       // Si le mode de jeu est spécifié, mettre temporairement à jour la configuration
       const savedMode = mainViewWindow.config.mode;
       if (gameMode) {
         mainViewWindow.config.mode = gameMode;
       }
       mainViewWindow.openMacroPanel();
       // Restaurer le mode si temporairement modifié
       if (gameMode) {
         mainViewWindow.config.mode = savedMode;
       }
     }
  });

  // Gestionnaire pour l'événement 'open-settings'
  ipcMain.on('open-settings', () => {
    if (mainViewWindow) {
      mainViewWindow.openSettings();
    }
  });

  // Gestionnaire pour l'événement 'reload-view'
  ipcMain.on('reload-view', (event, viewId) => {
    console.log(`Demande de rechargement de la vue ${viewId}`);
    if (mainViewWindow && mainViewWindow.views && viewId >= 0 && viewId < mainViewWindow.views.length) {
      const view = mainViewWindow.views[viewId];
      if (view && view.webContents && !view.webContents.isDestroyed()) {
        console.log(`Rechargement de la vue ${viewId} (${view.viewType} ${view.viewNumber})`);
        view.webContents.reload();
      }
    }
  });

  // Gestionnaire pour l'événement 'toggle-view-fullscreen'
  ipcMain.on('toggle-view-fullscreen', (event, viewId) => {
    console.log(`Basculement du mode plein écran pour la vue ${viewId}`);
    if (mainViewWindow && mainViewWindow.views && viewId >= 0 && viewId < mainViewWindow.views.length) {
      const view = mainViewWindow.views[viewId];
      if (view && view.webContents && !view.webContents.isDestroyed()) {
        mainViewWindow.toggleViewFullscreen(view);
      }
    }
  });

  // Gestionnaire pour l'événement 'open-view-devtools'
  ipcMain.on('open-view-devtools', (event, viewId) => {
    console.log(`Ouverture des DevTools pour la vue ${viewId}`);
    if (mainViewWindow && mainViewWindow.views && viewId >= 0 && viewId < mainViewWindow.views.length) {
      const view = mainViewWindow.views[viewId];
      if (view && view.webContents && !view.webContents.isDestroyed()) {
        view.webContents.openDevTools({ mode: 'detach' });
      }
    }
  });

  // Gestionnaire pour l'événement 'close-current-window'
  ipcMain.on('close-current-window', () => {
    console.log('Demande de fermeture de fenêtre reçue');
    // Cette logique doit être gérée par la fenêtre elle-même ou un gestionnaire global si plusieurs fenêtres peuvent l'envoyer
    // Pour l'instant, assumons qu'il s'agit de la fenêtre de paramètres ou similaire
    if (mainViewWindow && mainViewWindow.settingsWindow) {
       mainViewWindow.settingsWindow.close();
       mainViewWindow.settingsWindow = null;
       // Recharger les paramètres et mettre à jour les vues existantes
       mainViewWindow.reloadSettingsAndUpdateViews();
    }
  });

   // Gestionnaire pour 'request-views-state' (pour le panneau de synchronisation)
   ipcMain.on('request-views-state', (event) => {
     if (mainViewWindow) {
       mainViewWindow.updateSyncPanel();
     }
   });

   // Gestionnaire pour 'request-macros' (pour le panneau de macros)
   ipcMain.on('request-macros', (event, gameMode) => {
      console.log(`Demande de chargement des macros pour le mode: ${gameMode}`);
      // Dans une version future, on pourrait charger dynamiquement les macros
      // depuis une configuration et les envoyer au renderer.
   });

   // Gestionnaire pour synchroniser les vues
   ipcMain.on('synchronize-views', (event, selectedIndices) => {
     if (mainViewWindow) {
       mainViewWindow.synchronizeViews(selectedIndices);
     }
   });

   // Gestionnaire d'événements clavier (pour la synchronisation des inputs)
   ipcMain.on('keyboard-event', (event, keyEvent) => {
     if (mainViewWindow) {
       mainViewWindow.handleKeyboardEvent(keyEvent);
     }
   });

   // Gestionnaire pour configurer le proxy d'une vue spécifique (via panneau proxy)
   ipcMain.on('configure-proxy-for-view', (event, viewId) => {
      console.log(`Demande de configuration du proxy pour la vue ${viewId} (via panneau proxy)`);
      // Ouvre le panneau de configuration du proxy pour une vue spécifique
      if (mainViewWindow && mainViewWindow.views && viewId >= 0 && viewId < mainViewWindow.views.length) {
        const view = mainViewWindow.views[viewId];
        if (view) {
          // Note: openProxyConfigForView dans MainViewWindow redirige maintenant vers l'ouverture du panneau global.
          // Si vous voulez une fenêtre modale par vue, cette logique devrait être ajustée.
          mainViewWindow.openProxyConfigForView(view);
        }
      }
   });

  // --- Fin des gestionnaires IPC déplacés ---
  
  // Événement pour ouvrir le panneau de gestion des proxies
  ipcMain.on('open-proxy-panel', () => {
    if (mainViewWindow) {
      mainViewWindow.openProxyPanel();
    }
  });
  
  // Événement pour fermer le panneau de gestion des proxies
  ipcMain.on('close-proxy-panel', () => {
    if (mainViewWindow && mainViewWindow.proxyWindow) {
      mainViewWindow.proxyWindow.close();
    }
  });
  
  // Événement pour recharger toutes les vues
  ipcMain.handle('reload-all-views', () => {
    if (mainViewWindow) {
      mainViewWindow.reloadAllViews();
    }
  });
  
  // Gestionnaire pour obtenir la liste des vues disponibles
  ipcMain.handle('get-views-list', async (event) => {
    console.log('Demande de la liste des vues reçue (main.js).');
    if (!mainViewWindow || !mainViewWindow.views) return [];

    // Mapper les vues pour renvoyer les informations nécessaires au renderer
    const viewsData = mainViewWindow.views.map(view => ({
      id: view.viewIndex, // Utiliser l'index comme ID
      type: view.viewType,
      number: view.viewNumber
      // Nous pourrions ajouter ici l'état actuel du proxy si nous le stockions
    }));
    console.log(`Envoi de ${viewsData.length} vues au panneau proxy (main.js).`);
    return viewsData;
  });

  // Gestionnaire pour appliquer un proxy à une vue spécifique
  ipcMain.handle('apply-proxy-to-view', async (event, data) => {
    console.log(`Demande d'appliquer un proxy à la vue ${data.viewId} (main.js)`);
    const { viewId, proxyDetails } = data;

    // Trouver la vue correspondante
    if (!mainViewWindow || !mainViewWindow.views || viewId < 0 || viewId >= mainViewWindow.views.length) {
      console.log(`ID de vue invalide: ${viewId}. Impossible d'appliquer le proxy.`);
      return false;
    }

    const view = mainViewWindow.views[viewId];

    if (!view || !view.webContents || view.webContents.isDestroyed()) {
      console.log(`Vue ${viewId} non valide ou détruite. Impossible d'appliquer le proxy.`);
      return false;
    }

    try {
      const partition = view.webContents.session.partition;
      console.log(`Application du proxy à la session ${partition} (main.js)`);

      let proxyRules = `${proxyDetails.type}://${proxyDetails.host}:${proxyDetails.port}`;

      await view.webContents.session.setProxy({
        proxyRules: proxyRules,
        // Ajoutez bypassRules ici si nécessaire
      });

      console.log(`Proxy configuré avec succès pour la session ${partition} (main.js).`);
      // Recharger la vue pour que le proxy prenne effet
            view.webContents.reload();
      return true;

    } catch (error) {
      console.error(`Erreur lors de l'application du proxy à la session ${viewId} (main.js):`, error);
      return false;
    }
  });
  
  // Gestionnaire pour retirer le proxy d'une vue spécifique
  ipcMain.handle('remove-proxy-for-view', async (event, viewId) => {
    console.log(`Demande de retirer le proxy pour la vue ${viewId} (main.js)`);
    
    // Trouver la vue correspondante
    if (!mainViewWindow || !mainViewWindow.views || viewId < 0 || viewId >= mainViewWindow.views.length) {
      console.log(`ID de vue invalide: ${viewId}. Impossible de retirer le proxy.`);
      return false;
    }

    const view = mainViewWindow.views[viewId];

    if (!view || !view.webContents || view.webContents.isDestroyed()) {
      console.log(`Vue ${viewId} non valide ou détruite. Impossible de retirer le proxy.`);
    return false;
    }

    try {
      const partition = view.webContents.session.partition;
      console.log(`Retrait du proxy pour la session ${partition} (main.js)`);
  
      // Définir une configuration proxy vide pour réinitialiser
      await view.webContents.session.setProxy({});

      console.log(`Proxy retiré avec succès pour la session ${partition} (main.js).`);
      // Recharger la vue pour que le changement prenne effet
      view.webContents.reload();
      return true;

    } catch (error) {
      console.error(`Erreur lors du retrait du proxy pour la session ${viewId} (main.js):`, error);
      return false;
    }
  });
    
  // Écouteur pour l'authentification proxy
  session.defaultSession.on('login', (authInfo, callback) => {
    console.log('Événement login reçu pour le proxy.');
    // TODO: Ici, vous devez fournir le nom d'utilisateur et le mot de passe
    // en fonction de authInfo (par exemple, l'hôte et le port du proxy).
    // Pour l'instant, j'ajoute des identifiants factices. REMPLACEZ CELA.
    const username = 'votre_nom_utilisateur'; // REMPLACEZ CECI
    const password = 'votre_mot_de_passe'; // REMPLACEZ CECI

    // Si le proxy nécessite une authentification de base ou Digest
    if (authInfo.isProxy) {
      console.log(`Authentification requise pour le proxy ${authInfo.host}:${authInfo.port}`);
      // Fournir les identifiants pour l'authentification proxy
      callback(username, password);
    } else {
      // Pour l'authentification du serveur web si nécessaire (moins courant avec les proxies)
      console.log(`Authentification requise pour le serveur ${authInfo.host}:${authInfo.port}`);
      callback(); // Ne pas fournir d'identifiants par défaut pour le serveur
    }
  });
        
  // Lier l'écouteur login à toutes les sessions de partition futures
  app.on('session-created', (sessionInstance) => {
    console.log(`Nouvelle session créée: ${sessionInstance.partition}`);
    sessionInstance.on('login', (authInfo, callback) => {
       console.log(`Événement login reçu pour la session ${sessionInstance.partition}.`);
      // Réutiliser la logique d'authentification principale
       if (authInfo.isProxy) {
          console.log(`Authentification proxy requise pour la session ${sessionInstance.partition} sur ${authInfo.host}:${authInfo.port}`);
           // TODO: Ici, vous pourriez vouloir trouver les identifiants spécifiques à cette session/vue
           // Pour l'instant, j'utilise les mêmes identifiants factices.
          const username = 'votre_nom_utilisateur'; // REMPLACEZ CECI
          const password = 'votre_mot_de_passe'; // REMPLACEZ CECI
          callback(username, password);
       } else {
         callback();
       }
    });
  });
}

// Fonction pour initialiser les proxies Webshare (Ancienne logique - RETIRÉE)
// async function initializeWebshareProxies() {
//   console.log('Chargement des proxies Webshare...');
//   try {
//     // Cette fonction charge les proxies à partir d'un fichier et les stocke globalement
//     await directWebshareProxy.loadProxies();
//     console.log(`${directWebshareProxy.getProxies().length} proxies Webshare chargés avec succès.`);

//     // Cette partie installait l'extension pour toutes les sessions. Remplacé par installation par vue.
//     // await webshareProxyOpener.installForAllSessions();
//     // console.log('Processus d'installation de l'extension pour toutes les sessions terminé.');

//   } catch (error) {
//     console.error('Erreur lors du chargement ou de l\'initialisation des proxies Webshare:', error);
//   }
// }

app.whenReady().then(() => {
    createApplicationMenu();
    createSelectionWindow();
  setupIPCHandlers(); // Appeler ici après que l'application soit prête

  // Appeler l'initialisation des proxies (ancienne logique - RETIRÉE)
  // initializeWebshareProxies();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createSelectionWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
}); 