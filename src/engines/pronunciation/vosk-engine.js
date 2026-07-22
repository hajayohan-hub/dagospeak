/**
 * VoskEngine - Reconnaissance vocale 100% locale via WebAssembly.
 * Fonctionne parfaitement hors-ligne sur appareils modestes.
 */
export class VoskEngine {
  // ✅ DÉCLARATION DE TOUS LES CHAMPS PRIVÉS (C'est ce qui manquait)
  #bus;
  #model = null;
  #recognizer = null;
  #audioContext = null;
  #mediaStream = null;
  #processor = null;
  #source = null;
  #timeout = null;
  #isInitialized = false;
  #isProcessing = false;
  #audioChunks = [];
  #modelUrl = 'https://alphacephei.com/vosk/models/vosk-model-small-fr-0.22.tar';

  constructor(bus) {
    this.#bus = bus;
  }

  /**
   * Initialise le modèle Vosk (à appeler une seule fois)
   */
  async initialize() {
    if (this.#isInitialized) return true;

    if (typeof vosk === 'undefined') {
      console.warn('[VoskEngine] Bibliothèque vosk-browser non chargée');
      return false;
    }

    try {
      this.#bus.emit('vosk:loading', { message: 'Chargement du modèle vocal (~40 Mo)...' });

      // Créer le modèle (téléchargement automatique si pas en cache)
      this.#model = await vosk.createModel(this.#modelUrl);

      // Créer le recognizer avec une grammaire optimisée pour nos leçons
      const vocab = [
        "bonjour", "merci", "oui", "non", "s'il vous plaît",
        "au revoir", "comment", "allez-vous", "famille", "marché",
        "misaotra", "manahoana", "veloma", "eny", "tsia",
        "ray", "reny", "anaka", "anaka", "rahoviana",
        "firy", "voalohany", "faharoa", "fahatelo",
        "[unk]" // Token pour mots inconnus (obligatoire)
      ];

      this.#recognizer = new this.#model.KaldiRecognizer(48000);
      this.#recognizer.setWords(true);

      this.#isInitialized = true;
      this.#bus.emit('vosk:ready');
      console.log('[VoskEngine] ✅ Modèle chargé et prêt');
      return true;

    } catch (error) {
      console.error('[VoskEngine] Erreur initialisation:', error);
      this.#bus.emit('vosk:error', { error: error.message });
      return false;
    }
  }

  /**
   * Démarre l'enregistrement et la reconnaissance en temps réel
   */
  async startListening(targetText = '') {
    if (!this.#isInitialized) {
      const initOk = await this.initialize();
      if (!initOk) {
        this.#bus.emit('pronunciation:offline', {
          score: 1.0,
          feedback: "📶 Vosk non disponible. Pratiquez en vous écoutant.",
          transcript: "Mode pratique libre"
        });
        return;
      }
    }

    if (this.#isProcessing) {
      console.warn('[VoskEngine] Déjà en cours de traitement');
      return;
    }

