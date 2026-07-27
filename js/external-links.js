// ================================================================
// LUMIÈRE AUDIO — js/external-links.js
// ----------------------------------------------------------------
// Problème : sur iOS, quand l'app est ajoutée à l'écran d'accueil
// ("display": "standalone" dans manifest.json), les liens externes
// restent piégés dans le "webclip" minimal de l'app, qui ne gère
// pas du tout les téléchargements (pas de gestionnaire de
// téléchargement, pas d'intégration Fichiers/partage).
//
// Solution : sur iOS uniquement, on réécrit l'URL du lien vers la
// bibliothèque en utilisant le schéma x-safari-https://, propre à
// Safari, qui force la sortie du webclip vers un vrai onglet
// Safari complet.
//
// ⚠️ Ce schéma n'existe que sur iOS/Safari. Sur Android, PC, ou
// tout autre navigateur, il romprait le lien (URL invalide). On
// ne le remplace donc QUE si on détecte iOS ; ailleurs, l'URL
// normale (https://) reste inchangée et s'ouvre comme d'habitude.
// ================================================================

(function () {
  'use strict';

  var link = document.getElementById('link-library');
  if (!link) return;

  // Détection iOS : iPhone/iPod/iPad classiques, + iPadOS 13+ qui se
  // présente comme "MacIntel" mais reste tactile (maxTouchPoints > 1),
  // contrairement à un vrai Mac avec souris/trackpad.
  var isIOS =
    /iP(hone|od|ad)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  if (!isIOS) {
    // Android, PC, etc. : on ne touche à rien, l'URL normale suffit.
    return;
  }

  // Réécrit uniquement le préfixe "https://" en "x-safari-https://"
  // (link.href renvoie toujours l'URL absolue résolue par le navigateur).
  link.href = link.href.replace(/^https:\/\//, 'x-safari-https://');
})();
