// =========================================================================
// LUMIÈRE AUDIO — NAVIGATION INTERNE, THÈMES ET CONTRÔLES COMPLETS/ÉPURÉS
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. ROUTAGE & GESTION DES ONGLETS DE LA BARRE DU BAS ---
    const navHome = document.getElementById('nav-home');
    const navHistory = document.getElementById('nav-history');
    const navPlayer = document.getElementById('nav-player');
    const toggleCleanModeBtn = document.getElementById('toggleCleanMode');

    const viewHome = document.getElementById('view-home');
    const viewHistory = document.getElementById('view-history');
    const viewPlayer = document.getElementById('view-player');

    const sections = [viewHome, viewHistory, viewPlayer];
    const navButtons = [navHome, navHistory, navPlayer];

    function showPage(activeButton, activeSection, pageKey) {
        // Cacher toutes les pages
        sections.forEach(sec => sec.classList.add('hidden'));
        // Afficher la page ciblée
        activeSection.classList.remove('hidden');

        // Nettoyer le design de tous les boutons de navigation du bas
        navButtons.forEach(btn => {
            btn.className = "flex flex-col items-center justify-center text-on-surface-variant dark:text-slate-400 p-2 hover:bg-surface-container dark:hover:bg-slate-800 transition-all touch-active rounded-xl";
            const icon = btn.querySelector('.material-symbols-outlined');
            if(icon) icon.style.fontVariationSettings = "'FILL' 0";
        });

        // Appliquer le style "Bouton Actif" coloré
        activeButton.className = "flex flex-col items-center justify-center bg-primary-container text-on-primary-container rounded-xl px-5 py-1.5 transition-all touch-active shadow-sm";
        const activeIcon = activeButton.querySelector('.material-symbols-outlined');
        if(activeIcon) activeIcon.style.fontVariationSettings = "'FILL' 1";

        // Gérer la visibilité du bouton "Mode Épuré" en haut à droite
        if (pageKey === 'player') {
            toggleCleanModeBtn.classList.remove('hidden');
        } else {
            toggleCleanModeBtn.classList.add('hidden');
        }
    }

    // Assignation des écouteurs de la barre basse
    navHome.addEventListener('click', () => showPage(navHome, viewHome, 'home'));
    navHistory.addEventListener('click', () => showPage(navHistory, viewHistory, 'history'));
    navPlayer.addEventListener('click', () => showPage(navPlayer, viewPlayer, 'player'));


    // --- 2. LE MODE ÉPURÉ / ACCESSIBILITÉ PLEIN ÉCRAN ---
    const cleanModeOverlay = document.getElementById('cleanModeOverlay');
    const exitCleanMode = document.getElementById('exitCleanMode');

    toggleCleanModeBtn.addEventListener('click', () => {
        cleanModeOverlay.classList.remove('hidden');
        cleanModeOverlay.classList.add('flex');
        document.body.style.overflow = 'hidden'; // Bloquer le défilement de fond
    });

    exitCleanMode.addEventListener('click', () => {
        cleanModeOverlay.classList.remove('flex');
        cleanModeOverlay.classList.add('hidden');
        document.body.style.overflow = 'auto';
    });


    // --- 3. DÉPLIANT DE L'INDEX DES CHAPITRES ---
    const toggleChapters = document.getElementById('toggleChapters');
    const chapterList = document.getElementById('chapterList');
    const chevron = document.getElementById('chevron');

    toggleChapters.addEventListener('click', () => {
        const isClosed = chapterList.style.maxHeight === '0px' || chapterList.style.maxHeight === '';
        if (isClosed) {
            chapterList.style.maxHeight = '500px';
            chevron.style.transform = 'rotate(180deg)';
        } else {
            chapterList.style.maxHeight = '0px';
            chevron.style.transform = 'rotate(0deg)';
        }
    });


    // --- 4. COMMUTATEUR AUDIO PLAY/PAUSE AVEC SYNCHRONISATION ÉPURÉE ---
    const playPauseBtn = document.getElementById('playPause');
    const playPauseIcon = document.getElementById('playPauseIcon');
    const cleanPlayPause = document.getElementById('cleanPlayPause');
    const cleanPlayIcon = document.getElementById('cleanPlayIcon');
    const cleanPlayLabel = document.getElementById('cleanPlayLabel');

    let audioIsPlaying = false;

    function handlePlaybackToggle() {
        audioIsPlaying = !audioIsPlaying;
        if (audioIsPlaying) {
            playPauseIcon.textContent = 'pause';
            cleanPlayIcon.textContent = 'pause';
            cleanPlayLabel.textContent = 'PAUSE';
        } else {
            playPauseIcon.textContent = 'play_arrow';
            cleanPlayIcon.textContent = 'play_arrow';
            cleanPlayLabel.textContent = 'LECTURE';
        }
        // La gestion effective de l'objet audio html5 viendra se brancher ici
    }

    playPauseBtn.addEventListener('click', handlePlaybackToggle);
    cleanPlayPause.addEventListener('click', handlePlaybackToggle);


    // --- 5. GESTION DU BOUTON DE SÉLECTION DE LA VITESSE ---
    const speedButtons = document.querySelectorAll('#speed-buttons-container button');
    speedButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            // Désactiver l'ancien bouton sélectionné
            speedButtons.forEach(btn => {
                btn.className = "py-2.5 rounded-xl bg-surface-container-lowest dark:bg-slate-800 border border-outline-variant dark:border-slate-700 font-bold text-sm touch-active dark:text-white";
            });
            // Activer le bouton cliqué
            e.target.className = "py-2.5 rounded-xl bg-primary-container text-on-primary-container font-bold text-sm touch-active border border-primary-container";
            const targetSpeed = e.target.getAttribute('data-speed');
            console.log("Vitesse définie à :", targetSpeed);
        });
    });


    // --- 6. DRAG & DROP (GLISSER-DÉPOSER) LOGIQUE VISUELLE ---
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('file-input');
    const btnBrowse = document.getElementById('btn-browse');

    if (dropZone && fileInput) {
        btnBrowse.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.click();
        });
        dropZone.addEventListener('click', () => {
            fileInput.click();
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                dropZone.classList.add('drop-zone-active', 'shadow-md');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                dropZone.classList.remove('drop-zone-active', 'shadow-md');
            }, false);
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                console.log("Fichier DAISY capturé :", file.name);
                // Étape suivante du Jour 3 : décompression JSZip
            }
        });
    }


    // --- 7. BASOULE DE THÈME CLAIR / SOMBRE COMPLET ---
    const themeBtn = document.getElementById('btn-theme-toggle');
    const htmlElement = document.documentElement;

    themeBtn.addEventListener('click', () => {
        if (htmlElement.classList.contains('dark')) {
            htmlElement.classList.remove('dark');
            htmlElement.classList.add('light');
            localStorage.setItem('lumiere-audio-theme', 'light');
        } else {
            htmlElement.classList.add('dark');
            htmlElement.classList.remove('light');
            localStorage.setItem('lumiere-audio-theme', 'dark');
        }
    });

    // Restaurer le thème précédent au chargement
    if (localStorage.getItem('lumiere-audio-theme') === 'dark') {
        htmlElement.classList.add('dark');
        htmlElement.classList.remove('light');
    }

    // DEBUG FACILITÉ : Ligne à supprimer plus tard. Force l'affichage immédiat du lecteur pour test.
    // showPage(navPlayer, viewPlayer, 'player');
});
