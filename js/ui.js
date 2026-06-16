export function updatePlayPauseUI(isPlaying) {
    const iconName = isPlaying ? 'pause' : 'play_arrow';
    const pIcon = document.getElementById('playPauseIcon'); if (pIcon) pIcon.textContent = iconName;
    const cIcon = document.getElementById('cleanPlayIcon'); if (cIcon) cIcon.textContent = iconName;
    const cLabel = document.getElementById('cleanPlayLabel'); if (cLabel) cLabel.textContent = isPlaying ? 'PAUSE' : 'LECTURE';
}

export function showPage(activeButton, activeSection, toggleCleanModeBtn) {
    const views = [document.getElementById('view-home'), document.getElementById('view-history'), document.getElementById('view-player')];
    const navs = [document.getElementById('nav-home'), document.getElementById('nav-history'), document.getElementById('nav-player')];
    
    views.forEach(sec => { if (sec) sec.classList.add('hidden'); });
    if (activeSection) activeSection.classList.remove('hidden');

    navs.forEach(btn => {
        if (btn) btn.className = "flex flex-col items-center justify-center text-on-surface-variant dark:text-slate-400 p-2 hover:bg-surface-container dark:hover:bg-slate-800 transition-all rounded-xl";
    });
    if (activeButton) activeButton.className = "flex flex-col items-center justify-center bg-primary-container text-on-primary-container rounded-xl px-5 py-1.5 shadow-sm";
    
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
        btn.className = "w-full text-left px-4 py-3 rounded-lg hover:bg-surface-container-highest flex items-center gap-3 text-sm transition-colors text-on-surface dark:text-white bg-transparent border-transparent";
        btn.innerHTML = `<span class="material-symbols-outlined text-[20px]">radio_button_unchecked</span><span>${track.title}</span>`;
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
            btn.className = "w-full text-left px-4 py-3 rounded-lg bg-amber-500/15 border-l-4 border-amber-500 text-on-surface dark:text-white font-bold flex items-center gap-3 text-sm shadow-inner";
            if (icon) { 
                icon.textContent = "play_circle"; 
                icon.style.fontVariationSettings = "'FILL' 1"; 
            }
        } else {
            btn.className = "w-full text-left px-4 py-3 rounded-lg hover:bg-surface-container-highest transition-colors flex items-center gap-3 text-sm text-on-surface dark:text-slate-300 bg-transparent border-transparent";
            if (icon) { 
                icon.textContent = "radio_button_unchecked"; 
                icon.style.fontVariationSettings = "'FILL' 0"; 
            }
        }
    });
}

export function cycleThemes() {
    const body = document.body;
    const html = document.documentElement;
    
    if (!body.classList.contains('theme-dark') && !body.classList.contains('theme-orange')) {
        // Mode Sombre
        body.classList.add('theme-dark');
        html.classList.add('dark');
        html.classList.remove('light');
    } else if (body.classList.contains('theme-dark')) {
        // Mode Orange Contraste
        body.classList.remove('theme-dark');
        html.classList.remove('dark');
        body.classList.add('theme-orange');
        html.classList.add('light');
    } else {
        // Retour au Mode Clair
        body.classList.remove('theme-orange');
        html.classList.remove('dark');
        html.classList.add('light');
    }
}
