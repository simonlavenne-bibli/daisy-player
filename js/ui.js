// Synchronisation complète des indicateurs textuels et visuels de lecture
export function updatePlayPauseUI(isPlaying) {
    const iconName = isPlaying ? 'pause' : 'play_arrow';
    
    // Mode classique
    const pIcon = document.getElementById('playPauseIcon'); 
    if (pIcon) pIcon.textContent = iconName;
    
    // Mode Épuré
    const cIcon = document.getElementById('cleanPlayIcon'); 
    if (cIcon) cIcon.textContent = iconName;
    
    const cLabel = document.getElementById('cleanPlayLabel'); 
    if (cLabel) cLabel.textContent = isPlaying ? 'PAUSE' : 'LECTURE';
}

// Routage d'affichage des écrans par onglet
export function showPage(activeButton, activeSection, toggleCleanModeBtn) {
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

    navs.forEach(btn => {
        if (btn) {
            btn.className = "flex flex-col items-center justify-center text-slate-600 p-2 hover:bg-slate-100 transition-all rounded-xl min-w-[80px]";
        }
    });
    if (activeButton) {
        activeButton.className = "flex flex-col items-center justify-center bg-primary-container text-on-primary-container rounded-xl px-5 py-2 shadow-sm min-w-[80px]";
    }
    
    if (activeSection && toggleCleanModeBtn) {
        const isPlayer = activeSection.id === 'view-player';
        toggleCleanModeBtn.classList.toggle('hidden', !isPlayer);
    }
}

// Rendu de la table des matières (Uniquement pour le mode classique)
export function renderChaptersList(playlist, onChapterClick) {
    const container = document.getElementById('chapters-container');
    if (!container) return;
    container.innerHTML = "";
    playlist.forEach((track, index) => {
        const btn = document.createElement('button');
        btn.className = "w-full text-left px-4 py-3 rounded-lg hover:bg-slate-100 flex items-center gap-3 text-base transition-colors border text-slate-800 bg-transparent";
        btn.innerHTML = `<span class="material-symbols-outlined">radio_button_unchecked</span><span>${track.title}</span>`;
        btn.addEventListener('click', () => onChapterClick(index));
        container.appendChild(btn);
    });
}

export function highlightActiveChapter(activeIndex) {
    const container = document.getElementById('chapters-container');
    if (!container) return;
    
    const buttons = container.querySelectorAll('button');
    buttons.forEach((btn, index) => {
        const icon = btn.querySelector('.material-symbols-outlined');
        if (index === activeIndex) {
            btn.className = "w-full text-left px-4 py-3 rounded-lg bg-amber-100 border-l-4 border-amber-600 text-amber-900 font-bold flex items-center gap-3 text-base shadow-inner";
            if (icon) icon.textContent = "play_circle";
        } else {
            btn.className = "w-full text-left px-4 py-3 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-3 text-base text-slate-700 bg-transparent border-transparent";
            if (icon) icon.textContent = "radio_button_unchecked";
        }
    });
}

// CYCLAGE DES 4 THÈMES DEMANDÉS
export function cycleThemes() {
    const body = document.body;
    if (!body) return;

    if (!body.classList.contains('theme-white-on-black') && 
        !body.classList.contains('theme-black-on-white') && 
        !body.classList.contains('theme-yellow-on-black')) {
        
        // Vers Thème 2 : Blanc sur Noir
        body.classList.add('theme-white-on-black');
    } else if (body.classList.contains('theme-white-on-black')) {
        // Vers Thème 3 : Noir sur Blanc
        body.classList.remove('theme-white-on-black');
        body.classList.add('theme-black-on-white');
    } else if (body.classList.contains('theme-black-on-white')) {
        // Vers Thème 4 : Jaune sur Noir
        body.classList.remove('theme-black-on-white');
        body.classList.add('theme-yellow-on-black');
    } else {
        // Retour au Thème 1 : Classique (Par défaut)
        body.classList.remove('theme-yellow-on-black');
    }
}
