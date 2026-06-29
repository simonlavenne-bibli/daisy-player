/**
 * js/main.js — Point d'entrée principal de Lumière Audio
 */

// ─── Imports Phase 1 — TEST UNIQUEMENT, à conserver ──────────
import { initDB, addBook, getLastOpenedBook, saveProgress, getProgress } from './db.js';
// ─────────────────────────────────────────────────────────────────────────────

import { parseDaisyZip } from './parser.js';
import { DaisyPlayer }   from './player.js';
import * as ui           from './ui.js';

document.addEventListener('DOMContentLoaded', () => {

    // ─── Test Phase 1 — Conservé ──────────────────────────
    window.__testDB = async () => {
        await initDB();
        const id = await addBook({
            title: 'Test Guerre et Paix',
            author: 'Tolstoï',
            totalChapters: 5,
        });
        console.log('[TEST] Livre créé, bookId :', id);
        await saveProgress(id, {
            chapterIndex: 2,
            positionSeconds: 127.4,
            percentage: 41,
            playbackRate: 1.25,
        });
        console.log('[TEST] Progression sauvegardée.');
        const last = await getLastOpenedBook();
        console.log('[TEST] Dernier livre :', last.title);
        const prog = await getProgress(id);
        console.log('[TEST] Progression récupérée :', prog);
    };

    // ─── LOGIQUE DE NAVIGATION & MODE SIMPLE ─────────────────────────────
    const navHome = document.getElementById('nav-home');
    const navPlayer = document.getElementById('nav-player');
    const navHistory = document.getElementById('nav-history');
    
    const viewHome = document.getElementById('view-home');
    const viewPlayer = document.getElementById('view-player');
    const viewHistory = document.getElementById('view-history');
    
    const toggleCleanMode = document.getElementById('toggleCleanMode');
    const btnTheme = document.getElementById('btn-theme-toggle');

    function switchView(viewId) {
        // 1. Masquer toutes les vues
        viewHome.classList.add('hidden');
        viewPlayer.classList.add('hidden');
        viewHistory.classList.add('hidden');
        
        // 2. Réinitialiser les boutons de navigation
        navHome.classList.remove('active');
        navPlayer.classList.remove('active');
        navHistory.classList.remove('active');
        navHome.removeAttribute('aria-current');
        navPlayer.removeAttribute('aria-current');
        navHistory.removeAttribute('aria-current');

        // 3. Activer la bonne vue et gérer le bouton "Mode Simple"
        if(viewId === 'home') {
            viewHome.classList.remove('hidden');
            navHome.classList.add('active');
            navHome.setAttribute('aria-current', 'page');
            if(toggleCleanMode) toggleCleanMode.classList.add('hidden');
            loadHistory();
        } 
        else if(viewId === 'player') {
            viewPlayer.classList.remove('hidden');
            navPlayer.classList.add('active');
            navPlayer.setAttribute('aria-current', 'page');
            if(toggleCleanMode) toggleCleanMode.classList.remove('hidden'); // APPARAÎT ICI SEULEMENT
        } 
        else if(viewId === 'history') {
            viewHistory.classList.remove('hidden');
            navHistory.classList.add('active');
            navHistory.setAttribute('aria-current', 'page');
            if(toggleCleanMode) toggleCleanMode.classList.add('hidden');
            loadHistory();
        }
    }

    // Écouteurs de clics sur le menu du bas
    if(navHome) navHome.addEventListener('click', () => switchView('home'));
    if(navPlayer) navPlayer.addEventListener('click', () => switchView('player'));
    if(navHistory) navHistory.addEventListener('click', () => switchView('history'));

    // ─── LOGIQUE DE CHANGEMENT DE THÈME ──────────────────────────────────
    if(btnTheme) {
        btnTheme.addEventListener('click', () => {
            const body = document.body;
            // Cycle : Light -> Dark -> High Contrast -> Light
            if (body.classList.contains('theme-light')) {
                body.classList.replace('theme-light', 'theme-dark');
            } else if (body.classList.contains('theme-dark')) {
                body.classList.replace('theme-dark', 'theme-hc');
            } else {
                body.classList.replace('theme-hc', 'theme-light');
            }
        });
    }

    // ─── GESTION DE L'HISTORIQUE (EXISTANTE) ─────────────────────────────
    function loadHistory() {
        const history = JSON.parse(localStorage.getItem('daisy_history') || '[]');
        
        function buildHistoryCard(item) {
            const div = document.createElement('div');
            div.className = "p-6 md:p-8 bg-surface rounded-3xl border-4 border-borderLight flex justify-between items-center gap-6 shadow-md transition-colors hover:bg-surfaceHover cursor-pointer";
            div.innerHTML = `
                <div class="overflow-hidden">
                    <h4 class="font-black text-2xl md:text-3xl text-textPrimary truncate">${item.title}</h4>
                    <p class="text-xl md:text-2xl font-bold text-textSecondary mt-2 truncate">${item.author} — Lu le ${item.date}</p>
                </div>
                <span class="material-symbols-outlined text-[50px] text-accent flex-shrink-0">book</span>
            `;
            return div;
        }

        const containerHome = document.getElementById('history-container');
        if (containerHome) {
            containerHome.innerHTML = '';
            if (history.length === 0) {
                containerHome.innerHTML = '<p class="text-center py-6 text-textSecondary text-2xl font-bold">Aucun historique de lecture.</p>';
            } else {
                history.slice(0, 3).forEach(item => {
                    containerHome.appendChild(buildHistoryCard(item));
                });
            }
        }

        const containerFull = document.getElementById('history-container-full');
        if (containerFull) {
            containerFull.innerHTML = '';
            if (history.length === 0) {
                containerFull.innerHTML = '<p class="text-center py-12 text-textSecondary text-3xl font-black">Aucun historique de lecture.</p>';
            } else {
                history.forEach(item => {
                    containerFull.appendChild(buildHistoryCard(item));
                });
            }
        }
    }

    // Initialisation
    loadHistory();
});
