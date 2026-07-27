import { parseDaisyZip } from './parser.js';
import { DaisyPlayer } from './player.js';
import * as ui from './ui.js';
import * as library from './library.js';

document.addEventListener('DOMContentLoaded', async () => {

    const player = new DaisyPlayer();
    const toggleCleanModeBtn = document.getElementById('toggleCleanMode');

    // ─── Initialisation de la base de données ──────────────────────────
    await library.initLibrary();

    // ─── Utilitaire : raccourci addEventListener ────────────────────────
    function listen(id, event, callback) {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, callback);
    }

    // ─── Navigation entre pages ─────────────────────────────────────────
    function showView(viewId, activeNavId) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

        const view = document.getElementById(viewId);
        const tab  = document.getElementById(activeNavId);
        if (view) view.classList.add('active');
        if (tab)  tab.classList.add('active');
    }

    listen('nav-home', 'click', () => {
        showView('view-home', 'nav-home');
        if (toggleCleanModeBtn) toggleCleanModeBtn.classList.remove('visible');
        loadHistory();
    });

    listen('nav-player', 'click', () => {
        showView('view-player', 'nav-player');
        if (toggleCleanModeBtn) toggleCleanModeBtn.classList.add('visible');
    });

    // ─── Changement de thème ────────────────────────────────────────────
    listen('btn-theme-toggle', 'click', () => ui.cycleThemes());

    // ─── Basculement Mode Complet <-> Mode Simple ───────────────────────
    let isCleanMode = false;

    listen('toggleCleanMode', 'click', () => {
        const normalLayout = document.getElementById('player-normal-layout');
        const cleanLayout  = document.getElementById('player-clean-layout');
        isCleanMode = !isCleanMode;

        if (normalLayout && cleanLayout) {
            if (isCleanMode) {
                normalLayout.style.display = 'none';
                cleanLayout.classList.add('visible');
                if (toggleCleanModeBtn) toggleCleanModeBtn.textContent = 'MODE COMPLET';
            } else {
                normalLayout.style.display = '';
                cleanLayout.classList.remove('visible');
                if (toggleCleanModeBtn) toggleCleanModeBtn.textContent = 'MODE SIMPLE';
            }
        }
    });

    // ─── Déverrouillage audio iOS ────────────────────────────────────────
    // iOS exige que audio.play() soit appelé de façon SYNCHRONE, dans le
    // prolongement direct d'un geste utilisateur (tap). Nos flux d'import
    // et de reprise de lecture passent par plusieurs `await` (dézippage,
    // IndexedDB, extraction du blob audio) avant d'appeler réellement
    // play() — trop de délai pour iOS, qui bloque alors silencieusement
    // la lecture (symptôme observé : le titre s'affiche mais le temps
    // reste bloqué à 00:00, sans aucune erreur visible à l'écran).
    //
    // 1er correctif tenté : appeler play()/pause() SANS source chargée.
    // Insuffisant sur cette version d'iOS — WebKit exige qu'un VRAI
    // fragment audio soit effectivement joué (même silencieux) pour
    // valider le déverrouillage ; un play() "à vide" ne suffit pas
    // toujours.
    //
    // Correctif définitif : on charge un minuscule fichier WAV silencieux
    // (0,2s, ~1,6 Ko, encodé en base64 ci-dessous) comme amorce, on le
    // joue réellement pendant le geste utilisateur, puis on restaure la
    // source d'origine. Une fois cette vraie lecture effectuée pendant
    // un geste, iOS autorise cet élément <audio> à être piloté par la
    // suite — même après des délais asynchrones — pour le reste de la
    // session.
    const SILENT_AUDIO_SRC =
        'data:audio/wav;base64,UklGRmQGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YUAGAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';

    function unlockAudioForIOS() {
        const audio = player.audio;
        const originalSrc = audio.src;
        audio.src = SILENT_AUDIO_SRC;
        const playAttempt = audio.play();
        const restore = () => {
            audio.pause();
            audio.src = originalSrc || '';
        };
        if (playAttempt && typeof playAttempt.catch === 'function') {
            playAttempt.then(restore).catch(restore);
        } else {
            restore();
        }
    }

    // ─── Explorateur de fichiers & Drag & Drop ──────────────────────────
    const fileInput = document.getElementById('file-input');
    const dropZone  = document.getElementById('dropZone');

    listen('btn-browse', 'click', (e) => {
        e.stopPropagation();
        // Déverrouillage ICI : c'est le vrai tap de l'utilisateur.
        // L'événement "change" du file input, plus loin, se déclenche
        // APRÈS la fermeture du sélecteur de fichiers natif iOS — trop
        // tard, WebKit ne le considère probablement plus comme un geste
        // utilisateur actif à ce moment-là.
        unlockAudioForIOS();
        if (fileInput) fileInput.click();
    });

    if (dropZone) {
        dropZone.addEventListener('click',   () => {
            unlockAudioForIOS(); // même logique : c'est le vrai tap
            if (fileInput) fileInput.click();
        });
        dropZone.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                unlockAudioForIOS(); // une touche clavier est aussi un geste valide
                fileInput.click();
            }
        });
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.backgroundColor = 'var(--surface-hover)';
        });
        dropZone.addEventListener('dragleave', () => {
            dropZone.style.backgroundColor = '';
        });
        dropZone.addEventListener('drop', async (e) => {
            e.preventDefault();
            unlockAudioForIOS(); // doit rester avant tout await ci-dessous
            dropZone.style.backgroundColor = '';
            if (e.dataTransfer.files.length > 0) await handleFileSelection(e.dataTransfer.files[0]);
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            unlockAudioForIOS(); // doit rester avant tout await ci-dessous
            if (e.target.files.length > 0) await handleFileSelection(e.target.files[0]);
        });
    }

    // ─── Chargement d'un fichier ZIP ────────────────────────────────────
    async function handleFileSelection(file) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.classList.add('visible');
        try {
            const bookData = await parseDaisyZip(file);

            // Sauvegarde dans IndexedDB
            const importResult = await library.importBook(file, bookData);
            window.currentBookId = importResult.bookId;

            let startChapter = 0;
            let startPos = 0;

            // Reprise si livre déjà commencé
            if (importResult.status === 'duplicate') {
                const prog = importResult.progress;
                if (prog && (prog.chapterIndex > 0 || prog.positionSeconds > 0)) {
                    if (confirm(`Vous aviez déjà commencé "${bookData.title}". Voulez-vous reprendre là où vous vous étiez arrêté ?`)) {
                        startChapter = prog.chapterIndex;
                        startPos = prog.positionSeconds;
                    }
                }
            }

            // Chargement dans le lecteur
            player.setBook(bookData.zip, bookData.playlist);

            const bTitle = document.getElementById('book-title');
            if (bTitle) bTitle.textContent = bookData.title;

            await handleTrackChange(player.resumeAt(startChapter, startPos));

            showView('view-player', 'nav-player');
            if (toggleCleanModeBtn) toggleCleanModeBtn.classList.add('visible');

            if (!player.isPlaying) playPauseAction();

        } catch (error) {
            alert(error.message || "Erreur lors de l'ouverture du livre.");
        } finally {
            if (overlay) overlay.classList.remove('visible');
        }
    }

    // ─── Commandes Audio ────────────────────────────────────────────────
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

    // ─── Synchronisation barre de progression ───────────────────────────
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

    // ─── Sauvegarde progression toutes les 5 secondes ───────────────────
    setInterval(async () => {
        if (player.isPlaying && window.currentBookId) {
            await library.saveReadingProgress(window.currentBookId, {
                chapterIndex:    player.currentIndex,
                positionSeconds: player.audio.currentTime,
                totalChapters:   player.playlist.length,
                playbackRate:    player.audio.playbackRate
            });
        }
    }, 5000);

    // ─── Chargement de l'historique de lecture ───────────────────────────
    async function loadHistory() {
        const container = document.getElementById('current-reads-list');
        const section   = document.getElementById('current-reads-section');
        if (!container || !section) return;
        container.innerHTML = '';

        try {
            const summary = await library.getDiagnosticSummary();
            const books = summary?.books || [];

            if (books.length === 0) {
                section.style.display = 'none';
                return;
            }

            section.style.display = '';

            // Tri : lecture la plus récente en premier
            books.sort((a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0));

            books.forEach(item => {
                if (!item.bookId) return;

                const card = document.createElement('div');
                card.className = 'book-card';

                const infoDiv = document.createElement('div');
                infoDiv.className = 'book-card-info';

                const dateStr = item.lastOpenedAt
                    ? new Date(item.lastOpenedAt).toLocaleDateString('fr-FR')
                    : "Date inconnue";

                infoDiv.innerHTML = `
                    <h4>${item.title  || "Titre inconnu"}</h4>
                    <p>${item.author || "Auteur inconnu"} — Lu le ${dateStr}</p>
                `;

                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'book-card-actions';

                // Bouton Reprendre
                const resumeBtn = document.createElement('button');
                resumeBtn.className = 'btn-resume';
                resumeBtn.innerHTML = `<span class="material-symbols-outlined">play_arrow</span> Reprendre`;

                resumeBtn.addEventListener('click', async () => {
                    unlockAudioForIOS(); // doit rester avant tout await ci-dessous
                    const overlay = document.getElementById('loading-overlay');
                    if (overlay) overlay.classList.add('visible');
                    try {
                        const openedBook = await library.openBook(item.bookId);
                        if (!openedBook || !openedBook.zipBlob)
                            throw new Error("Fichier du livre introuvable dans la base locale.");

                        const bookData = await parseDaisyZip(openedBook.zipBlob);
                        player.setBook(bookData.zip, bookData.playlist);

                        const bTitle = document.getElementById('book-title');
                        if (bTitle) bTitle.textContent = bookData.title;

                        window.currentBookId = item.bookId;

                        const prog     = openedBook.progress;
                        const startChap = prog?.chapterIndex    || 0;
                        const startPos  = prog?.positionSeconds || 0;

                        await handleTrackChange(player.resumeAt(startChap, startPos));

                        showView('view-player', 'nav-player');
                        if (toggleCleanModeBtn) toggleCleanModeBtn.classList.add('visible');

                        if (!player.isPlaying) playPauseAction();

                    } catch(e) {
                        alert(e.message);
                    } finally {
                        if (overlay) overlay.classList.remove('visible');
                    }
                });

                // Bouton Supprimer
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'btn-delete';
                deleteBtn.setAttribute('aria-label', `Supprimer "${item.title || 'ce livre'}"`);
                deleteBtn.innerHTML = `<span class="material-symbols-outlined">delete</span>`;

                deleteBtn.addEventListener('click', async () => {
                    const titre = item.title || "ce livre";
                    if (!confirm(`Voulez-vous vraiment supprimer "${titre}" de vos lectures en cours ?\nCette action est irréversible.`)) return;
                    try {
                        await library.removeBook(item.bookId);
                        card.remove();
                        if (container.children.length === 0) section.style.display = 'none';
                    } catch(e) {
                        alert("Impossible de supprimer ce livre : " + e.message);
                    }
                });

                actionsDiv.appendChild(resumeBtn);
                actionsDiv.appendChild(deleteBtn);
                card.appendChild(infoDiv);
                card.appendChild(actionsDiv);
                container.appendChild(card);
            });

        } catch (err) {
            console.error("[History] Erreur :", err);
            section.style.display = '';
            container.innerHTML = `<p style="color:var(--text-secondary); padding:0.5rem 0;">Base de données inaccessible.</p>`;
        }
    }

    // Chargement initial
    loadHistory();
});
