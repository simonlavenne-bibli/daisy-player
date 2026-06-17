// ================================================================
// LUMIÈRE AUDIO v2 — ui.js
// Fonctions d'interface : thèmes, navigation, chapitres
// ================================================================

// ── Définition des 4 thèmes ────────────────────────────────────
const THEMES = [
    {
        cls:   'theme-classique',
        label: 'Classique',
        dark:  false,
        icon:  'light_mode'
    },
    {
        cls:   'theme-blanc-sur-noir',
        label: 'Blanc sur noir',
        dark:  true,
        icon:  'contrast'
    },
    {
        cls:   'theme-noir-sur-blanc',
        label: 'Noir sur blanc',
        dark:  false,
        icon:  'invert_colors'
    },
    {
        cls:   'theme-jaune-sur-noir',
        label: 'Jaune sur noir',
        dark:  true,
        icon:  'wb_sunny'
    },
];

const THEME_CLS_LIST = THEMES.map(t => t.cls);

// ── Restaure le thème sauvegardé au démarrage ──────────────────
export function restoreTheme() {
    const saved = localStorage.getItem('lumiere_theme');
    const theme = THEMES.find(t => t.cls === saved) || THEMES[0];
    _applyTheme(theme);
}

// ── Rotation vers le thème suivant ────────────────────────────
export function cycleThemes() {
    const body = document.body;
    const currentCls = THEME_CLS_LIST.find(cls => body.classList.contains(cls));
    const currentIdx = currentCls ? THEME_CLS_LIST.indexOf(currentCls) : 0;
    const nextIdx = (currentIdx + 1) % THEMES.length;
    const nextTheme = THEMES[nextIdx];
    _applyTheme(nextTheme);
    localStorage.setItem('lumiere_theme', nextTheme.cls);
}

// ── Application interne d'un thème ────────────────────────────
function _applyTheme(theme) {
    const body = document.body;
    const html = document.documentElement;

    // Retirer tous les thèmes précédents
    THEME_CLS_LIST.forEach(cls => {
        body.classList.remove(cls);
        html.classList.remove(cls);
    });

    // Appliquer le nouveau thème sur body ET html
    body.classList.add(theme.cls);
    html.classList.add(theme.cls);

    // Gestion de la classe Tailwind dark
    if (theme.dark) {
        html.classList.add('dark');
        html.classList.remove('light');
    } else {
        html.classList.remove('dark');
        html.classList.add('light');
    }

    // Mettre à jour le bouton thème
    const themeBtn = document.getElementById('btn-theme-toggle');
    if (themeBtn) {
        const iconEl = themeBtn.querySelector('.material-symbols-outlined');
        if (iconEl) iconEl.textContent = theme.icon;
        themeBtn.setAttribute(
            'aria-label',
            `Thème actuel : ${theme.label}. Cliquer pour changer de thème.`
        );
        themeBtn.title = theme.label;
    }
}

// ── Synchronisation bouton Play/Pause dans les deux modes ──────
export function updatePlayPauseUI(isPlaying) {
    const iconName = isPlaying ? 'pause' : 'play_arrow';

    // Mode complet
    const pIcon = document.getElementById('playPauseIcon');
    if (pIcon) pIcon.textContent = iconName;

    // Mode épuré
    const cIcon = document.getElementById('cleanPlayIcon');
    if (cIcon) cIcon.textContent = iconName;

    const cLabel = document.getElementById('cleanPlayLabel');
    if (cLabel) cLabel.textContent = isPlaying ? 'PAUSE' : 'LECTURE';
}

// ── Navigation entre les vues (Accueil / Mes livres / Lecteur) ─
export function showPage(activeButton, activeSection, toggleCleanModeBtn) {
    const views = [
        document.getElementById('view-home'),
        document.getElementById('view-history'),
        document.getElementById('view-player'),
    ];
    const navs = [
        document.getElementById('nav-home'),
        document.getElementById('nav-history'),
        document.getElementById('nav-player'),
    ];

    // Masquer toutes les vues
    views.forEach(sec => { if (sec) sec.classList.add('hidden'); });
    if (activeSection) activeSection.classList.remove('hidden');

    // Réinitialiser le style de tous les boutons nav
    navs.forEach(btn => {
        if (btn) {
            btn.className = 'nav-btn';
        }
    });

    // Activer le bouton sélectionné
    if (activeButton) {
        activeButton.className = 'nav-btn nav-btn--active';
    }

    // Afficher ou masquer le bouton Mode Épuré uniquement sur la vue lecteur
    if (toggleCleanModeBtn) {
        const isPlayer = activeSection && activeSection.id === 'view-player';
        toggleCleanModeBtn.classList.toggle('hidden', !isPlayer);
    }
}

// ── Rendu de la liste des chapitres (utilisé après chargement) ─
export function renderChaptersList(playlist, onChapterClick) {
    const container = document.getElementById('chapters-container');
    if (!container) return;
    container.innerHTML = '';

    playlist.forEach((track, index) => {
        const btn = document.createElement('button');
        btn.className = 'chapter-btn';
        btn.setAttribute('aria-label', `Chapitre ${index + 1} : ${track.title}`);
        btn.innerHTML = `
            <span class="material-symbols-outlined chapter-btn__icon" aria-hidden="true">radio_button_unchecked</span>
            <span class="chapter-btn__title">${track.title}</span>
        `;
        btn.addEventListener('click', () => onChapterClick(index));
        container.appendChild(btn);
    });
}

// ── Surlignage du chapitre actif dans la liste ─────────────────
export function highlightActiveChapter(activeIndex) {
    const container = document.getElementById('chapters-container');
    if (!container) return;

    const buttons = container.querySelectorAll('.chapter-btn');
    buttons.forEach((btn, index) => {
        const icon = btn.querySelector('.chapter-btn__icon');
        if (index === activeIndex) {
            btn.classList.add('chapter-btn--active');
            btn.setAttribute('aria-current', 'true');
            if (icon) {
                icon.textContent = 'play_circle';
                icon.style.fontVariationSettings = "'FILL' 1";
            }
        } else {
            btn.classList.remove('chapter-btn--active');
            btn.removeAttribute('aria-current');
            if (icon) {
                icon.textContent = 'radio_button_unchecked';
                icon.style.fontVariationSettings = "'FILL' 0";
            }
        }
    });
}
