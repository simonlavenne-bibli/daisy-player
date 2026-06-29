// ─── Imports Phase 1 — TEST UNIQUEMENT, à supprimer après validation ──────────
import { initDB, addBook, getLastOpenedBook, saveProgress, getProgress } from './db.js';
// ─────────────────────────────────────────────────────────────────────────────

import { parseDaisyZip } from './parser.js';
import { DaisyPlayer } from './player.js';
import * as ui from './ui.js';

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

    const player = new DaisyPlayer();
    const toggleCleanModeBtn = document.getElementById('toggleCleanMode');

    function listen(id, event, callback) {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, callback);
    }

    // Gestion de la navigation
    listen('nav-home', 'click', () => {
        ui.showPage(document.getElementById('nav-home'), document.getElementById('view-home'));
        loadHistory();
    });
    listen('nav-history', 'click', () => {
        ui.showPage(document.getElementById('nav-history'), document.getElementById('view-history'));
        loadHistory();
    });
    listen('nav-player', 'click', () => {
        ui.showPage(document.getElementById('nav-player'), document.getElementById('view-player'));
        if (toggleCleanModeBtn) toggleCleanModeBtn.classList.remove('hidden');
    });

    listen('btn-theme-toggle', 'click', () => ui.cycleThemes());

    // Basculement Mode Complet <-> Mode Simple
    let isCleanMode = false;
    listen('toggleCleanMode', 'click', () => {
        const normalLayout = document.getElementById('player-normal-layout');
        const cleanLayout = document.getElementById('player-clean-layout');
        isCleanMode = !isCleanMode;

        if (normalLayout && cleanLayout) {
            if (isCleanMode) {
                normalLayout.classList.add('hidden');
                cleanLayout.classList.remove('hidden');
                toggleCleanModeBtn.innerHTML = '<span class="material-symbols-outlined text-3xl">view_module</span><span class="text-lg md:text-xl font-black">MODE COMPLET</span>';
            } else {
                normalLayout.classList.remove('hidden');
                cleanLayout.classList.add('hidden');
                toggleCleanModeBtn.innerHTML = '<span class="material-symbols-outlined text-3xl">check_box_outline_blank</span><span class="text-lg md:text-xl font-black">MODE SIMPLE</span>';
            }
        }
    });

    // Explorateur de fichiers & Drag & Drop
    const fileInput = document.getElementById('file-input');
    const dropZone  = document.getElementById('dropZone');

    listen('btn-browse', 'click', (e) => { e.stopPropagation(); if (fileInput) fileInput.click(); });

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

            const bTitle = document.getElementById('book-title');
            if (bTitle) bTitle.textContent = bookData.title;

            await handleTrackChange(player.loadCurrentTrack());
            addToHistory(bookData.title, bookData.author);

            ui.showPage(document.getElementById('nav-player'), document.getElementById('view-player'));
            if (toggleCleanModeBtn) toggleCleanModeBtn.classList.remove('hidden');

            if (!player.isPlaying) playPauseAction();

        } catch (error) {
            alert(error.message || "Erreur lors de l'ouverture du livre.");
        } finally {
            if (overlay) overlay.classList.add('hidden');
        }
    }

    // Commandes Audio (Mappées sur les 2 modes)
    const playPauseAction = () => {
        const isPlaying = player.toggle();
        ui.updatePlayPauseUI(isPlaying);
    };
    listen('playPause',      'click', playPauseAction);
    listen('cleanPlayPause', 'click', playPauseAction);

    listen('btn-skip-back', 'click', () => {
        if (player.audio) player.audio.currentTime = Math.max(0, player.audio.currentTime - 60);
    });
    listen('btn-skip-forward', 'click', () => {
        if (player.audio) player.audio.currentTime = Math.min(
            player.audio.duration || Infinity,
            player.audio.currentTime + 60
        );
    });

    async function handleTrackChange(trackPromise) {
        const track = await trackPromise;
        if (track) {
            ui.highlightActiveChapter(track.title);
        } else if (player.currentIndex === player.playlist.length - 1 && !player.isPlaying) {
            ui.updatePlayPauseUI(false);
        }
    }

    listen('btn-next', 'click', () => handleTrackChange(player.next()));
    listen('btn-prev', 'click', () => handleTrackChange(player.prev()));

    // Synchronisation de la barre temporelle
    const audioSlider  = document.getElementById('audio-slider');
    const timeCurrent  = document.getElementById('time-current');
    const timeDuration = document.getElementById('time-duration');

    function formatTime(seconds) {
        if (isNaN(seconds) || !isFinite(seconds)) return "00:00";
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
        if (audioSlider && !audioSlider.seeking) audioSlider.value = Math.floor(player.audio.currentTime);
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

    // Sauvegarde et Historique (ancien système localStorage — remplacé en Phase 2)
    function loadHistory() {
        const container = document.getElementById('history-container');
        if (!container) return;
        container.innerHTML = '';
        const history = JSON.parse(localStorage.getItem('daisy_history') || '[]');

        if (history.length === 0) {
            container.innerHTML = `<p class="text-center py-12 text-textSecondary text-2xl font-black">Aucun historique de lecture.</p>`;
            return;
        }

        history.forEach(item => {
            const card = document.createElement('div');
            card.className = "p-6 md:p-8 bg-surface rounded-3xl border-4 border-borderCustom flex justify-between items-center gap-6 shadow-md text-textPrimary";
            card.innerHTML = `
                <div class="overflow-hidden">
                    <h4 class="font-black text-2xl md:text-3xl truncate">${item.title}</h4>
                    <p class="text-xl md:text-2xl font-bold text-textSecondary mt-2 truncate">${item.author} — Lu le ${item.date}</p>
                </div>
                <span class="material-symbols-outlined text-[50px] text-accent flex-shrink-0">book</span>
            `;
            container.appendChild(card);
        });
    }

    function addToHistory(title, author) {
        let history = JSON.parse(localStorage.getItem('daisy_history') || '[]');
        history = history.filter(h => h.title !== title);
        const dateStr = new Date().toLocaleDateString('fr-FR');
        history.unshift({ title, author, date: dateStr });
        if (history.length > 5) history.pop();
        localStorage.setItem('daisy_history', JSON.stringify(history));
    }

    loadHistory();
});
