/**
 * js/db.js — Couche d'accès IndexedDB pour Lumière Audio
 *
 * Responsabilités :
 *   - Ouvrir et migrer la base de données
 *   - Fournir des fonctions CRUD pour les 5 stores
 *   - Gérer la persistance du stockage (navigator.storage.persist)
 *   - Surveiller le quota disponible
 *   - Ne jamais toucher au DOM (zéro dépendance UI)
 *
 * Stores :
 *   books        — métadonnées de chaque livre
 *   book_files   — blobs ZIP binaires (store séparé pour pouvoir supprimer sans perdre la progression)
 *   progress     — position de lecture, vitesse, temps écouté
 *   bookmarks    — marque-pages manuels et automatiques (structure prête, UI à venir)
 *   settings     — préférences globales (vitesse par défaut, thème, etc.)
 *
 * Compatibilité testée :
 *   Chrome Desktop/Android, Edge, Safari macOS 14+, Safari iOS 15+
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

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — INITIALISATION ET MIGRATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ouvre la base de données et effectue les migrations si nécessaire.
 * Doit être appelée une seule fois au démarrage de l'application (dans main.js).
 * Les appels suivants retournent immédiatement la connexion existante.
 *
 * @returns {Promise<IDBDatabase>}
 */
export async function openDB() {
  if (_db) return _db;

  _db = await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    // Déclenché à la première ouverture ou lors d'une montée de version
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion;
      _migrate(db, oldVersion);
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror  = (event) => reject(event.target.error);

    // Connexion bloquée par un autre onglet encore ouvert sur une ancienne version
    request.onblocked = () => {
      console.warn('[DB] Mise à jour bloquée par un autre onglet. Veuillez fermer les autres onglets.');
    };
  });

  return _db;
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
  // Versions futures : if (oldVersion < 2) { _migrateToV2(db); }
}

/**
 * Crée le schéma complet version 1.
 * Appelé uniquement lors de la toute première installation.
 *
 * @param {IDBDatabase} db
 */
