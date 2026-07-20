/**
 * ShadowingEngine - Moteur d'évaluation de prononciation en temps réel.
 * Utilise la Web Speech API du navigateur pour une reconnaissance vocale réelle.
 */
export class ShadowingEngine {
  #bus;
  #recognition = null;
  #isRecording = false;

  constructor(bus) {
    this.#bus = bus;
    this.#initRecognition();
    console.log('[ShadowingEngine] Initialisé avec Web Speech API');
  }

  #initRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('[ShadowingEngine] Web Speech API non supportée sur ce navigateur.');
      return;
    }

    this.#recognition = new SpeechRecognition();
    this.#recognition.lang = 'fr-FR'; // Langue cible (peut être adapté dynamiquement)
    this.#recognition.continuous = false;
    this.#recognition.interimResults = false;
    this.#recognition.maxAlternatives = 1;

    this.#recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      const confidence = event.results[0][0].confidence; // Score de confiance (0.0 à 1.0)
      this.#isRecording = false;

      this.#bus.emit('pronunciation:evaluated', {
        score: confidence,
        feedback: this.#getFeedback(confidence),
        transcript: transcript
      });
    };

    this.#recognition.onerror = (event) => {
      console.warn('[ShadowingEngine] Erreur:', event.error);
      this.#isRecording = false;
      this.#bus.emit('pronunciation:error', { error: event.error });
    };

    this.#recognition.onend = () => {
      this.#isRecording = false;
    };
  }

  startRecording() {
    if (!this.#recognition) {
      this.#bus.emit('pronunciation:error', { error: 'not_supported' });
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
        this.#bus.emit('pronunciation:error', { error: err.message });
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
    if (confidence > 0.60) return 'Tsara ! (Bien)';
    if (confidence > 0.40) return 'Miezaha indray (Essayez encore)';
    return 'Hihainoa tsara ary andramo indray (Écoutez bien et réessayez)';
  }
}