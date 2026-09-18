/**
 * SpacedRepetition - Système de notifications de révision intelligente
 * 
 * Identifie les expressions à revoir selon :
 * - Niveau de maîtrise (< 50%)
 * - Temps écoulé depuis dernière utilisation (> 3 jours)
 * - Priorité pédagogique (expressions transversales d'abord)
 */

export class SpacedRepetition {
  #storageKey = 'dagospeak:lastReviewNotification';
  
  constructor() {
    console.log('[SpacedRepetition] 🔄 Initialisé');
  }

  /**
   * Identifie les expressions à revoir
   * @param {ExpressionMemory} expressionMemory - Instance de la mémoire
   * @returns {Array} Liste des expressions à revoir triées par priorité
   */
  getExpressionsToReview(expressionMemory) {
    if (!expressionMemory) {
      console.warn('[SpacedRepetition] ⚠️ expressionMemory non disponible');
      return [];
    }

    const allExpressions = expressionMemory.getAllExpressions();
    const now = Date.now();
    const THREE_DAYS = 3 * 24 * 60 * 60 * 1000; // 3 jours en ms
    
    const toReview = [];

    allExpressions.forEach(expr => {
      // Critère 1 : Maîtrise faible (< 50%)
      if (expr.mastery < 0.5) {
        const lastUsed = new Date(expr.lastUsed).getTime();
        const timeSinceLastUse = now - lastUsed;
        
        // Critère 2 : Pas utilisée depuis > 3 jours
        if (timeSinceLastUse > THREE_DAYS) {
          // Calculer la priorité
          const priority = this.#calculatePriority(expr, timeSinceLastUse);
          
          toReview.push({
            ...expr,
            daysSinceLastUse: Math.floor(timeSinceLastUse / (24 * 60 * 60 * 1000)),
            priority: priority
          });
        }
      }
    });

    // Trier par priorité décroissante
    toReview.sort((a, b) => b.priority - a.priority);

    console.log(`[SpacedRepetition] 📊 ${toReview.length} expression(s) à revoir identifiée(s)`);
    
    return toReview;
  }

  /**
   * Calcule la priorité d'une expression à réviser
   * @param {Object} expr - Expression
   * @param {number} timeSinceLastUse - Temps écoulé en ms
   * @returns {number} Score de priorité (0-100)
   */
  #calculatePriority(expr, timeSinceLastUse) {
    let priority = 0;

    // Facteur 1 : Faible maîtrise (plus c'est bas, plus c'est urgent)
    priority += (1 - expr.mastery) * 40; // 0-40 points

    // Facteur 2 : Temps écoulé (plus c'est long, plus c'est urgent)
    const daysSince = timeSinceLastUse / (24 * 60 * 60 * 1000);
    priority += Math.min(daysSince / 7, 1) * 30; // 0-30 points (max à 7 jours)

    // Facteur 3 : Expressions transversales (utilisées dans plusieurs thèmes)
    if (expr.themes && expr.themes.length > 1) {
      priority += 20; // Bonus pour expressions réutilisables
    }

    // Facteur 4 : Nombre d'utilisations (peu utilisées = moins prioritaires)
    if (expr.usageCount > 3) {
      priority += 10; // Bonus pour expressions déjà pratiquées
    }

    return Math.min(priority, 100);
  }

  /**
   * Vérifie si une notification doit être affichée
   * @param {ExpressionMemory} expressionMemory
   * @returns {Object|null} {expressions, count} ou null
   */
  shouldShowNotification(expressionMemory) {
    const toReview = this.getExpressionsToReview(expressionMemory);
    
    if (toReview.length === 0) {
      return null;
    }

    // Vérifier si on a déjà montré une notification récemment (24h)
    const lastNotification = localStorage.getItem(this.#storageKey);
    if (lastNotification) {
      const lastTime = parseInt(lastNotification, 10);
      const ONE_DAY = 24 * 60 * 60 * 1000;
      
      if (Date.now() - lastTime < ONE_DAY) {
        console.log('[SpacedRepetition] ⏸️  Notification déjà affichée récemment');
        return null;
      }
    }

    // Limiter à 5 expressions maximum pour ne pas submerger
    const limited = toReview.slice(0, 5);

    return {
      expressions: limited,
      count: toReview.length,
      totalAvailable: toReview.length
    };
  }

  /**
   * Marque la notification comme affichée
   */
  markNotificationShown() {
    localStorage.setItem(this.#storageKey, Date.now().toString());
    console.log('[SpacedRepetition] ✅ Notification marquée comme affichée');
  }

  /**
   * Réinitialise le timer de notification (pour les tests)
   */
  resetNotificationTimer() {
    localStorage.removeItem(this.#storageKey);
    console.log('[SpacedRepetition] 🔄 Timer de notification réinitialisé');
  }

  /**
   * Génère un message de notification personnalisé
   * @param {number} count - Nombre d'expressions à revoir
   * @returns {string} Message
   */
  generateNotificationMessage(count) {
    if (count === 1) {
      return "Vous avez 1 expression à réviser pour consolider vos acquis !";
    } else if (count <= 3) {
      return `Vous avez ${count} expressions à réviser. Quelques minutes suffisent !`;
    } else {
      return `Vous avez ${count} expressions à réviser. Une session rapide vous aidera à progresser !`;
    }
  }
}

export const spacedRepetition = new SpacedRepetition();
