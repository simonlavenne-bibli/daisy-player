/**
 * js/diagnostic.js — Moteur de la page de diagnostic
 *
 * Ce fichier est chargé UNIQUEMENT par diagnostic.html.
 * Il n'est jamais importé par l'application principale.
 *
 * Responsabilités :
 *   - Initialiser la base via library.js
 *   - Collecter le résumé de diagnostic
 *   - Écrire les tests unitaires en mémoire (add / read / delete)
 *   - Injecter les résultats dans le DOM de diagnostic.html
 *   - Permettre d'ajouter et supprimer des livres de test
 *
 * @module diagnostic
 */

import { initLibrary, getDiagnosticSummary, importBook, removeBook, getResumeData } from './library.js';

// ─────────────────────────────────────────────────────────────────────────────
// UTILITAIRES DOM
// ─────────────────────────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);

function setStatus(id, value, isOk) {
  const el = $(id);
  if (!el) return;
  el.textContent = value;
  el.className = 'diag-value ' + (isOk ? 'ok' : 'error');
}

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Mo';
  const mb = bytes / 1024 / 1024;
  if (mb < 1) return `${Math.round(bytes / 1024)} Ko`;
  if (mb < 1024) return `${mb.toFixed(1)} Mo`;
  return `${(mb / 1024).toFixed(2)} Go`;
}

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function log(message, type = 'info') {
  const container = $('test-log');
  if (!container) return;
  const line = document.createElement('div');
  line.className = `log-line log-${type}`;
  const time = new Date().toLocaleTimeString('fr-FR');
  line.textContent = `[${time}] ${message}`;
  container.prepend(line);
}

// ─────────────────────────────────────────────────────────────────────────────
// CHARGEMENT DU DIAGNOSTIC PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

async function runDiagnostic() {
  setText('diag-status-label', 'Analyse en cours…');

  try {
    await initLibrary();
    log('Base IndexedDB initialisée.', 'ok');
  } catch (err) {
    log(`Échec d'initialisation : ${err.message}`, 'error');
    setStatus('db-status', 'ERREUR', false);
    setText('diag-status-label', 'Erreur critique — voir le journal');
    return;
  }

  let summary;
  try {
    summary = await getDiagnosticSummary();
  } catch (err) {
    log(`Échec du diagnostic : ${err.message}`, 'error');
    return;
  }

  // ── Indicateurs principaux ─────────────────────────────────────────────────
  setStatus('db-status',     summary.dbStatus,                  summary.dbStatus === 'OK');
  setStatus('book-count',    summary.bookCount,                  true);
  setStatus('progress-count', summary.progressCount,             true);
  setStatus('persisted',     summary.persisted ? 'OUI' : 'NON', summary.persisted);
  setStatus('storage-used',  formatBytes(summary.storageUsedBytes), !summary.storageIsLow);
  setStatus('storage-quota', formatBytes(summary.storageQuotaBytes), true);
  setStatus('default-rate',  `×${summary.defaultPlaybackRate}`,  true);
  setText('device-id', summary.deviceId ? summary.deviceId.slice(0, 8) + '…' : '—');

  // ── Avertissement espace bas ───────────────────────────────────────────────
  const warn = $('storage-warning');
  if (warn) warn.hidden = !summary.storageIsLow;

  // ── Dernier livre ──────────────────────────────────────────────────────────
  const resume = await getResumeData();
  const resumeBox = $('resume-box');
  if (resumeBox) {
    if (resume) {
      resumeBox.hidden = false;
      setText('resume-title',    resume.book.title);
      setText('resume-author',   resume.book.author);
      setText('resume-chapter',  resume.progress ? `Chapitre ${resume.progress.chapterIndex + 1}` : '—');
      setText('resume-percent',  resume.progress ? `${resume.progress.percentage} %` : '—');
      setText('resume-rate',     resume.progress ? `×${resume.progress.playbackRate}` : '—');
      setText('resume-date',     formatDate(resume.book.lastOpenedAt));
      setStatus('resume-file',   resume.hasFile ? 'Disponible' : 'Absent (réimport requis)', resume.hasFile);
    } else {
      resumeBox.hidden = true;
    }
  }

  // ── Liste des livres ───────────────────────────────────────────────────────
  renderBooksList(summary.books);

  setText('diag-status-label', `Diagnostic terminé — ${new Date().toLocaleTimeString('fr-FR')}`);
  log(`Diagnostic complet. ${summary.bookCount} livre(s), ${summary.progressCount} progression(s).`, 'ok');
}

