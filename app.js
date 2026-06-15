/**
 * Lumière Audio - Main Application Logic
 * Optimized for accessibility and fast local DAISY 2.02 parsing.
 */

// Global Application State
let appState = {
  activeTheme: 'light', // 'light' | 'dark' | 'orange'
  playerMode: 'simple', // 'simple' | 'full'
  currentZip: null,     // Active JSZip object in memory
  basePath: '',         // Relative folder path of the ncc.html inside ZIP
  bookMeta: {
    title: 'Livre sans titre',
    creator: 'Auteur inconnu',
    publisher: 'Éditeur inconnu'
  },
  chapters: [],         // Array of parsed chapters from NCC
  currentChapterIndex: -1,
  activeSegments: [],   // Audio segments for the current chapter
  activeSegmentIndex: -1,
  audioElement: null,   // HTML5 Audio instance
  audioCache: {},       // Cache of decompressed Audio Blob URLs
  playbackRate: 1.0,    // 0.75 | 1.0 | 1.25 etc.
  volume: 0.8,
  isPlaying: false,
  isSeeking: false,
  progressSaverInterval: null
};

// Initialize Application on Load
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initAudioElement();
  initEventListeners();
  checkLastReadBook();
});

// ==========================================
// 1. THEME & ACCESSIBILITY MANAGEMENT
// ==========================================

function initTheme() {
  const savedTheme = localStorage.getItem('lumiere_contrast_theme');
  if (savedTheme && ['light', 'dark', 'orange'].includes(savedTheme)) {
    setTheme(savedTheme);
  } else {
    setTheme('light');
  }
}

function setTheme(themeName) {
  appState.activeTheme = themeName;
  document.body.className = ''; // Reset classes
  document.body.classList.add(`theme-${themeName}`);
  localStorage.setItem('lumiere_contrast_theme', themeName);

  // Update button active states
  document.querySelectorAll('.contrast-btn').forEach(btn => {
    if (btn.getAttribute('data-theme') === themeName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Screen reader accessibility announcement
  const themeNamesFr = { 'light': 'clair', 'dark': 'sombre', 'orange': 'orange sur noir' };
  announceToScreenReader(`Thème de contraste ${themeNamesFr[themeName]} activé`);
}

// ==========================================
// 2. AUDIO PLAYBACK CORE ENGINE
// ==========================================

function initAudioElement() {
  appState.audioElement = new Audio();
  
  // Apply saved volume
  const savedVolume = localStorage.getItem('lumiere_volume');
  if (savedVolume !== null) {
    appState.volume = parseFloat(savedVolume);
    appState.audioElement.volume = appState.volume;
    const volSlider = document.getElementById('slider-volume');
    if (volSlider) volSlider.value = appState.volume;
  }

  // Audio Event Listeners
  appState.audioElement.addEventListener('timeupdate', handleAudioTimeUpdate);
  appState.audioElement.addEventListener('ended', handleAudioSegmentEnded);
  appState.audioElement.addEventListener('error', (e) => {
    console.error("Audio playback error: ", e);
    // Auto skip to next segment if error occurs to avoid get stuck
    handleAudioSegmentEnded();
  });
}

// ==========================================
// 3. DAISY ZIP & NCC PARSER (ULTRA-FAST)
// ==========================================

// ==========================================
// INDEXEDDB DATABASE MANAGEMENT FOR BOOKS
// ==========================================
const DB_NAME = 'LumiereAudioDB';
const DB_VERSION = 1;
const STORE_NAME = 'books';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = (event) => reject(new Error("Erreur d'ouverture d'IndexedDB"));
    request.onsuccess = (event) => resolve(event.target.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'title' });
      }
    };
  });
}

async function saveBookToDB(title, creator, arrayBuffer) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const bookData = {
        title: title,
        creator: creator,
        arrayBuffer: arrayBuffer,
        timestamp: Date.now()
      };
      const request = store.put(bookData);
      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error("IndexedDB save error:", err);
    throw err;
  }
}

async function getBookFromDB(title) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(title);
      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error("IndexedDB retrieve error:", err);
    return null;
  }
}

async function deleteBookFromDB(title) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(title);
      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error("IndexedDB delete error:", err);
    return false;
  }
}

async function isBookInDB(title) {
  const book = await getBookFromDB(title);
  return !!book;
}

