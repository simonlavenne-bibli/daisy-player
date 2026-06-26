/**
 * js/library.js — Logique métier de la bibliothèque persistante
 *
 * Ce module est la couche entre l'interface utilisateur (main.js / ui.js)
 * et la base de données (db.js). Il ne touche jamais au DOM directement.
 *
 * Responsabilités :
 *   - Importer un livre DAISY (ZIP) avec détection de doublons
 *   - Ouvrir un livre et restaurer sa progression
 *   - Sauvegarder la progression automatiquement pendant la lecture
 *   - Exposer la bibliothèque (tous les livres, livres récents, dernier livre)
 *   - Supprimer un livre
 *   - Fournir un résumé de l'état de la bibliothèque (pour le diagnostic)
 *
 * Dépendances :
 *   - js/db.js  (couche IndexedDB)
 *   - js/parser.js est appelé EN AMONT par main.js ; library.js reçoit
 *     le résultat déjà parsé (bookData) plutôt que le fichier brut.
 *
 * @module library
 */

import {
  initDB,
  addBook,
  updateBook,
  getBook,
  getAllBooks,
  getRecentBooks,
  getLastOpenedBook,
  touchBook,
  deleteBook,
  computeHash,
  findBookByHash,
  findBookByNccId,
  setBookHash,
  saveBookFile,
  getBookFile,
  hasBookFile,
  deleteBookFile,
  saveProgress,
  getProgress,
  resetProgress,
  getDefaultPlaybackRate,
  setDefaultPlaybackRate,
  getSettingValue,
  setSettingValue,
  initDefaultSettings,
} from './db.js';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — INITIALISATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialise la bibliothèque.
 * Doit être appelée une fois au démarrage, avant toute autre fonction.
 *
 * @returns {Promise<{ persisted: boolean }>}
 */
