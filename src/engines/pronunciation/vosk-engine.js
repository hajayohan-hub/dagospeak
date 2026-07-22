/**
 * VoskEngine - Reconnaissance vocale 100% locale via WebAssembly.
 * Avec téléchargement progressif et suivi en temps réel.
 */
export class VoskEngine {
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
  #modelUrl = 'https://alphacephei.com/vosk/models/vosk-model-small-fr-0.22.zip';
  #expectedSize = 42 * 1024 * 1024; // ~42 Mo estimés

  constructor(bus) {
    this.#bus = bus;
  }

  /**
   * Télécharge le modèle avec suivi de progression
   */
  async #downloadModelWithProgress() {
    this.#bus.emit('vosk:progress', { percent: 0, message: 'Connexion au serveur...' });

    try {
      const response = await fetch(this.#modelUrl);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : this.#expectedSize;

      const reader = response.body.getReader();
      const chunks = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        chunks.push(value);
        received += value.length;

        const percent = (received / total) * 100;
        const receivedMB = (received / (1024 * 1024)).toFixed(1);
        const totalMB = (total / (1024 * 1024)).toFixed(1);

        this.#bus.emit('vosk:progress', {
          percent: percent,
          message: `${receivedMB} Mo / ${totalMB} Mo (${Math.round(percent)}%)`
        });
      }

      this.#bus.emit('vosk:progress', { percent: 95, message: 'Assemblage du modèle...' });

      // Combiner tous les chunks en un seul ArrayBuffer
      const blob = new Blob(chunks);
      return blob;

    } catch (error) {
      console.error('[VoskEngine] Erreur téléchargement:', error);
      throw error;
    }
  }

  /**
   * Initialise le modèle Vosk avec suivi de progression
   */
  async initialize() {
    if (this.#isInitialized) return true;

    if (typeof vosk === 'undefined') {
      console.warn('[VoskEngine] Bibliothèque vosk-browser non chargée');
      this.#bus.emit('vosk:error', { error: 'Bibliothèque Vosk non disponible' });
      return false;
    }

    try {
      this.#bus.emit('vosk:progress', { percent: 5, message: 'Téléchargement du modèle vocal...' });

      // Télécharger le modèle avec progression
      const modelBlob = await this.#downloadModelWithProgress();

      this.#bus.emit('vosk:progress', { percent: 97, message: 'Chargement en mémoire...' });

      // Créer le modèle à partir du Blob
      this.#model = await vosk.createModel(modelBlob);

      // Créer le recognizer
      this.#recognizer = new this.#model.KaldiRecognizer(48000);
      this.#recognizer.setWords(true);

      this.#isInitialized = true;

      this.#bus.emit('vosk:progress', { percent: 100, message: 'Moteur vocal prêt !' });
      this.#bus.emit('vosk:ready');

      console.log('[VoskEngine] ✅ Modèle chargé et prêt');
      return true;

    } catch (error) {
      console.error('[VoskEngine] Erreur initialisation:', error);
      this.#bus.emit('vosk:error', { error: error.message });
      this.#bus.emit('vosk:progress', { percent: 0, message: 'Erreur: ' + error.message });
      return false;
    }
  }

  /**
   * Démarre l'enregistrement et la reconnaissance
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

      this.#mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000
        }
      });

      this.#audioContext = new AudioContext({ sampleRate: 48000 });
      this.#source = this.#audioContext.createMediaStreamSource(this.#mediaStream);

      const bufferSize = 4096;
      this.#processor = this.#audioContext.createScriptProcessor(bufferSize, 1, 1);

      let silenceCount = 0;
      const SILENCE_THRESHOLD = 0.01;
      const MAX_SILENCE_CHUNKS = 15;

      this.#processor.onaudioprocess = (event) => {
        if (!this.#isProcessing) return;

        const inputData = event.inputBuffer.getChannelData(0);
        const volume = Math.max(...Array.from(inputData).map(Math.abs));

        if (volume < SILENCE_THRESHOLD) {
          silenceCount++;
        } else {
          silenceCount = 0;
        }

        this.#audioChunks.push(new Float32Array(inputData));

        if (silenceCount >= MAX_SILENCE_CHUNKS && this.#audioChunks.length > 10) {
          this.stopListening();
        }
      };

      this.#source.connect(this.#processor);
      this.#processor.connect(this.#audioContext.destination);

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

  stopListening() {
    if (!this.#isProcessing) return;

    this.#isProcessing = false;
    clearTimeout(this.#timeout);

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

    if (this.#recognizer && this.#audioChunks.length > 0) {
      try {
        const audioData = this.#convertFloat32ToPCM16(this.#audioChunks);
        const result = this.#recognizer.acceptWaveform(audioData);

        let transcript = '';
        let confidence = 0.5;

        if (result) {
          const finalResult = JSON.parse(this.#recognizer.result());
          transcript = finalResult.text || '';
          confidence = 0.8;
        } else {
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
      this.#bus.emit('pronunciation:evaluated', {
        score: 0,
        feedback: 'Aucun son détecté',
        transcript: '',
        engine: 'vosk'
      });
    }

    if (this.#recognizer) {
      this.#recognizer.Reset();
    }

    this.#audioChunks = [];
  }

  #convertFloat32ToPCM16(chunks) {
    let totalLength = 0;
    for (const chunk of chunks) {
      totalLength += chunk.length;
    }

    const pcmBuffer = new Int16Array(totalLength);
    let offset = 0;

    for (const chunk of chunks) {
      for (let i = 0; i < chunk.length; i++) {
        const sample = Math.max(-1, Math.min(1, chunk[i]));
        pcmBuffer[offset++] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      }
    }

    return pcmBuffer.buffer;
  }

  forceStop() {
    this.stopListening();
  }

  #getFeedback(confidence) {
    if (confidence > 0.85) return 'Tsara be ! (Excellent)';
    if (confidence > 0.70) return 'Tsara ! (Bien)';
    if (confidence > 0.50) return 'Miezaha indray (Essayez encore)';
    return 'Hihainoa tsara ary andramo indray (Écoutez bien et réessayez)';
  }

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

  getStatus() {
    return {
      isInitialized: this.#isInitialized,
      isProcessing: this.#isProcessing
    };
  }
}