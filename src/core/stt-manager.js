/**
 * STTManager — Gestion intelligente du Speech-to-Text
 * Détecte les capacités et propose des fallbacks adaptés
 */
export class STTManager {
  #recognition = null;
  #isSupported = false;
  #isListening = false;
  #deviceTier = 'unknown';

  constructor() {
    this.#detectCapabilities();
  }

  #detectCapabilities() {
        // Détection du support Web Speech API
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.#isSupported = !!SpeechRecognition;

        // ✅ Détection du mode hors-ligne
        const isOffline = !navigator.onLine;
        if (isOffline) {
          console.warn('[STTManager] ⚠️ Mode hors-ligne détecté, STT désactivé');
          this.#isSupported = false;
        }

        // Écouter les changements de connexion
        window.addEventListener('online', () => {
          this.#detectCapabilities();
          console.log('[STTManager] ✅ Connexion rétablie');
        });

        window.addEventListener('offline', () => {
          this.#isSupported = false;
          console.warn('[STTManager] ⚠️ Passage en mode hors-ligne, STT désactivé');
        });

        // Détection du tier appareil
        if (window.deviceCheck) {
          if (window.deviceCheck.isVeryLowEnd()) {
            this.#deviceTier = 'low';
          } else if (window.deviceCheck.isLowEnd()) {
            this.#deviceTier = 'mid';
          } else {
            this.#deviceTier = 'high';
          }
        } else {
          const ram = navigator.deviceMemory || 4;
          const connection = navigator.connection?.effectiveType || '4g';

          if (ram >= 4 && connection === '4g') {
            this.#deviceTier = 'high';
          } else if (ram >= 2 && ['4g', '3g'].includes(connection)) {
            this.#deviceTier = 'mid';
          } else {
            this.#deviceTier = 'low';
          }
        }

        console.log(`[STTManager] Support: ${this.#isSupported}, Tier: ${this.#deviceTier}, Offline: ${isOffline}`);
      }

  /**
   * Vérifie si le STT est disponible
   */
  isAvailable() {
    return this.#isSupported && this.#deviceTier !== 'low';
  }

     /**
   * Démarre l'écoute
   * @param {string} lang - Code langue (ex: 'fr-FR')
   * @param {Object} callbacks - { onStart, onResult, onEnd, onError }
   */
  startListening(lang = 'fr-FR', callbacks = {}) {
    if (!this.isAvailable()) {
      console.warn('[STTManager] STT non disponible');
      callbacks.onError?.('STT non disponible sur cet appareil');
      return false;
    }

    // ✅ Arrêter l'écoute précédente si active
    if (this.#isListening) {
      console.warn('[STTManager] Écoute déjà active, arrêt de la précédente');
      this.stopListening();
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(this.startListening(lang, callbacks));
        }, 300);
      });
    }

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.#recognition = new SpeechRecognition();

      this.#recognition.lang = lang;
      this.#recognition.interimResults = false;
      this.#recognition.maxAlternatives = 3;
      this.#recognition.continuous = false;

      this.#recognition.onstart = () => {
        this.#isListening = true;
        callbacks.onStart?.();
      };

      this.#recognition.onresult = (event) => {
        const results = [];
        for (let i = 0; i < event.results.length; i++) {
          results.push(event.results[i][0].transcript);
        }
        callbacks.onResult?.(results);
      };

      this.#recognition.onend = () => {
        this.#isListening = false;
        callbacks.onEnd?.();
      };

      this.#recognition.onerror = (event) => {
        this.#isListening = false;
        console.error('[STTManager] Erreur:', event.error);
        callbacks.onError?.(event.error);
      };

      this.#recognition.start();
      return true;

    } catch (e) {
      console.error('[STTManager] Erreur démarrage:', e);
      callbacks.onError?.(e.message);
      return false;
    }
  }

  /**
   * Compare le texte reconnu avec le texte attendu
   * @param {string} recognized - Texte reconnu par STT
   * @param {string} expected - Texte attendu
   * @returns {Object} { score, isCorrect, feedback }
   */
  compareTexts(recognized, expected) {
      if (!recognized || !expected) {
        return { score: 0, isCorrect: false, feedback: 'Aucun texte reconnu' };
      }

      // Normalisation
      const norm = (text) => text.toLowerCase().trim().replace(/[.,!?]/g, '');
      const rec = norm(recognized);
      const exp = norm(expected);

      // ✅ Comparaison exacte
      if (rec === exp) {
        return { score: 100, isCorrect: true, feedback: 'Parfait !' };
      }

      // ✅ Calcul de similarité avec mots clés
      const words1 = rec.split(' ');
      const words2 = exp.split(' ');

      // Compter les mots communs
      const common = words1.filter(w => words2.includes(w)).length;
      const baseScore = Math.round((common / Math.max(words1.length, words2.length)) * 100);

      // ✅ Bonus pour mots-clés importants (verbes, noms principaux)
      const keywords = ['bonjour', 'merci', 'je', 'tu', 'il', 'elle', 'nous', 'vous',
                        'appelle', 'mange', 'achète', 'veux', 'suis', 'es', 'est',
                        'rouge', 'bleu', 'vert', 'jaune', 'blanc', 'noir'];

      const keywordMatches = keywords.filter(k => rec.includes(k) && exp.includes(k)).length;
      const bonus = keywordMatches * 10; // +10% par mot-clé trouvé

      const score = Math.min(100, baseScore + bonus);
      const isCorrect = score >= 60; // ✅ Seuil plus permissif (60% au lieu de 70%)

      const feedback = isCorrect ? 'Très bien !' : 'Essaie encore';

      console.log(`[STT] Comparaison: rec="${rec}", exp="${exp}", score=${score}%`);

      return { score, isCorrect, feedback };
    }

  /**
   * Retourne le tier de l'appareil
   */
  getTier() {
    return this.#deviceTier;
  }
}



// Instance globale
export const sttManager = new STTManager();