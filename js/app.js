// =========================================================================
// LUMIÈRE AUDIO — LOGIQUE DE L'INTERFACE (JOUR 2)
// =========================================================================

// Dès que le document HTML est complètement chargé par le navigateur
document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. SÉLECTEURS DES ÉLÉMENTS DU CODE HTML ---
    const bodyElement = document.body;
    
    // Boutons de changement de Thème
    const themeButtons = document.querySelectorAll('.contrast-btn');
    
    // Boutons de navigation d'écrans et modes
    const btnToggleMode = document.getElementById('btn-toggle-mode');
    const btnToHome = document.getElementById('btn-to-home');
    
    // Les deux grands écrans (sections) de notre application
    const viewHome = document.getElementById('view-home');
    const viewPlayer = document.getElementById('view-player');
    const playerGrid = document.querySelector('.player-grid');

    // --- 2. GESTION DES THÈMES ET DU CONTRASTE ---
    
    // Fonction qui applique un thème et met à jour les boutons (accessibilité)
    function applyTheme(themeName) {
        // 1. On retire les anciennes classes de thème du body
        bodyElement.classList.remove('theme-light', 'theme-dark', 'theme-orange');
        // 2. On ajoute la classe du thème sélectionné
        bodyElement.classList.add(`theme-${themeName}`);
        
        // 3. Mise à jour visuelle et accessibilité (ARIA) des boutons
        themeButtons.forEach(button => {
            const isCurrentTheme = button.getAttribute('data-theme') === themeName;
            if (isCurrentTheme) {
                button.classList.add('active');
                button.setAttribute('aria-pressed', 'true');
            } else {
                button.classList.remove('active');
                button.setAttribute('aria-pressed', 'false');
            }
        });

        // 4. On sauvegarde ce choix dans la mémoire du navigateur (LocalStorage)
        localStorage.setItem('lumiere-audio-theme', themeName);
    }

    // Écoute du clic sur chaque bouton de thème
    themeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const selectedTheme = button.getAttribute('data-theme');
            applyTheme(selectedTheme);
        });
    });

    // Chargement du thème sauvegardé au démarrage
    const savedTheme = localStorage.getItem('lumiere-audio-theme') || 'light';
    applyTheme(savedTheme);


    // --- 3. GESTION DES MODES D'AFFICHAGE (COMPLET / SIMPLE) ---
    
    if (btnToggleMode) {
        btnToggleMode.addEventListener('click', () => {
            // On vérifie si le mode simple est actuellement actif
            const isSimpleMode = playerGrid.classList.contains('player-mode-simple');
            
            if (isSimpleMode) {
                // Si oui, on repasse en mode complet
                playerGrid.classList.remove('player-mode-simple');
                btnToggleMode.textContent = "Passer au Mode Simple";
                btnToggleMode.setAttribute('aria-pressed', 'false');
            } else {
                // Si non, on active le mode simple (gros boutons épurés)
                playerGrid.classList.add('player-mode-simple');
                btnToggleMode.textContent = "Passer au Mode Complet";
                btnToggleMode.setAttribute('aria-pressed', 'true');
            }
        });
    }


    // --- 4. NAVIGATION ENTRE LES ÉCRANS ---
    // (Pour l'instant, on configure le bouton retour à l'accueil)
    if (btnToHome) {
        btnToHome.addEventListener('click', () => {
            // On masque le lecteur et on réaffiche l'accueil
            viewPlayer.style.display = 'none';
            viewHome.style.display = 'grid'; // 'grid' correspond au style de landing-grid
            
            // Notification vocale optionnelle pour les lecteurs d'écran
            console.log("Retour à l'écran d'accueil");
        });
    }

    // ASTUCE POUR LE JOUR 2 : 
    // Pour pouvoir tester l'écran du lecteur aujourd'hui sans avoir à charger de livre,
    // vous pouvez décommenter les deux lignes ci-dessous. Elles masqueront l'accueil pour afficher le lecteur.
    // Pour la production finale, nous les supprimerons.
    
    // viewHome.style.display = 'none';
    // viewPlayer.style.display = 'grid';

});