function renderBooksList(books) {
  const container = $('books-list');
  if (!container) return;
  container.innerHTML = '';

  if (books.length === 0) {
    container.innerHTML = '<p class="empty-state">Aucun livre dans la bibliothèque.</p>';
    return;
  }

  books.forEach((b) => {
    const card = document.createElement('div');
    card.className = 'book-card';
    card.setAttribute('role', 'listitem');

    card.innerHTML = `
      <div class="book-card-header">
        <span class="book-icon" aria-hidden="true">📖</span>
        <div class="book-card-meta">
          <strong class="book-title">${escapeHtml(b.title)}</strong>
          <span class="book-author">${escapeHtml(b.author)}</span>
        </div>
        <button
          class="btn-delete"
          data-id="${escapeHtml(b.bookId)}"
          aria-label="Supprimer le livre ${escapeHtml(b.title)}"
        >Supprimer</button>
      </div>
      <dl class="book-details">
        <dt>Chapitres</dt>   <dd>${b.totalChapters}</dd>
        <dt>Progression</dt> <dd>${b.hasProgress ? `${b.percentage} % (ch. ${b.chapterIndex + 1})` : 'Aucune'}</dd>
        <dt>Vitesse</dt>     <dd>${b.playbackRate ? `×${b.playbackRate}` : '—'}</dd>
        <dt>Couverture</dt>  <dd>${b.hasCover ? 'Oui' : 'Non'}</dd>
        <dt>Importé le</dt>  <dd>${formatDate(b.importedAt)}</dd>
        <dt>Ouvert le</dt>   <dd>${formatDate(b.lastOpenedAt)}</dd>
        <dt>ID</dt>          <dd class="book-id">${b.bookId.slice(0, 18)}…</dd>
      </dl>
    `;

    card.querySelector('.btn-delete').addEventListener('click', async () => {
      if (!confirm(`Supprimer « ${b.title} » ? Cette action est irréversible.`)) return;
      try {
        await removeBook(b.bookId);
        log(`Livre supprimé : « ${b.title} »`, 'ok');
        await runDiagnostic();
      } catch (err) {
        log(`Erreur suppression : ${err.message}`, 'error');
      }
    });

    container.appendChild(card);
  });
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST AUTOMATIQUE — AJOUTER UN LIVRE FICTIF
// ─────────────────────────────────────────────────────────────────────────────

async function runAddTest() {
  log('Démarrage du test d\'ajout…');
  try {
    // Création d'un faux fichier ZIP (contenu vide — on teste le stockage, pas le parser)
    const fakeZip  = new Blob(['PK\x03\x04'], { type: 'application/zip' });
    const fakeFile = new File([fakeZip], 'test-livre.zip', { type: 'application/zip' });

    const fakeBookData = {
      title:         'Livre de test — ' + new Date().toLocaleTimeString('fr-FR'),
      author:        'Auteur Fictif',
      narrator:      null,
      nccId:         null, // pas de nccId = pas de déduplication par nccId
      coverBlob:     null,
      totalChapters: 12,
      playlist:      new Array(12).fill(null),
    };

    const result = await importBook(fakeFile, fakeBookData);

    if (result.status === 'imported') {
      log(`✓ Livre ajouté : « ${result.book.title} » (ID: ${result.bookId.slice(0,8)}…)`, 'ok');
    } else {
      log(`→ Doublon détecté pour « ${result.book.title} »`, 'warn');
    }

    await runDiagnostic();
  } catch (err) {
    log(`✗ Erreur lors du test d'ajout : ${err.message}`, 'error');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST DE PERSISTANCE
// ─────────────────────────────────────────────────────────────────────────────

function runPersistenceNote() {
  log('Pour tester la persistance : fermez cet onglet, rouvrez-le, cliquez sur « Rafraîchir ».', 'info');
  log('Si le nombre de livres est identique après fermeture, la persistance est confirmée.', 'info');
}

// ─────────────────────────────────────────────────────────────────────────────
// INITIALISATION DE LA PAGE
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Boutons d'action
  const btnRefresh = $('btn-refresh');
  const btnAddTest = $('btn-add-test');
  const btnPersist = $('btn-test-persist');

  if (btnRefresh) btnRefresh.addEventListener('click', runDiagnostic);
  if (btnAddTest) btnAddTest.addEventListener('click', runAddTest);
  if (btnPersist) btnPersist.addEventListener('click', runPersistenceNote);

  // Lancement automatique
  runDiagnostic();
});
