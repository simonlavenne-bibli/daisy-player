import { parseDaisyZip } from './parser.js';
import { DaisyPlayer } from './player.js';
import * as ui from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
    const player = new DaisyPlayer();
    
    // Éléments Navigation
    const navHome = document.getElementById('nav-home');
    const navHistory = document.getElementById('nav-history');
    const navPlayer = document.getElementById('nav-player');
    const toggleCleanModeBtn = document.getElementById('toggleCleanMode');
    
    // Actions de Navigation
    navHome.addEventListener('click', () => ui.showPage(navHome, document.getElementById('view-home'), toggleCleanModeBtn));
    navHistory.addEventListener('click', () => ui.showPage(navHistory, document.getElementById('view-history'), toggleCleanModeBtn));
    navPlayer.addEventListener('click', () => ui.showPage(navPlayer, document.getElementById('view-player'), toggleCleanModeBtn));

    // Drag and Drop & Input File
    const fileInput = document.getElementById('file-input');
    document.getElementById('btn-browse').addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
    document.getElementById('dropZone').addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            document.getElementById('loading-overlay').classList.remove('hidden');
            try {
                const bookData = await parseDaisyZip(e.target.files[0]);
                player.setBook(bookData.zip, bookData.playlist);
                
                document.getElementById('bookTitle').textContent = bookData.bookTitle;
                document.getElementById('cleanBookTitle').textContent = bookData.bookTitle;
                document.getElementById('bookAuthor').textContent = bookData.bookAuthor;

                // Initialiser le titre du premier chapitre sur l'écran épuré
                if (bookData.playlist.length > 0) {
                    document.getElementById('cleanChapterTitle').textContent = bookData.playlist[0].title;
                }

                ui.renderChaptersList(bookData.playlist, async (index) => {
                    player.currentIndex = index;
                    player.isPlaying = true;
                    ui.updatePlayPauseUI(true);
                    const track = await player.loadCurrentTrack();
                    if (track) {
                        document.getElementById('cleanChapterTitle').textContent = track.title;
                        ui.highlightActiveChapter(player.currentIndex);
                    }
                });

                await player.loadCurrentTrack();
                ui.highlightActiveChapter(player.currentIndex);
                ui.showPage(navPlayer, document.getElementById('view-player'), toggleCleanModeBtn);
            } catch (err) {
                alert(err.message);
            } finally {
                document.getElementById('loading-overlay').classList.add('hidden');
            }
        }
    });

    // Contrôles Audio liés au lecteur
    const playPauseAction = () => {
        const isPlaying = player.toggle();
        ui.updatePlayPauseUI(isPlaying);
    };
    document.getElementById('playPause').addEventListener('click', playPauseAction);
    document.getElementById('cleanPlayPause').addEventListener('click', playPauseAction);

    // Fonction centrale pour appliquer les changements de chapitre (Interface + Audio)
    async function handleTrackChange(trackPromise) {
        const track = await trackPromise;
        if (track) {
            document.getElementById('cleanChapterTitle').textContent = track.title;
            ui.highlightActiveChapter(player.currentIndex);
        } else if (player.currentIndex === player.playlist.length - 1 && !player.isPlaying) {
            // Si on a tenté d'avancer mais qu'on est au bout du livre
            ui.updatePlayPauseUI(false);
        }
    }

    // Assignation des boutons Suivant et Précédent (Modes normal et épuré)
    document.getElementById('btn-next').addEventListener('click', () => handleTrackChange(player.next()));
    document.getElementById('cleanNext').addEventListener('click', () => handleTrackChange(player.next()));
    document.getElementById('btn-prev').addEventListener('click', () => handleTrackChange(player.prev()));
    document.getElementById('cleanPrev').addEventListener('click', () => handleTrackChange(player
