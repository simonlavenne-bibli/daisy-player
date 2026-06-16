// =========================================================================
// LUMIÈRE AUDIO — MOTEUR DE LECTURE DAISY FONCTIONNEL
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {

    // --- ÉTATS GLOBAUX DU LECTEUR ---
    let currentZip = null;           // Stocke l'instance du ZIP chargé
    let playlist = [];              // Liste des sections { title, audioFile, audioUrl }
    let currentTrackIndex = 0;      // Index du chapitre en cours de lecture
    let audioPlayer = new Audio();  // Objet audio natif HTML5
    let audioIsPlaying = false;

    // --- ÉLÉMENTS DE L'INTERFACE ---
    const navHome = document.getElementById('nav-home');
    const navHistory = document.getElementById('nav-history');
    const navPlayer = document.getElementById('nav-player');
    const toggleCleanModeBtn = document.getElementById('toggleCleanMode');

    const viewHome = document.getElementById('view-home');
    const viewHistory = document.getElementById('view-history');
    const viewPlayer = document.getElementById('view-player');

    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('file-input');
    const loadingOverlay = document.getElementById('loading-overlay');

    const bookTitleEl = document.getElementById('bookTitle');
    const bookAuthorEl = document.getElementById('bookAuthor');
    const cleanBookTitleEl = document.getElementById('cleanBookTitle');
    const cleanChapterTitleEl = document.getElementById('cleanChapterTitle');
    const chaptersContainer = document.getElementById('chapters-container');

    const playPauseBtn = document.getElementById('playPause');
    const playPauseIcon = document.getElementById('playPauseIcon');
    const cleanPlayPause = document.getElementById('cleanPlayPause');
    const cleanPlayIcon = document.getElementById('cleanPlayIcon');
    const cleanPlayLabel = document.getElementById('cleanPlayLabel');

    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const cleanPrev = document.getElementById('cleanPrev');
    const cleanNext = document.getElementById('cleanNext');

    const timeCurrent = document.getElementById('time-current');
    const timeTotal = document.getElementById('time-total');
    const progressRange = document.getElementById('progress-range');
    const volumeRange = document.getElementById('volume-range');
    const speedButtons = document.querySelectorAll('#speed-buttons-container button');

    // --- 1. ROUTAGE & GESTION DES PAGES ---
    function showPage(activeButton, activeSection, pageKey) {
        [viewHome, viewHistory, viewPlayer].forEach(sec => sec.classList.add('hidden'));
        activeSection.classList.remove('hidden');

        [navHome, navHistory, navPlayer].forEach(btn => {
            btn.className = "flex flex-col items-center justify-center text-on-surface-variant dark:text-slate-400 p-2 hover:bg-surface-container dark:hover:bg-slate-800 transition-all touch-active rounded-xl";
            const icon = btn.querySelector('.material-symbols-outlined');
            if(icon) icon.style.fontVariationSettings = "'FILL' 0";
        });

        activeButton.className = "flex flex-col items-center justify-center bg-primary-container text-on-primary-container rounded-xl px-5 py-1.5 transition-all touch-active shadow-sm";
        const activeIcon = activeButton.querySelector('.material-symbols-outlined');
        if(activeIcon) activeIcon.style.fontVariationSettings = "'FILL' 1";

        toggleCleanModeBtn.classList.toggle('hidden', pageKey !== 'player');
    }

    navHome.addEventListener('click', () => showPage(navHome, viewHome, 'home'));
    navHistory.addEventListener('click', () => showPage(navHistory, viewHistory, 'history'));
    navPlayer.addEventListener('click', () => showPage(navPlayer, viewPlayer, 'player'));

    // --- 2. ANALYSE ET CHARGEMENT DU LIVRE DAISY (.ZIP) ---
    if (fileInput) {
        dropZone.addEventListener('click', () => fileInput.click());
        
        ['dragenter', 'dragover'].forEach(name => dropZone.addEventListener(name, (e) => {
            e.preventDefault(); dropZone.classList.add('drop-zone-active');
        }));
        ['dragleave', 'drop'].forEach(name => dropZone.addEventListener(name, (e) => {
            e.preventDefault(); dropZone.classList.remove('drop-zone-active');
        }));

        dropZone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) processZipFile(files[0]);
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) processZipFile(e.target.files[0]);
        });
    }

    async function processZipFile(file) {
        loadingOverlay.classList.remove('hidden');
        try {
            const zip = await JSZip.loadAsync(file);
            currentZip = zip;
            
            // 1. Trouver le fichier d'index (NCC pour DAISY 2.02 ou OPF pour DAISY 3)
            let indexFile = Object.keys(zip.files).find(name => name.toLowerCase().endsWith('.ncc') || name.toLowerCase().endsWith('.opf'));
            
            if (!indexFile) {
                alert("Ce fichier ne semble pas être une archive DAISY valide (aucun fichier d'index .ncc ou .opf trouvé).");
                loadingOverlay.classList.add('hidden');
                return;
            }

            const indexText = await zip.files[indexFile].async('string');
            const parser = new DOMParser();
            const doc = parser.parseFromString(indexText, 'text/html');

            // 2. Extraire les métadonnées de base
            const titleMeta = doc.querySelector('meta[name="dc:title"], meta[name="NCC:title"]');
            const authorMeta = doc.querySelector('meta[name="dc:creator"], meta[name="NCC:creator"]');
            
            const bookTitle = titleMeta ? titleMeta.getAttribute('content') : file.name.replace('.zip', '');
            const bookAuthor = authorMeta ? authorMeta.getAttribute('content') : "Auteur inconnu";

            // Mettre à jour l'affichage de l'identité du livre
            bookTitleEl.textContent = bookTitle;
            cleanBookTitleEl.textContent = bookTitle;
            bookAuthorEl.textContent = bookAuthor;

            // 3. Extraire les chapitres et les liens audios correspondants
            playlist = [];
            
            // Analyse typique d'un fichier DAISY 2.02 (balises 'a' pointant vers des fichiers .smil ou directement audios)
            const links = doc.querySelectorAll('a');
            let detectedAudioFiles = Object.keys(zip.files).filter(name => name.toLowerCase().endsWith('.mp3') || name.toLowerCase().endsWith('.mp4') || name.toLowerCase().endsWith('.aac'));

            if (links.length > 0) {
                links.forEach(link => {
                    const title = link.textContent.trim();
                    // On cherche un fichier audio qui correspond à l'ordre ou au nom du point de navigation
                    let href = link.getAttribute('href') || "";
                    let baseName = href.split('#')[0].toLowerCase().replace('.smil', '');
                    
                    let matchingAudio = detectedAudioFiles.find(f => f.toLowerCase().includes(baseName)) || detectedAudioFiles[playlist.length];
                    
                    if (matchingAudio && title.length > 0) {
                        playlist.push({
                            title: title,
                            audioFile: matchingAudio,
                            audioUrl: null // Généré à la volée lors de l'écoute
                        });
                    }
                });
            }

            // Si aucune structure n'est extraite, on crée un chapitre par fichier audio brut trouvé
            if (playlist.length === 0) {
                detectedAudioFiles.sort().forEach((file, index) => {
                    playlist.push({
                        title: `Piste ${index + 1}`,
                        audioFile: file,
                        audioUrl: null
                    });
                });
            }

            // 4. Générer l'affichage visuel de la liste des chapitres
            renderChapters();
            
            // 5. Charger la première piste
            currentTrackIndex = 0;
            await loadTrack(currentTrackIndex);

            // Mettre à jour la page "Mes livres" avec un résumé actif
            document.getElementById('view-history').innerHTML = `
                <h3 class="font-headline-lg text-xl font-bold text-on-surface dark:text-white mb-4">Mes lectures en cours</h3>
                <div class="bg-surface-container-low dark:bg-slate-900 p-4 rounded-xl border border-primary-container flex justify-between items-center">
                    <div>
                        <h4 class="font-bold dark:text-white">${bookTitle}</h4>
                        <p class="text-sm text-on-surface-variant dark:text-slate-400">${bookAuthor}</p>
                    </div>
                    <button id="btn-resume-reading" class="bg-primary-container text-on-background px-4 py-2 font-bold rounded-lg text-sm">Écouter</button>
                </div>
            `;
            document.getElementById('btn-resume-reading').addEventListener('click', () => showPage(navPlayer, viewPlayer, 'player'));

            // Redirection automatique vers l'onglet Lecteur
            showPage(navPlayer, viewPlayer, 'player');

        } catch (error) {
            console.error(error);
            alert("Erreur lors de la lecture du fichier ZIP : " + error.message);
        } finally {
            loadingOverlay.classList.add('hidden');
        }
    }

    // --- 3. MOTEUR AUDIO (CHARGEMENT & GESTION DES PISTES) ---
    async function loadTrack(index) {
        if (playlist.length === 0 || index < 0 || index >= playlist.length) return;

        // Si l'URL Blob pour ce fichier n'a pas encore été créée, on l'extrait du ZIP
        if (!playlist[index].audioUrl) {
            const fileData = await currentZip.file(playlist[index].audioFile).async('blob');
            playlist[index].audioUrl = URL.createObjectURL(fileData);
        }

        // Assigner la source au lecteur audio
        audioPlayer.src = playlist[index].audioUrl;
        audioPlayer.load();

        // Appliquer les réglages de vitesse actuels
        const activeSpeedBtn = document.querySelector('#speed-buttons-container button.bg-primary-container');
        if (activeSpeedBtn) {
            audioPlayer.playbackRate = parseFloat(activeSpeedBtn.getAttribute('data-speed'));
        }

        // Mettre à jour les titres de chapitres actifs dans l'interface
        cleanChapterTitleEl.textContent = playlist[index].title;
        highlightActiveChapter(index);

        if (audioIsPlaying) {
            audioPlayer.play().catch(err => console.log("Attente d'interaction utilisateur"));
        }
    }

    function renderChapters() {
        chaptersContainer.innerHTML = "";
        playlist.forEach((track, index) => {
            const btn = document.createElement('button');
            btn.className = "w-full text-left px-4 py-3 rounded-lg hover:bg-surface-container-highest transition-colors flex items-center gap-3 text-sm";
            btn.innerHTML = `
                <span class="material-symbols-outlined text-[20px] text-on-surface-variant">radio_button_unchecked</span>
                <span class="font-body-md">${track.title}</span>
            `;
            btn.addEventListener('click', async () => {
                currentTrackIndex = index;
                if(!audioIsPlaying) audioIsPlaying = true;
                updatePlayPauseUI();
                await loadTrack(currentTrackIndex);
                audioPlayer.play();
            });
            chaptersContainer.appendChild(btn);
        });
    }

    function highlightActiveChapter(activeIndex) {
        const buttons = chaptersContainer.querySelectorAll('button');
        buttons.forEach((btn, index) => {
            const icon = btn.querySelector('.material-symbols-outlined');
            if (index === activeIndex) {
                btn.className = "w-full text-left px-4 py-3 rounded-lg bg-primary-container/10 border-l-4 border-primary-container text-on-surface font-bold flex items-center gap-3 text-sm";
                if(icon) {
                    icon.textContent = "play_circle";
                    icon.style.fontVariationSettings = "'FILL' 1";
                }
            } else {
                btn.className = "w-full text-left px-4 py-3 rounded-lg hover:bg-surface-container-highest transition-colors flex items-center gap-3 text-sm";
                if(icon) {
                    icon.textContent = "radio_button_unchecked";
                    icon.style.fontVariationSettings = "'FILL' 0";
                }
            }
        });
    }

    // --- 4. CONTRÔLES AUDIO (PLAY, PAUSE, SUIVANT, PRÉCÉDENT) ---
    function togglePlayback() {
        if (playlist.length === 0) return;
        audioIsPlaying = !audioIsPlaying;
        updatePlayPauseUI();

        if (audioIsPlaying) {
            audioPlayer.play();
        } else {
            audioPlayer.pause();
        }
    }

    function updatePlayPauseUI() {
        const iconName = audioIsPlaying ? 'pause' : 'play_arrow';
        playPauseIcon.textContent = iconName;
        cleanPlayIcon.textContent = iconName;
        cleanPlayLabel.textContent = audioIsPlaying ? 'PAUSE' : 'LECTURE';
    }

    async function nextTrack() {
        if (currentTrackIndex < playlist.length - 1) {
            currentTrackIndex++;
            await loadTrack(currentTrackIndex);
        }
    }

    async function prevTrack() {
        if (audioPlayer.currentTime > 5) {
            // Recommencer le chapitre si entamé depuis plus de 5 secondes
            audioPlayer.currentTime = 0;
        } else if (currentTrackIndex > 0) {
            currentTrackIndex--;
            await loadTrack(currentTrackIndex);
        }
    }

    playPauseBtn.addEventListener('click', togglePlayback);
    cleanPlayPause.addEventListener('click', togglePlayback);
    
    btnNext.addEventListener('click', nextTrack);
    cleanNext.addEventListener('click', nextTrack);
    btnPrev.addEventListener('click', prevTrack);
    cleanPrev.addEventListener('click', prevTrack);

    // Passage automatique au chapitre suivant à la fin de la piste actuelle
    audioPlayer.addEventListener('ended', nextTrack);

    // --- 5. PROGRESSION & TEMPS EN REEL ---
    function formatTime(seconds) {
        if (isNaN(seconds)) return "00:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    audioPlayer.addEventListener('timeupdate', () => {
        if (audioPlayer.duration) {
            const current = audioPlayer.currentTime;
            const duration = audioPlayer.duration;
            
            timeCurrent.textContent = formatTime(current);
            timeTotal.textContent = formatTime(duration);
            progressRange.value = (current / duration) * 100;
        }
    });

    progressRange.addEventListener('input', (e) => {
        if (audioPlayer.duration) {
            const newTime = (e.target.value / 100) * audioPlayer.duration;
            audioPlayer.currentTime = newTime;
        }
    });

    // --- 6. VOLUME ET VITESSE ---
    volumeRange.addEventListener('input', (e) => {
        audioPlayer.volume = e.target.value / 100;
    });

    speedButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            speedButtons.forEach(btn => {
                btn.className = "py-2.5 rounded-xl bg-surface-container-lowest dark:bg-slate-800 border border-outline-variant dark:border-slate-700 font-bold text-sm touch-active dark:text-white";
            });
            e.target.className = "py-2.5 rounded-xl bg-primary-container text-on-primary-container font-bold text-sm touch-active border border-primary-container";
            
            const speed = parseFloat(e.target.getAttribute('data-speed'));
            audioPlayer.playbackRate = speed;
        });
    });

    // --- 7. MODES COMPACTS & THÈMES (INTERFACE GLISSANTE) ---
    const cleanModeOverlay = document.getElementById('cleanModeOverlay');
    const exitCleanMode = document.getElementById('exitCleanMode');
    const toggleChapters = document.getElementById('toggleChapters');
    const chapterList = document.getElementById('chapterList');
    const chevron = document.getElementById('chevron');

    toggleCleanModeBtn.addEventListener('click', () => {
        cleanModeOverlay.classList.remove('hidden');
        cleanModeOverlay.classList.add('flex');
        document.body.style.overflow = 'hidden';
    });

    exitCleanMode.addEventListener('click', () => {
        cleanModeOverlay.classList.remove('flex');
        cleanModeOverlay.classList.add('hidden');
        document.body.style.overflow = 'auto';
    });

    toggleChapters.addEventListener('click', () => {
        const isClosed = chapterList.style.maxHeight === '0px' || chapterList.style.maxHeight === '';
        chapterList.style.maxHeight = isClosed ? '500px' : '0px';
        chevron.style.transform = isClosed ? 'rotate(180deg)' : 'rotate(0deg)';
    });

    const themeBtn = document.getElementById('btn-theme-toggle');
    themeBtn.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
    });
});
