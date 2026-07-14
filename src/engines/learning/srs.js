/**
 * SRSEngine — Gère la répétition espacée (Spaced Repetition System).
 * Qualité de réponse : 0 (oubli total) à 5 (réponse parfaite et facile).
 */
export class SRSEngine {
  #db;
  #bus;

  constructor(db, bus) {
    this.#db = db;
    this.#bus = bus;
  }

  /**
   * Planifie la prochaine révision d'un élément.
   * @param {string} itemId - Identifiant de l'élément (ex: 'g1')
   * @param {number} quality - Note de 0 à 5
   */
  async schedule(itemId, quality) {
    const now = Date.now();
    let review = await this.#db.get('reviews', itemId);

    if (!review) {
      review = {
        itemId,
        state: 'new',
        stability: 0, // En jours
        difficulty: 5, // 1 (facile) à 10 (difficile)
        dueDate: now,
        reps: 0,
        lapses: 0
      };
    }

    // Algorithme simplifié de mise à jour
    if (quality < 3) {
      // Échec : on réinitialise la stabilité et on revoit bientôt
      review.lapses++;
      review.state = 'relearning';
      review.stability = Math.max(0.5, review.stability * 0.3);
      review.dueDate = now + 10 * 60_000; // 10 minutes
    } else {
      // Succès : on augmente la stabilité
      review.reps++;
      review.state = 'review';
      // Formule simple : stabilité précédente * facteur de qualité
      const factor = 1 + (quality / 10);
      review.stability = review.stability === 0 ? 1 : review.stability * factor;
      review.dueDate = now + (review.stability * 86_400_000); // Convertir jours en ms
    }

    // Ajustement de la difficulté perçue
    review.difficulty = Math.max(1, Math.min(10, 
      review.difficulty + (quality < 3 ? 0.5 : -0.3)
    ));
    
    review.lastReview = now;

    await this.#db.put('reviews', review);
    this.#bus.emit('srs:scheduled', { itemId, quality, nextReview: review.dueDate });
    
    return review;
  }

  /** Récupère les éléments à réviser aujourd'hui (limité à `limit` éléments) */
  async getDueReviews(limit = 20) {
    const allReviews = await this.#db.getAll('reviews');
    const now = Date.now();
    
    return allReviews
      .filter(r => r.dueDate <= now)
      .sort((a, b) => a.dueDate - b.dueDate) // Les plus en retard en premier
      .slice(0, limit);
  }
}