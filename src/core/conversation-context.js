/**
 * ConversationContext - Mémoire de session pour Conversation Live
 * V5.1 : Version minimale, non utilisée (juste instanciée)
 * 
 * Stocke ce que l'utilisateur dit pendant la conversation
 * pour permettre des échanges cohérents et personnalisés.
 */

export class ConversationContext {
  constructor() {
    // Ce que l'utilisateur a réellement dit
    this.userData = {};
    
    // Données du scénario (pour référence)
    this.scenarioData = {};
    
    // Historique court des derniers échanges
    this.history = [];
    
    // Timestamp de création
    this.startTime = Date.now();
    
    console.log('[ConversationContext] 🧠 Initialisé');
  }
  
  /**
   * Stocker une information donnée par l'utilisateur
   * @param {string} slot - Nom du slot (ex: 'fatherName', 'city')
   * @param {string} value - Valeur donnée par l'utilisateur
   */
  setUserSlot(slot, value) {
    this.userData[slot] = {
      value: value,
      status: 'KNOWN',
      source: 'user',
      timestamp: Date.now()
    };
    console.log(`[ConversationContext] 💾 Slot utilisateur: ${slot} = "${value}"`);
  }
  
  /**
   * Récupérer la valeur d'un slot (priorité : USER > SCENARIO)
   * @param {string} slot - Nom du slot
   * @returns {object|null} - {value, status, source} ou null
   */
  getSlot(slot) {
    return this.userData[slot] || this.scenarioData[slot] || null;
  }
  
  /**
   * Vérifier si un slot est connu (donné par l'utilisateur)
   * @param {string} slot - Nom du slot
   * @returns {boolean}
   */
  isKnown(slot) {
    return this.userData[slot]?.status === 'KNOWN';
  }
  
  /**
   * Ajouter un échange à l'historique
   * @param {string} question - Question du Teacher
   * @param {string} answer - Réponse de l'utilisateur
   */
  addExchange(question, answer) {
    this.history.push({
      question: question,
      answer: answer,
      timestamp: Date.now()
    });
    
    // Garder seulement les 10 derniers échanges
    if (this.history.length > 10) {
      this.history.shift();
    }
  }
  
  /**
   * Effacer le contexte (nouvelle conversation)
   */
  clear() {
    this.userData = {};
    this.scenarioData = {};
    this.history = [];
    this.startTime = Date.now();
    console.log('[ConversationContext] 🧹 Contexte effacé');
  }
  
  /**
   * Obtenir un résumé du contexte (pour debug)
   */
  getSummary() {
    return {
      userData: Object.keys(this.userData).length + ' slots',
      history: this.history.length + ' échanges',
      duration: Math.round((Date.now() - this.startTime) / 1000) + 's'
    };
  }
}
