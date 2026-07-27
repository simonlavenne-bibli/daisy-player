// ================================================================
// LUMIÈRE AUDIO v2 — player.js
// Moteur de lecture DAISY
// ================================================================

export class DaisyPlayer {
    constructor() {
        this.audio = new Audio();
        this.zip = null;
        this.playlist = [];
        this.currentIndex = 0;
        this.isPlaying = false;
    }

    // ── Chargement d'un nouveau livre ──────────────────────────
    setBook(zip, playlist) {
        // Révoquer les anciens ObjectURLs pour libérer la mémoire
        this.playlist.forEach(track => {
            if (track.audioUrl) {
                URL.revokeObjectURL(track.audioUrl);
            }
        });
        this.audio.pause();
        this.audio.src = '';

        this.zip = zip;
        this.playlist = playlist;
        this.currentIndex = 0;
        this.isPlaying = false;
    }

    // ── Reprise de lecture à un point précis ───────────────────
    async resumeAt(chapterIndex, positionSeconds) {
        this.currentIndex = Math.max(0, Math.min(chapterIndex, this.playlist.length - 1));
        const track = await this.loadCurrentTrack();
        
        const applyPosition = () => {
            this.audio.currentTime = positionSeconds;
        };

        // On attend que les métadonnées soient prêtes pour pouvoir faire un seek
        if (this.audio.readyState >= 1) {
            applyPosition();
        } else {
            const onLoaded = () => {
                applyPosition();
                this.audio.removeEventListener('loadedmetadata', onLoaded);
            };
            this.audio.addEventListener('loadedmetadata', onLoaded);
        }
        
        return track;
    }

    // ── Chargement et lecture de la piste courante ─────────────
    async loadCurrentTrack() {
        if (this.playlist.length === 0) return null;
        const track = this.playlist[this.currentIndex];

        if (!track.audioUrl) {
            try {
                const fileData = await this.zip.file(track.audioFile).async('blob');
                track.audioUrl = URL.createObjectURL(fileData);
                if (window.debugLog) {
                    window.debugLog('loadCurrentTrack: blob créé pour ' + track.audioFile + ' | type MIME=' + fileData.type + ' | taille=' + fileData.size + ' octets');
                }
            } catch (err) {
                console.error('[Player] Impossible de charger le fichier audio :', track.audioFile, err);
                if (window.debugLog) window.debugLog('loadCurrentTrack: ÉCHEC extraction blob - ' + err.message);
                return null;
            }
        }

        if (window.debugLog) window.debugLog('loadCurrentTrack: assignation audio.src = ' + track.audioUrl.slice(0, 50) + '...');
        this.audio.src = track.audioUrl;
        this.audio.load();

        if (this.isPlaying) {
            try {
                await this.audio.play();
                if (window.debugLog) window.debugLog('loadCurrentTrack: play() RÉUSSI | readyState=' + this.audio.readyState + ' currentTime=' + this.audio.currentTime);
            } catch (err) {
                console.warn('[Player] Lecture automatique bloquée par le navigateur.', err);
                if (window.debugLog) window.debugLog('loadCurrentTrack: play() ÉCHEC - ' + err.name + ': ' + err.message + ' | readyState=' + this.audio.readyState + ' networkState=' + this.audio.networkState);
            }
        }
        return track;
    }

    // ── Lecture / Pause ────────────────────────────────────────
    toggle() {
        if (this.playlist.length === 0) return false;
        this.isPlaying = !this.isPlaying;
        if (this.isPlaying) {
            if (window.debugLog) window.debugLog('toggle(): tentative play() | src=' + (this.audio.currentSrc || '').slice(0, 50) + ' readyState=' + this.audio.readyState);
            this.audio.play()
                .then(() => { if (window.debugLog) window.debugLog('toggle(): play() RÉUSSI'); })
                .catch(e => {
                    console.warn('[Player] toggle play error:', e);
                    if (window.debugLog) window.debugLog('toggle(): play() ÉCHEC - ' + e.name + ': ' + e.message);
                });
        } else {
            this.audio.pause();
        }
        return this.isPlaying;
    }

    // ── Navigation par chapitre ────────────────────────────────
    async nextChapter() {
        if (this.currentIndex < this.playlist.length - 1) {
            this.currentIndex++;
            return await this.loadCurrentTrack();
        }
        return null; // fin du livre
    }

    async previousChapter() {
        // Si on est à plus de 5 secondes : retour au début du chapitre courant
        if (this.audio.currentTime > 5) {
            this.audio.currentTime = 0;
            return this.playlist[this.currentIndex];
        }
        // Sinon : chapitre précédent
        if (this.currentIndex > 0) {
            this.currentIndex--;
            return await this.loadCurrentTrack();
        }
        return null; // début du livre, rien à faire
    }

    // ── Sauts temporels de 60 secondes ────────────────────────
    skipForward60() {
        if (this.playlist.length === 0) return;
        const duration = this.audio.duration;
        if (isNaN(duration)) return;
        this.audio.currentTime = Math.min(this.audio.currentTime + 60, duration - 0.1);
    }

    skipBackward60() {
        if (this.playlist.length === 0) return;
        this.audio.currentTime = Math.max(this.audio.currentTime - 60, 0);
    }

    // ── Aliases rétrocompatibles ───────────────────────────────
    async next() { return await this.nextChapter(); }
    async prev() { return await this.previousChapter(); }

    // ── Vitesse de lecture ─────────────────────────────────────
    setSpeed(rate) {
        const valid = [0.75, 1, 1.25, 1.5];
        if (valid.includes(rate)) {
            this.audio.playbackRate = rate;
        }
    }
}
