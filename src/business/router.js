/**
 * Router — Gestionnaire de navigation basé sur le hash (#).
 * Doit être démarré explicitement via start() après avoir ajouté les routes.
 */
export class Router {
  #routes = new Map();
  #defaultRoute;
  #started = false;

  constructor(defaultRoute = '/') {
    this.#defaultRoute = defaultRoute;
    window.addEventListener('hashchange', () => this.#handleRoute());
  }

  addRoute(path, handler) {
    this.#routes.set(path, handler);
  }

  /**
   * Démarre le router. À appeler APRÈS avoir ajouté toutes les routes.
   */
  start() {
    if (this.#started) return;
    this.#started = true;
    this.#handleRoute();
  }

  #handleRoute() {
    const hash = window.location.hash.slice(1) || this.#defaultRoute;
    const handler = this.#routes.get(hash);

    if (handler) {
      handler();
      return;
    }

    // Fallback sur la route par défaut
    const defaultHandler = this.#routes.get(this.#defaultRoute);
    if (defaultHandler) {
      window.location.hash = this.#defaultRoute;
      return;
    }

    console.warn(`[Router] Route inconnue : ${hash}`);
  }

  navigate(path) {
    window.location.hash = path;
  }
}