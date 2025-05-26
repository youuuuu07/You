// Script pour le panneau de gestion des proxies (Renderer Process)

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Panneau de proxies chargé.');

  // Récupérer la liste des vues disponibles depuis le processus principal
  const viewsList = await window.proxyAPI.getViewsList();
  console.log('Liste des vues reçue:', viewsList);

  const viewsContainer = document.getElementById('views-list-container');
  if (!viewsContainer) {
    console.error('Conteneur des vues introuvable dans le HTML.');
    return;
  }

  // Afficher la liste des vues et les contrôles proxy
  viewsList.forEach(view => {
    const viewElement = document.createElement('div');
    viewElement.classList.add('view-item');
    viewElement.dataset.viewId = view.id; // Assurez-vous que l'objet vue de main process a un ID

    viewElement.innerHTML = `
      <h3>Vue ${view.number} (${view.type}) - ID: ${view.id}</h3>
      <div class="proxy-controls">
        <div class="form-group">
          <label for="proxy-type-${view.id}">Type de Proxy:</label>
          <select id="proxy-type-${view.id}">
            <option value="http">HTTP</option>
            <option value="socks4">SOCKS4</option>
            <option value="socks5">SOCKS5</option>
          </select>
        </div>
        <div class="form-group">
          <label for="proxy-host-${view.id}">Hôte:</label>
          <input type="text" id="proxy-host-${view.id}" placeholder="ex: 192.168.1.1 ou proxy.example.com">
        </div>
        <div class="form-group">
          <label for="proxy-port-${view.id}">Port:</label>
          <input type="number" id="proxy-port-${view.id}" placeholder="ex: 8080">
        </div>
        <div class="button-group">
          <button class="btn-primary apply-proxy-btn" data-view-id="${view.id}">Appliquer Proxy</button>
          <button class="btn-secondary remove-proxy-btn" data-view-id="${view.id}">Retirer Proxy</button>
        </div>
      </div>
    `;

    viewsContainer.appendChild(viewElement);
  });

  // Ajouter les écouteurs d'événements aux boutons
  viewsContainer.addEventListener('click', async (event) => {
    const target = event.target;
    const viewId = target.dataset.viewId;

    if (!viewId) return;

    if (target.classList.contains('apply-proxy-btn')) {
      const proxyType = document.getElementById(`proxy-type-${viewId}`).value;
      const proxyHost = document.getElementById(`proxy-host-${viewId}`).value;
      const proxyPort = parseInt(document.getElementById(`proxy-port-${viewId}`).value, 10);

      if (!proxyHost || !proxyPort) {
        alert('Veuillez entrer l\'hôte et le port du proxy.');
        return;
      }

      const proxyDetails = {
        type: proxyType,
        host: proxyHost,
        port: proxyPort
        // L'authentification devra être gérée séparément via l'événement 'login' du processus principal
      };

      console.log(`Application du proxy ${proxyHost}:${proxyPort} (${proxyType}) pour la vue ${viewId}`);
      await window.proxyAPI.applyProxyToView(parseInt(viewId, 10), proxyDetails);
      alert(`Proxy appliqué à la vue ${viewId}. La vue va se recharger.`);

    } else if (target.classList.contains('remove-proxy-btn')) {
      console.log(`Retrait du proxy pour la vue ${viewId}`);
      await window.proxyAPI.removeProxyForView(parseInt(viewId, 10));
      alert(`Proxy retiré de la vue ${viewId}. La vue va se recharger.`);
    }
  });
}); 