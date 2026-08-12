/**
 * AudioLoader — Chargement intelligent de MP3 pré-enregistrés
 * Fallback automatique sur Web Speech API si MP3 manquant
 * Critique pour qualité audio constante à Madagascar (voix robotiques évitées)
 */
export class AudioLoader {
  #cache = new Map(); // Cache mémoire : URL -> Audio
  #baseAudioPath = '/content/fr/audio';

  /**
   * Charger un MP3 (avec fallback sur TTS si 404)
   * @param {string} path - Chemin relatif (ex: "survival/bonjour.mp3")
   * @param {string} fallbackText - Texte à prononcer si MP4 manquant
   * @param {object} options - Options TTS (rate, pitch, gender)
   * @returns {Promise<{audio: HTMLAudioElement|null, method: 'mp3'|'tts', blob: Blob|null}>}
   */
  async loadAudio(path, fallbackText, options = {}) {
    const fullUrl = `${this.#baseAudioPath}/${path}`;

    // 1. Vérifier le cache
    if (this.#cache.has(fullUrl)) {
      const cached = this.#cache.get(fullUrl);
      cached.currentTime = 0; // Rewind
      return { audio: cached, method: 'mp3', blob: null };
    }

    // 2. Essayer de charger le MP3
    try {
      const response = await fetch(fullUrl);

      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const audio = new Audio(blobUrl);

        // Précharger
        await new Promise((resolve, reject) => {
          audio.addEventListener('canplaythrough', resolve, { once: true });
          audio.addEventListener('error', reject, { once: true });
          audio.load();
        });

        // Mettre en cache
        this.#cache.set(fullUrl, audio);
        console.log(`[AudioLoader] ✅ MP3 chargé: ${path}`);

        return { audio, method: 'mp3', blob };
      }

      // 404 → fallback TTS
      console.log(`[AudioLoader] ⚠️ MP3 manquant (${response.status}): ${path} → fallback TTS`);
      return this.#fallbackTTS(fallbackText, options);

    } catch (e) {
      // Erreur réseau ou autre → fallback TTS
      console.warn(`[AudioLoader] ❌ Erreur chargement ${path}:`, e.message);
      return this.#fallbackTTS(fallbackText, options);
    }
  }

  /**
   * Fallback : utiliser Web Speech API
   */
  async #fallbackTTS(text, options = {}) {
    if (!('speechSynthesis' in window) || !text) {
      return { audio: null, method: 'none', blob: null };
    }

    // On ne crée pas de vrai Audio ici, on retourne null
    // et on laisse le code appelant gérer le TTS directement
    return { audio: null, method: 'tts', blob: null, text, options };
  }

  /**
   * Jouer un audio (MP3 ou TTS)
   * @param {string} path - Chemin du MP3
   * @param {string} fallbackText - Texte TTS si MP3 manquant
   * @param {object} options - Options (rate, pitch, gender, onStart, onEnd)
   */
  async playAudio(path, fallbackText, options = {}) {
    const result = await this.loadAudio(path, fallbackText, options);

    if (result.method === 'mp3' && result.audio) {
      // Jouer le MP3
      const audio = result.audio;
      audio.currentTime = 0;

      if (options.onStart) options.onStart();

      await new Promise((resolve) => {
        audio.addEventListener('ended', () => {
          if (options.onEnd) options.onEnd();
          resolve();
        }, { once: true });

        audio.play().catch(e => {
          console.warn('[AudioLoader] Play error:', e);
          if (options.onEnd) options.onEnd();
          resolve();
        });
      });

      return result;
    }

    // Fallback TTS
    if (result.method === 'tts' && result.text) {
      if (options.onStart) options.onStart();

      await this.#speakTTS(result.text, result.options);

      if (options.onEnd) options.onEnd();
      return result;
    }

    // Aucun audio disponible
    if (options.onEnd) options.onEnd();
    return { audio: null, method: 'none' };
  }

  /**
   * Jouer via Web Speech API
   */
  async #speakTTS(text, options = {}) {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        resolve();
        return;
      }

      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = options.lang || 'fr-FR';
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

      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();

      speechSynthesis.speak(utterance);
    });
  }

  /**
   * Précharger tous les MP3 d'un thème
   * @param {string} themeId - ID du thème (ex: "survival")
   * @param {Array} words - Liste des mots avec leur ID
   */
  async preloadTheme(themeId, words) {
    console.log(`[AudioLoader] 🔄 Préchargement thème ${themeId} (${words.length} mots)...`);

    const tasks = words.map(word => {
      const path = `${themeId}/${word.id || word.wordFr?.toLowerCase().replace(/\s+/g, '-')}.mp3`;
      return this.loadAudio(path, word.wordFr || word.fr).catch(() => null);
    });

    // Limiter à 3 tâches simultanées sur appareils modestes
    const maxConcurrent = window.deviceCheck?.getInfo()?.maxConcurrentTasks || 3;
    const results = [];

    for (let i = 0; i < tasks.length; i += maxConcurrent) {
      const batch = tasks.slice(i, i + maxConcurrent);
      const batchResults = await Promise.all(batch);
      results.push(...batchResults);
    }

    const loaded = results.filter(r => r && r.method === 'mp3').length;
    console.log(`[AudioLoader] ✅ Préchargement terminé: ${loaded}/${words.length} MP3 chargés`);
  }

  /**
   * Nettoyer le cache (libérer la mémoire)
   */
  clearCache() {
    this.#cache.forEach((audio, url) => {
      URL.revokeObjectURL(audio.src);
    });
    this.#cache.clear();
    console.log('[AudioLoader] 🧹 Cache nettoyé');
  }
}

// Instance globale
window.audioLoader = new AudioLoader();