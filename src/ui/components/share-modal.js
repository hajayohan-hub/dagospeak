/**
 * Share Modal — Fonctionnalité de partage (version robuste)
 */

function initShareModal() {
  // Ne rien faire si aucun bouton de partage n'existe
  const shareBtn = document.getElementById('btn-share');

  if (!shareBtn) {
    console.log('[ShareModal] Aucun bouton de partage trouvé.');
    return;
  }

  shareBtn.addEventListener('click', (e) => {
    e.preventDefault();

    if (navigator.share) {
      navigator.share({
        title: 'DagoSpeak - Apprenez le français',
        text: 'Découvrez DagoSpeak, l\'app pour apprendre le français facilement !',
        url: window.location.href
      }).catch(err => console.log('[ShareModal] Partage annulé'));
    } else {
      navigator.clipboard.writeText(window.location.href).then(() => {
        alert('Lien copié !');
      });
    }
  });
}

// Attendre que le DOM soit prêt
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initShareModal);
} else {
  initShareModal();
}

export {};