async function loadDaisyZip(file) {
  showLoading(true);
  try {
    announceToScreenReader("Lecture du fichier importé...");
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    // Find ncc.html file path (case-insensitive)
    let nccEntry = null;
    let nccFilename = '';
    
    zip.forEach((relativePath, entry) => {
      const lower = relativePath.toLowerCase();
      if (lower.endsWith('ncc.html') || lower.endsWith('ncc.htm')) {
        nccEntry = entry;
        nccFilename = relativePath;
      }
    });

    if (!nccEntry) {
      throw new Error("Fichier NCC.HTML introuvable. Ce fichier ne semble pas être un livre DAISY valide.");
    }

    // Parse NCC.html (temporary to extract metadata)
    const nccText = await nccEntry.async('string');
    const parser = new DOMParser();
    const doc = parser.parseFromString(nccText, 'text/html');
    const titleMeta = doc.querySelector('meta[name="dc:title"], meta[name="DC:Title"]');
    const creatorMeta = doc.querySelector('meta[name="dc:creator"], meta[name="DC:Creator"]');
    const title = titleMeta ? titleMeta.getAttribute('content') : 'Livre sans titre';
    const creator = creatorMeta ? creatorMeta.getAttribute('content') : 'Auteur inconnu';

    // Save to IndexedDB
    announceToScreenReader("Enregistrement du livre dans la mémoire locale...");
    try {
      await saveBookToDB(title, creator, arrayBuffer);
    } catch (dbErr) {
      console.warn("Could not save book to IndexedDB:", dbErr);
      alert("Attention : Le livre n'a pas pu être enregistré dans la mémoire locale (espace insuffisant). Vous pourrez l'écouter mais il ne sera pas disponible si vous fermez le lecteur.");
    }

    // Load from buffer
    await loadDaisyZipFromBuffer(arrayBuffer, zip, nccFilename, nccText);

  } catch (error) {
    showLoading(false);
    alert("Erreur lors de l'importation : " + error.message);
    appState.currentZip = null;
  }
}

async function loadDaisyZipFromBuffer(arrayBuffer, zipInstance = null, nccFilename = '', nccText = '') {
  showLoading(true);
  try {
    const zip = zipInstance || await JSZip.loadAsync(arrayBuffer);
    
    if (!nccFilename || !nccText) {
      let nccEntry = null;
      zip.forEach((relativePath, entry) => {
        const lower = relativePath.toLowerCase();
        if (lower.endsWith('ncc.html') || lower.endsWith('ncc.htm')) {
          nccEntry = entry;
          nccFilename = relativePath;
        }
      });

      if (!nccEntry) {
        throw new Error("Fichier NCC.HTML introuvable. Ce fichier ne semble pas être un livre DAISY valide.");
      }
      nccText = await nccEntry.async('string');
    }

    // Determine base folder path inside ZIP
    const lastSlashIdx = nccFilename.lastIndexOf('/');
    appState.basePath = lastSlashIdx !== -1 ? nccFilename.substring(0, lastSlashIdx + 1) : '';
    appState.currentZip = zip;
    appState.audioCache = {}; // Reset cache for new book

    // Parse NCC.html
    parseNccHtml(nccText);

    if (appState.chapters.length === 0) {
      throw new Error("Aucun chapitre audio trouvé dans le fichier NCC.HTML.");
    }

    // Load Book Metadata into DOM
    document.getElementById('player-book-title').textContent = appState.bookMeta.title;
    document.getElementById('player-book-author').textContent = appState.bookMeta.creator;
    
    // Render Playlist Sidebar
    renderPlaylist();

    // Check if we have progress saved for this book
    const savedProgress = getSavedProgressForBook(appState.bookMeta.title);
    
    // Reset player mode to simple by default on import
    togglePlayerMode('simple');
    
    // Show Player Page
    switchView('player');
    showLoading(false);
    
    announceToScreenReader(`Livre audio ${appState.bookMeta.title} chargé avec succès. Affichage du lecteur simple.`);

    if (savedProgress) {
      // Resume from saved progress
      playChapter(savedProgress.chapterIndex, savedProgress.timePosition);
    } else {
      // Start with chapter 0
      playChapter(0, 0);
    }

    // Save this book metadata to "recent books"
    saveBookToRecents(appState.bookMeta.title, appState.bookMeta.creator);

  } catch (error) {
    showLoading(false);
    alert("Erreur lors de la lecture : " + error.message);
    appState.currentZip = null;
  }
}

function parseNccHtml(htmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, 'text/html');
  
  // Parse Metadata
  const titleMeta = doc.querySelector('meta[name="dc:title"], meta[name="DC:Title"]');
  const creatorMeta = doc.querySelector('meta[name="dc:creator"], meta[name="DC:Creator"]');
  const publisherMeta = doc.querySelector('meta[name="dc:publisher"], meta[name="DC:Publisher"]');

  appState.bookMeta.title = titleMeta ? titleMeta.getAttribute('content') : 'Livre sans titre';
  appState.bookMeta.creator = creatorMeta ? creatorMeta.getAttribute('content') : 'Auteur inconnu';
  appState.bookMeta.publisher = publisherMeta ? publisherMeta.getAttribute('content') : 'Éditeur inconnu';

  // Parse Headings (Chapters)
  // DAISY 2.02 specifies navigation headings via h1-h6
  const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
  appState.chapters = [];

  let idx = 0;
  headings.forEach(heading => {
    const anchor = heading.querySelector('a');
    if (anchor) {
      const href = anchor.getAttribute('href') || '';
      const [smilFile, anchorId] = href.split('#');
      
      appState.chapters.push({
        id: `chap-${idx}`,
        title: heading.textContent.trim(),
        level: parseInt(heading.tagName.substring(1)), // h1 -> 1, h2 -> 2
        smilFile: smilFile,
        anchorId: anchorId || '',
        index: idx
      });
      idx++;
    }
  });
}

