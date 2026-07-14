/**
 * Container — Injection de dépendances légère.
 * Permet d'enregistrer des services et de les récupérer à la demande.
 */
export class Container {
  #services = new Map();

  /** Enregistrer un service (factory). */
  register(name, factory) {
    this.#services.set(name, { factory, instance: null });
  }

  /** Récupérer un service (instancié une seule fois). */
  get(name) {
    const svc = this.#services.get(name);
    if (!svc) throw new Error(`Service inconnu : ${name}`);
    if (!svc.instance) {
      svc.instance = svc.factory(this);
    }
    return svc.instance;
  }

  /** Vérifier si un service existe. */
  has(name) {
    return this.#services.has(name);
  }
}