function _createSchemaV1(db) {

  // ── Store: books ──────────────────────────────────────────────────────────
  // Métadonnées de chaque livre. Clé primaire : bookId (UUID v4).
  const booksStore = db.createObjectStore('books', { keyPath: 'bookId' });

  // Index pour la déduplication par hash du fichier ZIP
  booksStore.createIndex('by_contentHash', 'contentHash', { unique: false });

  // Index pour la déduplication par identifiant DAISY standard (dc:identifier dans ncc.html)
  // non-unique car le champ peut être absent (null) pour plusieurs livres
  booksStore.createIndex('by_nccId', 'nccId', { unique: false });

  // Index pour trier par dernière ouverture → "livres récents"
  // C'est l'index le plus sollicité : utilisé à chaque démarrage
  booksStore.createIndex('by_lastOpenedAt', 'lastOpenedAt', { unique: false });

  // Index pour trier par date d'import → tri alternatif dans la bibliothèque
  booksStore.createIndex('by_importedAt', 'importedAt', { unique: false });

  // ── Store: book_files ─────────────────────────────────────────────────────
  // Contenu binaire (blob ZIP). Séparé de books pour deux raisons :
  //   1. Permet de supprimer le fichier sans perdre les métadonnées ni la progression
  //   2. Les reads de métadonnées n'ont jamais besoin de charger les blobs en mémoire
  db.createObjectStore('book_files', { keyPath: 'bookId' });
  // Pas d'index secondaire : on accède toujours par bookId

  // ── Store: progress ───────────────────────────────────────────────────────
  // Position de lecture. Écrit toutes les ~5 secondes pendant la lecture.
  // Clé primaire : bookId (une seule entrée de progression par livre).
  const progressStore = db.createObjectStore('progress', { keyPath: 'bookId' });

  // Index utile pour trouver les livres dont la lecture est avancée (> X %)
  progressStore.createIndex('by_percentage', 'percentage', { unique: false });

  // ── Store: bookmarks ──────────────────────────────────────────────────────
  // Marque-pages manuels et automatiques.
  // Store créé maintenant pour éviter une migration de schéma ultérieure.
  // L'UI des marque-pages n'est pas encore implémentée mais la structure est prête.
  const bookmarksStore = db.createObjectStore('bookmarks', { keyPath: 'id' });

  // Index pour récupérer tous les marque-pages d'un livre donné
  bookmarksStore.createIndex('by_bookId', 'bookId', { unique: false });

  // Index pour filtrer par type (manual / auto)
  bookmarksStore.createIndex('by_type', 'type', { unique: false });

  // ── Store: settings ───────────────────────────────────────────────────────
  // Préférences globales de l'utilisateur.
  // Stockage clé-valeur simple (keyPath: 'key', value: 'value').
  // Valeurs attendues : defaultPlaybackRate, theme, lastExportedAt, etc.
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
 * Utilise crypto.randomUUID() si disponible (Chrome 92+, Safari 15.4+, Firefox 95+),
 * sinon utilise un fallback basé sur crypto.getRandomValues().
 *
 * @returns {string} UUID v4, ex: "f47ac10b-58cc-4372-a567-0e02b2c3d479"
 */
function _uuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback pour Safari < 15.4
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
    (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — GESTION DU STOCKAGE ET DU QUOTA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Demande le stockage persistant au navigateur.
 * Sans persistance, le navigateur peut expulser les données IndexedDB sous pression.
 * Particulièrement important sur Safari iOS (règle ITP des 7 jours).
 *
 * @returns {Promise<boolean>} true si la persistance est accordée, false sinon
 */
export async function requestPersistentStorage() {
  if (!navigator.storage || !navigator.storage.persist) {
    // API non disponible (très ancien navigateur) — on continue sans garantie
    return false;
  }

  try {
    const isPersisted = await navigator.storage.persisted();
    if (isPersisted) return true; // Déjà accordé

    const granted = await navigator.storage.persist();
    if (granted) {
      console.log('[DB] Stockage persistant accordé.');
    } else {
      // Sur Safari iOS, persist() retourne toujours false même si les données
      // sont conservées. Ce n'est pas bloquant mais on le signale.
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
 * Retourne un objet avec usage, quota, et un flag d'alerte si l'espace est insuffisant.
 *
 * @returns {Promise<{
 *   usage: number,        — octets utilisés par l'origine
 *   quota: number,        — quota total accordé
 *   available: number,    — octets disponibles estimés
 *   isLow: boolean        — true si < QUOTA_WARNING_THRESHOLD_BYTES
 * }>}
 */
export async function getStorageEstimate() {
  if (!navigator.storage || !navigator.storage.estimate) {
    // API non disponible : on retourne des valeurs fictives non-bloquantes
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
 * N'écrit PAS le fichier ZIP (c'est le rôle de saveBookFile).
 *
 * Structure complète d'un objet book :
 * {
 *   bookId:         string,   — UUID v4, généré ici
 *   contentHash:    string|null, — SHA-256 du ZIP, calculé en arrière-plan
 *   nccId:          string|null, — dc:identifier extrait du ncc.html
 *   title:          string,
 *   author:         string,
 *   narrator:       string|null,
 *   coverBlob:      Blob|null,
 *   totalChapters:  number,
 *   importedAt:     number,   — timestamp ms
 *   lastOpenedAt:   number,   — timestamp ms (= importedAt à la création)
 *   schemaVersion:  number,   — toujours 1 pour cette version
 *   syncedAt:       null,     — réservé pour la synchronisation cloud future
 *   deviceId:       string,   — UUID de l'appareil pour la sync future
 * }
 *
 * @param {Omit<book, 'bookId'|'importedAt'|'lastOpenedAt'|'schemaVersion'|'syncedAt'>} metadata
 * @returns {Promise<string>} bookId généré
 */
export async function addBook(metadata) {
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
    // deviceId fixe pour cet appareil, persisté dans settings
    deviceId:      await getSettingValue('deviceId') ?? null,
  };

  const store = _tx('books', 'readwrite').stores;
  await _req(store.put(book));

  return bookId;
}

/**
 * Met à jour les métadonnées d'un livre existant (merge partiel).
 * Seules les clés présentes dans `changes` sont modifiées.
 *
 * @param {string} bookId
 * @param {Partial<book>} changes
 * @returns {Promise<void>}
 */
export async function updateBook(bookId, changes) {
  const store = _tx('books', 'readwrite').stores;
  const existing = await _req(store.get(bookId));
  if (!existing) throw new Error(`[DB] Livre non trouvé : ${bookId}`);
  await _req(store.put({ ...existing, ...changes, bookId }));
}

/**
 * Récupère un livre par son bookId.
 *
 * @param {string} bookId
 * @returns {Promise<book|undefined>}
 */
export async function getBook(bookId) {
  const store = _tx('books').stores;
  return _req(store.get(bookId));
}

/**
 * Retourne tous les livres triés par dernière ouverture (plus récent en premier).
 * Utilisé pour la vue bibliothèque complète.
 *
 * @returns {Promise<book[]>}
 */
export async function getAllBooks() {
  const store = _tx('books').stores;
  const index = store.index('by_lastOpenedAt');

  // IDBIndex.getAll() retourne les entrées dans l'ordre croissant de la clé d'index.
  // On inverse le résultat pour avoir le plus récent en premier.
  const books = await _req(index.getAll());
  return books.reverse();
}

/**
 * Retourne les N livres les plus récemment ouverts.
 * Implémente la fonctionnalité "Livres récents".
 *
 * @param {number} [limit=5]
 * @returns {Promise<book[]>}
 */
export async function getRecentBooks(limit = 5) {
  const all = await getAllBooks();
  return all.slice(0, limit);
}

/**
 * Retourne le livre ouvert le plus récemment.
 * Utilisé pour la section "Reprendre ma lecture" sur l'écran d'accueil.
 *
 * @returns {Promise<book|null>}
 */
export async function getLastOpenedBook() {
  const recent = await getRecentBooks(1);
  return recent[0] ?? null;
}

/**
 * Met à jour la date de dernière ouverture d'un livre.
 * À appeler à chaque fois que l'utilisateur ouvre un livre.
 *
 * @param {string} bookId
 * @returns {Promise<void>}
 */
export async function touchBook(bookId) {
  await updateBook(bookId, { lastOpenedAt: Date.now() });
}

/**
 * Supprime un livre ET son fichier ZIP ET sa progression ET ses marque-pages.
 * Opération atomique dans une transaction multi-stores.
 *
 * @param {string} bookId
 * @returns {Promise<void>}
 */
export async function deleteBook(bookId) {
  const { tx, stores } = _tx(
    ['books', 'book_files', 'progress', 'bookmarks'],
    'readwrite'
  );
  const [booksStore, filesStore, progressStore, bookmarksStore] = stores;

  // Suppression des stores simples (clé primaire = bookId)
  booksStore.delete(bookId);
  filesStore.delete(bookId);
  progressStore.delete(bookId);

  // Suppression des marque-pages liés (index, pas de clé directe)
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
 * Utilisé pour la détection de doublons à l'import.
 * Cette opération peut prendre 1 à 5 secondes sur un fichier de 300 Mo — à appeler
 * en arrière-plan après avoir déjà affiché un indicateur de chargement.
 *
 * @param {Blob|ArrayBuffer} data
 * @returns {Promise<string>} hash hexadécimal, ex: "a3f5..."
 */
export async function computeHash(data) {
  const buffer = data instanceof Blob ? await data.arrayBuffer() : data;
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray  = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Recherche un livre existant par son hash SHA-256.
 * Retourne le premier livre trouvé ou null.
 *
 * @param {string} contentHash
 * @returns {Promise<book|null>}
 */
export async function findBookByHash(contentHash) {
  const store  = _tx('books').stores;
  const index  = store.index('by_contentHash');
  const result = await _req(index.getAll(contentHash));
  return result[0] ?? null;
}

/**
 * Recherche un livre existant par son identifiant DAISY (dc:identifier).
 * Second mécanisme de déduplication, complémentaire au hash.
 *
 * @param {string} nccId
 * @returns {Promise<book|null>}
 */
export async function findBookByNccId(nccId) {
  if (!nccId) return null;
  const store  = _tx('books').stores;
  const index  = store.index('by_nccId');
  const result = await _req(index.getAll(nccId));
  return result[0] ?? null;
}

/**
 * Met à jour le contentHash d'un livre après calcul en arrière-plan.
 * Appelée par library.js une fois le hash disponible.
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
 * Le blob est stocké tel quel, sans transformation.
 *
 * @param {string} bookId
 * @param {Blob}   zipBlob
 * @returns {Promise<void>}
 */
export async function saveBookFile(bookId, zipBlob) {
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
 * Retourne null si le fichier n'a pas été stocké (ou a été supprimé).
 *
 * @param {string} bookId
 * @returns {Promise<Blob|null>}
 */
export async function getBookFile(bookId) {
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
  const store  = _tx('book_files').stores;
  const record = await _req(store.get(bookId));
  return record != null;
}

/**
 * Supprime uniquement le fichier ZIP d'un livre, en conservant
 * les métadonnées, la progression et les marque-pages.
 * Utile pour libérer de l'espace disque sans perdre la position de lecture.
 *
 * @param {string} bookId
 * @returns {Promise<void>}
 */
export async function deleteBookFile(bookId) {
  const store = _tx('book_files', 'readwrite').stores;
  await _req(store.delete(bookId));
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7 — STORE: progress
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sauvegarde ou met à jour la progression de lecture d'un livre.
 * Conçu pour être appelé fréquemment (toutes les 5 secondes pendant la lecture)
 * sans impacter les performances grâce à IndexedDB put() qui écrase l'entrée.
 *
 * Structure complète d'un objet progress :
 * {
 *   bookId:            string,  — FK → books.bookId
 *   chapterIndex:      number,  — index du chapitre courant (0-based)
 *   positionSeconds:   number,  — position exacte dans le chapitre
 *   percentage:        number,  — 0–100, progression globale calculée
 *   savedAt:           number,  — timestamp ms de la dernière sauvegarde
 *   playbackRate:      number,  — vitesse de lecture (0.5, 0.75, 1, 1.25, 1.5, 2)
 *   totalListenedSec:  number,  — temps total écouté (cumul, pour statistiques futures)
 * }
 *
 * @param {string} bookId
 * @param {object} data
 * @param {number} data.chapterIndex
 * @param {number} data.positionSeconds
 * @param {number} data.percentage       — valeur 0–100
 * @param {number} data.playbackRate     — ex: 1.0, 1.25, 1.5
 * @param {number} [data.totalListenedSec] — optionnel, cumulé par le player
 * @returns {Promise<void>}
 */
export async function saveProgress(bookId, data) {
  // Récupère la progression existante pour cumuler totalListenedSec
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
 * Retourne null si aucune progression n'a encore été sauvegardée.
 *
 * @param {string} bookId
 * @returns {Promise<progress|null>}
 */
export async function getProgress(bookId) {
  const store  = _tx('progress').stores;
  const record = await _req(store.get(bookId));
  return record ?? null;
}

/**
 * Réinitialise la progression d'un livre (lecture depuis le début).
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
// Le store est créé et les fonctions sont exposées dès maintenant.
// L'interface utilisateur des marque-pages sera implémentée dans une phase ultérieure.

/**
 * Ajoute un marque-page.
 *
 * @param {string} bookId
 * @param {object} data
 * @param {number}  data.chapterIndex
 * @param {number}  data.positionSeconds
 * @param {string}  [data.label]      — libellé optionnel saisi par l'utilisateur
 * @param {'manual'|'auto'} [data.type='manual']
 * @returns {Promise<string>} id du marque-page créé
 */
export async function addBookmark(bookId, data) {
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
 * @returns {Promise<bookmark[]>}
 */
export async function getBookmarks(bookId) {
  const store  = _tx('bookmarks').stores;
  const index  = store.index('by_bookId');
  const marks  = await _req(index.getAll(bookId));
  // Tri par chapitre puis par position dans le chapitre
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
  const store = _tx('bookmarks', 'readwrite').stores;
  await _req(store.delete(id));
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 9 — STORE: settings
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lit une valeur dans le store settings.
 * Retourne undefined si la clé n'existe pas.
 *
 * @param {string} key
 * @returns {Promise<any>}
 */
export async function getSettingValue(key) {
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
  const store = _tx('settings', 'readwrite').stores;
  await _req(store.put({ key, value }));
}

/**
 * Lit la vitesse de lecture par défaut.
 * Retourne 1.0 si non définie.
 *
 * @returns {Promise<number>}
 */
export async function getDefaultPlaybackRate() {
  return (await getSettingValue('defaultPlaybackRate')) ?? 1.0;
}

/**
 * Définit la vitesse de lecture par défaut (globale).
 *
 * @param {number} rate — valeur entre 0.5 et 2.0
 * @returns {Promise<void>}
 */
export async function setDefaultPlaybackRate(rate) {
  const clamped = Math.min(2.0, Math.max(0.5, rate));
  await setSettingValue('defaultPlaybackRate', clamped);
}

/**
 * Initialise les settings obligatoires au premier lancement.
 * Appelée par openDB() après la création du schéma, ou au démarrage si les
 * valeurs sont absentes (upgrade depuis une version sans settings).
 *
 * @returns {Promise<void>}
 */
export async function initDefaultSettings() {
  // deviceId : identifiant stable de cet appareil, pour la sync cloud future
  const existingDeviceId = await getSettingValue('deviceId');
  if (!existingDeviceId) {
    await setSettingValue('deviceId', _uuid());
  }

  // Vitesse par défaut
  const existingRate = await getSettingValue('defaultPlaybackRate');
  if (existingRate === undefined) {
    await setSettingValue('defaultPlaybackRate', 1.0);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 10 — EXPORT / IMPORT DES DONNÉES UTILISATEUR
// ─────────────────────────────────────────────────────────────────────────────
// Structure prête pour une future fonctionnalité d'export complet.
// Les blobs ZIP sont exclus de l'export v1 (trop volumineux).

/**
 * Exporte toutes les données utilisateur au format JSON.
 * Les blobs ZIP (book_files) sont exclus pour des raisons de taille.
 * L'utilisateur devra réimporter les fichiers ZIP si nécessaire.
 *
 * Format de sortie :
 * {
 *   exportVersion: 1,
 *   exportedAt: timestamp,
 *   deviceId: string,
 *   books: [...],
 *   progress: [...],
 *   bookmarks: [...],
 *   settings: [...],
 *   files: "excluded"
 * }
 *
 * @returns {Promise<object>}
 */
export async function exportData() {
  const deviceId = await getSettingValue('deviceId');
  await setSettingValue('lastExportedAt', Date.now());

  // Lecture de tous les stores (sauf book_files)
  const [books, progress, bookmarks, settingsRaw] = await Promise.all([
    getAllBooks(),
    _getAllFromStore('progress'),
    _getAllFromStore('bookmarks'),
    _getAllFromStore('settings'),
  ]);

  // Sérialisation : les coverBlob (Blob) ne sont pas JSON-sérialisables.
  // On les exclut proprement de l'export v1.
  const booksClean = books.map(({ coverBlob: _ignored, ...rest }) => rest);

  return {
    exportVersion: 1,
    exportedAt:    Date.now(),
    deviceId,
    books:         booksClean,
    progress,
    bookmarks,
    settings:      settingsRaw,
    files:         'excluded', // Les ZIP ne sont pas inclus dans l'export v1
  };
}

/**
 * Importe des données utilisateur depuis un objet JSON exporté.
 * Fusionne les données : les livres existants ne sont pas écrasés si le bookId correspond.
 * La progression et les marque-pages importés prennent le dessus sur les données locales.
 *
 * @param {object} data — objet retourné par exportData()
 * @returns {Promise<{ imported: number, skipped: number }>}
 */
export async function importData(data) {
  if (!data || data.exportVersion !== 1) {
    throw new Error('[DB] Format d\'export non reconnu ou version incompatible.');
  }

  let imported = 0;
  let skipped  = 0;

  // Import des livres (métadonnées uniquement, sans coverBlob ni fichier ZIP)
  for (const book of (data.books ?? [])) {
    const existing = await getBook(book.bookId);
    if (!existing) {
      // Le livre n'existe pas localement : on l'importe sans coverBlob ni fichier
      const store = _tx('books', 'readwrite').stores;
      await _req(store.put({ ...book, coverBlob: null }));
      imported++;
    } else {
      skipped++;
    }
  }

  // Import de la progression
  for (const prog of (data.progress ?? [])) {
    const store = _tx('progress', 'readwrite').stores;
    await _req(store.put(prog));
  }

  // Import des marque-pages
  for (const mark of (data.bookmarks ?? [])) {
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
  const store = _tx(storeName).stores;
  return _req(store.getAll());
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 11 — POINT D'ENTRÉE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialise complètement la couche base de données.
 * Doit être la première chose appelée au démarrage de l'application.
 *
 * Séquence :
 *   1. Ouvre la connexion IndexedDB (crée le schéma si premier lancement)
 *   2. Initialise les settings par défaut manquants
 *   3. Demande le stockage persistant
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
