export function updatePlayPauseUI(isPlaying) {
    const iconName = isPlaying ? 'pause' : 'play_arrow';
    const pIcon = document.getElementById('playPauseIcon'); 
    if (pIcon) pIcon.textContent = iconName;
    const cIcon = document.getElementById('cleanPlayIcon'); 
    if (cIcon) cIcon.textContent = iconName;
    const cLabel = document.getElementById('cleanPlayLabel'); 
    if (cLabel) cLabel.textContent = isPlaying ? 'PAUSE' : 'LECTURE';
}

export function showPage(activeButton, activeSection, toggleCleanModeBtn) {
    const views = [document.getElementById('view-home'), document.getElementById('view-history'), document.getElementById('view-player')];
    const navs = [document.getElementById('nav-home'), document.getElementById('nav-history'), document.getElementById('nav-player')];
    
    views.forEach(sec => { if (sec) sec.classList.add('hidden'); });
    if (activeSection) activeSection.classList.remove('hidden');

    // Style MASSIF pour les boutons inactifs
    navs.forEach(btn => {
        if (btn) {
            btn.className = "flex flex-col items-center justify-center text-slate-600 px-10 py-6 hover:bg-slate-100 transition-all rounded-3xl min-w-[200px]";
        }
    });
    
    // Style MASSIF pour le bouton actif
    if (activeButton) {
        activeButton.className = "flex flex-col items-center justify-center bg-primary-container text-on-primary-container rounded-3xl px-10 py-6 shadow-xl border-4 border-amber-200 min-w-[200px]";
    }
    
    if (activeSection && toggleCleanModeBtn) {
        const isPlayer = activeSection.id === 'view-player';
        toggleCleanModeBtn.classList.toggle('hidden', !isPlayer);
    }
}

export function renderChaptersList(playlist, onChapterClick) {
    const container = document.getElementById('chapters-container');
    if (!container) return;
    container.innerHTML = "";
    playlist.forEach((track, index) => {
        const btn = document.createElement('button');
        btn.className = "w-full text-left px-8 py-6 rounded-2xl hover:bg-slate-100 flex items-center gap-6 text-2xl font-bold transition-colors border-4 border-slate-200 bg-transparent text-slate-800";
        btn.innerHTML = `<span class="material-symbols-outlined text-4xl">radio_button_unchecked</span><span>${track.title}</span>`;
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
            btn.className = "w-full text-left px-8 py-6 rounded-2xl bg-amber-100 border-l-[12px] border-amber-600 text-amber-900 font-black flex items-center gap-6 text-2xl shadow-inner";
            if (icon) icon.textContent = "play_circle";
        } else {
            btn.className = "w-full text-left px-8 py-6 rounded-2xl hover:bg-slate-100 transition-colors flex items-center gap-6 text-2xl text-slate-700 bg-transparent border-4 border-slate-200";
            if (icon) icon.textContent = "radio_button_unchecked";
        }
    });
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
