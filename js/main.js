import { parseDaisyZip } from './parser.js';
import { DaisyPlayer } from './player.js';
import * as ui from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
    const player = new DaisyPlayer();
    const toggleCleanModeBtn = document.getElementById('toggleCleanMode');
    
    function listen(id, event, callback) {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, callback);
    }

    // Gestion du routage et des vues
    listen('nav-home', 'click', () => {
        ui.showPage(document.getElementById('nav-home'), document.getElementById('view-home'), toggleCleanModeBtn);
        loadHistory();
    });
    listen('nav-history', 'click', () => {
        ui.showPage(document.getElementById('nav-history'), document.getElementById('view-history'), toggleCleanModeBtn);
        loadHistory();
    });
    listen('nav-player', 'click', () => {
        ui.showPage(document.getElementById('nav-player'), document.getElementById('view-player'), toggleCleanModeBtn);
    });

    listen('btn-theme-toggle', 'click', () => ui.cycleThemes());

    // Interconnexion et Synchronisation Mode Normal / Mode Épuré
    let isCleanMode = false;
    listen('toggleCleanMode', 'click', () => {
        const normalLayout = document.getElementById('player-normal-layout');
        const cleanLayout = document.getElementById('player-clean-layout');
        isCleanMode = !isCleanMode;
        
        if (normalLayout && cleanLayout) {
            if (isCleanMode) {
                normalLayout.classList.add('hidden');
                cleanLayout.classList.remove('hidden');
                toggleCleanModeBtn.innerHTML = '<span class="material-symbols-outlined text-2xl">workspace_premium</span><span class="text-base font-black">MODE NORMAL</span>';
            } else {
                normalLayout.classList.remove('hidden');
                cleanLayout.classList.add('hidden');
                toggleCleanModeBtn.innerHTML = '<span class="material-symbols-outlined text-2xl">buttons_alt</span><span class="text-base font-black">MODE ÉPURÉ</span>';
            }
        }
    });

    // Explorateur de fichiers locaux et Drag & Drop
    const fileInput = document.getElementById('file-input');
    const dropZone = document.getElementById('dropZone');

    listen('btn-browse', 'click', (e) => { e.stopPropagation(); if (fileInput) fileInput.click(); });
    if (dropZone) {
        dropZone.addEventListener('click', () => { if (fileInput) fileInput.click(); });
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('border-amber-500'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('border-amber-500'));
        dropZone.addEventListener('drop', async (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-amber-500');
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
            
            const bTitle = document.getElementById('book-title'); if (bTitle) bTitle.textContent = bookData.title;
            const bAuthor = document.getElementById('book-author'); if (bAuthor) bAuthor.textContent = bookData.author;
            const cBookTitle = document.getElementById('cleanBookTitle'); if (cBookTitle) cBookTitle.textContent = bookData.title;

            ui.renderChaptersList(player.playlist, async (index) => {
                player.currentIndex = index;
                await handleTrackChange(player.loadCurrentTrack());
                if (!player.isPlaying) playPauseAction();
            });

            await handleTrackChange(player.loadCurrentTrack());
            addToHistory(bookData.title, bookData.author);

            ui.showPage(document.getElementById('nav-player'), document.getElementById('view-player'), toggleCleanModeBtn);
        } catch (error) {
            alert(error.message || "Erreur lors de l'ouverture du livre DAISY.");
        } finaly {
            if (overlay) overlay.classList.add('hidden');
        }
    }

    // Commandes Audio Synchronisées
    const playPauseAction = () => {
        const isPlaying = player.toggle();
        ui.updatePlayPauseUI(isPlaying);
    };
    listen('playPause', 'click', playPauseAction);
    listen('cleanPlayPause', 'click', playPauseAction);

    // Sauts d'une minute entière (60 secondes)
    listen('btn-skip-back-1m', 'click', () => {
        player.audio.currentTime = Math.max(0, player.audio.currentTime - 60);
    });
    listen('btn-skip-forward-1m', 'click', () => {
        player.audio.currentTime = Math.min(player.audio.duration, player.audio.currentTime + 60);
    });

    async function handleTrackChange(trackPromise) {
        const track = await trackPromise;
        if (track) {
            const cChapterTitle = document.getElementById('cleanChapterTitle');
            if (cChapterTitle) cChapterTitle.textContent = track.title;
            ui.highlightActiveChapter(player.currentIndex);
        }
    }

    listen('btn-next', 'click', () => handleTrackChange(player.next()));
    listen('btn-prev', 'click', () => handleTrackChange(player.prev()));

    // Synchronisation Temporelle
    const audioSlider = document.getElementById('audio-slider');
    const timeCurrent = document.getElementById('time-current');
    const timeDuration = document.getElementById('time-duration');

    function formatTime(seconds) {
        if (isNaN(seconds)) return "00:00";
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    player.audio.addEventListener('loadedmetadata', () => {
        if (audioSlider) { audioSlider.max = Math.floor(player.audio.duration); audioSlider.value = 0; }
        if (timeDuration) timeDuration.textContent = formatTime(player.audio.duration);
    });

    player.audio.addEventListener('timeupdate', () => {
        if (audioSlider && !audioSlider.seeking) audioSlider.value = Math.floor(player.audio.currentTime);
        if (timeCurrent) timeCurrent.textContent = formatTime(player.audio.currentTime);
    });

    if (audioSlider) {
        audioSlider.addEventListener('input', () => audioSlider.seeking = true);
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

    // Sauvegarde et Historique local permanent
    function loadHistory() {
        const container = document.getElementById('history-container');
        if (!container) return;
        container.innerHTML = "";
        const history = JSON.parse(localStorage.getItem('daisy_history') || '[]');
        
        if (history.length === 0) {
            container.innerHTML = `<p class="text-center py-8 text-slate-500 font-black">Aucun historique de lecture disponible.</p>`;
            return;
        }

        history.forEach(item => {
            const card = document.createElement('div');
            card.className = "p-5 bg-white rounded-xl border-2 border-slate-200 flex justify-between items-center gap-4 shadow-sm";
            card.innerHTML = `<div><h4 class="font-black text-lg text-slate-800">${item.title}</h4><p class="text-sm font-bold text-slate-500 mt-1">${item.author} — Lu le ${item.date}</p></div><span class="material-symbols-outlined text-4xl text-amber-600">book</span>`;
            container.appendChild(card);
        });
    }

    function addToHistory(title, author) {
        let history = JSON.parse(localStorage.getItem('daisy_history') || '[]');
        history = history.filter(h => h.title !== title);
        const d = new Date();
        const dateStr = d.toLocaleDateString('fr-FR') + ' à ' + d.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'});
        history.unshift({ title, author, date: dateStr });
        if (history.length > 5) history.pop();
        localStorage.setItem('daisy_history', JSON.stringify(history));
    }

    loadHistory();
});
