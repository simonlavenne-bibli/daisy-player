/* ================================================================
   LUMIÈRE AUDIO — js/ui.js
   Fonctions d'interface — sans Tailwind.
   Utilise uniquement les classes définies dans css/style.css :
     .view .active  .nav-tab .active  .visible  .hidden (display:none)
================================================================ */

/**
 * Met à jour l'icône et le label du bouton Lecture/Pause
 * dans le mode normal ET le mode simple.
 */
export function updatePlayPauseUI(isPlaying) {
  const iconName  = isPlaying ? 'pause'   : 'play_arrow';
  const labelName = isPlaying ? 'PAUSE'   : 'LECTURE';

  // Mode normal
  const pIcon  = document.getElementById('playPauseIcon');
  const pLabel = document.getElementById('playLabel');
  if (pIcon)  pIcon.textContent  = iconName;
  if (pLabel) pLabel.textContent = labelName;

  // Mode simple
  const cIcon  = document.getElementById('cleanPlayIcon');
  const cLabel = document.getElementById('cleanPlayLabel');
  if (cIcon)  cIcon.textContent  = iconName;
  if (cLabel) cLabel.textContent = labelName;
}

/**
 * Affiche la vue demandée et met à jour l'onglet actif.
 * Compatible avec la nouvelle structure CSS (classe .active).
 *
 * @param {HTMLElement} activeButton  — bouton nav à activer
 * @param {HTMLElement} activeSection — section à afficher
 */
export function showPage(activeButton, activeSection) {
  // Cacher toutes les vues
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

  // Désactiver tous les onglets
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

  // Afficher la bonne vue
  if (activeSection) activeSection.classList.add('active');

  // Activer le bon onglet
  if (activeButton) activeButton.classList.add('active');
}

/**
 * Affiche le titre du chapitre en cours dans le lecteur.
 *
 * @param {string} title — titre du chapitre
 */
export function highlightActiveChapter(title) {
  const chapterDisplay = document.getElementById('cleanChapterTitle');
  if (chapterDisplay && title) {
    chapterDisplay.textContent = title;
  }
}

/**
 * cycleThemes() — Parcourt les 5 thèmes en ordre circulaire.
 *
 * Ordre : light  (Bleu/Blanc/Orange)
 *       → dark   (Blanc sur fond noir)
 *       → hc     (Noir sur fond blanc)
 *       → sepia  (Orange sur fond noir)
 *       → yellow (Jaune sur fond noir)
 *       → light  (retour au début)
 *
 * Les noms de data-theme correspondent exactement aux sélecteurs
 * définis dans css/style.css.
 */
export function cycleThemes() {
  const body = document.body;
  if (!body) return;

  const themes = ['light', 'dark', 'hc', 'sepia', 'yellow'];
  const current = body.getAttribute('data-theme') || 'light';
  const idx  = themes.indexOf(current);
  const next = themes[(idx + 1) % themes.length];

  body.setAttribute('data-theme', next);

  // Mise à jour du label aria pour l'accessibilité
  const themeLabels = {
    light:  'Thème : Bleu/Blanc/Orange',
    dark:   'Thème : Blanc sur fond noir',
    hc:     'Thème : Noir sur fond blanc',
    sepia:  'Thème : Orange sur fond noir',
    yellow: 'Thème : Jaune sur fond noir'
  };
  const btn = document.getElementById('btn-theme-toggle');
  if (btn) btn.setAttribute('aria-label', themeLabels[next] + ' — Cliquer pour changer');
}
