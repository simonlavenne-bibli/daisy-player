export function updatePlayPauseUI(isPlaying) {
    const iconName = isPlaying ? 'pause' : 'play_arrow';
    const cIcon = document.getElementById('cleanPlayIcon'); 
    if (cIcon) cIcon.textContent = iconName;
    const cLabel = document.getElementById('cleanPlayLabel'); 
    if (cLabel) cLabel.textContent = isPlaying ? 'PAUSE' : 'LECTURE';
}

export function showPage(activeButton, activeSection) {
    const views = [document.getElementById('view-home'), document.getElementById('view-history'), document.getElementById('view-player')];
    const navs = [document.getElementById('nav-home'), document.getElementById('nav-history'), document.getElementById('nav-player')];
    
    views.forEach(sec => { if (sec) sec.classList.add('hidden'); });
    if (activeSection) activeSection.classList.remove('hidden');

    // Style unifié et accessible pour les onglets inactifs
    navs.forEach(btn => {
        if (btn) {
            btn.className = "nav-tab flex flex-col items-center justify-center text-slate-600 px-4 md:px-10 py-4 md:py-6 hover:bg-slate-100 transition-all rounded-3xl min-w-[100px] md:min-w-[200px]";
        }
    });
    
    // Style pour l'onglet actif (mise en évidence)
    if (activeButton) {
        activeButton.className = "nav-tab flex flex-col items-center justify-center bg-primary-container text-on-primary-container rounded-3xl px-4 md:px-10 py-4 md:py-6 shadow-xl border-4 border-amber-300 min-w-[100px] md:min-w-[200px]";
    }
}

// Gère l'affichage du chapitre dans la zone unifiée
export function highlightActiveChapter(title) {
    const chapterDisplay = document.getElementById('cleanChapterTitle');
    if (chapterDisplay && title) {
        chapterDisplay.textContent = title;
    }
}

export function cycleThemes() {
    const body = document.body;
    if (!body) return;
    
    if (!body.classList.contains('theme-white-on-black') && !body.classList.contains('theme-black-on-white') && !body.classList.contains('theme-yellow-on-black')) {
        body.classList.add('theme-white-on-black');
    } else if (body.classList.contains('theme-white-on-black')) {
        body.classList.remove('theme-white-on-black');
        body.classList.add('theme-black-on-white');
    } else if (body.classList.contains('theme-black-on-white')) {
        body.classList.remove('theme-black-on-white');
        body.classList.add('theme-yellow-on-black');
    } else {
        body.classList.remove('theme-yellow-on-black');
    }
}
