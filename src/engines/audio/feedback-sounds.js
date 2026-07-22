/**
 * FeedbackSounds - Sons synthétiques pour les feedbacks (Web Audio API).
 * Aucun fichier externe nécessaire, fonctionne 100% hors-ligne.
 */
export class FeedbackSounds {
  #audioContext = null;

  #getContext() {
    if (!this.#audioContext) {
      this.#audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this.#audioContext;
  }

  /**
   * Son de réussite : deux notes ascendantes joyeuses
   */
  playSuccess() {
    try {
      const ctx = this.#getContext();
      const now = ctx.currentTime;

      // Note 1 : Do (C5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.value = 523.25;
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc1.connect(gain1).connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.3);

      // Note 2 : Mi (E5) - plus aigu, joyeux
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.value = 659.25;
      gain2.gain.setValueAtTime(0.3, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc2.connect(gain2).connect(ctx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.5);
    } catch (e) {
      console.warn('[FeedbackSounds] Erreur:', e);
    }
  }

  /**
   * Son d'erreur : note descendante douce
   */
  playRetry() {
    try {
      const ctx = this.#getContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(250, now + 0.4);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    } catch (e) {
      console.warn('[FeedbackSounds] Erreur:', e);
    }
  }

  /**
   * Son de félicitations : fanfare courte (3 notes)
   */
  playCelebration() {
    try {
      const ctx = this.#getContext();
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99]; // Do, Mi, Sol

      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.25, now + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.4);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + i * 0.15);
        osc.stop(now + i * 0.15 + 0.4);
      });
    } catch (e) {
      console.warn('[FeedbackSounds] Erreur:', e);
    }
  }

  /**
   * Son de clic : petit "tick"
   */
  playClick() {
    try {
      const ctx = this.#getContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 800;
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } catch (e) {
      console.warn('[FeedbackSounds] Erreur:', e);
    }
  }
}