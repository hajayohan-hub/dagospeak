/**
 * SpeechRecognitionEngine - Moteur de reconnaissance vocale réutilisable.
 * Utilise la Web Speech API du navigateur (Chrome, Edge, Safari).
 */
export class SpeechRecognitionEngine {
  #bus;
  #recognition = null;
  #isListening = false;
  #currentResolve = null;

  constructor(bus) {
    this.#bus = bus;
    this.#initRecognition();
  }

  #initRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('[SpeechRecognition] API non supportée sur ce navigateur');
      return;
    }

    this.#recognition = new SpeechRecognition();
    this.#recognition.lang = 'fr-FR';
    this.#recognition.continuous = false;
    this.#recognition.interimResults = false;
    this.#recognition.maxAlternatives = 1;

    this.#recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      const confidence = event.results[0][0].confidence;
      this.#isListening = false;
      this.#bus.emit('speech:recognized', { transcript, confidence });
      if (this.#currentResolve) {
        this.#currentResolve({ transcript, confidence });
        this.#currentResolve = null;
      }
    };

    this.#recognition.onerror = (event) => {
      console.warn('[SpeechRecognition] Erreur:', event.error);
      this.#isListening = false;
      this.#bus.emit('speech:error', { error: event.error });
      if (this.#currentResolve) {
        this.#currentResolve({ transcript: '', confidence: 0, error: event.error });
        this.#currentResolve = null;
      }
    };

    this.#recognition.onend = () => {
      this.#isListening = false;
    };
  }

  /**
   * Démarre l'écoute et retourne une promesse avec la transcription
   * @returns {Promise<{transcript: string, confidence: number, error?: string}>}
   */
  async listen() {
    if (!this.#recognition) {
      return { transcript: '', confidence: 0, error: 'not_supported' };
    }
    if (this.#isListening) {
      this.#recognition.stop();
    }

    return new Promise((resolve) => {
      this.#currentResolve = resolve;
      this.#isListening = true;
      this.#bus.emit('speech:listening');
      try {
        this.#recognition.start();
      } catch (err) {
        this.#isListening = false;
        resolve({ transcript: '', confidence: 0, error: err.message });
      }
    });
  }

  stop() {
    if (this.#recognition && this.#isListening) {
      this.#recognition.stop();
      this.#isListening = false;
    }
  }

  isSupported() {
    return !!this.#recognition;
  }
}