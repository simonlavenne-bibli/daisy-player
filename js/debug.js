// ================================================================
// LUMIÈRE AUDIO — js/debug.js
// ----------------------------------------------------------------
// Panneau de diagnostic TEMPORAIRE, affiché directement à l'écran.
// Objectif : voir ce qui se passe réellement sur iPhone (Simon
// préfère ne pas utiliser les outils de développement du navigateur).
//
// À RETIRER une fois le bug de lecture iOS résolu : supprimer la
// ligne <script src="js/debug.js"> dans index.html, et les appels à
// window.debugLog(...) ajoutés dans main.js / player.js peuvent
// rester inertes sans problème (ils sont protégés par un test
// d'existence), mais le plus propre est de les enlever aussi.
// ================================================================

(function () {
    'use strict';

    var panel = document.createElement('div');
    panel.id = 'debug-panel';
    panel.style.position = 'fixed';
    panel.style.top = '0';
    panel.style.left = '0';
    panel.style.right = '0';
    panel.style.maxHeight = '45vh';
    panel.style.overflowY = 'auto';
    panel.style.background = 'rgba(0,0,0,0.88)';
    panel.style.color = '#7CFC00';
    panel.style.fontFamily = 'monospace';
    panel.style.fontSize = '11px';
    panel.style.lineHeight = '1.4';
    panel.style.padding = '6px 8px';
    panel.style.zIndex = '99999';
    panel.style.whiteSpace = 'pre-wrap';
    panel.style.wordBreak = 'break-word';
    panel.style.borderBottom = '3px solid #7CFC00';

    function mount() {
        if (document.body) document.body.appendChild(panel);
    }
    if (document.body) {
        mount();
    } else {
        document.addEventListener('DOMContentLoaded', mount);
    }

    var lineCount = 0;

    window.debugLog = function (msg) {
        lineCount++;
        var time = new Date().toISOString().substr(11, 12);
        var line = document.createElement('div');
        line.textContent = '#' + lineCount + ' [' + time + '] ' + msg;
        panel.appendChild(line);
        panel.scrollTop = panel.scrollHeight;
        console.log('[DEBUG]', msg);
    };

    // Capture aussi les erreurs JS et promesses non gérées qui
    // pourraient passer sous le radar autrement.
    window.addEventListener('error', function (e) {
        window.debugLog('ERREUR JS : ' + e.message + ' (' + e.filename + ':' + e.lineno + ')');
    });
    window.addEventListener('unhandledrejection', function (e) {
        var reason = e.reason && e.reason.message ? e.reason.message : e.reason;
        window.debugLog('PROMESSE REJETÉE NON GÉRÉE : ' + reason);
    });

    window.debugLog('--- Diagnostic démarré ---');
    window.debugLog('UA : ' + navigator.userAgent);
    window.debugLog('Standalone (écran d\'accueil) : ' + (window.navigator.standalone === true));
})();
