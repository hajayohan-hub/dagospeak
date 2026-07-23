/**
 * VoskEngine - Reconnaissance vocale 100% locale via WebAssembly.
 * Modèle auto-hébergé en local (tar.gz), mis en cache par le Service Worker.
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

  // ✅ Modèle local, format tar.gz obligatoire pour vosk-browser
  #modelUrl = '/vosk-model-small-fr-0.22.tar.gz';

  constructor(bus) {
    this.#bus = bus;
  }

  async initialize() {
    if (this.#isInitialized) return true;

    if (typeof Vosk === 'undefined') {
      console.warn('[VoskEngine] Bibliothèque Vosk non chargée. Vérifiez la balise <script> dans index.html');
      this.#bus.emit('vosk:error', { error: 'Bibliothèque Vosk non disponible' });
      return false;
    }

    try {
      if (navigator.storage?.estimate) {
        const { usage = 0, quota = 0 } = await navigator.storage.estimate();
        const free = quota - usage;
        if (quota > 0 && free < 60 * 1024 * 1024) {
          const msg = 'Espace de stockage insuffisant sur cet appareil pour le mode hors-ligne';
          console.warn('[VoskEngine]', msg, { free, quota });
          this.#bus.emit('vosk:error', { error: msg });
          this.#bus.emit('vosk:progress', { percent: 0, message: msg });
          return false;
        }
      }

      if (navigator.storage?.persist) {
        await navigator.storage.persist();
      }

      this.#bus.emit('vosk:progress', { percent: 10, message: 'Téléchargement du modèle (~40 Mo)...' });
      this.#model = await Vosk.createModel(this.#modelUrl);
      this.#bus.emit('vosk:progress', { percent: 90, message: 'Initialisation du moteur...' });

      // ✅ CORRECTION CRUCIALE : Le modèle small-fr est strictement à 16 kHz, PAS 48 kHz !
      this.#recognizer = new this.#model.KaldiRecognizer(16000);
      this.#recognizer.setWords(true);

      this.#isInitialized = true;
      this.#bus.emit('vosk:progress', { percent: 100, message: 'Moteur vocal prêt !' });
      this.#bus.emit('vosk:ready');

      console.log('[VoskEngine] ✅ Modèle chargé et prêt');
      return true;

    } catch (error) {
      const isQuota = error?.name === 'QuotaExceededError';
      const message = isQuota ? 'Espace de stockage insuffisant' : (error?.message || 'Erreur inconnue');
      console.error('[VoskEngine] Erreur initialisation:', error);
      this.#bus.emit('vosk:error', { error: message });
      this.#bus.emit('vosk:progress', { percent: 0, message: 'Erreur: ' + message });
      return false;
    }
  }

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

    if (this.#isProcessing) return;

    try {
      this.#isProcessing = true;
      this.#audioChunks = [];
      this.#bus.emit('vosk:listening');

      // ✅ Le navigateur gère le resampling automatiquement, on enlève la contrainte 48k
      this.#mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });

      // ✅ CORRECTION CRUCIALE : AudioContext à 16 kHz pour correspondre au modèle Vosk
      this.#audioContext = new AudioContext({ sampleRate: 16000 });
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
        if (this.#isProcessing) this.stopListening();
      }, 10000);

    } catch (error) {
      console.error('[VoskEngine] Erreur micro:', error);
      this.#isProcessing = false;
      this.#bus.emit('pronunciation:evaluated', {
        score: 0, feedback: 'Micro non disponible', transcript: '', error: error.message, engine: 'vosk'
      });
    }
  }

  stopListening() {
    if (!this.#isProcessing) return;
    this.#isProcessing = false;
    clearTimeout(this.#timeout);

    if (this.#processor) { this.#processor.disconnect(); this.#processor = null; }
    if (this.#source) { this.#source.disconnect(); this.#source = null; }
    if (this.#mediaStream) { this.#mediaStream.getTracks().forEach(track => track.stop()); this.#mediaStream = null; }
    if (this.#audioContext) { this.#audioContext.close(); this.#audioContext = null; }

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
        }

        this.#bus.emit('pronunciation:evaluated', {
          score: confidence,
          feedback: this.#getFeedback(confidence),
          transcript: transcript,
          engine: 'vosk'
        });
      } catch (error) {
        console.error('[VoskEngine] Erreur traitement:', error);
        this.#bus.emit('pronunciation:evaluated', { score: 0, feedback: 'Erreur de traitement', transcript: '', error: error.message, engine: 'vosk' });
      }
    } else {
      this.#bus.emit('pronunciation:evaluated', { score: 0, feedback: 'Aucun son détecté', transcript: '', engine: 'vosk' });
    }

    if (this.#recognizer) this.#recognizer.Reset();
    this.#audioChunks = [];
  }

  #convertFloat32ToPCM16(chunks) {
    let totalLength = 0;
    for (const chunk of chunks) totalLength += chunk.length;

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

  forceStop() { this.stopListening(); }

  #getFeedback(confidence) {
    if (confidence > 0.85) return 'Tsara be ! (Excellent)';
    if (confidence > 0.70) return 'Tsara ! (Bien)';
    if (confidence > 0.50) return 'Miezaha indray (Essayez encore)';
    return 'Hihainoa tsara ary andramo indray (Écoutez bien et réessayez)';
  }

  destroy() {
    this.forceStop();
    if (this.#recognizer) { this.#recognizer.free(); this.#recognizer = null; }
    if (this.#model) { this.#model.free(); this.#model = null; }
    this.#isInitialized = false;
  }

  getStatus() {
    return { isInitialized: this.#isInitialized, isProcessing: this.#isProcessing };
  }
}