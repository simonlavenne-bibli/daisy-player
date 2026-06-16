// =========================================================================
// LUMIÈRE AUDIO — LOGIQUE DES PAGES, THÈMES ET DRAG-AND-DROP
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. CONFIGURATION DES PAGES ET DE LA BARRE BASSE ---
    const navBtnHelp = document.getElementById('nav-btn-help');
    const navBtnHistory = document.getElementById('nav-btn-history');
    const navBtnPlayer = document.getElementById('nav-btn-player');
    const helpCtaBtn = document.getElementById('help-cta-btn'); // Gros bouton au centre de l'aide
    
    const viewHelp = document.getElementById('view-help');
    const viewHistory = document.getElementById('view-history');
    const viewDaisyRoot = document.getElementById('view-daisy-root');
    
    const navButtons = [navBtnHelp, navBtnHistory, navBtnPlayer];

    function switchPage(targetPage) {
        // Masquage complet de toutes les sections
        viewHelp.classList.add('hidden');
        viewHistory.classList.add('hidden');
        viewDaisyRoot.classList.add('hidden');
        
        // Rétablir le style neutre sur tous les boutons de navigation
        navButtons.forEach(btn => {
            if(btn) {
                btn.classList.remove('text-primary-container');
                btn.classList.add('text-on-surface-variant', 'dark:text-slate-400');
            }
        });

        // Activation de la page et du bouton correspondant
        if (targetPage === 'help') {
            viewHelp.classList.remove('hidden');
            navBtnHelp.classList.add('text-primary-container');
            navBtnHelp.classList.remove('text-on-surface-variant');
        } else if (targetPage === 'history') {
            viewHistory.classList.remove('hidden');
            navBtnHistory.classList.add('text-primary-container');
            navBtnHistory.classList.remove('text-on-surface-variant');
        } else if (targetPage === 'daisy') {
            viewDaisyRoot.classList.remove('hidden');
            navBtnPlayer.classList.add('text-primary-container');
            navBtnPlayer.classList.remove('text-on-surface-variant');
        }
    }

    // Association des clics sur la barre du bas
    if(navBtnHelp) navBtnHelp.addEventListener('click', () => switchPage('help'));
    if(navBtnHistory) navBtnHistory.addEventListener('click', () => switchPage('history'));
    if(navBtnPlayer) navBtnPlayer.addEventListener('click', () => switchPage('daisy'));
    if(helpCtaBtn) helpCtaBtn.addEventListener('click', () => switchPage('daisy'));


    // --- 2. GESTION DU THÈME SOMBRE (MODERNE ET COMPACT) ---
    const btnThemeToggle = document.getElementById('btn-theme-toggle');
    const htmlElement = document.documentElement;

    function applySavedTheme() {
        const savedTheme = localStorage.getItem('lumiere-audio-modern-theme') || 'light';
        if (savedTheme === 'dark') {
            htmlElement.classList.add('dark');
            htmlElement.classList.remove('light');
        } else {
            htmlElement.classList.remove('dark');
            htmlElement.classList.add('light');
        }
    }

    if (btnThemeToggle) {
        btnThemeToggle.addEventListener('click', () => {
            if (htmlElement.classList.contains('dark')) {
                htmlElement.classList.remove('dark');
                htmlElement.classList.add('light');
                localStorage.setItem('lumiere-audio-modern-theme', 'light');
            } else {
                htmlElement.classList.add('dark');
                htmlElement.classList.remove('light');
                localStorage.setItem('lumiere-audio-modern-theme', 'dark');
            }
        });
    }
    applySavedTheme();


    // --- 3. RETOUR DU MODE SIMPLE / COMPLET (LECTEUR) ---
    const btnToggleMode = document.getElementById('btn-toggle-mode');
    const viewPlayerLayout = document.getElementById('view-player');

    if (btnToggleMode && viewPlayerLayout) {
        btnToggleMode.addEventListener('click', () => {
            const asideMenu = viewPlayerLayout.querySelector('aside');
            if (asideMenu.classList.contains('hidden')) {
                asideMenu.classList.remove('hidden');
                btnToggleMode.textContent = "Mode Simple";
            } else {
                asideMenu.classList.add('hidden');
                btnToggleMode.textContent = "Mode Complet";
            }
        });
    }


    // --- 4. LOGIQUE VISUELLE DU DRAG AND DROP (GLISSER-DÉPOSER) ---
    const dropZone = document.getElementById('view-home');
    const fileInput = document.getElementById('file-input');
    const btnBrowse = document.getElementById('btn-browse');

    if (dropZone && fileInput) {
        // Ouvrir la fenêtre de fichier au clic sur le bouton parcourir
        if (btnBrowse) {
            btnBrowse.addEventListener('click', (e) => {
                e.stopPropagation(); // Évite le double déclenchement
                fileInput.click();
            });
        }
        
        // Ouvrir aussi en cliquant n'importe où sur la boîte
        dropZone.addEventListener('click', () => {
            fileInput.click();
        });

        // Effets visuels de survol du fichier sur la zone
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                dropZone.classList.add('drop-zone-active', 'shadow-xl');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                dropZone.classList.remove('drop-zone-active', 'shadow-xl');
            }, false);
        });
        
        // Écoute de l'ajout réel du fichier
        fileInput.addEventListener('change', (e) => {
            if(e.target.files.length > 0) {
                console.log("Fichier prêt à être analysé :", e.target.files[0].name);
                // La logique de traitement JSZip interviendra ici au Jour 3
            }
        });
    }

    // Ligne temporaire de test (À supprimer en production) :
    // Enlevez les deux barres devant la ligne suivante pour forcer l'affichage direct du lecteur audio
    // document.getElementById('view-home').classList.add('hidden'); document.getElementById('view-player').classList.remove('hidden'); switchPage('daisy');

});