// ==========================================
// 4. SMIL PARSER & LAZY AUDIO LOADER
// ==========================================

// Parse SMIL file for current chapter to find all associated audio clips
async function loadChapterSegments(chapterIndex) {
  const chapter = appState.chapters[chapterIndex];
  if (!chapter) return [];

  const smilZipPath = appState.basePath + chapter.smilFile;
  const smilEntry = appState.currentZip.file(smilZipPath);
  
  if (!smilEntry) {
    console.error(`SMIL file ${smilZipPath} not found in zip.`);
    return [];
  }

  const smilText = await smilEntry.async('string');
  const parser = new DOMParser();
  const doc = parser.parseFromString(smilText, 'text/xml');
  
  // Find all parallel <par> segments in SMIL
  const pars = doc.querySelectorAll('par');
  let segments = [];
  let foundStart = false;

  // Next chapter boundary
  const nextChapter = appState.chapters[chapterIndex + 1];
  const nextChapterSameFile = nextChapter && nextChapter.smilFile === chapter.smilFile;
  const nextChapterAnchor = nextChapterSameFile ? nextChapter.anchorId : null;

  pars.forEach(par => {
    const id = par.getAttribute('id') || '';
    
    // DAISY links point directly to heading anchors in SMIL.
    if (id === chapter.anchorId) {
      foundStart = true;
    }
    
    // If the next chapter is in the same SMIL file, we stop collecting when we hit its anchor
    if (nextChapterAnchor && id === nextChapterAnchor) {
      foundStart = false;
    }

    if (foundStart || (!chapter.anchorId && segments.length === 0)) {
      const audio = par.querySelector('audio');
      if (audio) {
        const src = audio.getAttribute('src') || '';
        const clipBeginStr = audio.getAttribute('clip-begin') || '';
        const clipEndStr = audio.getAttribute('clip-end') || '';
        
        segments.push({
          audioFile: src,
          begin: parseSmilTime(clipBeginStr),
          end: parseSmilTime(clipEndStr)
        });
      }
    }
  });

  // Fallback
  if (segments.length === 0) {
    const audios = doc.querySelectorAll('audio');
    audios.forEach(audio => {
      const src = audio.getAttribute('src') || '';
      const clipBeginStr = audio.getAttribute('clip-begin') || '';
      const clipEndStr = audio.getAttribute('clip-end') || '';
      
      segments.push({
        audioFile: src,
        begin: parseSmilTime(clipBeginStr),
        end: parseSmilTime(clipEndStr)
      });
    });
  }

  return segments;
}

// Convert SMIL time strings to float seconds
function parseSmilTime(timeStr) {
  if (!timeStr) return 0;
  let cleanStr = timeStr.replace('npt=', '').replace('s', '');
  if (cleanStr.includes(':')) {
    const parts = cleanStr.split(':').map(parseFloat);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
  }
  return parseFloat(cleanStr) || 0;
}

// Decompress single audio file from ZIP on-the-fly and return local Blob URL
async function getAudioBlobUrl(audioFilename) {
  const fullPath = appState.basePath + audioFilename;
  
  if (appState.audioCache[fullPath]) {
    return appState.audioCache[fullPath];
  }

  let fileEntry = appState.currentZip.file(fullPath);
  if (!fileEntry) {
    const lowerPath = fullPath.toLowerCase();
    appState.currentZip.forEach((relativePath, entry) => {
      if (relativePath.toLowerCase() === lowerPath) {
        fileEntry = entry;
      }
    });
  }

  if (!fileEntry) {
    throw new Error(`Audio file not found: ${fullPath}`);
  }

  const blob = await fileEntry.async('blob');
  
  let type = 'audio/mpeg';
  if (audioFilename.endsWith('.ogg')) type = 'audio/ogg';
  const audioBlob = new Blob([blob], { type: type });
  
  const blobUrl = URL.createObjectURL(audioBlob);
  appState.audioCache[fullPath] = blobUrl;
  
  return blobUrl;
}

// ==========================================
// 5. PLAYER NAVIGATION & ACTION HANDLERS
// ==========================================

async function playChapter(chapterIndex, startTimePosition = 0) {
  if (chapterIndex < 0 || chapterIndex >= appState.chapters.length) return;
  
  appState.currentChapterIndex = chapterIndex;
  updatePlaylistActiveItem();

  const chapter = appState.chapters[chapterIndex];
  document.getElementById('player-chapter-title').textContent = chapter.title;
  
  announceToScreenReader(`Chargement du chapitre : ${chapter.title}`);
  showAudioLoading(true);

  try {
    appState.activeSegments = await loadChapterSegments(chapterIndex);
    
    if (appState.activeSegments.length === 0) {
      throw new Error("Aucun segment audio disponible pour ce chapitre.");
    }

    appState.activeSegmentIndex = 0;
    
    let targetSegmentIndex = 0;
    let targetAudioTime = appState.activeSegments[0].begin;
    
    if (startTimePosition > 0) {
      let accumulatedTime = 0;
      for (let i = 0; i < appState.activeSegments.length; i++) {
        const seg = appState.activeSegments[i];
        const segDuration = seg.end - seg.begin;
        if (accumulatedTime + segDuration >= startTimePosition) {
          targetSegmentIndex = i;
          targetAudioTime = seg.begin + (startTimePosition - accumulatedTime);
          break;
        }
        accumulatedTime += segDuration;
      }
    }

    appState.activeSegmentIndex = targetSegmentIndex;
    await playActiveSegment(targetAudioTime);
    
  } catch (error) {
    console.error(error);
    alert("Impossible de lire ce chapitre : " + error.message);
    showAudioLoading(false);
  }
}

