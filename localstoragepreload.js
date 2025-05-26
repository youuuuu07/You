const { contextBridge, ipcRenderer } = require('electron');

// Variable pour suivre si le script a déjà été injecté
let scriptInjected = false;

// Fichier de préchargement pour la gestion du localStorage
// Ce fichier a été nettoyé de toutes les références à BetterXcloud

console.log("localstoragepreload.js est chargé");

// Fonction pour initialiser le localStorage avec des paramètres par défaut si nécessaire
function initializeLocalStorage() {
  try {
    // Vous pouvez ajouter ici des paramètres par défaut si nécessaire
    console.log("LocalStorage initialisé avec succès");
  } catch (error) {
    console.error("Erreur lors de l'initialisation du localStorage:", error);
  }
}

// Initialiser le localStorage au chargement de la page
document.addEventListener('DOMContentLoaded', function() {
  console.log("DOMContentLoaded déclenché");
  initializeLocalStorage();
});