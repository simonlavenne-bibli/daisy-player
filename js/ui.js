export function updatePlayPauseUI(isPlaying) {
    const iconName  = isPlaying ? 'pause'  : 'play_arrow';
    const labelName = isPlaying ? 'PAUSE'  : 'LECTURE';

    // Mode normal
    const pIcon  = document.getElementById('playPauseIcon');
    if (pIcon)  pIcon.textContent  = iconName;
    const pLabel = document.getElementById('playLabel');
    if (pLabel) pLabel.textContent = labelName;

    // Mode simple
    const cIcon  = document.getElementById('cleanPlayIcon');
    if (cIcon)  cIcon.textContent  = iconName;
    const cLabel = document.getElementById('cleanPlayLabel');
    if (cLabel) cLabel.textContent = labelName;
}

export function showPage(activeButton, activeSection) {
    const views = [
        document.getElementById('view-home'),
        document.getElementById('view-history'),
        document.getElementById('view-player')
    ];
    const navs = [
        document.getElementById('nav-home'),
        document.getElementById('nav-history'),
        document.getElementById('nav-player')
    ];

    views.forEach(sec => { if (sec) sec.classList.add('hidden'); });
    if (activeSection) activeSection.classList.remove('hidden');

    // Apparence inactive (utilise les variables sémantiques)
    navs.forEach(btn => {
        if (btn) {
            btn.className = "nav-tab flex flex-col items-center justify-center bg-surface text-textSecondary px-4 md:px-10 py-4 md:py-6 hover:bg-surfaceHover transition-colors rounded-3xl border-4 border-transparent min-w-[100px] md:min-w-[180px] focus-ring";
        }
    });

    // Apparence active
    if (activeButton) {
        activeButton.className = "nav-tab flex flex-col items-center justify-center bg-bgSecondary text-textPrimary px-4 md:px-10 py-4 md:py-6 shadow-md rounded-3xl border-4 border-accent min-w-[100px] md:min-w-[180px] focus-ring";
    }
}

export function highlightActiveChapter(title) {
    const chapterDisplay = document.getElementById('cleanChapterTitle');
    if (chapterDisplay && title) {
        chapterDisplay.textContent = title;
    }
}

/**
 * cycleThemes() — Parcourt les 5 thèmes en ordre circulaire.
 *
 * Ordre :  light (Classique)
 *       → dark  (Blanc sur fond noir)
 *       → hc    (Noir sur fond blanc)
 *       → sepia (Orange sur fond noir)
 *       → yellow(Jaune sur fond noir)
 *       → light (retour au début)
 *
 * Les noms de data-theme correspondent exactement aux sélecteurs
 * définis dans css/style.css.
 */
export function cycleThemes() {
    const body = document.body;
    if (!body) return;

    const themes = ['light', 'dark', 'hc', 'sepia', 'yellow'];
    const current = body.getAttribute('data-theme') || 'light';
    const idx     = themes.indexOf(current);
    const next    = themes[(idx + 1) % themes.length];

    body.setAttribute('data-theme', next);

    // Mise à jour optionnelle du label du bouton (accessibilité)
    const themeLabels = {
        light:  'Thème : Classique',
        dark:   'Thème : Blanc sur fond noir',
        hc:     'Thème : Noir sur fond blanc',
        sepia:  'Thème : Orange sur fond noir',
        yellow: 'Thème : Jaune sur fond noir'
    };
    const btn = document.getElementById('btn-theme-toggle');
    if (btn) btn.setAttribute('aria-label', themeLabels[next] + ' — Cliquer pour changer');
}