async function playActiveSegment(customTime = null) {
  const segment = appState.activeSegments[appState.activeSegmentIndex];
  if (!segment) return;

  try {
    const blobUrl = await getAudioBlobUrl(segment.audioFile);
    
    const isSameFile = appState.audioElement.src === blobUrl;
    if (!isSameFile) {
      appState.audioElement.src = blobUrl;
      appState.audioElement.load();
    }

    const startSeek = customTime !== null ? customTime : segment.begin;
    
    const timeDiff = Math.abs(appState.audioElement.currentTime - startSeek);
    if (!isSameFile || customTime !== null || timeDiff > 0.4) {
      appState.audioElement.currentTime = startSeek;
    }
    
    appState.audioElement.playbackRate = appState.playbackRate;
    showAudioLoading(false);

    if (appState.isPlaying) {
      appState.audioElement.play().catch(err => {
        console.log("Autoplay blocked: ", err);
        setPlayState(false);
      });
    }

  } catch (err) {
    console.error(err);
    alert("Erreur de décompression audio : " + err.message);
    showAudioLoading(false);
  }
}

function handleAudioTimeUpdate() {
  if (appState.isSeeking || appState.activeSegments.length === 0) return;

  const segment = appState.activeSegments[appState.activeSegmentIndex];
  if (!segment) return;

  const curTime = appState.audioElement.currentTime;

  if (curTime >= segment.end) {
    handleAudioSegmentEnded();
    return;
  }

  updateProgressUI();
}

function handleAudioSegmentEnded() {
  if (appState.activeSegmentIndex + 1 < appState.activeSegments.length) {
    appState.activeSegmentIndex++;
    playActiveSegment();
  } else {
    if (appState.currentChapterIndex + 1 < appState.chapters.length) {
      playChapter(appState.currentChapterIndex + 1);
    } else {
      setPlayState(false);
      appState.audioElement.currentTime = appState.activeSegments[appState.activeSegmentIndex].begin;
      updateProgressUI();
      alert("Vous avez terminé l'écoute de ce livre !");
    }
  }
}

function getChapterDuration() {
  return appState.activeSegments.reduce((sum, seg) => sum + (seg.end - seg.begin), 0);
}

function getChapterCurrentTime() {
  if (appState.activeSegments.length === 0) return 0;
  let accumulated = 0;
  for (let i = 0; i < appState.activeSegmentIndex; i++) {
    accumulated += (appState.activeSegments[i].end - appState.activeSegments[i].begin);
  }
  const activeSeg = appState.activeSegments[appState.activeSegmentIndex];
  if (activeSeg) {
    accumulated += Math.max(0, appState.audioElement.currentTime - activeSeg.begin);
  }
  return accumulated;
}

function updateProgressUI() {
  const curTime = getChapterCurrentTime();
  const totalDuration = getChapterDuration();
  
  document.getElementById('player-time-current').textContent = formatTime(curTime);
  document.getElementById('player-time-duration').textContent = formatTime(totalDuration);

  const pct = totalDuration > 0 ? (curTime / totalDuration) * 100 : 0;
  document.getElementById('progress-fill').style.width = `${pct}%`;

  const progressContainer = document.getElementById('progress-container');
  if (progressContainer) {
    progressContainer.setAttribute('aria-valuenow', Math.round(pct));
    progressContainer.setAttribute('aria-valuetext', `${formatTime(curTime)} sur ${formatTime(totalDuration)}`);
  }
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  const paddedM = String(m).padStart(2, '0');
  const paddedS = String(s).padStart(2, '0');

  if (h > 0) {
    return `${h}:${paddedM}:${paddedS}`;
  }
  return `${paddedM}:${paddedS}`;
}

function setPlayState(play) {
  appState.isPlaying = play;
  const playSvg = document.getElementById('svg-play');
  const pauseSvg = document.getElementById('svg-pause');
  const playBtn = document.getElementById('btn-play-pause');
  
  if (play) {
    playSvg.style.display = 'none';
    pauseSvg.style.display = 'block';
    playBtn.setAttribute('aria-label', 'Mettre en pause la lecture');
    
    appState.audioElement.play().catch(err => {
      console.log("Playback failed: ", err);
      appState.isPlaying = false;
      playSvg.style.display = 'block';
      pauseSvg.style.display = 'none';
      playBtn.setAttribute('aria-label', 'Lancer la lecture');
    });

    startProgressSaver();
    const chapTitle = appState.currentChapterIndex !== -1 ? appState.chapters[appState.currentChapterIndex].title : '';
    announceToScreenReader(`Lecture en cours. ${chapTitle}`);
  } else {
    playSvg.style.display = 'block';
    pauseSvg.style.display = 'none';
    playBtn.setAttribute('aria-label', 'Lancer la lecture');
    
    appState.audioElement.pause();
    stopProgressSaver();
    saveCurrentProgress();
    
    announceToScreenReader("Lecture en pause");
  }
}

