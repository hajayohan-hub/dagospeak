/**
 * PedagogicalIntelligence - Moteur d'intelligence pédagogique
 * 
 * Utilise la mémoire des expressions pour :
 * - Générer des conseils personnalisés
 * - Suggérer des expressions à pratiquer
 * - Créer des variations intelligentes
 * - Adapter la difficulté au niveau de l'apprenant
 */

export class PedagogicalIntelligence {
  constructor() {
    this.expressionMemory = null;
  }

  /**
   * Initialise avec la mémoire des expressions
   */
  initialize(expressionMemory) {
    this.expressionMemory = expressionMemory;
    console.log('[PedagogicalIntelligence] 🧠 Initialisé avec mémoire pédagogique');
  }

  /**
   * Génère un conseil personnalisé basé sur les expressions maîtrisées
   * @returns {string} Conseil pédagogique
   */
  getPersonalizedAdvice() {
    if (!this.expressionMemory) {
      return this.#getDefaultAdvice();
    }

    const stats = this.expressionMemory.getStats();
    const mastered = this.expressionMemory.getMasteredExpressions();
    const toReview = this.expressionMemory.getExpressionsToReview(0.6);

    // Pas d'expressions encore
    if (stats.total === 0) {
      return "Commencez par pratiquer quelques expressions dans un thème pour que je puisse vous aider ! 🎯";
    }

    // Beaucoup d'expressions à revoir
    if (toReview.length > 3) {
      return `Vous avez ${toReview.length} expressions à réviser. Cliquez sur "Mes expressions" pour les pratiquer ! 📚`;
    }

    // Bonne progression
    if (mastered.length > 5) {
      const randomMastered = mastered[Math.floor(Math.random() * mastered.length)];
      return `Excellent ! Vous maîtrisez bien "${randomMastered.expression}". Essayez de l'utiliser dans une conversation ! 💬`;
    }

    // Progression normale
    const masteryPercent = Math.round(stats.masteryRate * 100);
    return `Votre progression est de ${masteryPercent}%. Continuez à pratiquer régulièrement ! 🚀`;
  }

  /**
   * Suggère la prochaine expression à pratiquer
   * @param {string} currentTheme - Thème actuel
   * @returns {object|null} {expression, reason, priority}
   */
  suggestNextExpression(currentTheme = null) {
    if (!this.expressionMemory) return null;

    const allExpressions = this.expressionMemory.getAllExpressions();
    if (allExpressions.length === 0) return null;

    // Filtrer par thème si spécifié
    let candidates = allExpressions;
    if (currentTheme) {
      candidates = allExpressions.filter(e => e.themes.includes(currentTheme));
    }

    if (candidates.length === 0) return null;

    // Priorité 1: Expressions faibles (à réviser)
    const weakExpressions = candidates.filter(e => e.mastery < 0.6);
    if (weakExpressions.length > 0) {
      const weakest = weakExpressions.sort((a, b) => a.mastery - b.mastery)[0];
      return {
        expression: weakest.expression,
        reason: 'À réviser (maîtrise faible)',
        priority: 'HIGH',
        mastery: weakest.mastery
      };
    }

    // Priorité 2: Expressions moyennes (à renforcer)
    const mediumExpressions = candidates.filter(e => e.mastery >= 0.6 && e.mastery < 0.8);
    if (mediumExpressions.length > 0) {
      const target = mediumExpressions[Math.floor(Math.random() * mediumExpressions.length)];
      return {
        expression: target.expression,
        reason: 'À renforcer',
        priority: 'MEDIUM',
        mastery: target.mastery
      };
    }

    // Priorité 3: Expressions maîtrisées (maintenir)
    const masteredExpressions = candidates.filter(e => e.mastery >= 0.8);
    if (masteredExpressions.length > 0) {
      const target = masteredExpressions[Math.floor(Math.random() * masteredExpressions.length)];
      return {
        expression: target.expression,
        reason: 'À maintenir',
        priority: 'LOW',
        mastery: target.mastery
      };
    }

    return null;
  }

  /**
   * Génère une variation d'une expression maîtrisée
   * @param {string} baseExpression - Expression de base
   * @returns {string} Variation de l'expression
   */
  generateVariation(baseExpression) {
    const variations = {
      'Bonjour': ['Salut !', 'Bonjour ! Comment allez-vous ?', 'Bonjour et bienvenue !'],
      'Merci': ['Merci beaucoup !', 'Je vous remercie.', 'Merci infiniment !'],
      'S\'il vous plaît': ['S\'il vous plaît, pouvez-vous m\'aider ?', 'Un café, s\'il vous plaît.', 'S\'il vous plaît, parlez plus lentement.'],
      'Comment ça va ?': ['Comment allez-vous ?', 'Comment vous sentez-vous ?', 'Tout va bien ?'],
      'Au revoir': ['Au revoir et bonne journée !', 'À bientôt !', 'Au revoir, prenez soin de vous !'],
      'Je m\'appelle': ['Je m\'appelle et j\'habite à...', 'Mon nom est...', 'Je suis...'],
      'Je voudrais': ['Je voudrais acheter...', 'J\'aimerais avoir...', 'Je prendrai...'],
      'Où est': ['Où est la gare, s\'il vous plaît ?', 'Où se trouve...?', 'Pouvez-vous me dire où est...?']
    };

    // Chercher une variation correspondante
    for (const [base, vars] of Object.entries(variations)) {
      if (baseExpression.toLowerCase().includes(base.toLowerCase())) {
        return vars[Math.floor(Math.random() * vars.length)];
      }
    }

    // Variation générique
    return `${baseExpression} (dans un contexte différent)`;
  }

  /**
   * Identifie les expressions faibles à réviser
   * @returns {Array} Liste des expressions à réviser
   */
  identifyWeakExpressions() {
    if (!this.expressionMemory) return [];
    return this.expressionMemory.getExpressionsToReview(0.6);
  }

  /**
   * Génère un message de félicitations personnalisé
   * @param {string} expression - Expression maîtrisée
   * @returns {string} Message de félicitations
   */
  generateCongratulationMessage(expression) {
    const messages = [
      `Excellent ! Vous maîtrisez maintenant "${expression}" ! 🎉`,
      `Bravo ! "${expression}" fait partie de votre vocabulaire actif ! ⭐`,
      `Félicitations ! Vous pouvez utiliser "${expression}" en conversation ! 💬`,
      `Super progression ! "${expression}" est maintenant bien ancré ! 🚀`
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }

  /**
   * Génère un message d'encouragement
   * @param {string} expression - Expression à pratiquer
   * @returns {string} Message d'encouragement
   */
  generateEncouragementMessage(expression) {
    const messages = [
      `Continuez à pratiquer "${expression}", vous progressez bien ! 💪`,
      `"${expression}" deviendra bientôt naturel avec un peu plus de pratique ! 🌟`,
      `Chaque répétition de "${expression}" vous rapproche de la maîtrise ! 🎯`,
      `Vous êtes sur la bonne voie avec "${expression}" ! Continuez ! 📈`
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }

  /**
   * Conseille par défaut si pas de données
   */
  #getDefaultAdvice() {
    const advices = [
      "Pratiquez régulièrement pour progresser ! 📚",
      "Écoutez attentivement avant de répéter. 👂",
      "N'hésitez pas à répéter plusieurs fois. 🔄",
      "La régularité est la clé du succès ! 🔑"
    ];
    return advices[Math.floor(Math.random() * advices.length)];
  }
}

export const pedagogicalIntelligence = new PedagogicalIntelligence();
