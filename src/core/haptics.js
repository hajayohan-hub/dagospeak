/**
 * Haptics — Retour tactile (vibration) sur mobile
 * Utilise l'API Vibration native d'Android
 */
export class Haptics {
  #enabled = true;

  constructor() {
    // ✅ NOUVEAU : Lire depuis les settings globaux (priorité)
    try {
      const settings = JSON.parse(localStorage.getItem('dagospeak:settings') || '{}');
      if (settings.haptics !== undefined) {
        this.#enabled = settings.haptics;
      } else {
        // Fallback sur l'ancienne clé
        const saved = localStorage.getItem('dagospeak:hapticsEnabled');
        if (saved !== null) {
          this.#enabled = saved === 'true';
        } else {
          this.#enabled = true; // Activé par défaut
        }
      }
    } catch (e) {
      this.#enabled = true;
    }

    console.log(`[Haptics] Initialisé - activé: ${this.#enabled}`);
  }

  /**
   * Vibration légère pour les clics normaux
   */
  light() {
    if (!this.#enabled || !navigator.vibrate) return;
    try { navigator.vibrate(10); } catch (e) {}
  }

  /**
   * Vibration moyenne pour les actions importantes
   */
  medium() {
    if (!this.#enabled || !navigator.vibrate) return;
    try { navigator.vibrate(25); } catch (e) {}
  }

  /**
   * Vibration forte pour les succès/erreurs
   */
  strong() {
    if (!this.#enabled || !navigator.vibrate) return;
    try { navigator.vibrate([50, 30, 50]); } catch (e) {}
  }

  /**
   * Activer/désactiver les vibrations
   */
  setEnabled(enabled) {
    this.#enabled = enabled;

    // ✅ NOUVEAU : Sauvegarder dans les deux endroits pour compatibilité
    localStorage.setItem('dagospeak:hapticsEnabled', enabled.toString());

    // Aussi mettre à jour dans settings
    try {
      const settings = JSON.parse(localStorage.getItem('dagospeak:settings') || '{}');
      settings.haptics = enabled;
      localStorage.setItem('dagospeak:settings', JSON.stringify(settings));
    } catch (e) {
      // Silencieux
    }

    console.log(`[Haptics] ${enabled ? '✅ Activé' : '❌ Désactivé'}`);
  }

  isEnabled() {
    return this.#enabled;
  }
}

// Instance globale
window.haptics = new Haptics();