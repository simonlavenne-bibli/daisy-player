export async function parseDaisyZip(file) {
    const zip = await window.JSZip.loadAsync(file);
    
    // 1. Trouver le fichier d'index (On inclut bien 'ncc.html' cette fois !)
    let indexFile = Object.keys(zip.files).find(name => 
        name.toLowerCase().endsWith('ncc.html') || 
        name.toLowerCase().endsWith('.ncc') || 
        name.toLowerCase().endsWith('.opf')
    );
    
    if (!indexFile) {
        throw new Error("Ce fichier ne semble pas être une archive DAISY valide (aucun fichier d'index .ncc, ncc.html ou .opf trouvé).");
    }

    // 2. Lire le fichier d'index pour récupérer le titre et l'auteur
    const indexText = await zip.files[indexFile].async('string');
    const parser = new DOMParser();
    const doc = parser.parseFromString(indexText, 'text/html');

    const titleMeta = doc.querySelector('meta[name="dc:title"], meta[name="NCC:title"]');
    const authorMeta = doc.querySelector('meta[name="dc:creator"], meta[name="NCC:creator"]');
    
    const bookTitle = titleMeta ? titleMeta.getAttribute('content') : file.name.replace('.zip', '');
    const bookAuthor = authorMeta ? authorMeta.getAttribute('content') : "Auteur inconnu";

    // 3. Construire la liste de lecture (Playlist)
    let playlist = [];
    const links = doc.querySelectorAll('a');
    
    // On liste tous les fichiers audio présents dans l'archive
    let detectedAudioFiles = Object.keys(zip.files).filter(name => 
        name.toLowerCase().endsWith('.mp3') || 
        name.toLowerCase().endsWith('.mp4') || 
        name.toLowerCase().endsWith('.aac')
    );

    // On parcourt les liens du ncc.html qui pointent vers les fichiers SMIL
    if (links.length > 0) {
        links.forEach(link => {
            const title = link.textContent.trim();
            let href = link.getAttribute('href') || "";
            
            // Le ncc.html pointe vers un fichier .smil (ex: "chapter1.smil#id1")
            // On récupère le nom de base sans l'extension
            let baseName = href.split('#')[0].toLowerCase().replace('.smil', '');
            
            // On cherche le fichier MP3 qui porte le même nom que le fichier SMIL
            let matchingAudio = detectedAudioFiles.find(f => f.toLowerCase().includes(baseName));
            
            if (matchingAudio && title.length > 0) {
                playlist.push({ title, audioFile: matchingAudio, audioUrl: null });
            }
        });
    }

    // Solution de secours : si la liaison SMIL/MP3 échoue, on charge tous les MP3 dans l'ordre alphabétique
    if (playlist.length === 0 && detectedAudioFiles.length > 0) {
        detectedAudioFiles.sort().forEach((file, index) => {
            playlist.push({ title: `Section ${index + 1}`, audioFile: file, audioUrl: null });
        });
    }

    // Si vraiment on ne trouve aucun son
    if (playlist.length === 0) {
        throw new Error("Erreur : Aucun fichier audio (MP3) n'a pu être détecté dans ce livre DAISY.");
    }

    return { zip, bookTitle, bookAuthor, playlist };
}
