/**
 * STTManager — Gestion intelligente du Speech-to-Text
 * Mode offline : simulation avec feedback pédagogique
 * Mode online : Web Speech API réel
 */
export class STTManager {
  #recognition = null;
  #isSupported = false;
  #isListening = false;
  #deviceTier = 'unknown';
  #isOffline = false;
  #simulationMode = false;

  constructor() {
    this.#detectCapabilities();
    this.#setupNetworkListeners();
  }

  #setupNetworkListeners() {
    window.addEventListener('online', () => {
      this.#isOffline = false;
      this.#detectCapabilities();
      console.log('[STTManager] ✅ Connexion rétablie, STT réel disponible');
    });

    window.addEventListener('offline', () => {
      this.#isOffline = true;
      this.#simulationMode = true;
      console.log('[STTManager] ⚠️ Mode offline, simulation STT activée');
    });
  }

  #detectCapabilities() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.#isSupported = !!SpeechRecognition && !this.#isOffline;

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
      if (ram < 2) this.#deviceTier = 'low';
      else if (ram < 4) this.#deviceTier = 'mid';
      else this.#deviceTier = 'high';
    }

    // Mode simulation si offline
      // Si online, vérifier le toggle utilisateur
      if (this.#isOffline) {
        this.#simulationMode = true;
      } else {
        // Vérifier le toggle utilisateur dans les settings
        const settings = JSON.parse(localStorage.getItem('dagospeak:settings') || '{}');
        const userWantsRealSTT = settings.sttEnabled !== false; // Par défaut activé
        
        // Si l'utilisateur veut du STT réel ET que c'est supporté, utiliser le mode réel
        this.#simulationMode = !userWantsRealSTT || !this.#isSupported;
      }

    console.log(`[STTManager] Support: ${this.#isSupported}, Tier: ${this.#deviceTier}, Offline: ${this.#isOffline}, Simulation: ${this.#simulationMode}`);
  }

  /**
   * Vérifie si le STT est disponible (réel ou simulé)
   */
  isAvailable() {
    return true; // Toujours disponible (réel ou simulé)
  }

  /**
   * Vérifie si on utilise la simulation
   */
  isSimulationMode() {
    return this.#simulationMode;
  }

  /**
   * Démarre l'écoute (réelle ou simulée)
   */
     startListening(lang = 'fr-FR', callbacks = {}) {
      console.log(`[STTManager] startListening appelé, isListening=${this.#isListening}, simulationMode=${this.#simulationMode}`);
      
    if (this.#isListening) {
      console.warn('[STTManager] Écoute déjà active, arrêt de la précédente');
      this.stopListening();
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(this.startListening(lang, callbacks));
        }, 300);
      });
    }

    // ✅ Mode simulation (offline ou low-end)
    if (this.#simulationMode) {
      return this.#simulateListening(callbacks);
    }

    // ✅ Mode réel (Web Speech API)
    return this.#startRealListening(lang, callbacks);
  }

  /**
   * Simulation d'écoute (mode offline)
   */
  #simulateListening(callbacks) {
    console.log('[STTManager] 🎭 Mode simulation activé');

    callbacks.onStart?.();
    this.#isListening = true;

    // Simuler un délai d'écoute (1-2 secondes)
    const listenDuration = 1500 + Math.random() * 1000;

    setTimeout(() => {
      this.#isListening = false;

      // Simuler une reconnaissance (toujours "correcte" en mode encouragement)
        callbacks.onResult?.({
          transcript: '[Mode entraînement hors connexion]',
          isReal: false,
          confidence: 1.0
        });

      callbacks.onEnd?.();

      // Message pédagogique
      console.log('[STTManager] 💡 Simulation terminée, feedback encourageant');
    }, listenDuration);

    return true;
  }

  /**
   * Écoute réelle (Web Speech API)
   */
  #startRealListening(lang, callbacks) {
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
          const results = event.results[0];
          const bestResult = results[0];
          callbacks.onResult?.({
            transcript: bestResult.transcript,
            isReal: true,
            confidence: bestResult.confidence,
            alternatives: Array.from(results).map(r => r.transcript)
          });
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
   * Arrête l'écoute
   */
  stopListening() {
    if (this.#recognition && this.#isListening) {
      this.#recognition.stop();
      this.#isListening = false;
    } else if (this.#isListening) {
      // Mode simulation : juste arrêter le flag
      this.#isListening = false;
    }
  }

  /**
   * Compare le texte reconnu avec le texte attendu
   * Mode simulation : toujours encourageant
   * Mode réel : comparaison précise
   */
  compareTexts(recognized, expected) {
    if (!recognized || !expected) {
      return { score: 0, isCorrect: false, feedback: 'Aucun texte reconnu' };
    }

    // ✅ Mode simulation : feedback toujours encourageant
    if (this.#simulationMode) {
      console.log('[STTManager] 💬 Simulation : feedback encourageant');
      return {
        score: 85, // Score encourageant
        isCorrect: true, // Toujours "correct" en simulation
        feedback: 'Bien prononcé ! Continuez ainsi.',
        isSimulation: true
      };
    }

    // ✅ Mode réel : comparaison précise
    const norm = (text) => text.toLowerCase().trim().replace(/[.,!?]/g, '');
    const rec = norm(recognized);
    const exp = norm(expected);

    if (rec === exp) {
      return { score: 100, isCorrect: true, feedback: 'Parfait !' };
    }

    const words1 = rec.split(' ');
    const words2 = exp.split(' ');

    const common = words1.filter(w => words2.includes(w)).length;
    const baseScore = Math.round((common / Math.max(words1.length, words2.length)) * 100);

    const keywords = ['bonjour', 'merci', 'je', 'tu', 'il', 'elle', 'nous', 'vous',
                      'appelle', 'mange', 'achète', 'veux', 'suis', 'es', 'est',
                      'rouge', 'bleu', 'vert', 'jaune', 'blanc', 'noir'];

    const keywordMatches = keywords.filter(k => rec.includes(k) && exp.includes(k)).length;
    const bonus = keywordMatches * 10;

    const score = Math.min(100, baseScore + bonus);
    const isCorrect = score >= 60;

    const feedback = isCorrect ? 'Très bien !' : 'Essaie encore';

    console.log(`[STT] Comparaison: rec="${rec}", exp="${exp}", score=${score}%`);

    return { score, isCorrect, feedback, isSimulation: false };
  }

  /**
   * Retourne le tier de l'appareil
   */
  getTier() {
    return this.#deviceTier;
  }
}

export const sttManager = new STTManager();