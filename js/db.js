/**
 * js/db.js — Couche d'accès IndexedDB pour Lumière Audio
 *
 * Responsabilités :
 * - Ouvrir et migrer la base de données
 * - Fournir des fonctions CRUD pour les 5 stores
 * - Gérer la persistance du stockage (navigator.storage.persist)
 * - Surveiller le quota disponible
 * - Ne jamais toucher au DOM (zéro dépendance UI)
 *
 * Stores :
 * books        — métadonnées de chaque livre
 * book_files   — blobs ZIP binaires (store séparé pour pouvoir supprimer sans perdre la progression)
 * progress     — position de lecture, vitesse, temps écouté
 * bookmarks    — marque-pages manuels et automatiques (structure prête, UI à venir)
 * settings     — preferences globales (vitesse par défaut, thème, etc.)
 *
 * Compatibilité testée :
 * Chrome Desktop/Android, Edge, Safari macOS 14+, Safari iOS 15+
 *
 * @module db
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

/** Nom de la base IndexedDB */
const DB_NAME = 'lumiere-audio';

/**
 * Version du schéma.
 * Incrémenter cette valeur déclenche onupgradeneeded et permet la migration.
 * Historique : 1 = schéma initial complet
 */
const DB_VERSION = 1;

/**
 * Seuil d'espace libre minimum avant import (en octets).
 * En dessous, l'application avertit l'utilisateur avant d'écrire le blob ZIP.
 * 300 Mo est une valeur conservatrice qui couvre un livre audio de taille moyenne.
 */
const QUOTA_WARNING_THRESHOLD_BYTES = 300 * 1024 * 1024;

// ─────────────────────────────────────────────────────────────────────────────
// ÉTAT INTERNE DU MODULE
// ─────────────────────────────────────────────────────────────────────────────

/** Référence unique à la connexion IDBDatabase, partagée par toutes les fonctions */
let _db = null;

/** Promesse unique partagée pour gérer les ouvertures simultanées de la base */
let _openPromise = null;

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — INITIALISATION ET MIGRATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ouvre la base de données et effectue les migrations si nécessaire.
 * Gère correctement la concurrence au démarrage.
 *
 * @returns {Promise<IDBDatabase>}
 */
export function openDB() {
  if (_db) return Promise.resolve(_db);
  if (_openPromise) return _openPromise;

  _openPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    // Déclenché à la première ouverture ou lors d'une montée de version
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion;
      _migrate(db, oldVersion);
    };

    request.onsuccess = (event) => {
      _db = event.target.result; // Assigné immédiatement ici !
      resolve(_db);
    };

    request.onerror = (event) => {
      _openPromise = null; // Permet de retenter la connexion en cas d'échec
      reject(event.target.error);
    };

    // Connexion bloquée par un autre onglet encore ouvert sur une ancienne version
    request.onblocked = () => {
      console.warn('[DB] Mise à jour bloquée par un autre onglet. Veuillez fermer les autres onglets.');
    };
  });

  return _openPromise;
}

/**
 * Applique les migrations de schéma selon la version précédente.
 * Chaque bloc if crée les stores/index manquants pour sa version.
 * Les anciens stores ne sont jamais supprimés sauf migration explicite.
 *
 * @param {IDBDatabase} db
 * @param {number} oldVersion - Version avant la mise à jour (0 = première installation)
 */
function _migrate(db, oldVersion) {
  if (oldVersion < 1) {
    _createSchemaV1(db);
  }
}

/**
 * Crée le schéma complet version 1.
 * Appelé uniquement lors de la toute première installation.
 *
 * @param {IDBDatabase} db
 */