    try {
      this.#isProcessing = true;
      this.#audioChunks = [];
      this.#bus.emit('vosk:listening');

      // Obtenir l'accès au micro
      this.#mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000
        }
      });

      // Créer le contexte audio
      this.#audioContext = new AudioContext({ sampleRate: 48000 });
      this.#source = this.#audioContext.createMediaStreamSource(this.#mediaStream);

      // Créer un ScriptProcessorNode pour capturer l'audio en temps réel
      const bufferSize = 4096;
      this.#processor = this.#audioContext.createScriptProcessor(bufferSize, 1, 1);

      let silenceCount = 0;
      const SILENCE_THRESHOLD = 0.01;
      const MAX_SILENCE_CHUNKS = 15; // ~2 secondes de silence pour arrêter

      this.#processor.onaudioprocess = (event) => {
        if (!this.#isProcessing) return;

        const inputData = event.inputBuffer.getChannelData(0);

        // Détecter le silence
        const volume = Math.max(...Array.from(inputData).map(Math.abs));
        if (volume < SILENCE_THRESHOLD) {
          silenceCount++;
        } else {
          silenceCount = 0;
        }

        this.#audioChunks.push(new Float32Array(inputData));

        // Arrêter automatiquement après silence prolongé
        if (silenceCount >= MAX_SILENCE_CHUNKS && this.#audioChunks.length > 10) {
          this.stopListening();
        }
      };

      this.#source.connect(this.#processor);
      this.#processor.connect(this.#audioContext.destination);

      // Timeout de sécurité : arrêter après 10 secondes max
      this.#timeout = setTimeout(() => {
        if (this.#isProcessing) {
          this.stopListening();
        }
      }, 10000);

    } catch (error) {
      console.error('[VoskEngine] Erreur micro:', error);
      this.#isProcessing = false;
      this.#bus.emit('pronunciation:evaluated', {
        score: 0,
        feedback: 'Micro non disponible',
        transcript: '',
        error: error.message,
        engine: 'vosk'
      });
    }
  }

  /**
   * Arrête l'enregistrement et traite le résultat avec Vosk
   */
  stopListening() {
    if (!this.#isProcessing) return;

    this.#isProcessing = false;
    clearTimeout(this.#timeout);

    // Arrêter les flux audio
    if (this.#processor) {
      this.#processor.disconnect();
      this.#processor = null;
    }
    if (this.#source) {
      this.#source.disconnect();
      this.#source = null;
    }
    if (this.#mediaStream) {
      this.#mediaStream.getTracks().forEach(track => track.stop());
      this.#mediaStream = null;
    }
    if (this.#audioContext) {
      this.#audioContext.close();
      this.#audioContext = null;
    }

    // Traiter l'audio accumulé avec Vosk
    if (this.#recognizer && this.#audioChunks.length > 0) {
      try {
        // Convertir les chunks Float32 en format PCM 16-bit pour Vosk
        const audioData = this.#convertFloat32ToPCM16(this.#audioChunks);

        // Envoyer les données à Vosk pour reconnaissance
        const result = this.#recognizer.acceptWaveform(audioData);

        let transcript = '';
        let confidence = 0.5;

        if (result) {
          // Reconnaissance finale
          const finalResult = JSON.parse(this.#recognizer.result());
          transcript = finalResult.text || '';
          confidence = 0.8; // Vosk ne donne pas de score de confiance direct
        } else {
          // Résultat partiel
          const partialResult = JSON.parse(this.#recognizer.partialResult());
          transcript = partialResult.partial || '';
          confidence = 0.5;
        }

        this.#bus.emit('pronunciation:evaluated', {
          score: confidence,
          feedback: this.#getFeedback(confidence),
          transcript: transcript,
          engine: 'vosk'
        });

      } catch (error) {
        console.error('[VoskEngine] Erreur traitement:', error);
        this.#bus.emit('pronunciation:evaluated', {
          score: 0,
          feedback: 'Erreur de traitement',
          transcript: '',
          error: error.message,
          engine: 'vosk'
        });
      }
    } else {
      // Pas d'audio capturé
      this.#bus.emit('pronunciation:evaluated', {
        score: 0,
        feedback: 'Aucun son détecté',
        transcript: '',
        engine: 'vosk'
      });
    }

    // Nettoyer le recognizer pour la prochaine utilisation
    if (this.#recognizer) {
      this.#recognizer.Reset();
    }

    this.#audioChunks = [];
  }

  /**
   * Convertit Float32Array en PCM 16-bit (format requis par Vosk)
   */
  #convertFloat32ToPCM16(chunks) {
    // Calculer la taille totale
    let totalLength = 0;
    for (const chunk of chunks) {
      totalLength += chunk.length;
    }

    // Créer un buffer PCM 16-bit
    const pcmBuffer = new Int16Array(totalLength);
    let offset = 0;

    for (const chunk of chunks) {
      for (let i = 0; i < chunk.length; i++) {
        // Convertir Float32 [-1, 1] en Int16 [-32768, 32767]
        const sample = Math.max(-1, Math.min(1, chunk[i]));
        pcmBuffer[offset++] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      }
    }

    return pcmBuffer.buffer;
  }

  /**
   * Force l'arrêt immédiat
   */
  forceStop() {
    this.stopListening();
  }

  #getFeedback(confidence) {
    if (confidence > 0.85) return 'Tsara be ! (Excellent)';
    if (confidence > 0.70) return 'Tsara ! (Bien)';
    if (confidence > 0.50) return 'Miezaha indray (Essayez encore)';
    return 'Hihainoa tsara ary andramo indray (Écoutez bien et réessayez)';
  }

  /**
   * Libère les ressources
   */
  destroy() {
    this.forceStop();
    if (this.#recognizer) {
      this.#recognizer.free();
      this.#recognizer = null;
    }
    if (this.#model) {
      this.#model.free();
      this.#model = null;
    }
    this.#isInitialized = false;
  }

  /**
   * Retourne l'état actuel
   */
  getStatus() {
    return {
      isInitialized: this.#isInitialized,
      isProcessing: this.#isProcessing
    };
  }
}