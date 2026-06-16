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
