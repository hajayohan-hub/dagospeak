/**
 * VoskEngine - Version temporaire (Vosk désactivé - incompatible avec vosk-browser 0.0.8)
 * Utilise le fallback Web Speech API + auto-évaluation hors-ligne
 */
export class VoskEngine {
  #bus;
  #isInitialized = false;

  constructor(bus) {
    this.#bus = bus;
  }

  async initialize() {
    // ✅ Vosk temporairement désactivé - incompatibilité avec le modèle FR moderne
    console.warn('[VoskEngine] Vosk désactivé temporairement (incompatible avec vosk-browser 0.0.8). Utilisation du fallback Web Speech API.');
    this.#bus.emit('vosk:error', {
      error: 'Vosk désactivé - Utilisation du mode hybride (Web Speech API + auto-évaluation)'
    });
    this.#isInitialized = false;
    return false;
  }

  async startListening() {
    // Ne fait rien - le ShadowingEngine basculera automatiquement sur Web Speech API
    this.#bus.emit('pronunciation:offline', {
      score: 1.0,
      feedback: "📶 Mode pratique : Écoutez, prononcez et comparez avec le modèle.",
      transcript: "Mode auto-évaluation"
    });
  }

  forceStop() { /* Rien à faire */ }

  getStatus() {
    return { isInitialized: false, isProcessing: false };
  }

  destroy() { /* Rien à nettoyer */ }
}