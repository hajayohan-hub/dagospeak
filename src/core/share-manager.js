/**
 * ShareManager — Partage natif de l'app et du certificat
 * Utilise l'API Web Share (Android) + fallback presse-papier
 * Crucial pour la croissance virale à Madagascar (bouche-à-oreille)
 */
export class ShareManager {
  #appUrl = 'https://dagospeak.vercel.app';

  /**
   * Partager l'application (texte + lien)
   */
  async shareApp() {
    const shareData = {
      title: 'DagoSpeak - Apprends le français',
      text: '🇲🇬🇫🇷 Apprends le français facilement avec DagoSpeak ! Leçons, dialogues, et certification A2. 100% hors-ligne. Rejoins-moi !',
      url: this.#appUrl
    };

    // API Web Share native (Android, iOS)
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        if (window.haptics) window.haptics.light();
        return { success: true, method: 'native' };
      } catch (e) {
        // Utilisateur a annulé → on fait rien
        if (e.name === 'AbortError') {
          return { success: false, method: 'cancelled' };
        }
        // Autre erreur → fallback presse-papier
        return this.#copyToClipboard(shareData.url);
      }
    }

    // Fallback : copier le lien
    return this.#copyToClipboard(shareData.url);
  }

  /**
   * Partager le certificat A2 (image PNG)
   * @param {Blob} blob - L'image du certificat
   * @param {string} fileName - Nom du fichier
   */
  async shareCertificate(blob, fileName) {
    if (!blob) return { success: false, error: 'no-blob' };

    const file = new File([blob], fileName, { type: 'image/png' });

    const shareData = {
      title: 'Ma certification DagoSpeak A2 🎓',
      text: 'J\'ai obtenu la certification A2 en français sur DagoSpeak ! Rejoins-moi pour apprendre !',
      files: [file]
    };

    // Vérifier si le partage de fichiers est supporté
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share(shareData);
        if (window.haptics) window.haptics.medium();
        return { success: true, method: 'native-file' };
      } catch (e) {
        if (e.name === 'AbortError') {
          return { success: false, method: 'cancelled' };
        }
        // Fallback : télécharger l'image
        return { success: false, method: 'fallback-download', blob, fileName };
      }
    }

    // Pas de support fichier → proposer le téléchargement
    return { success: false, method: 'fallback-download', blob, fileName };
  }

  /**
   * Copier dans le presse-papier (fallback)
   */
  async #copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.#showToast('✅ Lien copié ! Partage-le avec tes amis.');
      if (window.haptics) window.haptics.light();
      return { success: true, method: 'clipboard' };
    } catch (e) {
      // Dernier recours : prompt manuel
      this.#showToast('📋 Copie ce lien : ' + text, 5000);
      return { success: false, method: 'manual', url: text };
    }
  }

  /**
   * Toast de feedback
   */
  #showToast(message, duration = 3000) {
    const existing = document.getElementById('share-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'share-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 120px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--ds-color-primary, #0A8A6E);
      color: white;
      padding: 12px 24px;
      border-radius: 50px;
      font-size: 0.9rem;
      font-weight: 600;
      z-index: 100000;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
      max-width: 90%;
      text-align: center;
      animation: slideUp 0.3s ease-out;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.4s';
      setTimeout(() => toast.remove(), 400);
    }, duration);
  }
}

// Instance globale
window.shareManager = new ShareManager();