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

    // Gestion de la navigation principale
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

    // Gestion adaptative du Mode Épuré
    let isCleanMode = false;
    listen('toggleCleanMode', 'click', () => {
        const normalLayout = document.getElementById('player-normal-layout');
        const cleanLayout = document.getElementById('player-clean-layout');
        isCleanMode = !isCleanMode;
        
        if (normalLayout && cleanLayout) {
            if (isCleanMode) {
                normalLayout.classList.add('hidden');
                cleanLayout.classList.remove('hidden');
                toggleCleanModeBtn.innerHTML = '<span class="material-symbols-outlined text-2xl">workspace_premium</span><span class="text-xs font-bold">MODE NORMAL</span>';
            } else {
                normalLayout.classList.remove('hidden');
                cleanLayout.classList.add('hidden');
                toggleCleanModeBtn.innerHTML = '<span class="material-symbols-outlined text-2xl">buttons_alt</span><span class="text-xs font-bold">MODE ÉPURÉ</span>';
            }
        }
    });

    // Gestion Drag & Drop et Sélections de fichiers
    const fileInput = document.getElementById('file-input');
    const dropZone = document.getElementById('dropZone');

    listen('btn-browse', 'click', (e) => { e.stopPropagation(); if (fileInput) fileInput.click(); });
    if (dropZone) {
        dropZone.addEventListener('click', () => { if (fileInput) fileInput.click(); });
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('border-primary'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('border-primary'));
        dropZone.addEventListener('drop', async (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-primary');
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

    async function handleFileSelection(file) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.classList.remove('hidden');
        try {
            const bookData = await parseDaisyZip(file);
            player.setBook(bookData.zip, bookData.playlist);
            
            // Assignation des textes dans la vue classique et épurée
            const bTitle = document.getElementById('book-title');
            if (bTitle) bTitle.textContent = bookData.title;
            const bAuthor = document.getElementById('book-author');
            if (bAuthor) bAuthor.textContent = bookData.author;
            const cBookTitle = document.getElementById('cleanBookTitle');
            if (cBookTitle) cBookTitle.textContent = bookData.title;

            // Rendu de la liste cliquable des chapitres
            ui.renderChaptersList(player.playlist, async (index) => {
                player.currentIndex = index;
                await handleTrackChange(player.loadCurrentTrack());
                if (!player.isPlaying) playPauseAction();
            });

            // Initialisation de la première piste
            await handleTrackChange(player.loadCurrentTrack());
            addToHistory(bookData.title, bookData.author);

            // Redirection automatique sur la page de lecture
            ui.showPage(document.getElementById('nav-player'), document.getElementById('view-player'), toggleCleanModeBtn);
        } catch (error) {
            alert(error.message || "Erreur de chargement du fichier DAISY.");
            console.error(error);
        } finally {
            if (overlay) overlay.classList.add('hidden');
        }
    }

    // Gestionnaires des boutons multimédias
    const playPauseAction = () => {
        const isPlaying = player.toggle();
        ui.updatePlayPauseUI(isPlaying);
    };
    listen('playPause', 'click', playPauseAction);
    listen('cleanPlayPause', 'click', playPauseAction);

    async function handleTrackChange(trackPromise) {
        const track = await trackPromise;
        if (track) {
            const cChapterTitle = document.getElementById('cleanChapterTitle');
            if (cChapterTitle) cChapterTitle.textContent = track.title;
            ui.highlightActiveChapter(player.currentIndex);
        } else if (player.currentIndex === player.playlist.length - 1 && !player.isPlaying) {
            ui.updatePlayPauseUI(false);
        }
    }

    listen('btn-next', 'click', () => handleTrackChange(player.next()));
    listen('cleanNext', 'click', () => handleTrackChange(player.next()));
    listen('btn-prev', 'click', () => handleTrackChange(player.prev()));
    listen('cleanPrev', 'click', () => handleTrackChange(player.prev()));

    // Enchaînement automatique à la fin d'un chapitre
    player.audio.addEventListener('ended', () => {
        if (player.currentIndex < player.playlist.length - 1) {
            handleTrackChange(player.next());
        } else {
            player.isPlaying = false;
            ui.updatePlayPauseUI(false);
        }
    });

    // Système d'historique en LocalStorage
    function loadHistory() {
        const historyContainer = document.getElementById('history-container');
        if (!historyContainer) return;
        
        historyContainer.innerHTML = "";
        const history = JSON.parse(localStorage.getItem('daisy_history') || '[]');
        
        if (history.length === 0) {
            historyContainer.innerHTML = `
                <div class="text-center py-8 text-on-surface-variant dark:text-slate-400">
                    <span class="material-symbols-outlined text-4xl mb-2">history</span>
                    <p class="text-sm font-bold">Aucun livre lu récemment</p>
                </div>`;
            return;
        }

        history.forEach(item => {
            const div = document.createElement('div');
            div.className = "p-4 rounded-xl bg-surface-container dark:bg-slate-800/50 border border-outline-variant dark:border-slate-700/50 flex justify-between items-center gap-4";
            div.innerHTML = `
                <div class="flex-1 min-w-0">
                    <h4 class="font-bold text-on-surface dark:text-white text-sm truncate">${item.title}</h4>
                    <p class="text-xs text-on-surface-variant dark:text-slate-400 truncate mt-0.5">${item.author}</p>
                    <span class="text-[10px] text-slate-400 block mt-2 font-medium">${item.date}</span>
                </div>
                <span class="material-symbols-outlined text-amber-500 text-xl">menu_book</span>
            `;
            historyContainer.appendChild(div);
        });

        const clearBtn = document.createElement('button');
        clearBtn.className = "mt-4 w-full py-2 border border-outline-variant text-on-surface-variant dark:text-slate-400 rounded-xl text-sm font-bold hover:bg-surface-container transition-colors";
        clearBtn.innerHTML = '<span class="material-symbols-outlined text-sm align-middle">delete</span> Effacer l\'historique';
        clearBtn.addEventListener('click', () => {
            localStorage.removeItem('daisy_history');
            loadHistory();
        });
        historyContainer.appendChild(clearBtn);
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

    loadHistory();
});
