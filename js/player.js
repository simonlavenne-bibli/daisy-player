export class DaisyPlayer {
    constructor() {
        this.audio = new Audio();
        this.zip = null;
        this.playlist = [];
        this.currentIndex = 0;
        this.isPlaying = false;
    }

    setBook(zip, playlist) {
        this.zip = zip;
        this.playlist = playlist;
        this.currentIndex = 0;
    }

    async loadCurrentTrack() {
        if (this.playlist.length === 0) return null;
        const track = this.playlist[this.currentIndex];
        
        if (!track.audioUrl) {
            const fileData = await this.zip.file(track.audioFile).async('blob');
            track.audioUrl = URL.createObjectURL(fileData);
        }
        
        this.audio.src = track.audioUrl;
        this.audio.load();
        if (this.isPlaying) await this.audio.play();
        return track;
    }

    toggle() {
        if (this.playlist.length === 0) return false;
        this.isPlaying = !this.isPlaying;
        if (this.isPlaying) this.audio.play();
        else this.audio.pause();
        return this.isPlaying;
    }

    async next() {
        if (this.currentIndex < this.playlist.length - 1) {
            this.currentIndex++;
            await this.loadCurrentTrack();
        }
    }

    async prev() {
        if (this.audio.currentTime > 5) {
            this.audio.currentTime = 0;
        } else if (this.currentIndex > 0) {
            this.currentIndex--;
            await this.loadCurrentTrack();
        }
    }
}
