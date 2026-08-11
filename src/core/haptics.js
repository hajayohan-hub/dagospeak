/**
 * Haptics — Retour tactile (vibration) sur mobile
 */
export class Haptics {
  #enabled = true;

  constructor() {
    const saved = localStorage.getItem('dagospeak:hapticsEnabled');
    if (saved !== null) {
      this.#enabled = saved === 'true';
    }
  }

  light() {
    if (!this.#enabled || !navigator.vibrate) return;
    try { navigator.vibrate(10); } catch (e) {}
  }

  medium() {
    if (!this.#enabled || !navigator.vibrate) return;
    try { navigator.vibrate(25); } catch (e) {}
  }

  strong() {
    if (!this.#enabled || !navigator.vibrate) return;
    try { navigator.vibrate([50, 30, 50]); } catch (e) {}
  }

  setEnabled(enabled) {
    this.#enabled = enabled;
    localStorage.setItem('dagospeak:hapticsEnabled', enabled.toString());
  }

  isEnabled() {
    return this.#enabled;
  }
}

window.haptics = new Haptics();