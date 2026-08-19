/**
 * SessionManager — Gestion centralisée des sessions actives
 * Élimine les callbacks fantômes, timers résiduels et double-appels
 */
export class SessionManager {
  #sessions = new Map();
  #sessionCounter = 0;

  /**
   * Crée une nouvelle session unique
   * @param {string} type - Type de session ('roleplay', 'dialogue', 'shadowing', etc.)
   * @returns {Object} Session object avec id unique
   */
  create(type) {
    // Annuler toute session existante du même type
    this.cancel(type);

    const sessionId = ++this.#sessionCounter;
    const session = {
      id: sessionId,
      type: type,
      active: true,
      timers: new Set(),
      listeners: new Map(),
      createdAt: Date.now()
    };

    this.#sessions.set(type, session);
    console.log(`[SessionManager] Session créée: ${type}#${sessionId}`);
    return session;
  }

  /**
   * Vérifie si une session est encore valide
   * @param {string} type - Type de session
   * @param {number} sessionId - ID de la session à vérifier
   * @returns {boolean}
   */
  isValid(type, sessionId) {
    const session = this.#sessions.get(type);
    if (!session || !session.active) return false;
    return session.id === sessionId;
  }

  /**
   * Enregistre un timer pour qu'il soit annulé automatiquement
   * @param {string} type - Type de session
   * @param {number} timerId - ID retourné par setTimeout/setInterval
   */
  registerTimer(type, timerId) {
    const session = this.#sessions.get(type);
    if (session && session.active) {
      session.timers.add(timerId);
    }
  }

  /**
   * Enregistre un event listener pour qu'il soit retiré automatiquement
   * @param {string} type - Type de session
   * @param {string} event - Nom de l'événement
   * @param {Function} handler - Fonction handler
   */
  registerListener(type, event, handler) {
    const session = this.#sessions.get(type);
    if (session && session.active) {
      if (!session.listeners.has(event)) {
        session.listeners.set(event, []);
      }
      session.listeners.get(event).push(handler);
    }
  }

  /**
   * Annule une session et nettoie toutes ses ressources
   * @param {string} type - Type de session à annuler
   */
  cancel(type) {
    const session = this.#sessions.get(type);
    if (!session) return;

    console.log(`[SessionManager] Annulation session: ${type}#${session.id}`);

    // Marquer comme inactive (invalide tous les callbacks)
    session.active = false;

    // Annuler tous les timers
    session.timers.forEach(timerId => {
      clearTimeout(timerId);
      clearInterval(timerId);
    });
    session.timers.clear();

    // Retirer tous les event listeners
    session.listeners.forEach((handlers, event) => {
      handlers.forEach(handler => {
        if (window.bus && window.bus.off) {
          window.bus.off(event, handler);
        }
      });
    });
    session.listeners.clear();

    // Supprimer la session
    this.#sessions.delete(type);
  }

  /**
   * Annule toutes les sessions actives
   */
  cancelAll() {
    const types = Array.from(this.#sessions.keys());
    types.forEach(type => this.cancel(type));
    console.log('[SessionManager] Toutes les sessions annulées');
  }

  /**
   * Crée un setTimeout qui sera annulé si la session est annulée
   * @param {string} type - Type de session
   * @param {Function} callback - Fonction à exécuter
   * @param {number} delay - Délai en ms
   * @returns {number} Timer ID
   */
  setTimeout(type, callback, delay) {
    const session = this.#sessions.get(type);
    if (!session || !session.active) return null;

    const timerId = setTimeout(() => {
      // Vérifier que la session est encore valide avant d'exécuter
      if (this.isValid(type, session.id)) {
        session.timers.delete(timerId);
        callback();
      } else {
        console.log(`[SessionManager] Timer ignoré (session ${type}#${session.id} invalide)`);
      }
    }, delay);

    session.timers.add(timerId);
    return timerId;
  }

  /**
   * Crée un setInterval qui sera annulé si la session est annulée
   * @param {string} type - Type de session
   * @param {Function} callback - Fonction à exécuter
   * @param {number} interval - Intervalle en ms
   * @returns {number} Timer ID
   */
  setInterval(type, callback, interval) {
    const session = this.#sessions.get(type);
    if (!session || !session.active) return null;

    const timerId = setInterval(() => {
      if (this.isValid(type, session.id)) {
        callback();
      } else {
        clearInterval(timerId);
        session.timers.delete(timerId);
      }
    }, interval);

    session.timers.add(timerId);
    return timerId;
  }
}

// Instance globale
export const sessionManager = new SessionManager();