// ==========================================
// 6. PROGRESS STORAGE & RECOVERY SYSTEM
// ==========================================

// Starts progress saver interval to run every 5s
function startProgressSaver() {
  stopProgressSaver();
  appState.progressSaverInterval = setInterval(saveCurrentProgress, 5000);
}

function stopProgressSaver() {
  if (appState.progressSaverInterval) {
    clearInterval(appState.progressSaverInterval);
    appState.progressSaverInterval = null;
  }
}

function saveCurrentProgress() {
  if (appState.currentChapterIndex === -1 || !appState.currentZip) return;
  
  const progress = {
    bookTitle: appState.bookMeta.title,
    creator: appState.bookMeta.creator,
    chapterIndex: appState.currentChapterIndex,
    timePosition: getChapterCurrentTime(),
    timestamp: Date.now()
  };

  let progressRegistry = JSON.parse(localStorage.getItem('lumiere_books_progress') || '{}');
  progressRegistry[appState.bookMeta.title] = progress;
  localStorage.setItem('lumiere_books_progress', JSON.stringify(progressRegistry));
}

function getSavedProgressForBook(title) {
  const progressRegistry = JSON.parse(localStorage.getItem('lumiere_books_progress') || '{}');
  return progressRegistry[title] || null;
}

function saveBookToRecents(title, creator) {
  let recents = JSON.parse(localStorage.getItem('lumiere_recent_books') || '[]');
  recents = recents.filter(b => b.title !== title);
  recents.unshift({ title, creator, timestamp: Date.now() });
  recents = recents.slice(0, 3);
  localStorage.setItem('lumiere_recent_books', JSON.stringify(recents));
  
  checkLastReadBook();
}