function _createSchemaV1(db) {
  // ── Store: books ──────────────────────────────────────────────────────────
  const booksStore = db.createObjectStore('books', { keyPath: 'bookId' });
  booksStore.createIndex('by_contentHash', 'contentHash', { unique: false });
  booksStore.createIndex('by_nccId', 'nccId', { unique: false });
  booksStore.createIndex('by_lastOpenedAt', 'lastOpenedAt', { unique: false });
  booksStore.createIndex('by_importedAt', 'importedAt', { unique: false });

  // ── Store: book_files ─────────────────────────────────────────────────────
  db.createObjectStore('book_files', { keyPath: 'bookId' });

  // ── Store: progress ───────────────────────────────────────────────────────
  const progressStore = db.createObjectStore('progress', { keyPath: 'bookId' });
  progressStore.createIndex('by_percentage', 'percentage', { unique: false });

  // ── Store: bookmarks ──────────────────────────────────────────────────────
  const bookmarksStore = db.createObjectStore('bookmarks', { keyPath: 'id' });
  bookmarksStore.createIndex('by_bookId', 'bookId', { unique: false });
  bookmarksStore.createIndex('by_type', 'type', { unique: false });

  // ── Store: settings ───────────────────────────────────────────────────────
  db.createObjectStore('settings', { keyPath: 'key' });

  console.log('[DB] Schéma v1 créé.');
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — UTILITAIRES INTERNES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Raccourci pour ouvrir une transaction et obtenir un store.
 *
 * @param {string|string[]} storeNames - Nom(s) du ou des stores
 * @param {'readonly'|'readwrite'} mode
 * @returns {{ tx: IDBTransaction, stores: IDBObjectStore[] }}
 */
function _tx(storeNames, mode = 'readonly') {
  const db = _db;
  if (!db) throw new Error('[DB] Base non initialisée. Appeler openDB() en premier.');
  const names = Array.isArray(storeNames) ? storeNames : [storeNames];
  const tx = db.transaction(names, mode);
  const stores = names.map((n) => tx.objectStore(n));
  return { tx, stores: stores.length === 1 ? stores[0] : stores };
}

/**
 * Enveloppe une requête IDB dans une Promise.
 *
 * @param {IDBRequest} request
 * @returns {Promise<any>}
 */
function _req(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror   = (e) => reject(e.target.error);
  });
}

/**
 * Génère un UUID v4 sans dépendance externe.
 *
 * @returns {string} UUID v4
 */
