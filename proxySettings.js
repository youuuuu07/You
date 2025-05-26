const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
    const saveButton = document.getElementById('saveProxy');
    const proxyList = document.getElementById('proxyList');

    // Charger les proxies existants
    loadProxies();

    saveButton.addEventListener('click', () => {
        const url = document.getElementById('url').value;
        const host = document.getElementById('host').value;
        const port = document.getElementById('port').value;
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        if (!url || !host || !port) {
            alert('Veuillez remplir tous les champs obligatoires');
            return;
        }

        const proxyConfig = {
            host,
            port: parseInt(port),
            username: username || undefined,
            password: password || undefined
        };

        ipcRenderer.send('set-proxy', { url, proxyConfig });
    });

    function loadProxies() {
        ipcRenderer.send('get-proxies');
    }

    ipcRenderer.on('proxies-list', (event, proxies) => {
        proxyList.innerHTML = '';
        
        for (const [url, config] of Object.entries(proxies)) {
            const proxyItem = document.createElement('div');
            proxyItem.className = 'proxy-item';
            
            proxyItem.innerHTML = `
                <div class="proxy-info">
                    <strong>URL:</strong> ${url}<br>
                    <strong>Proxy:</strong> ${config.host}:${config.port}
                    ${config.username ? `<br><strong>Utilisateur:</strong> ${config.username}` : ''}
                </div>
                <div class="proxy-actions">
                    <button class="remove-btn" data-url="${url}">Supprimer</button>
                </div>
            `;
            
            proxyList.appendChild(proxyItem);
        }

        // Ajouter les écouteurs d'événements pour les boutons de suppression
        document.querySelectorAll('.remove-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const url = e.target.dataset.url;
                ipcRenderer.send('remove-proxy', url);
            });
        });
    });

    // Réinitialiser le formulaire après l'enregistrement
    ipcRenderer.on('proxy-saved', () => {
        document.getElementById('url').value = '';
        document.getElementById('host').value = '';
        document.getElementById('port').value = '';
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        loadProxies();
    });
}); 