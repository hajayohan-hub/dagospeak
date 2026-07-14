export class ShadowingEngine {
  #bus;
  #mediaRecorder = null;
  #audioChunks = [];
  #autoStopTimeout = null;
  #stream = null;
  #isRecording = false;

  constructor(bus) {
    this.#bus = bus;
  }

  forceStop() {
    if (this.#autoStopTimeout) {
      clearTimeout(this.#autoStopTimeout);
      this.#autoStopTimeout = null;
    }
    if (this.#mediaRecorder && this.#mediaRecorder.state !== 'inactive') {
      this.#mediaRecorder.stop();
    }
    if (this.#stream) {
      this.#stream.getTracks().forEach(track => track.stop());
      this.#stream = null;
    }
    this.#audioChunks = [];
    this.#isRecording = false;
  }

  async startRecording() {
    if (this.#isRecording) {
      console.warn('⚠️ [Shadowing] Déjà en cours d\'enregistrement, ignore.');
      return;
    }

    this.forceStop(); // Nettoyage de sécurité

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.#bus.emit('pronunciation:error', 'Micro non supporté.');
      setTimeout(() => this.#bus.emit('pronunciation:evaluated', { score: 0.5, feedback: 'Mode texte' }), 500);
      return;
    }

    try {
      this.#stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.#mediaRecorder = new MediaRecorder(this.#stream);
      this.#audioChunks = [];
      this.#isRecording = true;

      this.#mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) this.#audioChunks.push(event.data);
      };

      this.#mediaRecorder.onstop = async () => {
        this.#isRecording = false;
        await this.#evaluate();
      };

      this.#mediaRecorder.start();
      this.#bus.emit('pronunciation:recordingStarted');

      this.#autoStopTimeout = setTimeout(() => {
        if (this.#isRecording) {
          console.log('⏱️ [Shadowing] Arrêt auto forcé à 5s');
          this.forceStop();
        }
      }, 5000);

    } catch (err) {
      console.error('❌ [Shadowing] Erreur micro:', err);
      this.forceStop();
      setTimeout(() => {
        this.#bus.emit('pronunciation:evaluated', { score: 0.5, feedback: 'Micro refusé' });
      }, 500);
    }
  }

  async #evaluate() {
    await new Promise(resolve => setTimeout(resolve, 800));
    const mockScore = Math.random() > 0.3 ? 0.85 : 0.65;
    const feedback = mockScore > 0.8 ? 'Tsyara ! (Très bien)' : 'Miezaha indray';

    console.log('✅ [DEBUG] Évaluation shadowing:', { score: mockScore, feedback });
    this.#bus.emit('pronunciation:evaluated', { score: mockScore, feedback });
  }
}