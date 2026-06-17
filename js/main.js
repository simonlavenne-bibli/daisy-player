// ================================================================
// LUMIÈRE AUDIO v2 — main.js
// Point d'entrée principal : liaison HTML ↔ Player ↔ UI
// ================================================================

import { parseDaisyZip } from './parser.js';
import { DaisyPlayer }   from './player.js';
import * as ui           from './ui.js';

document.addEventListener('DOMContentLoaded', () => {

    // ── Initialisation ──────────────────────────────────────────
    ui.restoreTheme();
    const player = new DaisyPlayer();

    // Raccourci : attacher un listener sur un élément par son ID
    function listen(id, event, callback) {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, callback);
    }

    // ── Références aux éléments de navigation ──────────────────
    const toggleCleanModeBtn = document.getElementById('toggleCleanMode');

    // ── Navigation principale ───────────────────────────────────
    listen('nav-home', 'click', () => {
        ui.showPage(
            document.getElementById('nav-home'),
            document.getElementById('view-home'),
            toggleCleanModeBtn
        );
        loadHistory();
    });

    listen('nav-history', 'click', () => {
        ui.showPage(
            document.getElementById('nav-history'),
            document.getElementById('view-history'),
            toggleCleanModeBtn
        );
        loadHistory();
    });

    listen('nav-player', 'click', () => {
        ui.showPage(
            document.getElementById('nav-player'),
            document.getElementById('view-player'),
            toggleCleanModeBtn
        );
    });

    // ── Changement de thème ─────────────────────────────────────
    listen('btn-theme-toggle', 'click', () => ui.cycleThemes());

    // ── Mode Épuré / Mode Complet ───────────────────────────────
    let isCleanMode = false;
    const cleanModeOverlay = document.getElementById('cleanModeOverlay');

    listen('toggleCleanMode', 'click', () => {
        isCleanMode = !isCleanMode;
        if (!cleanModeOverlay) return;

        if (isCleanMode) {
            // Afficher l'overlay Mode Épuré
            cleanModeOverlay.classList.remove('hidden');
            cleanModeOverlay.classList.add('flex');
            toggleCleanModeBtn.innerHTML =
                '<span class="material-symbols-outlined" aria-hidden="true">dashboard</span>' +
                '<span>Mode complet</span>';
            toggleCleanModeBtn.setAttribute('aria-label', 'Quitter le mode épuré');
        } else {
            // Retour au Mode Complet
            cleanModeOverlay.classList.add('hidden');
            cleanModeOverlay.classList.remove('flex');
            toggleCleanModeBtn.innerHTML =
                '<span class="material-symbols-outlined" aria-hidden="true">auto_awesome</span>' +
                '<span>Mode épuré</span>';
            toggleCleanModeBtn.setAttribute('aria-label', 'Activer le mode épuré');
        }
    });

    listen('exitCleanMode', 'click', () => {
        isCleanMode = false;
        if (cleanModeOverlay) {
            cleanModeOverlay.classList.add('hidden');
            cleanModeOverlay.classList.remove('flex');
        }
        if (toggleCleanModeBtn) {
            toggleCleanModeBtn.innerHTML =
                '<span class="material-symbols-outlined" aria-hidden="true">auto_awesome</span>' +
                '<span>Mode épuré</span>';
            toggleCleanModeBtn.setAttribute('aria-label', 'Activer le mode épuré');
        }
    });

    // ── Drag & Drop et sélection de fichier ────────────────────
    const fileInput = document.getElementById('file-input');
    const dropZone  = document.getElementById('dropZone');

    listen('btn-browse', 'click', (e) => {
        e.stopPropagation();
        if (fileInput) fileInput.click();
    });

    if (dropZone) {
        dropZone.addEventListener('click', () => {
            if (fileInput) fileInput.click();
        });
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drop-zone-active');
        });
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drop-zone-active');
        });
        dropZone.addEventListener('drop', async (e) => {
            e.preventDefault();
            dropZone.classList.remove('drop-zone-active');
            if (e.dataTransfer.files.length > 0) {
                await handleFileSelection(e.dataTransfer.files[0]);
            }
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                await handleFileSelection(e.target.files[0]);
            }
        });
    }

    // ── Chargement d'un fichier DAISY ──────────────────────────
    async function handleFileSelection(file) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.classList.remove('hidden');

        try {
            const bookData = await parseDaisyZip(file);
            player.setBook(bookData.zip, bookData.playlist);

            // ── Mise à jour des métadonnées dans les deux modes ─
            const bookTitleEl      = document.getElementById('book-title');
            const bookAuthorEl     = document.getElementById('book-author');
            const cleanBookTitleEl = document.getElementById('cleanBookTitle');

            if (bookTitleEl)      bookTitleEl.textContent      = bookData.title;
            if (bookAuthorEl)     bookAuthorEl.textContent     = bookData.author;
            if (cleanBookTitleEl) cleanBookTitleEl.textContent = bookData.title;

            // ── Rendu de la liste des chapitres ────────────────
            ui.renderChaptersList(bookData.playlist, async (index) => {
                player.currentIndex = index;
                const track = await player.loadCurrentTrack();
                handleTrackUpdate(track);
                if (!player.isPlaying) {
                    const isNowPlaying = player.toggle();
                    ui.updatePlayPauseUI(isNowPlaying);
                }
            });

            // ── Chargement de la première piste ────────────────
            const firstTrack = await player.loadCurrentTrack();
            handleTrackUpdate(firstTrack);

            // ── Enregistrement dans l'historique ────────────────
            addToHistory(bookData.title, bookData.author);

            // ── Redirection vers la vue lecteur ─────────────────
            ui.showPage(
                document.getElementById('nav-player'),
                document.getElementById('view-player'),
                toggleCleanModeBtn
            );

        } catch (error) {
            alert(error.message || 'Erreur de chargement du fichier DAISY.');
            console.error('[Main] handleFileSelection error:', error);
        } finally {
            if (overlay) overlay.classList.add('hidden');
        }
    }

    // ── Mise à jour de l'interface après changement de piste ───
    function handleTrackUpdate(track) {
        if (track) {
            const cleanChapterTitleEl = document.getElementById('cleanChapterTitle');
            if (cleanChapterTitleEl) cleanChapterTitleEl.textContent = track.title;
            ui.highlightActiveChapter(player.currentIndex);
            ui.updatePlayPauseUI(player.isPlaying);
        } else {
            // Fin du livre ou erreur
            player.isPlaying = false;
            ui.updatePlayPauseUI(false);
        }
    }

    // ── Action Play / Pause (partagée entre les deux modes) ────
    const playPauseAction = () => {
        const isNowPlaying = player.toggle();
        ui.updatePlayPauseUI(isNowPlaying);
    };

    listen('playPause',      'click', playPauseAction);
    listen('cleanPlayPause', 'click', playPauseAction);

    // ── Navigation Chapitre (Mode Complet uniquement) ──────────
    listen('btn-prev', 'click', async () => {
        const track = await player.previousChapter();
        handleTrackUpdate(track);
    });

    listen('btn-next', 'click', async () => {
        const track = await player.nextChapter();
        handleTrackUpdate(track);
    });

    // ── Sauts temporels ±60 s (Mode Complet uniquement) ────────
    listen('btn-backward60', 'click', () => player.skipBackward60());
    listen('btn-forward60',  'click', () => player.skipForward60());

    // ── Vitesse de lecture ─────────────────────────────────────
    const speedContainer = document.getElementById('speed-buttons-container');
    if (speedContainer) {
        speedContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-speed]');
            if (!btn) return;
            const speed = parseFloat(btn.dataset.speed);
            if (!isNaN(speed)) {
                player.setSpeed(speed);
                // Mise à jour visuelle
                speedContainer.querySelectorAll('[data-speed]').forEach(b => {
                    b.classList.remove('speed-btn--active');
                });
                btn.classList.add('speed-btn--active');
            }
        });
    }

    // ── Barre de progression ───────────────────────────────────
    const progressRange = document.getElementById('progress-range');

    player.audio.addEventListener('timeupdate', () => {
        if (!progressRange || isNaN(player.audio.duration)) return;
        const pct = (player.audio.currentTime / player.audio.duration) * 100;
        progressRange.value = pct;

        const timeCurrent = document.getElementById('time-current');
        const timeTotal   = document.getElementById('time-total');
        if (timeCurrent) timeCurrent.textContent = formatTime(player.audio.currentTime);
        if (timeTotal)   timeTotal.textContent   = formatTime(player.audio.duration);
    });

    if (progressRange) {
        progressRange.addEventListener('input', () => {
            if (!isNaN(player.audio.duration)) {
                player.audio.currentTime = (progressRange.value / 100) * player.audio.duration;
            }
        });
    }

    // ── Enchaînement automatique à la fin d'un chapitre ────────
    player.audio.addEventListener('ended', async () => {
        if (player.currentIndex < player.playlist.length - 1) {
            const track = await player.nextChapter();
            handleTrackUpdate(track);
        } else {
            // Fin du livre
            player.isPlaying = false;
            ui.updatePlayPauseUI(false);
        }
    });

    // ── Formatage du temps mm:ss ───────────────────────────────
    function formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) return '00:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    // ── Historique LocalStorage ────────────────────────────────
    function loadHistory() {
        const container = document.getElementById('history-container');
        if (!container) return;
        container.innerHTML = '';

        const history = JSON.parse(localStorage.getItem('daisy_history') || '[]');

        if (history.length === 0) {
            container.innerHTML = `
                <div class="history-empty">
                    <span class="material-symbols-outlined history-empty__icon" aria-hidden="true">history</span>
                    <p>Aucun livre lu récemment</p>
                </div>`;
            return;
        }

        history.forEach(item => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = `
                <div class="history-item__text">
                    <h4 class="history-item__title">${item.title}</h4>
                    <p  class="history-item__author">${item.author}</p>
                    <span class="history-item__date">${item.date}</span>
                </div>
                <span class="material-symbols-outlined history-item__icon" aria-hidden="true">menu_book</span>
            `;
            container.appendChild(div);
        });

        const clearBtn = document.createElement('button');
        clearBtn.className = 'btn-clear-history';
        clearBtn.innerHTML =
            '<span class="material-symbols-outlined" aria-hidden="true">delete</span> Effacer l\'historique';
        clearBtn.addEventListener('click', () => {
            localStorage.removeItem('daisy_history');
            loadHistory();
        });
        container.appendChild(clearBtn);
    }

    function addToHistory(title, author) {
        let history = JSON.parse(localStorage.getItem('daisy_history') || '[]');
        // Éviter les doublons
        history = history.filter(item => item.title !== title);

        const now = new Date();
        const formattedDate = now.toLocaleDateString('fr-FR', {
            day:    '2-digit',
            month:  '2-digit',
            year:   'numeric',
            hour:   '2-digit',
            minute: '2-digit',
        });

        history.unshift({ title, author, date: formattedDate });
        if (history.length > 5) history.pop();

        localStorage.setItem('daisy_history', JSON.stringify(history));
    }

    // ── Chargement initial de l'historique ─────────────────────
    loadHistory();

    // ── Enregistrement du Service Worker (PWA) ─────────────────
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./service-worker.js')
                .then(reg  => console.log('[PWA] Service Worker enregistré :', reg.scope))
                .catch(err => console.warn('[PWA] Échec enregistrement SW :', err));
        });
    }
});
