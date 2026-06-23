import { parseDaisyZip } from './parser.js';
import { DaisyPlayer } from './player.js';
import * as ui from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
    const player = new DaisyPlayer();
    
    function listen(id, event, callback) {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, callback);
    }

    // Gestion de la navigation inter-onglets
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
    });

    listen('btn-theme-toggle', 'click', () => ui.cycleThemes());

    // Explorateur de fichiers & Glisser-Déposer
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

    // Fonction de traitement et d'initialisation du livre
    async function handleFileSelection(file) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.classList.remove('hidden');
        try {
            const bookData = await parseDaisyZip(file);
            player.setBook(bookData.zip, bookData.playlist);
            
            const bTitle = document.getElementById('book-title'); 
            if (bTitle) bTitle.textContent = bookData.title;

            // Charge le premier morceau
            await handleTrackChange(player.loadCurrentTrack());
            addToHistory(bookData.title, bookData.author);

            // Bascule automatiquement sur l'onglet du lecteur
            ui.showPage(document.getElementById('nav-player'), document.getElementById('view-player'));
            
            // Lancer la lecture automatiquement si souhaité, sinon mettre à jour l'UI
            if (!player.isPlaying) playPauseAction();
            
        } catch (error) {
            alert(error.message || "Erreur lors de l'ouverture du livre DAISY.");
        } finally {
            if (overlay) overlay.classList.add('hidden');
        }
    }

    // --- CONTRÔLES AUDIO (LA NOUVELLE GRILLE 2X2) ---
    
    const playPauseAction = () => {
        const isPlaying = player.toggle();
        ui.updatePlayPauseUI(isPlaying);
    };
    listen('cleanPlayPause', 'click', playPauseAction);

    // Sauts de -1 minute et +1 minute
    listen('btn-skip-back', 'click', () => {
        if (player.audio) {
            player.audio.currentTime = Math.max(0, player.audio.currentTime - 60);
        }
    });
    listen('btn-skip-forward', 'click', () => {
        if (player.audio) {
            player.audio.currentTime = Math.min(player.audio.duration || Infinity, player.audio.currentTime + 60);
        }
    });

    // Changement de piste (Précédent / Suivant)
    async function handleTrackChange(trackPromise) {
        const track = await trackPromise;
        if (track) {
            ui.highlightActiveChapter(track.title);
        } else if (player.currentIndex === player.playlist.length - 1 && !player.isPlaying) {
            ui.updatePlayPauseUI(false);
        }
    }

    listen('cleanNext', 'click', () => handleTrackChange(player.next()));
    listen('btn-prev', 'click', () => handleTrackChange(player.prev()));

    // Synchronisation de la barre temporelle
    const audioSlider = document.getElementById('audio-slider');
    const timeCurrent = document.getElementById('time-current');
    const timeDuration = document.getElementById('time-duration');

    function formatTime(seconds) {
        if (isNaN(seconds) || !isFinite(seconds)) return "00:00";
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

    // Passage automatique à la piste suivante en fin de chapitre
    player.audio.addEventListener('ended', () => {
        if (player.currentIndex < player.playlist.length - 1) {
            handleTrackChange(player.next());
        } else {
            player.isPlaying = false;
            ui.updatePlayPauseUI(false);
        }
    });

    // --- SAUVEGARDE ET HISTORIQUE ---
    function loadHistory() {
        const container = document.getElementById('history-container');
        if (!container) return;
        container.innerHTML = "";
        const history = JSON.parse(localStorage.getItem('daisy_history') || '[]');
        
        if (history.length === 0) {
            container.innerHTML = `<p class="text-center py-12 text-slate-500 text-2xl md:text-3xl font-black">Aucun historique de lecture.</p>`;
            return;
        }

        history.forEach(item => {
            const card = document.createElement('div');
            card.className = "p-6 md:p-8 bg-white rounded-3xl border-4 border-slate-200 flex justify-between items-center gap-6 shadow-md";
            card.innerHTML = `<div class="overflow-hidden"><h4 class="font-black text-2xl md:text-3xl text-slate-800 truncate">${item.title}</h4><p class="text-xl md:text-2xl font-bold text-slate-500 mt-2 truncate">${item.author} — Lu le ${item.date}</p></div><span class="material-symbols-outlined text-[50px] md:text-[60px] text-amber-600 flex-shrink-0">book</span>`;
            container.appendChild(card);
        });
    }

    function addToHistory(title, author) {
        let history = JSON.parse(localStorage.getItem('daisy_history') || '[]');
        history = history.filter(h => h.title !== title); // Supprime le doublon s'il existe
        const d = new Date();
        const dateStr = d.toLocaleDateString('fr-FR');
        history.unshift({ title, author, date: dateStr });
        if (history.length > 5) history.pop(); // Ne garder que les 5 derniers
        localStorage.setItem('daisy_history', JSON.stringify(history));
    }

    loadHistory();
});