async function checkLastReadBook() {
  const recents = JSON.parse(localStorage.getItem('lumiere_recent_books') || '[]');
  const containerId = 'recent-books-container';
  
  const landingInfoSec = document.querySelector('.info-section');
  if (!landingInfoSec) return;

  let recentContainer = document.getElementById(containerId);
  if (recents.length === 0) {
    if (recentContainer) recentContainer.style.display = 'none';
    return;
  }

  if (!recentContainer) {
    recentContainer = document.createElement('div');
    recentContainer.id = containerId;
    recentContainer.style.marginTop = '2rem';
    recentContainer.style.display = 'flex';
    recentContainer.style.flexDirection = 'column';
    recentContainer.style.gap = '0.75rem';
    
    landingInfoSec.appendChild(recentContainer);
  } else {
    recentContainer.innerHTML = '';
    recentContainer.style.display = 'flex';
  }

  const titleEl = document.createElement('h3');
  titleEl.textContent = "Continuer la lecture";
  titleEl.style.margin = '0 0 0.5rem 0';
  recentContainer.appendChild(titleEl);

  for (const book of recents) {
    const inDB = await isBookInDB(book.title);

    const card = document.createElement('div');
    card.className = 'step-card';
    card.style.borderColor = 'var(--border-color)';
    card.style.display = 'flex';
    card.style.alignItems = 'center';
    card.style.justifyContent = 'space-between';
    card.style.padding = '0.75rem 1rem';
    card.style.gap = '1rem';

    // Left click area to load book
    const clickArea = document.createElement('div');
    clickArea.style.display = 'flex';
    clickArea.style.alignItems = 'center';
    clickArea.style.gap = '1rem';
    clickArea.style.flexGrow = '1';
    clickArea.style.cursor = 'pointer';
    clickArea.setAttribute('role', 'button');
    clickArea.setAttribute('tabindex', '0');
    
    const statusText = inDB ? 'En mémoire' : 'À réimporter';
    const statusColor = inDB ? 'var(--text-main)' : 'var(--text-muted)';
    
    if (inDB) {
      clickArea.setAttribute('aria-label', `Reprendre la lecture de "${book.title}". Disponible en mémoire locale.`);
    } else {
      clickArea.setAttribute('aria-label', `Reprendre la lecture de "${book.title}". Nécessite de réimporter le fichier ZIP.`);
    }

    clickArea.innerHTML = `
      <div class="step-number" style="background-color: ${inDB ? 'var(--color-primary)' : 'var(--color-accent)'}; color: ${inDB ? 'var(--bg-card)' : 'var(--text-main)'}; flex-shrink: 0;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
      </div>
      <div class="step-text" style="flex-grow: 1;">
        <h4 style="margin: 0 0 0.25rem 0; font-size: 1.05rem;">${book.title}</h4>
        <p style="margin: 0; font-size: 0.9rem; color: var(--text-muted);">${book.creator} <span style="font-size: 0.8rem; font-weight: bold; color: ${statusColor};">(${statusText})</span></p>
      </div>
    `;

    clickArea.addEventListener('click', async () => {
      if (inDB) {
        showLoading(true);
        announceToScreenReader(`Chargement du livre "${book.title}" depuis la mémoire locale...`);
        try {
          const bookData = await getBookFromDB(book.title);
          if (bookData && bookData.arrayBuffer) {
            await loadDaisyZipFromBuffer(bookData.arrayBuffer);
          } else {
            throw new Error("Données du livre corrompues ou vides.");
          }
        } catch (err) {
          showLoading(false);
          alert("Erreur lors de l'extraction : " + err.message);
        }
      } else {
        alert(`Pour reprendre la lecture de "${book.title}", veuillez glisser-déposer son fichier ZIP dans la zone de chargement.`);
        document.getElementById('dropzone').focus();
      }
    });

    clickArea.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        clickArea.click();
      }
    });

    card.appendChild(clickArea);

    // Right delete button (only if saved in database)
    if (inDB) {
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn-delete-stored';
      deleteBtn.setAttribute('aria-label', `Supprimer "${book.title}" de la mémoire locale`);
      
      deleteBtn.style.backgroundColor = 'var(--bg-card)';
      deleteBtn.style.color = 'var(--text-main)';
      deleteBtn.style.border = '3px solid var(--border-color)';
      deleteBtn.style.borderRadius = '10px';
      deleteBtn.style.cursor = 'pointer';
      deleteBtn.style.padding = '0.5rem';
      deleteBtn.style.display = 'inline-flex';
      deleteBtn.style.alignItems = 'center';
      deleteBtn.style.justifyContent = 'center';
      deleteBtn.style.width = '44px';
      deleteBtn.style.height = '44px';
      deleteBtn.style.flexShrink = '0';

      deleteBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
      `;

      deleteBtn.addEventListener('mouseenter', () => {
        deleteBtn.style.backgroundColor = 'var(--bg-hover)';
      });
      deleteBtn.addEventListener('mouseleave', () => {
        deleteBtn.style.backgroundColor = 'var(--bg-card)';
      });

      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`Voulez-vous supprimer le livre "${book.title}" de la mémoire locale ? (La progression de lecture sera conservée)`)) {
          const success = await deleteBookFromDB(book.title);
          if (success) {
            announceToScreenReader(`Livre "${book.title}" supprimé de la mémoire locale.`);
            checkLastReadBook();
          } else {
            alert("Erreur lors de la suppression du livre.");
          }
        }
      });

      card.appendChild(deleteBtn);
    }

    recentContainer.appendChild(card);
  }
}

// ==========================================
// 7. USER INTERFACE & EVENTS WIRING
// ==========================================

function initEventListeners() {
  document.querySelectorAll('.contrast-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.getAttribute('data-theme');
      setTheme(theme);
    });
  });

  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const btnBrowse = document.getElementById('btn-browse-file');

  btnBrowse.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      loadDaisyZip(e.target.files[0]);
    }
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.zip')) {
        loadDaisyZip(file);
      } else {
        alert("Veuillez sélectionner un fichier ZIP DAISY.");
      }
    }
  });

  dropzone.addEventListener('click', () => {
    fileInput.click();
  });

  document.getElementById('btn-play-pause').addEventListener('click', () => {
    setPlayState(!appState.isPlaying);
  });

  document.getElementById('btn-next-chapter').addEventListener('click', () => {
    if (appState.currentChapterIndex + 1 < appState.chapters.length) {
      playChapter(appState.currentChapterIndex + 1);
    }
  });

  document.getElementById('btn-prev-chapter').addEventListener('click', () => {
    if (appState.currentChapterIndex - 1 >= 0) {
      playChapter(appState.currentChapterIndex - 1);
    }
  });

  document.getElementById('btn-rewind-10').addEventListener('click', () => {
    adjustAudioTime(-10);
  });

  document.getElementById('btn-forward-10').addEventListener('click', () => {
    adjustAudioTime(10);
  });

  const volSlider = document.getElementById('slider-volume');
  volSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    appState.volume = val;
    appState.audioElement.volume = val;
    localStorage.setItem('lumiere_volume', val);
    volSlider.setAttribute('aria-valuenow', Math.round(val * 100));
    announceToScreenReader(`Volume à ${Math.round(val * 100)} %`);
  });

  const speedSelect = document.getElementById('select-speed');
  speedSelect.addEventListener('change', (e) => {
    const speed = parseFloat(e.target.value);
    appState.playbackRate = speed;
    appState.audioElement.playbackRate = speed;
    
    const speedText = speed === 1.0 ? "normale" : `${speed} fois la normale`;
    announceToScreenReader(`Vitesse de lecture réglée à ${speedText}`);
  });

  const progressContainer = document.getElementById('progress-container');
  progressContainer.addEventListener('mousedown', startSeeking);
  progressContainer.addEventListener('touchstart', startSeeking, { passive: true });

  document.getElementById('btn-toggle-mode').addEventListener('click', () => {
    togglePlayerMode();
  });

  document.getElementById('btn-close-book').addEventListener('click', () => {
    closeBook();
  });

  window.addEventListener('keydown', handleGlobalKeydown);
}

function adjustAudioTime(delta) {
  if (appState.activeSegments.length === 0) return;
  
  const curTime = appState.audioElement.currentTime;
  const segment = appState.activeSegments[appState.activeSegmentIndex];
  if (!segment) return;

  const targetTime = curTime + delta;

  if (targetTime < segment.begin) {
    if (appState.activeSegmentIndex - 1 >= 0) {
      appState.activeSegmentIndex--;
      const prevSeg = appState.activeSegments[appState.activeSegmentIndex];
      const leftover = segment.begin - targetTime;
      const prevTarget = Math.max(prevSeg.begin, prevSeg.end - leftover);
      playActiveSegment(prevTarget);
    } else {
      appState.audioElement.currentTime = segment.begin;
    }
  } else if (targetTime > segment.end) {
    if (appState.activeSegmentIndex + 1 < appState.activeSegments.length) {
      appState.activeSegmentIndex++;
      const nextSeg = appState.activeSegments[appState.activeSegmentIndex];
      const leftover = targetTime - segment.end;
      const nextTarget = Math.min(nextSeg.end, nextSeg.begin + leftover);
      playActiveSegment(nextTarget);
    } else {
      handleAudioSegmentEnded();
    }
  } else {
    appState.audioElement.currentTime = targetTime;
  }

  updateProgressUI();
  saveCurrentProgress();
}

function startSeeking(e) {
  appState.isSeeking = true;
  document.addEventListener('mousemove', moveSeeking);
  document.addEventListener('mouseup', stopSeeking);
  document.addEventListener('touchmove', moveSeeking, { passive: true });
  document.addEventListener('touchend', stopSeeking);
  
  moveSeeking(e);
}

function moveSeeking(e) {
  if (!appState.isSeeking || appState.activeSegments.length === 0) return;
  const progressContainer = document.getElementById('progress-container');
  const rect = progressContainer.getBoundingClientRect();
  
  let clientX = e.clientX;
  if (e.touches && e.touches.length > 0) {
    clientX = e.touches[0].clientX;
  }

  let relX = (clientX - rect.left) / rect.width;
  relX = Math.max(0, Math.min(1, relX));

  const totalDuration = getChapterDuration();
  const targetChapterTime = relX * totalDuration;

  document.getElementById('progress-fill').style.width = `${relX * 100}%`;
  document.getElementById('player-time-current').textContent = formatTime(targetChapterTime);
}

async function stopSeeking(e) {
  if (!appState.isSeeking) return;
  appState.isSeeking = false;
  
  document.removeEventListener('mousemove', moveSeeking);
  document.removeEventListener('mouseup', stopSeeking);
  document.removeEventListener('touchmove', moveSeeking);
  document.removeEventListener('touchend', stopSeeking);

  if (appState.activeSegments.length === 0) return;

  const progressContainer = document.getElementById('progress-container');
  const rect = progressContainer.getBoundingClientRect();
  
  let clientX = e.clientX;
  if (e.changedTouches && e.changedTouches.length > 0) {
    clientX = e.changedTouches[0].clientX;
  } else if (e.touches && e.touches.length > 0) {
    clientX = e.touches[0].clientX;
  }

  let relX = (clientX - rect.left) / rect.width;
  relX = Math.max(0, Math.min(1, relX));

  const totalDuration = getChapterDuration();
  const targetChapterTime = relX * totalDuration;

  let accumulatedTime = 0;
  let targetSegIdx = 0;
  let targetAudioTime = appState.activeSegments[0].begin;

  for (let i = 0; i < appState.activeSegments.length; i++) {
    const seg = appState.activeSegments[i];
    const segDuration = seg.end - seg.begin;
    if (accumulatedTime + segDuration >= targetChapterTime) {
      targetSegIdx = i;
      targetAudioTime = seg.begin + (targetChapterTime - accumulatedTime);
      break;
    }
    accumulatedTime += segDuration;
    if (i === appState.activeSegments.length - 1) {
      targetSegIdx = i;
      targetAudioTime = seg.end - 0.1;
    }
  }

  showAudioLoading(true);

  const fileChanged = appState.activeSegmentIndex !== targetSegIdx;
  appState.activeSegmentIndex = targetSegIdx;

  if (fileChanged) {
    await playActiveSegment(targetAudioTime);
  } else {
    appState.audioElement.currentTime = targetAudioTime;
    showAudioLoading(false);
  }

  updateProgressUI();
  saveCurrentProgress();
}

function closeBook() {
  if (confirm("Voulez-vous fermer ce livre ? Votre progression est sauvegardée localement.")) {
    setPlayState(false);
    stopProgressSaver();
    saveCurrentProgress();
    
    appState.audioElement.src = '';
    appState.currentZip = null;
    appState.chapters = [];
    appState.currentChapterIndex = -1;
    appState.activeSegments = [];
    appState.activeSegmentIndex = -1;

    Object.values(appState.audioCache).forEach(url => {
      URL.revokeObjectURL(url);
    });
    appState.audioCache = {};

    document.getElementById('file-input').value = '';
    switchView('landing');
  }
}

function handleGlobalKeydown(e) {
  if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT') {
    return;
  }

  if (appState.currentChapterIndex === -1) return;

  switch (e.key) {
    case ' ':
      e.preventDefault();
      setPlayState(!appState.isPlaying);
      break;
    case 'ArrowLeft':
      e.preventDefault();
      adjustAudioTime(-10);
      break;
    case 'ArrowRight':
      e.preventDefault();
      adjustAudioTime(10);
      break;
    case 'ArrowUp':
      e.preventDefault();
      const volSliderUp = document.getElementById('slider-volume');
      const nextVolUp = Math.min(1.0, appState.volume + 0.1);
      appState.volume = nextVolUp;
      appState.audioElement.volume = nextVolUp;
      if (volSliderUp) volSliderUp.value = nextVolUp;
      localStorage.setItem('lumiere_volume', nextVolUp);
      break;
    case 'ArrowDown':
      e.preventDefault();
      const volSliderDown = document.getElementById('slider-volume');
      const nextVolDown = Math.max(0.0, appState.volume - 0.1);
      appState.volume = nextVolDown;
      appState.audioElement.volume = nextVolDown;
      if (volSliderDown) volSliderDown.value = nextVolDown;
      localStorage.setItem('lumiere_volume', nextVolDown);
      break;
  }
}

// ==========================================
// 8. HTML DOM RENDERING / DISPLAY CONTROLLERS
// ==========================================

function switchView(viewName) {
  const landingEl = document.getElementById('view-landing');
  const playerEl = document.getElementById('view-player');

  if (viewName === 'landing') {
    landingEl.style.display = 'grid';
    playerEl.style.display = 'none';
  } else if (viewName === 'player') {
    landingEl.style.display = 'none';
    playerEl.style.display = 'grid';
  }
}

function showLoading(show) {
  const loader = document.getElementById('loading-overlay');
  loader.style.display = show ? 'flex' : 'none';
}

function showAudioLoading(show) {
  const playBtn = document.getElementById('btn-play-pause');
  if (show) {
    playBtn.style.opacity = '0.5';
    playBtn.disabled = true;
  } else {
    playBtn.style.opacity = '1';
    playBtn.disabled = false;
  }
}

function renderPlaylist() {
  const listContainer = document.getElementById('chapters-list');
  listContainer.innerHTML = '';

  appState.chapters.forEach(chapter => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'playlist-item';
    btn.id = chapter.id;
    btn.setAttribute('role', 'option');
    btn.setAttribute('aria-selected', 'false');

    const indent = Math.max(0, (chapter.level - 1) * 12);
    btn.style.paddingLeft = `${16 + indent}px`;

    btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="playlist-item-icon">
        <circle cx="12" cy="12" r="10"></circle>
        <polygon points="10 8 16 12 10 16 10 8" fill="currentColor"></polygon>
      </svg>
      <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${chapter.title}</span>
    `;

    btn.addEventListener('click', () => {
      if (appState.currentChapterIndex === chapter.index) {
        setPlayState(!appState.isPlaying);
      } else {
        setPlayState(true);
        playChapter(chapter.index, 0);
      }
    });

    listContainer.appendChild(btn);
  });
}

