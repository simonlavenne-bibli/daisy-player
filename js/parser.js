export async function parseDaisyZip(file) {
    const zip = await window.JSZip.loadAsync(file);
    
    // 1. Trouver le fichier d'index principal
    let indexFile = Object.keys(zip.files).find(name => 
        name.toLowerCase().endsWith('ncc.html') || 
        name.toLowerCase().endsWith('.ncc') || 
        name.toLowerCase().endsWith('.opf')
    );
    
    if (!indexFile) {
        throw new Error("Ce fichier ne semble pas être une archive DAISY valide (aucun fichier d'index trouvé).");
    }

    // 2. Lire les métadonnées globales (Titre, Auteur et ID)
    const indexText = await zip.files[indexFile].async('string');
    const parser = new DOMParser();
    const doc = parser.parseFromString(indexText, 'text/html');

    const titleMeta = doc.querySelector('meta[name="dc:title"], meta[name="NCC:title"]');
    const authorMeta = doc.querySelector('meta[name="dc:creator"], meta[name="NCC:creator"]');
    const idMeta = doc.querySelector('meta[name="dc:identifier"], meta[name="NCC:Identifier"]');
    
    const bookTitle = titleMeta ? titleMeta.getAttribute('content') : file.name.replace('.zip', '');
    const bookAuthor = authorMeta ? authorMeta.getAttribute('content') : "Auteur inconnu";
    const nccId = idMeta ? idMeta.getAttribute('content') : null;

    // 3. Construire la liste de lecture
    let playlist = [];
    const links = doc.querySelectorAll('a');
    
    let detectedAudioFiles = Object.keys(zip.files).filter(name => 
        name.toLowerCase().endsWith('.mp3') || 
        name.toLowerCase().endsWith('.aac')
    );

    if (links.length > 0) {
        links.forEach(link => {
            const title = link.textContent.trim();
            let href = link.getAttribute('href') || "";
            let baseName = href.split('#')[0].toLowerCase().replace('.smil', '');
            let matchingAudio = detectedAudioFiles.find(f => f.toLowerCase().includes(baseName));
            
            if (matchingAudio && title.length > 0) {
                playlist.push({ title, audioFile: matchingAudio, audioUrl: null });
            }
        });
    }

    // Solution de secours : Tri alphabétique direct si aucun lien SMIL valide n'est trouvé
    if (playlist.length === 0 && detectedAudioFiles.length > 0) {
        detectedAudioFiles.sort().forEach((file, index) => {
            playlist.push({ title: `Section ${index + 1}`, audioFile: file, audioUrl: null });
        });
    }

    if (playlist.length === 0) {
        throw new Error("Erreur : Aucun fichier audio (MP3/AAC) n'a pu être détecté dans ce livre.");
    }

    return {
        title: bookTitle,
        author: bookAuthor,
        nccId: nccId,
        playlist: playlist,
        zip: zip
    };
}
