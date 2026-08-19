/**
 * TTSService — Service centralisé de Text-to-Speech
 * Gère MP3 (via AudioLoader) et fallback Web Speech API
 */
export class TTSService {
  #audioLoader = null;
  #voicesLoaded = false;

  constructor() {
    // Attendre que les voix soient chargées
    if ('speechSynthesis' in window) {
      speechSynthesis.onvoiceschanged = () => {
        this.#voicesLoaded = true;
      };
      // Vérifier si déjà chargées
      if (speechSynthesis.getVoices().length > 0) {
        this.#voicesLoaded = true;
      }
    }
  }

  /**
   * Joue un texte en utilisant MP3 si disponible, sinon Web Speech API
   * @param {string} text - Texte à prononcer
   * @param {Object} options - Options de lecture
   * @returns {Promise<void>}
   */
  async speak(text, options = {}) {
    if (!text) {
      if (options.onEnd) options.onEnd();
      return;
    }

    // Récupérer audioLoader si disponible
    this.#audioLoader = window.audioLoader;

    // ✅ Essayer de charger un MP3 si on a un thème + mot ID
    if (options.themeId && options.wordId && this.#audioLoader) {
      const mp3Path = `${options.themeId}/${options.wordId}.mp3`;

      try {
        const result = await this.#audioLoader.playAudio(mp3Path, text, {
          rate: options.rate || 0.9,
          gender: options.gender || 'female',
          onStart: options.onStart,
          onEnd: options.onEnd
        });

        // ✅ MP3 joué avec succès → on sort
        if (result.method === 'mp3') {
          console.log(`[TTSService] ✅ MP3 joué: ${mp3Path}`);
          return;
        }

        // ✅ TTS déjà joué par AudioLoader → on sort AUSSI (ne pas rejouer !)
        if (result.method === 'tts') {
          console.log(`[TTSService] ⚠️ MP3 manquant → TTS déjà joué par AudioLoader: ${mp3Path}`);
          return;
        }

        // Seul cas où on continue : method === 'none' (aucun audio disponible)
        console.log(`[TTSService] ❌ Aucun audio disponible pour: ${mp3Path}`);
      } catch (e) {
        console.warn('[TTSService] Erreur MP3, fallback TTS:', e);
      }
    }

    // Fallback : Web Speech API (comportement actuel)
    if (!('speechSynthesis' in window)) {
      if (options.onEnd) options.onEnd();
      return;
    }

    // Annuler toute lecture en cours
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = options.rate || 0.9;
    utterance.pitch = options.pitch || 1.1;

    // Sélection de la voix
    const voices = speechSynthesis.getVoices();
    const frenchVoice = voices.find(v =>
      v.lang.startsWith('fr') &&
      (options.gender === 'male' ?
        v.name.toLowerCase().includes('male') || v.name.includes('Thomas') :
        v.name.toLowerCase().includes('female') || v.name.includes('Amélie') || v.name.includes('Marie'))
    ) || voices.find(v => v.lang.startsWith('fr'));

    if (frenchVoice) utterance.voice = frenchVoice;

    console.log(`[TTSService] 🎙️ gender=${options.gender || 'female'}, voice=${frenchVoice?.name || 'default'}`);

    if (options.onStart) options.onStart();
    utterance.onend = () => {
      if (options.onEnd) options.onEnd();
    };
    utterance.onerror = () => {
      if (options.onEnd) options.onEnd();
    };

    speechSynthesis.speak(utterance);
  }

  /**
   * Annule toute lecture TTS en cours
   */
  cancel() {
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
  }

  /**
   * Préchauffe le TTS pour éliminer la latence au premier clic
   */
  warmUp() {
    if ('speechSynthesis' in window) {
      const warmup = new SpeechSynthesisUtterance('');
      warmup.volume = 0;
      warmup.lang = 'fr-FR';
      speechSynthesis.speak(warmup);
      console.log('[TTSService] Préchauffage effectué');
    }
  }
}

// Instance globale
export const ttsService = new TTSService();

// Préchauffage au démarrage
window.addEventListener('load', () => {
  ttsService.warmUp();
});