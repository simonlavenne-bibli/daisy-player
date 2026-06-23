export function updatePlayPauseUI(isPlaying) {
    const iconName = isPlaying ? 'pause' : 'play_arrow';
    const labelName = isPlaying ? 'PAUSE' : 'LECTURE';
    
    // Normal Mode
    const pIcon = document.getElementById('playPauseIcon'); 
    if (pIcon) pIcon.textContent = iconName;
    const pLabel = document.getElementById('playLabel');
    if (pLabel) pLabel.textContent = labelName;

    // Simple Mode
    const cIcon = document.getElementById('cleanPlayIcon'); 
    if (cIcon) cIcon.textContent = iconName;
    const cLabel = document.getElementById('cleanPlayLabel'); 
    if (cLabel) cLabel.textContent = labelName;
}

export function showPage(activeButton, activeSection) {
    const views = [document.getElementById('view-home'), document.getElementById('view-history'), document.getElementById('view-player')];
    const navs = [document.getElementById('nav-home'), document.getElementById('nav-history'), document.getElementById('nav-player')];
    
    views.forEach(sec => { if (sec) sec.classList.add('hidden'); });
    if (activeSection) activeSection.classList.remove('hidden');

    // Apparence Inactive (Variables Sémantiques)
    navs.forEach(btn => {
        if (btn) {
            btn.className = "nav-tab flex flex-col items-center justify-center bg-surface text-textSecondary px-4 md:px-10 py-4 md:py-6 hover:bg-surfaceHover transition-colors rounded-3xl border-4 border-transparent min-w-[100px] md:min-w-[180px] focus-ring";
        }
    });
    
    // Apparence Active (Mise en évidence stricte)
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

export function cycleThemes() {
    const body = document.body;
    if (!body) return;
    
    body.classList.remove('theme-dark', 'theme-hc', 'theme-sepia');
    let currentTheme = body.getAttribute('data-theme') || 'light';

    if (currentTheme === 'light') {
        body.setAttribute('data-theme', 'dark');
        body.classList.add('theme-dark');
    } else if (currentTheme === 'dark') {
        body.setAttribute('data-theme', 'hc');
        body.classList.add('theme-hc');
    } else if (currentTheme === 'hc') {
        body.setAttribute('data-theme', 'sepia');
        body.classList.add('theme-sepia');
    } else {
        body.setAttribute('data-theme', 'light');
    }
}
