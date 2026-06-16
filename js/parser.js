export async function parseDaisyZip(file) {
    const zip = await window.JSZip.loadAsync(file);
    let indexFile = Object.keys(zip.files).find(name => name.toLowerCase().endsWith('.ncc') || name.toLowerCase().endsWith('.opf'));
    
    if (!indexFile) {
        throw new Error("Ce fichier ne semble pas être une archive DAISY valide (aucun fichier d'index .ncc ou .opf trouvé).");
    }

    const indexText = await zip.files[indexFile].async('string');
    const parser = new DOMParser();
    const doc = parser.parseFromString(indexText, 'text/html');

    const titleMeta = doc.querySelector('meta[name="dc:title"], meta[name="NCC:title"]');
    const authorMeta = doc.querySelector('meta[name="dc:creator"], meta[name="NCC:creator"]');
    
    const bookTitle = titleMeta ? titleMeta.getAttribute('content') : file.name.replace('.zip', '');
    const bookAuthor = authorMeta ? authorMeta.getAttribute('content') : "Auteur inconnu";

    let playlist = [];
    const links = doc.querySelectorAll('a');
    let detectedAudioFiles = Object.keys(zip.files).filter(name => name.toLowerCase().endsWith('.mp3') || name.toLowerCase().endsWith('.mp4') || name.toLowerCase().endsWith('.aac'));

    if (links.length > 0) {
        links.forEach(link => {
            const title = link.textContent.trim();
            let href = link.getAttribute('href') || "";
            let baseName = href.split('#')[0].toLowerCase().replace('.smil', '');
            let matchingAudio = detectedAudioFiles.find(f => f.toLowerCase().includes(baseName)) || detectedAudioFiles[playlist.length];
            
            if (matchingAudio && title.length > 0) {
                playlist.push({ title, audioFile: matchingAudio, audioUrl: null });
            }
        });
    }

    if (playlist.length === 0) {
        detectedAudioFiles.sort().forEach((file, index) => {
            playlist.push({ title: `Piste ${index + 1}`, audioFile: file, audioUrl: null });
        });
    }

    return { zip, bookTitle, bookAuthor, playlist };
}
