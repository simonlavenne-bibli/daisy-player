// =========================================================================
// LUMIÈRE AUDIO — LOGIQUE DES PAGES ET DE L'INTERFACE
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. SÉLECTEURS ÉLÉMENTS DE THÈME & AFFICHAGE ---
    const bodyElement = document.body;
    const themeButtons = document.querySelectorAll('.contrast-btn');
    
    // Boutons du Menu Principal
    const menuBtnHelp = document.getElementById('menu-btn-help');
    const menuBtnHistory = document.getElementById('menu-btn-history');
    const menuBtnPlayer = document.getElementById('menu-btn-player');
    
    // Les 3 blocs de pages (sections)
    const viewHelp = document.getElementById('view-help');
    const viewHistory = document.getElementById('view-history');
    const viewDaisyRoot = document.getElementById('view-daisy-root');
    
    // Boutons de retour collectifs "← Retour au menu principal"
    const backToMenuButtons = document.querySelectorAll('.go-to-menu');
    
    // Éléments internes du lecteur DAISY (Bascule mode simple/complet)
    const btnToggleMode = document.getElementById('btn-toggle-mode');
    const playerGrid = document.querySelector('.player-grid');


    // --- 2. FONCTION DE NAVIGATION (AIGUILLAGE DES PAGES) ---
    // Cette fonction cache tout le monde et affiche uniquement la page demandée
    function switchPage(targetPage) {
        // On masque toutes les sections
        viewHelp.style.display = 'none';
        viewHistory.style.display = 'none';
        viewDaisyRoot.style.display = 'none';
        
        // Si la cible est 'menu', on laisse tout masqué (seul le menu reste visible)
        if (targetPage === 'help') {
            viewHelp.style.display = 'block';
        } else if (targetPage === 'history') {
            viewHistory.style.display = 'block';
        } else if (targetPage === 'daisy') {
            viewDaisyRoot.style.display = 'block';
        }
    }

    // Assignation des clics sur les boutons du menu principal
    if(menuBtnHelp) menuBtnHelp.addEventListener('click', () => switchPage('help'));
    if(menuBtnHistory) menuBtnHistory.addEventListener('click', () => switchPage('history'));
    if(menuBtnPlayer) menuBtnPlayer.addEventListener('click', () => switchPage('daisy'));

    // Configurer tous les boutons "← Retour au menu principal" d'un coup
    backToMenuButtons.forEach(button => {
        button.addEventListener('click', () => switchPage('menu'));
    });


    // --- 3. GESTION DES THÈMES (CONSERVÉE DU JOUR 2) ---
    function applyTheme(themeName) {
        bodyElement.classList.remove('theme-light', 'theme-dark', 'theme-orange');
        bodyElement.classList.add(`theme-${themeName}`);
        
        themeButtons.forEach(button => {
            const isCurrentTheme = button.getAttribute('data-theme') === themeName;
            button.classList.toggle('active', isCurrentTheme);
            button.setAttribute('aria-pressed', isCurrentTheme ? 'true' : 'false');
        });
        localStorage.setItem('lumiere-audio-theme', themeName);
    }

    themeButtons.forEach(button => {
        button.addEventListener('click', () => {
            applyTheme(button.getAttribute('data-theme'));
        });
    });
    applyTheme(localStorage.getItem('lumiere-audio-theme') || 'light');


    // --- 4. GESTION DU MODE COMPACT / SIMPLE DU LECTEUR ---
    if (btnToggleMode) {
        btnToggleMode.addEventListener('click', () => {
            const isSimpleMode = playerGrid.classList.contains('player-mode-simple');
            if (isSimpleMode) {
                playerGrid.classList.remove('player-mode-simple');
                btnToggleMode.textContent = "Passer au Mode Simple";
                btnToggleMode.setAttribute('aria-pressed', 'false');
            } else {
                playerGrid.classList.add('player-mode-simple');
                btnToggleMode.textContent = "Passer au Mode Complet";
                btnToggleMode.setAttribute('aria-pressed', 'true');
            }
        });
    }
});