function _uuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
    (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — GESTION DU STOCKAGE ET DU QUOTA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Demande le stockage persistant au navigateur.
 *
 * @returns {Promise<boolean>}
 */
export async function requestPersistentStorage() {
  if (!navigator.storage || !navigator.storage.persist) return false;

  try {
    const isPersisted = await navigator.storage.persisted();
    if (isPersisted) return true;

    const granted = await navigator.storage.persist();
    if (granted) {
      console.log('[DB] Stockage persistant accordé.');
    } else {
      console.warn('[DB] Stockage persistant refusé ou non supporté (comportement normal sur Safari iOS).');
    }
    return granted;
  } catch (err) {
    console.warn('[DB] Erreur lors de la demande de persistance :', err);
    return false;
  }
}

/**
 * Estime l'espace de stockage disponible.
 *
 * @returns {Promise<object>}
 */
export async function getStorageEstimate() {
  if (!navigator.storage || !navigator.storage.estimate) {
    return { usage: 0, quota: Infinity, available: Infinity, isLow: false };
  }

  try {
    const estimate = await navigator.storage.estimate();
    const usage     = estimate.usage  ?? 0;
    const quota     = estimate.quota  ?? Infinity;
    const available = quota - usage;
    const isLow     = available < QUOTA_WARNING_THRESHOLD_BYTES;

    if (isLow) {
      console.warn(`[DB] Espace faible : ${Math.round(available / 1024 / 1024)} Mo disponibles.`);
    }

    return { usage, quota, available, isLow };
  } catch (err) {
    console.warn('[DB] Impossible d\'estimer le quota :', err);
    return { usage: 0, quota: Infinity, available: Infinity, isLow: false };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — STORE: books
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Insère un nouveau livre dans le store books.
 *
 * @param {object} metadata
 * @returns {Promise<string>} bookId généré
 */
export async function addBook(metadata) {
  await openDB(); // Sécurisation
  const now    = Date.now();
  const bookId = _uuid();

  const book = {
    bookId,
    contentHash:   metadata.contentHash   ?? null,
    nccId:         metadata.nccId         ?? null,
    title:         metadata.title         || 'Titre inconnu',
    author:        metadata.author        || 'Auteur inconnu',
    narrator:      metadata.narrator      ?? null,
    coverBlob:     metadata.coverBlob     ?? null,
    totalChapters: metadata.totalChapters ?? 0,
    importedAt:    now,
    lastOpenedAt:  now,
    schemaVersion: 1,
    syncedAt:      null,
    deviceId:      await getSettingValue('deviceId') ?? null,
  };

  const store = _tx('books', 'readwrite').stores;
  await _req(store.put(book));

  return bookId;
}

/**
 * Met à jour les métadonnées d'un livre existant.
 *
 * @param {string} bookId
 * @param {Partial<book>} changes
 * @returns {Promise<void>}
 */
export async function updateBook(bookId, changes) {
  await openDB(); // Sécurisation
  const store = _tx('books', 'readwrite').stores;
  const existing = await _req(store.get(bookId));
  if (!existing) throw new Error(`[DB] Livre non trouvé : ${bookId}`);
  await _req(store.put({ ...existing, ...changes, bookId }));
}

/**
 * Récupère un livre par son bookId.
 *
 * @param {string} bookId
 * @returns {Promise<object|undefined>}
 */
export async function getBook(bookId) {
  await openDB(); // Sécurisation
  const store = _tx('books').stores;
  return _req(store.get(bookId));
}

/**
 * Retourne tous les livres triés par dernière ouverture.
 *
 * @returns {Promise<array>}
 */
export async function getAllBooks() {
  await openDB(); // Sécurisation
  const store = _tx('books').stores;
  const index = store.index('by_lastOpenedAt');
  const books = await _req(index.getAll());
  return books.reverse();
}

/**
 * Retourne les N livres les plus récemment ouverts.
 *
 * @param {number} [limit=5]
 * @returns {Promise<array>}
 */
export async function getRecentBooks(limit = 5) {
  const all = await getAllBooks();
  return all.slice(0, limit);
}

/**
 * Retourne le livre ouvert le plus récemment.
 *
 * @returns {Promise<object|null>}
 */
export async function getLastOpenedBook() {
  const recent = await getRecentBooks(1);
  return recent[0] ?? null;
}

/**
 * Met à jour la date de dernière ouverture d'un livre.
 *
 * @param {string} bookId
 * @returns {Promise<void>}
 */
export async function touchBook(bookId) {
  await updateBook(bookId, { lastOpenedAt: Date.now() });
}

/**
 * Supprime un livre ET son fichier ZIP ET sa progression ET ses marque-pages.
 *
 * @param {string} bookId
 * @returns {Promise<void>}
 */
export async function deleteBook(bookId) {
  await openDB(); // Sécurisation
  const { tx, stores } = _tx(
    ['books', 'book_files', 'progress', 'bookmarks'],
    'readwrite'
  );
  const [booksStore, filesStore, progressStore, bookmarksStore] = stores;

  booksStore.delete(bookId);
  filesStore.delete(bookId);
  progressStore.delete(bookId);

  const bookmarkIndex = bookmarksStore.index('by_bookId');
  const bookmarkKeys  = await _req(bookmarkIndex.getAllKeys(bookId));
  for (const key of bookmarkKeys) {
    bookmarksStore.delete(key);
  }

  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror    = (e) => reject(e.target.error);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — DÉDUPLICATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcule le SHA-256 d'un Blob ou ArrayBuffer.
 *
 * @param {Blob|ArrayBuffer} data
 * @returns {Promise<string>}
 */
export async function computeHash(data) {
  const buffer = data instanceof Blob ? await data.arrayBuffer() : data;
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray  = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Recherche un livre existant par son hash SHA-256.
 *
 * @param {string} contentHash
 * @returns {Promise<object|null>}
 */
export async function findBookByHash(contentHash) {
  await openDB(); // Sécurisation
  const store  = _tx('books').stores;
  const index  = store.index('by_contentHash');
  const result = await _req(index.getAll(contentHash));
  return result[0] ?? null;
}

/**
 * Recherche un livre existant par son identifiant DAISY (dc:identifier).
 *
 * @param {string} nccId
 * @returns {Promise<object|null>}
 */
export async function findBookByNccId(nccId) {
  if (!nccId) return null;
  await openDB(); // Sécurisation
  const store  = _tx('books').stores;
  const index  = store.index('by_nccId');
  const result = await _req(index.getAll(nccId));
  return result[0] ?? null;
}

/**
 * Met à jour le contentHash d'un livre après calcul en arrière-plan.
 *
 * @param {string} bookId
 * @param {string} contentHash
 * @returns {Promise<void>}
 */
export async function setBookHash(bookId, contentHash) {
  await updateBook(bookId, { contentHash });
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — STORE: book_files
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sauvegarde le fichier ZIP d'un livre dans IndexedDB.
 *
 * @param {string} bookId
 * @param {Blob}   zipBlob
 * @returns {Promise<void>}
 */
export async function saveBookFile(bookId, zipBlob) {
  await openDB(); // Sécurisation
  const store = _tx('book_files', 'readwrite').stores;
  await _req(store.put({
    bookId,
    zipBlob,
    storedAt:  Date.now(),
    sizeBytes: zipBlob.size,
  }));
}

/**
 * Récupère le blob ZIP d'un livre.
 *
 * @param {string} bookId
 * @returns {Promise<Blob|null>}
 */
export async function getBookFile(bookId) {
  await openDB(); // Sécurisation
  const store  = _tx('book_files').stores;
  const record = await _req(store.get(bookId));
  return record?.zipBlob ?? null;
}

/**
 * Vérifie si le fichier ZIP d'un livre est disponible dans IndexedDB.
 *
 * @param {string} bookId
 * @returns {Promise<boolean>}
 */
export async function hasBookFile(bookId) {
  await openDB(); // Sécurisation
  const store  = _tx('book_files').stores;
  const record = await _req(store.get(bookId));
  return record != null;
}

/**
 * Supprime uniquement le fichier ZIP d'un livre.
 *
 * @param {string} bookId
 * @returns {Promise<void>}
 */
export async function deleteBookFile(bookId) {
  await openDB(); // Sécurisation
  const store = _tx('book_files', 'readwrite').stores;
  await _req(store.delete(bookId));
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7 — STORE: progress
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sauvegarde ou met à jour la progression de lecture d'un livre.
 *
 * @param {string} bookId
 * @param {object} data
 * @returns {Promise<void>}
 */
export async function saveProgress(bookId, data) {
  await openDB(); // Sécurisation
  const existing = await getProgress(bookId);

  const store = _tx('progress', 'readwrite').stores;
  await _req(store.put({
    bookId,
    chapterIndex:     data.chapterIndex,
    positionSeconds:  data.positionSeconds,
    percentage:       Math.min(100, Math.max(0, data.percentage)),
    savedAt:          Date.now(),
    playbackRate:     data.playbackRate      ?? 1.0,
    totalListenedSec: data.totalListenedSec ?? (existing?.totalListenedSec ?? 0),
  }));
}

/**
 * Récupère la progression d'un livre.
 *
 * @param {string} bookId
 * @returns {Promise<object|null>}
 */
export async function getProgress(bookId) {
  await openDB(); // Sécurisation
  const store  = _tx('progress').stores;
  const record = await _req(store.get(bookId));
  return record ?? null;
}

/**
 * Réinitialise la progression d'un livre.
 *
 * @param {string} bookId
 * @returns {Promise<void>}
 */
export async function resetProgress(bookId) {
  await saveProgress(bookId, {
    chapterIndex:    0,
    positionSeconds: 0,
    percentage:      0,
    playbackRate:    await getDefaultPlaybackRate(),
    totalListenedSec: 0,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8 — STORE: bookmarks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ajoute un marque-page.
 *
 * @param {string} bookId
 * @param {object} data
 * @returns {Promise<string>} id du marque-page créé
 */
export async function addBookmark(bookId, data) {
  await openDB(); // Sécurisation
  const id    = _uuid();
  const store = _tx('bookmarks', 'readwrite').stores;
  await _req(store.put({
    id,
    bookId,
    chapterIndex:    data.chapterIndex,
    positionSeconds: data.positionSeconds,
    label:           data.label ?? null,
    type:            data.type  ?? 'manual',
    createdAt:       Date.now(),
  }));
  return id;
}

/**
 * Retourne tous les marque-pages d'un livre, triés par position.
 *
 * @param {string} bookId
 * @returns {Promise<array>}
 */
export async function getBookmarks(bookId) {
  await openDB(); // Sécurisation
  const store  = _tx('bookmarks').stores;
  const index  = store.index('by_bookId');
  const marks  = await _req(index.getAll(bookId));
  return marks.sort((a, b) =>
    a.chapterIndex !== b.chapterIndex
      ? a.chapterIndex - b.chapterIndex
      : a.positionSeconds - b.positionSeconds
  );
}

/**
 * Supprime un marque-page par son id.
 *
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteBookmark(id) {
  await openDB(); // Sécurisation
  const store = _tx('bookmarks', 'readwrite').stores;
  await _req(store.delete(id));
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 9 — STORE: settings
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lit une valeur dans le store settings.
 *
 * @param {string} key
 * @returns {Promise<any>}
 */
export async function getSettingValue(key) {
  await openDB(); // Sécurisation
  const store  = _tx('settings').stores;
  const record = await _req(store.get(key));
  return record?.value;
}

/**
 * Écrit une valeur dans le store settings.
 *
 * @param {string} key
 * @param {any}    value
 * @returns {Promise<void>}
 */
export async function setSettingValue(key, value) {
  await openDB(); // Sécurisation
  const store = _tx('settings', 'readwrite').stores;
  await _req(store.put({ key, value }));
}

/**
 * Lit la vitesse de lecture par défaut.
 *
 * @returns {Promise<number>}
 */
export async function getDefaultPlaybackRate() {
  return (await getSettingValue('defaultPlaybackRate')) ?? 1.0;
}

/**
 * Définit la vitesse de lecture par défaut (globale).
 *
 * @param {number} rate
 * @returns {Promise<void>}
 */
export async function setDefaultPlaybackRate(rate) {
  const clamped = Math.min(2.0, Math.max(0.5, rate));
  await setSettingValue('defaultPlaybackRate', clamped);
}

/**
 * Initialise les settings obligatoires au premier lancement.
 *
 * @returns {Promise<void>}
 */
export async function initDefaultSettings() {
  const existingDeviceId = await getSettingValue('deviceId');
  if (!existingDeviceId) {
    await setSettingValue('deviceId', _uuid());
  }

  const existingRate = await getSettingValue('defaultPlaybackRate');
  if (existingRate === undefined) {
    await setSettingValue('defaultPlaybackRate', 1.0);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 10 — EXPORT / IMPORT DES DONNÉES UTILISATEUR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exporte toutes les données utilisateur au format JSON.
 *
 * @returns {Promise<object>}
 */
export async function exportData() {
  const deviceId = await getSettingValue('deviceId');
  await setSettingValue('lastExportedAt', Date.now());

  const [books, progress, bookmarks, settingsRaw] = await Promise.all([
    getAllBooks(),
    _getAllFromStore('progress'),
    _getAllFromStore('bookmarks'),
    _getAllFromStore('settings'),
  ]);

  const booksClean = books.map(({ coverBlob: _ignored, ...rest }) => rest);

  return {
    exportVersion: 1,
    exportedAt:    Date.now(),
    deviceId,
    books:         booksClean,
    progress,
    bookmarks,
    settings:      settingsRaw,
    files:         'excluded',
  };
}

/**
 * Importe des données utilisateur depuis un objet JSON exporté.
 *
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function importData(data) {
  if (!data || data.exportVersion !== 1) {
    throw new Error('[DB] Format d\'export non reconnu ou version incompatible.');
  }

  let imported = 0;
  let skipped  = 0;

  for (const book of (data.books ?? [])) {
    const existing = await getBook(book.bookId);
    if (!existing) {
      await openDB();
      const store = _tx('books', 'readwrite').stores;
      await _req(store.put({ ...book, coverBlob: null }));
      imported++;
    } else {
      skipped++;
    }
  }

  for (const prog of (data.progress ?? [])) {
    await openDB();
    const store = _tx('progress', 'readwrite').stores;
    await _req(store.put(prog));
  }

  for (const mark of (data.bookmarks ?? [])) {
    await openDB();
    const store = _tx('bookmarks', 'readwrite').stores;
    await _req(store.put(mark));
  }

  return { imported, skipped };
}

/**
 * Utilitaire interne : retourne toutes les entrées d'un store.
 *
 * @param {string} storeName
 * @returns {Promise<any[]>}
 */
async function _getAllFromStore(storeName) {
  await openDB(); // Sécurisation
  const store = _tx(storeName).stores;
  return _req(store.getAll());
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 11 — POINT D'ENTRÉE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialise complètement la couche base de données.
 *
 * @returns {Promise<{ persisted: boolean }>}
 */
export async function initDB() {
  await openDB();
  await initDefaultSettings();
  const persisted = await requestPersistentStorage();
  console.log(`[DB] Initialisée. Persistance : ${persisted ? 'accordée' : 'non garantie'}.`);
  return { persisted };
}
