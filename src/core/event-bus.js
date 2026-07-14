/**
 * EventBus — Bus d'événements découplé.
 * Tous les moteurs communiquent via ce bus, sans se connaître.
 */
export class EventBus {
  #listeners = new Map();

  /**
   * S'abonner à un événement.
   * @returns {Function} Fonction de désabonnement.
   */
  on(event, handler) {
    if (!this.#listeners.has(event)) {
      this.#listeners.set(event, new Set());
    }
    this.#listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  /** Se désabonner d'un événement. */
  off(event, handler) {
    this.#listeners.get(event)?.delete(handler);
  }

  /** Émettre un événement. */
  emit(event, payload) {
    const handlers = this.#listeners.get(event);
    if (!handlers) return;
    for (const h of handlers) {
      try {
        h(payload);
      } catch (err) {
        console.error(`[EventBus] Erreur sur "${event}" :`, err);
      }
    }
  }

  /** Émettre une fois (auto-désabonnement). */
  once(event, handler) {
    const wrapper = (payload) => {
      this.off(event, wrapper);
      handler(payload);
    };
    this.on(event, wrapper);
  }
}