export function updatePlayPauseUI(isPlaying) {
    const iconName = isPlaying ? 'pause' : 'play_arrow';
    document.getElementById('playPauseIcon').textContent = iconName;
    document.getElementById('cleanPlayIcon').textContent = iconName;
    document.getElementById('cleanPlayLabel').textContent = isPlaying ? 'PAUSE' : 'LECTURE';
}

export function showPage(activeButton, activeSection, toggleCleanModeBtn) {
    const views = [document.getElementById('view-home'), document.getElementById('view-history'), document.getElementById('view-player')];
    const navs = [document.getElementById('nav-home'), document.getElementById('nav-history'), document.getElementById('nav-player')];
    
    views.forEach(sec => sec.classList.add('hidden'));
    activeSection.classList.remove('hidden');

    navs.forEach(btn => {
        btn.className = "flex flex-col items-center justify-center text-on-surface-variant dark:text-slate-400 p-2 hover:bg-surface-container dark:hover:bg-slate-800 transition-all rounded-xl";
    });
    activeButton.className = "flex flex-col items-center justify-center bg-primary-container text-on-primary-container rounded-xl px-5 py-1.5 shadow-sm";
    
    const isPlayer = activeSection.id === 'view-player';
    toggleCleanModeBtn.classList.toggle('hidden', !isPlayer);
}

export function renderChaptersList(playlist, onChapterClick) {
    const container = document.getElementById('chapters-container');
    container.innerHTML = "";
    playlist.forEach((track, index) => {
        const btn = document.createElement('button');
        btn.className = "w-full text-left px-4 py-3 rounded-lg hover:bg-surface-container-highest flex items-center gap-3 text-sm";
        btn.innerHTML = `<span class="material-symbols-outlined text-[20px]">radio_button_unchecked</span><span>${track.title}</span>`;
        btn.addEventListener('click', () => onChapterClick(index));
        container.appendChild(btn);
    });
}

// Met en valeur visuellement le chapitre actif dans l'index (normal et automatique)
export function highlightActiveChapter(activeIndex) {
    const container = document.getElementById('chapters-container');
    if (!container) return;
    
    const buttons = container.querySelectorAll('button');
    buttons.forEach((btn, index) => {
        const icon = btn.querySelector('.material-symbols-outlined');
        if (index === activeIndex) {
            // Style d'accessibilité actif (fond coloré léger et bordure gauche marquée)
            btn.className = "w-full text-left px-4 py-3 rounded-lg bg-amber-500/10 border-l-4 border-amber-500 text-on-surface font-bold flex items-center gap-3 text-sm";
            if (icon) { 
                icon.textContent = "play_circle"; 
                icon.style.fontVariationSettings = "'FILL' 1"; 
            }
        } else {
            // Style de base inactif
            btn.className = "w-full text-left px-4 py-3 rounded-lg hover:bg-surface-container-highest transition-colors flex items-center gap-3 text-sm";
            if (icon) { 
                icon.textContent = "radio_button_unchecked"; 
                icon.style.fontVariationSettings = "'FILL' 0"; 
            }
        }
    });
}

// Permet de cycler entre le thème clair, sombre et orange contrasté du fichier style.css
export function cycleThemes() {
    const body = document.body;
    if (!body.classList.contains('theme-dark') && !body.classList.contains('theme-orange')) {
        // Étape 1 : Passer au thème sombre
        body.classList.add('theme-dark');
    } else if (body.classList.contains('theme-dark')) {
        // Étape 2 : Passer au thème orange
        body.classList.remove('theme-dark');
        body.classList.add('theme-orange');
    } else {
        // Étape 3 : Revenir au thème clair par défaut
        body.classList.remove('theme-orange');
    }
}
