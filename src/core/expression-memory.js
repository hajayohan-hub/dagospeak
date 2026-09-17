/**
 * ExpressionMemory - Système de mémoire pédagogique des expressions
 * 
 * Suit la maîtrise de chaque expression utilisée par l'apprenant
 * et permet à Teacher AI de les réutiliser intelligemment.
 */

export class ExpressionMemory {
  #storageKey = 'dagospeak:expressionMemory';
  #memory = {};

  constructor() {
    this.#load();
    console.log('[ExpressionMemory] Initialisé avec', Object.keys(this.#memory).length, 'expressions');
  }

  // ═══════════════════════════════════════════════════════════════════
  // Chargement et sauvegarde
  // ═══════════════════════════════════════════════════════════════════

  #load() {
    try {
      const stored = localStorage.getItem(this.#storageKey);
      if (stored) {
        this.#memory = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('[ExpressionMemory] Erreur de chargement:', e);
      this.#memory = {};
    }
  }

  #save() {
    try {
      localStorage.setItem(this.#storageKey, JSON.stringify(this.#memory));
    } catch (e) {
      console.warn('[ExpressionMemory] Erreur de sauvegarde:', e);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Enregistrement d'une expression
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Enregistre l'utilisation d'une expression
   * @param {string} expression - L'expression utilisée
   * @param {string} theme - Le thème dans lequel elle a été utilisée
   * @param {string} context - Le contexte (practice, roleplay, conversation)
   * @param {number} score - Score de similarité (0-1)
   */
  recordExpression(expression, theme, context, score = 1.0) {
    if (!expression || expression.trim().length < 2) return;

    const normalized = this.#normalize(expression);

    if (!this.#memory[normalized]) {
      this.#memory[normalized] = {
        expression: expression,
        themes: [theme],
        contexts: [context],
        usageCount: 0,
        firstUsed: new Date().toISOString(),
        lastUsed: new Date().toISOString(),
        mastery: 0,
        attempts: 0,
        successes: 0,
        scores: []
      };
    }

    const entry = this.#memory[normalized];

    // Mettre à jour les thèmes et contextes
    if (!entry.themes.includes(theme)) {
      entry.themes.push(theme);
    }
    if (!entry.contexts.includes(context)) {
      entry.contexts.push(context);
    }

    // Mettre à jour les compteurs
    entry.usageCount++;
    entry.lastUsed = new Date().toISOString();
    entry.attempts++;

    // Mettre à jour le score
    entry.scores.push(score);
    if (entry.scores.length > 10) {
      entry.scores = entry.scores.slice(-10); // Garder les 10 derniers scores
    }

    if (score >= 0.6) {
      entry.successes++;
    }

    // Calculer la maîtrise (moyenne des derniers scores)
    entry.mastery = this.#calculateMastery(entry.scores);

    this.#save();

    console.log(`[ExpressionMemory] 📝 '${expression}' enregistré (maîtrise: ${Math.round(entry.mastery * 100)}%)`);

    return entry;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Calcul de la maîtrise
  // ═══════════════════════════════════════════════════════════════════

  #calculateMastery(scores) {
    if (scores.length === 0) return 0;

    // Moyenne pondérée : les scores récents comptent plus
    const weights = scores.map((_, i) => i + 1);
    const weightedSum = scores.reduce((sum, score, i) => sum + score * weights[i], 0);
    const weightTotal = weights.reduce((a, b) => a + b, 0);

    return weightedSum / weightTotal;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Récupération des expressions
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Récupère toutes les expressions
   */
  getAllExpressions() {
    return Object.values(this.#memory);
  }

  /**
   * Récupère les expressions maîtrisées (score > seuil)
   */
  getMasteredExpressions(threshold = 0.7) {
    return Object.values(this.#memory).filter(e => e.mastery >= threshold);
  }

  /**
   * Récupère les expressions à revoir (score faible)
   */
  getExpressionsToReview(threshold = 0.5) {
    return Object.values(this.#memory).filter(e => e.mastery < threshold && e.attempts > 0);
  }

  /**
   * Récupère les expressions d'un thème spécifique
   */
  getExpressionsByTheme(theme) {
    return Object.values(this.#memory).filter(e => e.themes.includes(theme));
  }

  /**
   * Récupère les expressions les plus utilisées
   */
  getMostUsedExpressions(limit = 10) {
    return Object.values(this.#memory)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  }

  /**
   * Récupère des expressions pour Teacher AI (réutilisation intelligente)
   */
  getExpressionsForTeacherAI(theme = null, count = 3) {
    let expressions = Object.values(this.#memory);

    // Filtrer par thème si spécifié
    if (theme) {
      expressions = expressions.filter(e => e.themes.includes(theme));
    }

    // Prioriser les expressions maîtrisées mais pas trop utilisées
    const scored = expressions.map(e => ({
      ...e,
      priority: e.mastery * 0.7 + (1 / (e.usageCount + 1)) * 0.3
    }));

    return scored
      .sort((a, b) => b.priority - a.priority)
      .slice(0, count);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Statistiques
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Statistiques globales
   */
  getStats() {
    const expressions = Object.values(this.#memory);
    const total = expressions.length;
    const mastered = expressions.filter(e => e.mastery >= 0.7).length;
    const learning = expressions.filter(e => e.mastery >= 0.4 && e.mastery < 0.7).length;
    const toReview = expressions.filter(e => e.mastery < 0.4).length;

    return {
      total,
      mastered,
      learning,
      toReview,
      totalUsage: expressions.reduce((sum, e) => sum + e.usageCount, 0),
      averageMastery: total > 0 
        ? expressions.reduce((sum, e) => sum + e.mastery, 0) / total 
        : 0
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // Utilitaires
  // ═══════════════════════════════════════════════════════════════════

  #normalize(expression) {
    return expression
      .toLowerCase()
      .trim()
      .replace(/[.,!?;:]/g, '')
      .replace(/\s+/g, ' ');
  }

  /**
   * Réinitialise la mémoire (pour les tests)
   */
  reset() {
    this.#memory = {};
    localStorage.removeItem(this.#storageKey);
    console.log('[ExpressionMemory] Mémoire réinitialisée');
  }
}

// Instance singleton
export const expressionMemory = new ExpressionMemory();

  /**
   * Met à jour la maîtrise d'une expression spécifique
   * @param {string} expression - L'expression à mettre à jour
   * @param {number} newMastery - Nouvelle valeur de maîtrise (0-1)
   */
  updateMastery(expression, newMastery) {
    const normalized = this.#normalize(expression);
    
    if (this.#memory[normalized]) {
      this.#memory[normalized].mastery = Math.min(1, Math.max(0, newMastery));
      this.#memory[normalized].lastUsed = new Date().toISOString();
      this.#save();
      
      console.log(`[ExpressionMemory] 📊 Maîtrise mise à jour: "${expression}" → ${Math.round(newMastery * 100)}%`);
      return true;
    }
    
    console.warn(`[ExpressionMemory] ⚠️ Expression non trouvée: "${expression}"`);
    return false;
  }