function updatePlaylistActiveItem() {
  appState.chapters.forEach(chapter => {
    const el = document.getElementById(chapter.id);
    if (el) {
      if (chapter.index === appState.currentChapterIndex) {
        el.classList.add('active');
        el.setAttribute('aria-selected', 'true');
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        el.classList.remove('active');
        el.setAttribute('aria-selected', 'false');
      }
    }
  });
}

// ==========================================
// 9. ACCESSIBILITY SCREEN READER HELPERS & VIEWS
// ==========================================

function announceToScreenReader(message) {
  const announcer = document.getElementById('sr-announcer');
  if (announcer) {
    announcer.textContent = '';
    setTimeout(() => {
      announcer.textContent = message;
    }, 50);
  }
}

function togglePlayerMode(targetMode = null) {
  const playerGrid = document.getElementById('view-player');
  const btnToggle = document.getElementById('btn-toggle-mode');
  
  let nextMode = appState.playerMode === 'simple' ? 'full' : 'simple';
  if (targetMode !== null) {
    nextMode = targetMode;
  }
  
  appState.playerMode = nextMode;
  
  if (nextMode === 'simple') {
    playerGrid.classList.remove('player-mode-full');
    playerGrid.classList.add('player-mode-simple');
    btnToggle.querySelector('span').textContent = 'Lecteur complet';
    btnToggle.setAttribute('aria-label', 'Afficher le lecteur complet avec la liste des chapitres et les commandes de volume et vitesse');
    btnToggle.setAttribute('aria-expanded', 'false');
    announceToScreenReader("Passage au mode lecteur simple.");
  } else {
    playerGrid.classList.remove('player-mode-simple');
    playerGrid.classList.add('player-mode-full');
    btnToggle.querySelector('span').textContent = 'Lecteur simple';
    btnToggle.setAttribute('aria-label', 'Masquer la liste des chapitres et revenir au lecteur simple');
    btnToggle.setAttribute('aria-expanded', 'true');
    announceToScreenReader("Passage au mode lecteur complet.");
  }
}
