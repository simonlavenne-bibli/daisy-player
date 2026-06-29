/**
 * js/main.js — Point d'entrée principal de Lumière Audio
 *
 * Modifications de cette version :
 *   - Bouton #toggleCleanMode masqué/affiché selon la vue active (point 6)
 *   - Navigation met à jour aria-current et la classe active des boutons nav
 *   - Synchronisation titre entre mode normal et mode simple
 *   - Historique chargé dans les deux conteneurs (#history-container et #history-container-full)
 *   - Bloc de test IndexedDB conservé (à supprimer après validation Phase 1)
 */

// ─── Imports Phase 1 — TEST UNIQUEMENT, à supprimer après validation ──────────
import { initDB, addBook, getLastOpenedBook, saveProgress, getProgress } from './db.js';
// ─────────────────────────────────────────────────────────────────────────────

import { parseDaisyZip } from './parser.js';
import { DaisyPlayer }   from './player.js';
import * as ui           from './ui.js';

document.addEventListener('DOMContentLoaded', () => {

    // ─── Test Phase 1 — À SUPPRIMER après validation ──────────────────────────
    window.__testDB = async () => {
        await initDB();
        const id = await addBook({
            title: 'Test Guerre et Paix',
            author: 'Tolstoï',
            totalChapters: 5,
        });
        console.log('[TEST] Livre créé, bookId :', id);
        await saveProgress(id, {
            chapterIndex: 2,
            positionSeconds: 127.4,
            percentage: 41,
            playbackRate: 1.25,
        });
        console.log('[TEST] Progression sauvegardée.');
        const last = await getLastOpenedBook();
        console.log('[TEST] Dernier livre :', last?.title);
        const prog = await getProgress(id);
        console.log('[TEST] Progression récupérée :', prog);
    };
    window.__testDB();
    // ─── Fin du bloc de test ──────────────────────────────────────────────────

    const player           = new DaisyPlayer();
    const toggleCleanModeBtn = document.getElementById('toggleCleanMode');

    // ─────────────────────────────────────────────────────────────────────────
    // UTILITAIRE : attacher un listener à un élément par son id
    // ─────────────────────────────────────────────────────────────────────────
    function listen(id, event, callback) {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, callback);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // NAVIGATION : affiche la vue demandée, masque les autres,
    //              gère le bouton Mode Simple (visible seulement sur Lecteur),
    //              met à jour aria-current et la classe active.
    // ─────────────────────────────────────────────────────────────────────────

    const NAV_ITEMS = [
        { navId: 'nav-home',    viewId: 'view-home',    showCleanBtn: false },
        { navId: 'nav-player',  viewId: 'view-player',  showCleanBtn: true  },
        { navId: 'nav-history', viewId: 'view-history', showCleanBtn: false },
    ];

    /**
     * Active une vue et met à jour tous les états visuels associés.
     * @param {string} targetNavId  - id du bouton nav cliqué
     */
    function navigateTo(targetNavId) {
        NAV_ITEMS.forEach(({ navId, viewId, showCleanBtn }) => {
            const navBtn = document.getElementById(navId);
            const view   = document.getElementById(viewId);
            const isActive = (navId === targetNavId);

            // Vue : flex si active, hidden sinon
            if (view) {
                view.classList.toggle('hidden', !isActive);
                view.classList.toggle('flex',   isActive);
            }

            // Bouton nav : classe active + aria-current
            if (navBtn) {
                navBtn.classList.toggle('active', isActive);
                if (isActive) {
                    navBtn.setAttribute('aria-current', 'page');
                } else {
                    navBtn.removeAttribute('aria-current');
                }
            }

            // Bouton Mode Simple : visible uniquement sur Lecteur
            if (isActive && toggleCleanModeBtn) {
                if (showCleanBtn) {
                    toggleCleanModeBtn.classList.remove('hidden');
                    toggleCleanModeBtn.classList.add('flex');
                } else {
                    toggleCleanModeBtn.classList.add('hidden');
                    toggleCleanModeBtn.classList.remove('flex');
                }
            }
        });
    }

    // Listeners de navigation
    listen('nav-home',    'click', () => { navigateTo('nav-home');    loadHistory(); });
    listen('nav-player',  'click', () => { navigateTo('nav-player');  });
    listen('nav-history', 'click', () => { navigateTo('nav-history'); loadHistory(); });

    // État initial : vue Accueil visible
    navigateTo('nav-home');

    // ─────────────────────────────────────────────────────────────────────────
    // THÈME
    // ─────────────────────────────────────────────────────────────────────────
    listen('btn-theme-toggle', 'click', () => ui.cycleThemes());

    // ─────────────────────────────────────────────────────────────────────────
    // MODE SIMPLE / MODE COMPLET
    // ─────────────────────────────────────────────────────────────────────────
    let isCleanMode = false;

    listen('toggleCleanMode', 'click', () => {
        const normalLayout = document.getElementById('player-normal-layout');
        const cleanLayout  = document.getElementById('player-clean-layout');
        isCleanMode = !isCleanMode;

        // Met à jour aria-pressed
        if (toggleCleanModeBtn) {
            toggleCleanModeBtn.setAttribute('aria-pressed', isCleanMode ? 'true' : 'false');
        }

        if (normalLayout && cleanLayout) {
            if (isCleanMode) {
                normalLayout.classList.add('hidden');
                cleanLayout.classList.remove('hidden');
                cleanLayout.classList.add('flex');
                if (toggleCleanModeBtn) {
                    toggleCleanModeBtn.innerHTML =
                        '<span class="material-symbols-outlined text-2xl">view_module</span>' +
                        '<span class="font-black text-sm md:text-base">MODE COMPLET</span>';
                    toggleCleanModeBtn.setAttribute('aria-label', 'Revenir au mode complet');
                }
                // Synchronise le titre dans le mode simple
                const mainTitle  = document.getElementById('book-title');
                const cleanTitle = document.getElementById('clean-book-title');
                if (mainTitle && cleanTitle) cleanTitle.textContent = mainTitle.textContent;
            } else {
                normalLayout.classList.remove('hidden');
                cleanLayout.classList.add('hidden');
                cleanLayout.classList.remove('flex');
                if (toggleCleanModeBtn) {
                    toggleCleanModeBtn.innerHTML =
                        '<span class="material-symbols-outlined text-2xl">check_box_outline_blank</span>' +
                        '<span class="font-black text-sm md:text-base">MODE SIMPLE</span>';
                    toggleCleanModeBtn.setAttribute('aria-label', 'Basculer en mode simple');
                }
            }
        }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // IMPORT DE FICHIER (drag & drop + bouton parcourir)
    // ─────────────────────────────────────────────────────────────────────────
    const fileInput = document.getElementById('file-input');
    const dropZone  = document.getElementById('dropZone');

    listen('btn-browse', 'click', (e) => {
        e.stopPropagation();
        if (fileInput) fileInput.click();
    });

    if (dropZone) {
        dropZone.addEventListener('click',   () => { if (fileInput) fileInput.click(); });
        dropZone.addEventListener('keydown', (e) => { if (e.key === 'Enter') fileInput.click(); });

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.backgroundColor = 'var(--surface-hover)';
        });
        dropZone.addEventListener('dragleave', () => {
            dropZone.style.backgroundColor = '';
        });
        dropZone.addEventListener('drop', async (e) => {
            e.preventDefault();
            dropZone.style.backgroundColor = '';
            if (e.dataTransfer.files.length > 0) await handleFileSelection(e.dataTransfer.files[0]);
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) await handleFileSelection(e.target.files[0]);
        });
    }

    async function handleFileSelection(file) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.classList.remove('hidden');
        try {
            const bookData = await parseDaisyZip(file);
            player.setBook(bookData.zip, bookData.playlist);

            // Met à jour le titre dans les deux modes
            const bTitle      = document.getElementById('book-title');
            const cleanBTitle = document.getElementById('clean-book-title');
            if (bTitle)      bTitle.textContent      = bookData.title;
            if (cleanBTitle) cleanBTitle.textContent  = bookData.title;

            await handleTrackChange(player.loadCurrentTrack());
            addToHistory(bookData.title, bookData.author);

            // Navigue vers le lecteur (affiche aussi le bouton Mode Simple)
            navigateTo('nav-player');

            if (!player.isPlaying) playPauseAction();

        } catch (error) {
            alert(error.message || "Erreur lors de l'ouverture du livre.");
        } finally {
            if (overlay) overlay.classList.add('hidden');
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // COMMANDES AUDIO
    // ─────────────────────────────────────────────────────────────────────────
    const playPauseAction = () => {
        const isPlaying = player.toggle();
        ui.updatePlayPauseUI(isPlaying);
    };

    listen('playPause',      'click', playPauseAction);
    listen('cleanPlayPause', 'click', playPauseAction);

    listen('btn-skip-back', 'click', () => {
        if (player.audio) {
            player.audio.currentTime = Math.max(0, player.audio.currentTime - 60);
        }
    });
    listen('btn-skip-forward', 'click', () => {
        if (player.audio) {
            player.audio.currentTime = Math.min(
                player.audio.duration || Infinity,
                player.audio.currentTime + 60
            );
        }
    });

    async function handleTrackChange(trackPromise) {
        const track = await trackPromise;
        if (track) {
            ui.highlightActiveChapter(track.title);
            // Met à jour le sous-titre (chapitre)
            const chapterEl = document.getElementById('chapter-title');
            if (chapterEl) chapterEl.textContent = track.title;
        } else if (player.currentIndex === player.playlist.length - 1 && !player.isPlaying) {
            ui.updatePlayPauseUI(false);
        }
    }

    listen('btn-next', 'click', () => handleTrackChange(player.next()));
    listen('btn-prev', 'click', () => handleTrackChange(player.prev()));

    // ─────────────────────────────────────────────────────────────────────────
    // BARRE DE PROGRESSION AUDIO
    // ─────────────────────────────────────────────────────────────────────────
    const audioSlider  = document.getElementById('audio-slider');
    const timeCurrent  = document.getElementById('time-current');
    const timeDuration = document.getElementById('time-duration');

    function formatTime(seconds) {
        if (isNaN(seconds) || !isFinite(seconds)) return '00:00';
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    player.audio.addEventListener('loadedmetadata', () => {
        if (audioSlider) {
            audioSlider.max   = Math.floor(player.audio.duration);
            audioSlider.value = 0;
        }
        if (timeDuration) timeDuration.textContent = formatTime(player.audio.duration);
    });

    player.audio.addEventListener('timeupdate', () => {
        if (audioSlider && !audioSlider.seeking) {
            audioSlider.value = Math.floor(player.audio.currentTime);
        }
        if (timeCurrent) timeCurrent.textContent = formatTime(player.audio.currentTime);
    });

    if (audioSlider) {
        audioSlider.addEventListener('input',  () => { audioSlider.seeking = true; });
        audioSlider.addEventListener('change', () => {
            player.audio.currentTime = parseFloat(audioSlider.value);
            audioSlider.seeking = false;
        });
    }

    player.audio.addEventListener('ended', () => {
        if (player.currentIndex < player.playlist.length - 1) {
            handleTrackChange(player.next());
        } else {
            player.isPlaying = false;
            ui.updatePlayPauseUI(false);
        }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // HISTORIQUE (localStorage — remplacé en Phase 2 par IndexedDB)
    // Charge dans les deux conteneurs : accueil (#history-container)
    // et vue historique complète (#history-container-full)
    // ─────────────────────────────────────────────────────────────────────────

    function buildHistoryCard(item) {
        const card = document.createElement('div');
        card.setAttribute('role', 'listitem');
        card.className =
            'p-5 md:p-7 bg-surface rounded-3xl border-2 border-borderCustom ' +
            'flex justify-between items-center gap-4 shadow-sm text-textPrimary';
        card.innerHTML = `
            <div class="overflow-hidden min-w-0">
                <h4 class="font-black text-xl md:text-2xl truncate">${item.title}</h4>
                <p class="text-base md:text-lg font-bold text-textSecondary mt-1 truncate">
                    ${item.author} — Lu le ${item.date}
                </p>
            </div>
            <span class="material-symbols-outlined text-5xl text-accent flex-shrink-0" aria-hidden="true">book</span>
        `;
        return card;
    }

    function loadHistory() {
        const history = JSON.parse(localStorage.getItem('daisy_history') || '[]');

        // Conteneur Accueil (3 entrées max pour ne pas surcharger)
        const containerHome = document.getElementById('history-container');
        if (containerHome) {
            containerHome.innerHTML = '';
            if (history.length === 0) {
                containerHome.innerHTML =
                    '<p class="text-center py-6 text-textSecondary text-lg font-bold">Aucun historique de lecture.</p>';
            } else {
                history.slice(0, 3).forEach(item => {
                    containerHome.appendChild(buildHistoryCard(item));
                });
            }
        }

        // Conteneur vue Historique complète (toutes les entrées)
        const containerFull = document.getElementById('history-container-full');
        if (containerFull) {
            containerFull.innerHTML = '';
            if (history.length === 0) {
                containerFull.innerHTML =
                    '<p class="text-center py-12 text-textSecondary text-xl font-black">Aucun historique de lecture.</p>';
            } else {
                history.forEach(item => {
                    containerFull.appendChild(buildHistoryCard(item));
                });
            }
        }
    }

    function addToHistory(title, author) {
        let history = JSON.parse(localStorage.getItem('daisy_history') || '[]');
        history = history.filter(h => h.title !== title);
        const dateStr = new Date().toLocaleDateString('fr-FR');
        history.unshift({ title, author, date: dateStr });
        if (history.length > 10) history.pop();
        localStorage.setItem('daisy_history', JSON.stringify(history));
    }

    // Chargement initial
    loadHistory();
});
