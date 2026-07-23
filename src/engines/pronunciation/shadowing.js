/**
 * ShadowingEngine - Moteur de prononciation hybride (Vosk offline + Web Speech online).
 * Utilise automatiquement la meilleure option selon la connectivité et l'appareil.
 */
import { VoskEngine } from './vosk-engine.js';

export class ShadowingEngine {
  #bus;
  #webRecognition = null;
  #voskEngine = null;
  #isRecording = false;
  #isVoskReady = false;
  #useVosk = false;

  constructor(bus) {
    this.#bus = bus;
    this.#initWebRecognition();
    this.#initVosk();
    console.log('[ShadowingEngine] Initialisé (mode hybride)');
  }

  #initWebRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    this.#webRecognition = new SpeechRecognition();
    this.#webRecognition.lang = 'fr-FR';
    this.#webRecognition.continuous = false;
    this.#webRecognition.interimResults = true;
    this.#webRecognition.maxAlternatives = 3;

    this.#webRecognition.onresult = (event) => {
      const results = event.results[0];
      const bestResult = results[0];
      const transcript = bestResult.transcript;
      const confidence = bestResult.confidence;

      this.#isRecording = false;

      this.#bus.emit('pronunciation:evaluated', {
        score: confidence,
        feedback: this.#getFeedback(confidence),
        transcript: this.#normalizeText(transcript),
        alternatives: Array.from(results).map(r => this.#normalizeText(r.transcript)),
        engine: 'webspeech'
      });
    };

    this.#webRecognition.onerror = (event) => {
      console.warn('[ShadowingEngine] Erreur Web Speech:', event.error);
      this.#isRecording = false;

      if (event.error === 'network' || event.error === 'aborted') {
        // Essayer de basculer sur Vosk si disponible
        if (this.#isVoskReady && this.#voskEngine) {
          console.log('[ShadowingEngine] Bascule vers Vosk (pas de réseau)');
          this.#voskEngine.startListening();
        } else {
          this.#bus.emit('pronunciation:offline', {
            score: 1.0,
            feedback: "📶 Mode hors-ligne : Écoutez bien et enregistrez-vous pour vous auto-évaluer.",
            transcript: "Mode auto-évaluation"
          });
        }
      } else {
        this.#bus.emit('pronunciation:evaluated', {
          score: 0,
          feedback: 'Erreur de reconnaissance',
          transcript: '',
          error: event.error
        });
      }
    };

    this.#webRecognition.onend = () => {
      this.#isRecording = false;
    };
  }

  async #initVosk() {
    // Vérifier si l'appareil peut supporter Vosk (>= 2 Go RAM)
    const memory = navigator.deviceMemory || 4;
    if (memory < 2) {
      console.log('[ShadowingEngine] Appareil trop modeste pour Vosk');
      return;
    }

    try {
      this.#voskEngine = new VoskEngine(this.#bus);

      // Écouter les événements Vosk
      this.#bus.on('vosk:ready', () => {
        this.#isVoskReady = true;
        console.log('[ShadowingEngine] ✅ Vosk prêt');
      });

      this.#bus.on('vosk:loading', (data) => {
        this.#bus.emit('pronunciation:evaluated', {
          score: 0,
          feedback: `⏳ ${data.message}`,
          transcript: '',
          engine: 'vosk-loading'
        });
      });

      // Démarrer le chargement de Vosk en arrière-plan (non bloquant)
      // Le modèle sera mis en cache par le Service Worker après le 1er téléchargement
      console.log('[ShadowingEngine] Préchargement de Vosk en arrière-plan...');
      this.#voskEngine.initialize().catch(err => {
        console.warn('[ShadowingEngine] Échec préchargement Vosk:', err);
      });

    } catch (err) {
      console.warn('[ShadowingEngine] Vosk non disponible:', err);
    }
  }

  async startRecording(useVoskOverride = false) {
    // Décider du moteur à utiliser
    const isOnline = navigator.onLine;
    this.#useVosk = useVoskOverride || (!isOnline && this.#isVoskReady);

    if (this.#useVosk && this.#isVoskReady) {
      console.log('[ShadowingEngine] Utilisation de Vosk (offline)');
      this.#isRecording = true;
      await this.#voskEngine.startListening();
    } else if (this.#webRecognition) {
      console.log('[ShadowingEngine] Utilisation de Web Speech API');
      if (this.#isRecording) {
        this.#webRecognition.stop();
      } else {
        this.#isRecording = true;
        try {
          this.#webRecognition.start();
        } catch (err) {
          this.#isRecording = false;
          this.#bus.emit('pronunciation:evaluated', {
            score: 0,
            feedback: 'Erreur: ' + err.message,
            transcript: '',
            error: err.message
          });
        }
      }
    } else {
      // Fallback ultime
      this.#bus.emit('pronunciation:offline', {
        score: 1.0,
        feedback: "📶 Reconnaissance vocale non disponible. Pratiquez en vous écoutant.",
        transcript: "Mode pratique libre"
      });
    }
  }

  forceStop() {
    if (this.#webRecognition && this.#isRecording) {
      this.#webRecognition.stop();
    }
    if (this.#voskEngine) {
      this.#voskEngine.forceStop();
    }
    this.#isRecording = false;
  }

  #normalizeText(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\sàâäéèêëïîôùûüÿç']/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  #getFeedback(confidence) {
    if (confidence > 0.85) return 'Tsara be ! (Excellent)';
    if (confidence > 0.70) return 'Tsara ! (Bien)';
    if (confidence > 0.50) return 'Miezaha indray (Essayez encore)';
    return 'Hihainoa tsara ary andramo indray (Écoutez bien et réessayez)';
  }

  /**
   * Retourne l'état actuel du moteur
   */
  getStatus() {
    return {
      isVoskReady: this.#isVoskReady,
      isWebSpeechAvailable: !!this.#webRecognition,
      isRecording: this.#isRecording
    };
  }

    /**
   * Méthode publique pour précharger le modèle Vosk lors de l'onboarding
   */
  async preloadVoskModel() {
    if (this.#voskEngine) {
      return await this.#voskEngine.initialize();
    }
    return false;
  }
}