export async function initLibrary() {
  const result = await initDB();
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — IMPORT D'UN LIVRE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Importe un livre DAISY depuis un fichier ZIP.
 *
 * Séquence :
 *   1. Détection rapide de doublon via nccId (instantané)
 *   2. Création de l'entrée dans IndexedDB (bookId attribué sans attendre le hash)
 *   3. Sauvegarde du blob ZIP
 *   4. Calcul du SHA-256 en arrière-plan (non bloquant)
 *   5. Initialisation de la progression à zéro
 *
 * Résultat possible :
 *   { status: 'imported',  bookId, book, progress: null }
 *   { status: 'duplicate', bookId, book, progress }
 *
 * @param {File}   zipFile  — fichier ZIP sélectionné par l'utilisateur
 * @param {object} bookData — résultat de parseDaisyZip() (déjà appelé dans main.js)
 * @returns {Promise<ImportResult>}
 */
export async function importBook(zipFile, bookData) {
  // Étape 1 : détection rapide par nccId
  if (bookData.nccId) {
    const existing = await findBookByNccId(bookData.nccId);
    if (existing) {
      return _buildDuplicateResult(existing);
    }
  }

  // Étape 2 : création du livre
  const bookId = await addBook({
    title:         bookData.title         || 'Titre inconnu',
    author:        bookData.author        || 'Auteur inconnu',
    narrator:      bookData.narrator      ?? null,
    nccId:         bookData.nccId         ?? null,
    coverBlob:     bookData.coverBlob     ?? null,
    totalChapters: bookData.totalChapters ?? bookData.playlist?.length ?? 0,
    contentHash:   null,
  });

  // Étape 3 : sauvegarde du blob ZIP
  await saveBookFile(bookId, zipFile);

  // Étape 4 : hash en arrière-plan
  _computeAndStoreHash(bookId, zipFile);

  // Étape 5 : progression initiale
  const defaultRate = await getDefaultPlaybackRate();
  await resetProgressWithRate(bookId, defaultRate);

  const book = await getBook(bookId);
  return { status: 'imported', bookId, book, progress: null };
}

/**
 * Calcule et stocke le hash SHA-256 en arrière-plan.
 * Si un doublon est découvert tardivement, l'entrée redondante est supprimée.
 */
async function _computeAndStoreHash(bookId, zipBlob) {
  try {
    const hash = await computeHash(zipBlob);
    const existingByHash = await findBookByHash(hash);
    if (existingByHash && existingByHash.bookId !== bookId) {
      console.warn(
        `[Library] Doublon tardif détecté par hash. ` +
        `Conservation de ${existingByHash.bookId}, suppression de ${bookId}.`
      );
      await deleteBook(bookId);
      return;
    }
    await setBookHash(bookId, hash);
  } catch (err) {
    console.warn('[Library] Calcul du hash échoué (non bloquant) :', err);
  }
}

/**
 * Construit un résultat "doublon" avec la progression existante.
 */
async function _buildDuplicateResult(existingBook) {
  const progress = await getProgress(existingBook.bookId);
  return {
    status:   'duplicate',
    bookId:   existingBook.bookId,
    book:     existingBook,
    progress,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — OUVERTURE ET REPRISE D'UN LIVRE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ouvre un livre pour la lecture et restaure sa progression.
 * Met à jour lastOpenedAt dans la base.
 *
 * @param {string} bookId
 * @returns {Promise<{ book, progress, zipBlob }>}
 */
export async function openBook(bookId) {
  const book = await getBook(bookId);
  if (!book) throw new Error(`[Library] Livre introuvable : ${bookId}`);

  await touchBook(bookId);

  const [progress, zipBlob] = await Promise.all([
    getProgress(bookId),
    getBookFile(bookId),
  ]);

  return { book, progress, zipBlob };
}

/**
 * Retourne le dernier livre ouvert avec sa progression et la disponibilité du fichier.
 * Utilisé pour la section "Reprendre ma lecture".
 *
 * @returns {Promise<{ book, progress, hasFile }|null>}
 */
export async function getResumeData() {
  const book = await getLastOpenedBook();
  if (!book) return null;

  const [progress, fileAvailable] = await Promise.all([
    getProgress(book.bookId),
    hasBookFile(book.bookId),
  ]);

  return { book, progress, hasFile: fileAvailable };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — SAUVEGARDE DE LA PROGRESSION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sauvegarde la progression de lecture.
 * Appelée depuis le player toutes les 5 secondes via setInterval.
 *
 * @param {string} bookId
 * @param {object} state
 * @param {number}  state.chapterIndex
 * @param {number}  state.positionSeconds
 * @param {number}  state.totalChapters
 * @param {number}  state.playbackRate
 * @param {number}  [state.totalListenedSec]
 * @returns {Promise<void>}
 */
export async function saveReadingProgress(bookId, state) {
  const percentage = state.totalChapters > 0
    ? Math.round((state.chapterIndex / state.totalChapters) * 100)
    : 0;

  await saveProgress(bookId, {
    chapterIndex:     state.chapterIndex,
    positionSeconds:  state.positionSeconds,
    percentage,
    playbackRate:     state.playbackRate ?? 1.0,
    totalListenedSec: state.totalListenedSec ?? undefined,
  });
}

/**
 * Réinitialise la progression (lecture depuis le début).
 *
 * @param {string} bookId
 * @param {number} [rate]
 * @returns {Promise<void>}
 */
export async function resetProgressWithRate(bookId, rate) {
  const effectiveRate = rate ?? await getDefaultPlaybackRate();
  await saveProgress(bookId, {
    chapterIndex:     0,
    positionSeconds:  0,
    percentage:       0,
    playbackRate:     effectiveRate,
    totalListenedSec: 0,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — BIBLIOTHÈQUE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retourne tous les livres avec leur progression.
 *
 * @returns {Promise<Array<{ book, progress }>>}
 */
export async function getLibrary() {
  const books = await getAllBooks();
  const progressList = await Promise.all(books.map((b) => getProgress(b.bookId)));
  return books.map((book, i) => ({ book, progress: progressList[i] }));
}

/**
 * Retourne les N livres les plus récents avec leur progression.
 *
 * @param {number} [limit=5]
 * @returns {Promise<Array<{ book, progress }>>}
 */
export async function getRecentLibrary(limit = 5) {
  const books = await getRecentBooks(limit);
  const progressList = await Promise.all(books.map((b) => getProgress(b.bookId)));
  return books.map((book, i) => ({ book, progress: progressList[i] }));
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — SUPPRESSION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Supprime un livre complètement (métadonnées + fichier + progression + marque-pages).
 *
 * @param {string} bookId
 * @returns {Promise<void>}
 */
export async function removeBook(bookId) {
  await deleteBook(bookId);
}

/**
 * Supprime uniquement le fichier ZIP pour libérer de l'espace.
 * Conserve métadonnées, progression et marque-pages.
 *
 * @param {string} bookId
 * @returns {Promise<void>}
 */
export async function removeBookFile(bookId) {
  await deleteBookFile(bookId);
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7 — PRÉFÉRENCES DE LECTURE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retourne la vitesse de lecture pour un livre.
 * Priorité : valeur par livre > valeur globale par défaut.
 *
 * @param {string} bookId
 * @returns {Promise<number>}
 */
export async function getPlaybackRate(bookId) {
  const progress = await getProgress(bookId);
  if (progress?.playbackRate) return progress.playbackRate;
  return getDefaultPlaybackRate();
}

export { setDefaultPlaybackRate };

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8 — DIAGNOSTIC
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retourne un résumé complet de l'état de la bibliothèque.
 * Utilisé exclusivement par diagnostic.js.
 *
 * @returns {Promise<DiagnosticSummary>}
 */
export async function getDiagnosticSummary() {
  let dbStatus = 'OK';
  let books    = [];
  let progList = [];

  try {
    books    = await getAllBooks();
    progList = await Promise.all(books.map((b) => getProgress(b.bookId)));
  } catch (err) {
    dbStatus = `ERREUR : ${err.message}`;
  }

  let storageInfo = { usage: 0, quota: 0, available: 0, isLow: false };
  try {
    if (navigator.storage?.estimate) {
      const est   = await navigator.storage.estimate();
      const usage = est.usage ?? 0;
      const quota = est.quota ?? 0;
      storageInfo = {
        usage,
        quota,
        available: quota - usage,
        isLow: (quota - usage) < 300 * 1024 * 1024,
      };
    }
  } catch (_) {}

  let persisted = false;
  try {
    if (navigator.storage?.persisted) {
      persisted = await navigator.storage.persisted();
    }
  } catch (_) {}

  const defaultRate = await getDefaultPlaybackRate();
  const deviceId    = await getSettingValue('deviceId');

  const booksSummary = books.map((book, i) => {
    const prog = progList[i];
    return {
      bookId:        book.bookId,
      title:         book.title,
      author:        book.author,
      importedAt:    book.importedAt,
      lastOpenedAt:  book.lastOpenedAt,
      totalChapters: book.totalChapters,
      hasCover:      !!book.coverBlob,
      hasProgress:   !!prog,
      chapterIndex:  prog?.chapterIndex  ?? null,
      percentage:    prog?.percentage    ?? null,
      playbackRate:  prog?.playbackRate  ?? null,
    };
  });

  return {
    dbStatus,
    bookCount:           books.length,
    progressCount:       progList.filter(Boolean).length,
    persisted,
    storageUsedBytes:    storageInfo.usage,
    storageQuotaBytes:   storageInfo.quota,
    storageIsLow:        storageInfo.isLow,
    defaultPlaybackRate: defaultRate,
    deviceId,
    books:               booksSummary,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 9 — RÉ-EXPORTS UTILES
// ─────────────────────────────────────────────────────────────────────────────

export { getProgress, getBook, hasBookFile };
