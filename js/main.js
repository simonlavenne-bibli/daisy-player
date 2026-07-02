import { parseDaisyZip } from './parser.js';
import { DaisyPlayer } from './player.js';
import * as ui from './ui.js';
import * as library from './library.js';

document.addEventListener('DOMContentLoaded', async () => {

    const player = new DaisyPlayer();
    const toggleCleanModeBtn = document.getElementById('toggleCleanMode');
    
    // Initialisation de la base de données au démarrage
    await library.initLibrary();

    function listen(id, event, callback) {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, callback);
    }

    // Gestion de la navigation
    listen('nav-home', 'click', () => {
        ui.showPage(document.getElementById('nav-home'), document.getElementById('view-home'));
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
                toggleCleanModeBtn.innerHTML = '<span class="material-symbols-outlined text-4xl">view_module</span><span class="text-2xl font-black">MODE COMPLET</span>';
            } else {
                normalLayout.classList.remove('hidden');
                cleanLayout.classList.add('hidden');
                toggleCleanModeBtn.innerHTML = '<span class="material-symbols-outlined text-4xl">check_box_outline_blank</span><span class="text-2xl font-black">MODE SIMPLE</span>';
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
            
            // Sauvegarde du livre dans la bibliothèque (IndexedDB)
            const importResult = await library.importBook(file, bookData);
            window.currentBookId = importResult.bookId;
            
            let startChapter = 0;
            let startPos = 0;
            
            // Gestion de la reprise si le livre existe déjà
            if (importResult.status === 'duplicate') {
                const prog = importResult.progress;
                if (prog && (prog.chapterIndex > 0 || prog.positionSeconds > 0)) {
                    if (confirm(`Vous aviez déjà commencé "${bookData.title}". Voulez-vous reprendre là où vous vous étiez arrêté ?`)) {
                        startChapter = prog.chapterIndex;
                        startPos = prog.positionSeconds;
                    }
                }
            }

            // Chargement dans le lecteur audio
            player.setBook(bookData.zip, bookData.playlist);

            const bTitle = document.getElementById('book-title');
            if (bTitle) bTitle.textContent = bookData.title;

            await handleTrackChange(player.resumeAt(startChapter, startPos));

            ui.showPage(document.getElementById('nav-player'), document.getElementById('view-player'));
            if (toggleCleanModeBtn) toggleCleanModeBtn.classList.remove('hidden');

            if (!player.isPlaying) playPauseAction();

        } catch (error) {
            alert(error.message || "Erreur lors de l'ouverture du livre.");
        } finally {
            if (overlay) overlay.classList.add('hidden');
        }
    }

    // Commandes Audio
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

    // Tâche de fond : Sauvegarde de la progression toutes les 5 secondes
    setInterval(async () => {
        if (player.isPlaying && window.currentBookId) {
            await library.saveReadingProgress(window.currentBookId, {
                chapterIndex: player.currentIndex,
                positionSeconds: player.audio.currentTime,
                totalChapters: player.playlist.length,
                playbackRate: player.audio.playbackRate
            });
        }
    }, 5000);

    // ─── Chargement sécurisé de l'historique ───────────────────────────
    async function loadHistory() {
        const container = document.getElementById('current-reads-list');
        const section   = document.getElementById('current-reads-section');
        if (!container || !section) return;
        container.innerHTML = '';

        try {
            const summary = await library.getDiagnosticSummary();
            const books = summary?.books || [];

            if (books.length === 0) {
                section.classList.add('hidden');
                return;
            }

            section.classList.remove('hidden');

            // Tri par ouverture la plus récente
            books.sort((a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0));

            books.forEach(item => {
                if (!item.bookId) return;

                const card = document.createElement('div');
                card.className = "p-6 md:p-8 bg-surface rounded-3xl border-4 border-borderCustom flex justify-between items-center gap-6 shadow-md text-textPrimary";

                const infoDiv = document.createElement('div');
                infoDiv.className = "overflow-hidden flex-grow";

                const dateStr = item.lastOpenedAt ? new Date(item.lastOpenedAt).toLocaleDateString('fr-FR') : "Date inconnue";

                infoDiv.innerHTML = `
                    <h4 class="font-black text-3xl md:text-4xl truncate">${item.title || "Titre inconnu"}</h4>
                    <p class="text-2xl md:text-3xl font-bold text-textSecondary mt-2 truncate">${item.author || "Auteur inconnu"} — Lu le ${dateStr}</p>
                `;

                const resumeBtn = document.createElement('button');
                resumeBtn.className = "bg-accent text-white font-black py-5 px-8 rounded-2xl flex items-center gap-3 hover:brightness-110 active:scale-95 transition-all text-2xl border-4 border-borderCustom flex-shrink-0 cursor-pointer";
                resumeBtn.innerHTML = `<span class="material-symbols-outlined text-3xl">play_arrow</span> Reprendre`;

                resumeBtn.addEventListener('click', async () => {
                    const overlay = document.getElementById('loading-overlay');
                    if (overlay) overlay.classList.remove('hidden');

                    try {
                        const openedBook = await library.openBook(item.bookId);
                        if (!openedBook || !openedBook.zipBlob) throw new Error("Fichier du livre introuvable dans la base locale.");

                        const bookData = await parseDaisyZip(openedBook.zipBlob);
                        player.setBook(bookData.zip, bookData.playlist);

                        const bTitle = document.getElementById('book-title');
                        if (bTitle) bTitle.textContent = bookData.title;

                        window.currentBookId = item.bookId;

                        const prog = openedBook.progress;
                        const startChap = prog?.chapterIndex || 0;
                        const startPos  = prog?.positionSeconds || 0;

                        await handleTrackChange(player.resumeAt(startChap, startPos));

                        ui.showPage(document.getElementById('nav-player'), document.getElementById('view-player'));
                        if (toggleCleanModeBtn) toggleCleanModeBtn.classList.remove('hidden');

                        if (!player.isPlaying) playPauseAction();

                    } catch(e) {
                        alert(e.message);
                    } finally {
                        if (overlay) overlay.classList.add('hidden');
                    }
                });

                card.appendChild(infoDiv);
                card.appendChild(resumeBtn);
                container.appendChild(card);
            });
        } catch (err) {
            console.error("[History] Erreur :", err);
            section.classList.remove('hidden');
            container.innerHTML = `<p class="py-4 text-textSecondary text-xl font-bold">Base de données inaccessible.</p>`;
        }
    }

    // Chargement initial au démarrage
    loadHistory();
});
