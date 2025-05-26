const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const proxyManager = require('./proxyManager');

let mainWindow;
let proxyWindow = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // Créer le menu
    const template = [
        {
            label: 'Fichier',
            submenu: [
                {
                    label: 'Paramètres Proxy',
                    click: () => {
                        openProxySettings();
                    }
                },
                { type: 'separator' },
                { role: 'quit' }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    mainWindow.loadURL('https://www.xbox.com/fr-FR/');
}

function openProxySettings() {
    if (proxyWindow) {
        proxyWindow.focus();
        return;
    }

    proxyWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    const proxySettingsPath = path.join(__dirname, '../renderer/proxySettings.html');
    console.log('Chargement du fichier proxy settings:', proxySettingsPath);
    proxyWindow.loadFile(proxySettingsPath);

    proxyWindow.on('closed', () => {
        proxyWindow = null;
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// Gestion des événements IPC pour les proxies
ipcMain.on('set-proxy', (event, { url, proxyConfig }) => {
    proxyManager.setProxy(url, proxyConfig);
    event.reply('proxy-saved');
});

ipcMain.on('get-proxies', (event) => {
    const proxies = proxyManager.getAllProxies();
    event.reply('proxies-list', proxies);
});

ipcMain.on('remove-proxy', (event, url) => {
    proxyManager.removeProxy(url);
    event.reply('proxy-saved');
});

// Gestionnaire pour ouvrir les paramètres de proxy
ipcMain.on('open-proxy-settings', () => {
    console.log('Demande d\'ouverture des paramètres proxy reçue');
    try {
        openProxySettings();
        console.log('Fenêtre des paramètres proxy ouverte avec succès');
    } catch (error) {
        console.error('Erreur lors de l\'ouverture des paramètres proxy:', error);
    }
}); 