import { parseDaisyZip } from './parser.js';
import { DaisyPlayer } from './player.js';
import * as ui from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
    const player = new DaisyPlayer();
    
    // Fonction de sécurité pour éviter le krach du script si un ID n'est pas trouvé
    function listen(id, event, callback) {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, callback);
    }

    const toggleCleanModeBtn = document.getElementById('toggleCleanMode');
    
    // Navigation inter-pages
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

    // Sécurité Thèmes : On écoute les deux variantes d'ID possibles dans votre HTML
    listen('theme-toggle', 'click', () => ui.cycleThemes());
    listen('btn-theme-toggle', 'click', () => ui.cycleThemes());

    // Basculement Mode Épuré / Mode Classique
    let isCleanMode = false;
    listen('toggleCleanMode', 'click', () => {
        isCleanMode = !isCleanMode;
        const playerClassic = document.getElementById('player-classic');
        const playerClean = document.getElementById('player-clean');
        
        if (isCleanMode) {
            if (playerClassic) playerClassic.classList.add('hidden');
            if (playerClean) playerClean.classList.remove('hidden');
            if (toggleCleanModeBtn) {
                const icon = toggleCleanModeBtn.querySelector('span');
                if (icon) icon.textContent = 'playlist_play';
                toggleCleanModeBtn.title = "Mode Classique";
            }
        } else {
            if (playerClassic) playerClassic.classList.remove('hidden');
            if (playerClean) playerClean.classList.add('hidden');
            if (toggleCleanModeBtn) {
                const icon = toggleCleanModeBtn.querySelector('span');
                if (icon) icon.textContent = 'auto_awesome';
                toggleCleanModeBtn.title = "Mode Épuré";
            }
        }
    });

    // Modification de la vitesse de la voix
    let currentSpeed = 1.0;
    listen('select-speed', 'change', (e) => {
        currentSpeed = parseFloat(e.target.value);
        player.audio.playbackRate = currentSpeed;
    });

    // Maintien de la vitesse personnalisée lors du passage au chapitre suivant
    player.audio.addEventListener('canplay', () => {
        player.audio.playbackRate = currentSpeed;
    });

    // Sauts temporels (Boutons reculer/avancer de 10 secondes)
    listen('btn-skip-back', 'click', () => {
        player.audio.currentTime = Math.max(0, player.audio.currentTime - 10);
    });
    listen('btn-skip-forward', 'click', () => {
        player.audio.currentTime = Math.min(player.audio.duration, player.audio.currentTime + 10);
    });

    // Convertisseur de secondes en affichage standard (00:00)
    function formatTime(seconds) {
        if (isNaN(seconds)) return "00:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // Gestion de la barre de progression (Timeline)
    const audioSlider = document.getElementById('audio-slider');
    const timeCurrent = document.getElementById('time-current');
    const timeDuration = document.getElementById('time-duration');

    player.audio.addEventListener('loadedmetadata', () => {
        if (audioSlider) {
            audioSlider.max = Math.floor(player.audio.duration);
            audioSlider.value = 0;
        }
        if (timeDuration) timeDuration.textContent = formatTime(player.audio.duration);
        if (timeCurrent) timeCurrent.textContent = "00:00";
    });

    player.audio.addEventListener('timeupdate', () => {
        if (audioSlider && !audioSlider.seeking) {
            audioSlider.value = Math.floor(player.audio.currentTime);
        }
        if (timeCurrent) timeCurrent.textContent = formatTime(player.audio.currentTime);
    });

    if (audioSlider) {
        audioSlider.addEventListener('input', () => audioSlider.seeking = true);
        audioSlider.addEventListener('change', () => {
            player.audio.currentTime = parseFloat(audioSlider.value);
            audioSlider.seeking = false;
        });
    }

    // Importation et analyse du fichier ZIP DAISY
    const fileInput = document.getElementById('file-input');
    listen('btn-browse', 'click', (e) => { e.stopPropagation(); if (fileInput) fileInput.click(); });
    listen('dropZone', 'click', () => { if (fileInput) fileInput.click(); });

    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                const loader = document.getElementById('loading-overlay');
                if (loader) loader.classList.remove('hidden');
                try {
                    const bookData = await parseDaisyZip(e.target.files[0]);
                    player.setBook(bookData.zip, bookData.playlist);
                    
                    const t1 = document.getElementById('bookTitle'); if (t1) t1.textContent = bookData.bookTitle;
                    const t2 = document.getElementById('cleanBookTitle'); if (t2) t2.textContent = bookData.bookTitle;
                    const aut = document.getElementById('bookAuthor'); if (aut) aut.textContent = bookData.bookAuthor;

                    addToHistory(bookData.bookTitle, bookData.bookAuthor);

                    const cleanChTitle = document.getElementById('cleanChapterTitle');
                    if (cleanChTitle && bookData.playlist.length > 0) {
                        cleanChTitle.textContent = bookData.playlist[0].title;
                    }

                    ui.renderChaptersList(bookData.playlist, async (index) => {
                        player.currentIndex = index;
                        player.isPlaying = true;
                        ui.updatePlayPauseUI(true);
                        const track = await player.loadCurrentTrack();
                        if (track && cleanChTitle) cleanChTitle.textContent = track.title;
                        ui.highlightActiveChapter(player.currentIndex);
                    });

                    await player.loadCurrentTrack();
                    ui.highlightActiveChapter(player.currentIndex);
                    
                    const navPlayerEl = document.getElementById('nav-player');
                    const viewPlayerEl = document.getElementById('view-player');
                    if (navPlayerEl && viewPlayerEl) ui.showPage(navPlayerEl, viewPlayerEl, toggleCleanModeBtn);
                } catch (err) {
                    alert(err.message);
                } finally {
                    if (loader) loader.classList.add('hidden');
                }
            }
        });
    }

    // Commandes principales Play / Pause
    const playPauseAction = () => {
        const isPlaying = player.toggle();
        ui.updatePlayPauseUI(isPlaying);
    };
    listen('playPause', 'click', playPauseAction);
    listen('cleanPlayPause', 'click', playPauseAction);

    // Commandes Suivant / Précédent (avec rafraîchissement d'interface)
    async function handleTrackChange(trackPromise) {
        const track = await trackPromise;
        const cleanChTitle = document.getElementById('cleanChapterTitle');
        if (track && cleanChTitle) {
            cleanChTitle.textContent = track.title;
        }
        ui.highlightActiveChapter(player.currentIndex);
        if (!track && player.currentIndex === player.playlist.length - 1 && !player.isPlaying) {
            ui.updatePlayPauseUI(false);
        }
    }

    listen('btn-next', 'click', () => handleTrackChange(player.next()));
    listen('cleanNext', 'click', () => handleTrackChange(player.next()));
    listen('btn-prev', 'click', () => handleTrackChange(player.prev()));
    listen('cleanPrev', 'click', () => handleTrackChange(player.prev()));

    // Enchaînement automatique à la fin du morceau
    player.audio.addEventListener('ended', () => {
        if (player.currentIndex < player.playlist.length - 1) {
            handleTrackChange(player.next());
        } else {
            player.isPlaying = false;
            ui.updatePlayPauseUI(false);
        }
    });

    // Fonctions liées à la persistance de l'historique de lecture
    function loadHistory() {
        const historyContainer = document.getElementById('history-container');
        const historyEmpty = document.getElementById('history-empty');
        if (!historyContainer) return;

        const history = JSON.parse(localStorage.getItem('daisy_history') || '[]');
        historyContainer.innerHTML = "";
        
        if (history.length === 0) {
            if (historyEmpty) {
                historyEmpty.classList.remove('hidden');
                historyContainer.appendChild(historyEmpty);
            }
            return;
        }

        if (historyEmpty) historyEmpty.classList.add('hidden');

        history.forEach(item => {
            const div = document.createElement('div');
            div.className = "p-4 rounded-xl bg-white dark:bg-slate-800 border flex items-center justify-between shadow-sm text-on-surface dark:text-white";
            div.innerHTML = `
                <div>
                    <h4 class="font-bold text-base text-amber-600 dark:text-amber-400">${item.title}</h4>
                    <p class="text-xs opacity-70">${item.author} — Lu le ${item.date}</p>
                </div>
                <span class="material-symbols-outlined text-amber-500 text-xl">menu_book</span>
            `;
            historyContainer.appendChild(div);
        });
    }

    function addToHistory(title, author) {
        let history = JSON.parse(localStorage.getItem('daisy_history') || '[]');
        history = history.filter(item => item.title !== title);
        
        const now = new Date();
        const formattedDate = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        
        history.unshift({ title, author, date: formattedDate });
        if (history.length > 5) history.pop();
        
        localStorage.setItem('daisy_history', JSON.stringify(history));
    }

    listen('btn-clear-history', 'click', () => {
        localStorage.removeItem('daisy_history');
        loadHistory();
    });

    loadHistory();
});
