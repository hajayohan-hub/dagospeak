/**
 * ShadowingEngine - Moteur d'évaluation de prononciation optimisé.
 */
export class ShadowingEngine {
  #bus;
  #recognition = null;
  #isRecording = false;

  constructor(bus) {
    this.#bus = bus;
    this.#initRecognition();
    console.log('[ShadowingEngine] Initialisé avec Web Speech API optimisée');
  }

  #initRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('[ShadowingEngine] Web Speech API non supportée.');
      return;
    }

    this.#recognition = new SpeechRecognition();
    this.#recognition.lang = 'fr-FR';
    this.#recognition.continuous = false;
    this.#recognition.interimResults = true; // ✅ Permet de voir les résultats partiels
    this.#recognition.maxAlternatives = 3; // ✅ Obtenir plusieurs alternatives

    this.#recognition.onresult = (event) => {
      const results = event.results[0];
      const bestResult = results[0];
      const transcript = bestResult.transcript;
      const confidence = bestResult.confidence;

      this.#isRecording = false;

      // Normaliser le texte pour une meilleure comparaison
      const normalizedTranscript = this.#normalizeText(transcript);

      this.#bus.emit('pronunciation:evaluated', {
        score: confidence,
        feedback: this.#getFeedback(confidence),
        transcript: normalizedTranscript,
        alternatives: Array.from(results).map(r => this.#normalizeText(r.transcript))
      });
    };

    this.#recognition.onerror = (event) => {
      console.warn('[ShadowingEngine] Erreur:', event.error);
      this.#isRecording = false;
      this.#bus.emit('pronunciation:evaluated', {
        score: 0,
        feedback: 'Tsy nahare tsara (Erreur de reconnaissance)',
        transcript: '',
        error: event.error
      });
    };

    this.#recognition.onend = () => {
      this.#isRecording = false;
    };
  }

  #normalizeText(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\sàâäéèêëïîôùûüÿç']/gi, '') // Garder les accents et apostrophes
      .replace(/\s+/g, ' ')
      .trim();
  }

  startRecording() {
    if (!this.#recognition) {
      this.#bus.emit('pronunciation:evaluated', {
        score: 0,
        feedback: 'Tsy mandeha ny mikrô (Micro non supporté)',
        transcript: '',
        error: 'not_supported'
      });
      return;
    }
    if (this.#isRecording) {
      this.#recognition.stop();
    } else {
      this.#isRecording = true;
      try {
        this.#recognition.start();
      } catch (err) {
        this.#isRecording = false;
        this.#bus.emit('pronunciation:evaluated', {
          score: 0,
          feedback: 'Hadisoana: ' + err.message,
          transcript: '',
          error: err.message
        });
      }
    }
  }

  forceStop() {
    if (this.#recognition && this.#isRecording) {
      this.#recognition.stop();
      this.#isRecording = false;
    }
  }

  #getFeedback(confidence) {
    if (confidence > 0.85) return 'Tsara be ! (Excellent)';
    if (confidence > 0.70) return 'Tsara ! (Bien)';
    if (confidence > 0.50) return 'Miezaha indray (Essayez encore)';
    return 'Hihainoa tsara ary andramo indray (Écoutez bien et réessayez)';
  }
}