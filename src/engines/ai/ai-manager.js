/**
 * AIManager - Couche d'abstraction pour toutes les opérations d'IA.
 * Permet de basculer entre Local (ONNX/WebLLM), Cloud ou Fallback sans toucher à l'UI.
 */
import { DeviceCheck } from './device-check.js';

export class AIManager {
  constructor(bus) {
    this.bus = bus;
    this.deviceCheck = new DeviceCheck();
    this.isInitialized = false;
  }

  /**
   * Initialise les moteurs d'IA (Lazy loading : ne charge les gros modèles que si nécessaire)
   */
  async initialize() {
    if (this.isInitialized) return;

    console.log('[AIManager] Initialisation...', this.deviceCheck.getCapabilities());

    if (!this.deviceCheck.canRunHeavyAI()) {
      console.warn('[AIManager] Appareil modeste détecté. Les fonctionnalités IA lourdes sont désactivées.');
    }

    // Ici, plus tard, nous chargerons dynamiquement les modèles :
    // if (this.deviceCheck.canRunHeavyAI()) { await import('...onnx...'); }

    this.isInitialized = true;
    this.bus.emit('ai:ready');
  }

  /**
   * Évalue la prononciation (Shadowing)
   * @param {Blob} audioBlob - L'enregistrement audio de l'utilisateur
   * @param {string} targetText - Le texte attendu
   * @returns {Promise<{score: number, feedback: string, transcript: string}>}
   */
  async evaluatePronunciation(audioBlob, targetText) {
    // Simulation actuelle (à remplacer par Whisper/ONNX plus tard)
    await new Promise(resolve => setTimeout(resolve, 800)); // Délai artificiel pour simuler le traitement

    const mockScore = Math.random() > 0.3 ? 0.85 : 0.65;
    const feedback = mockScore > 0.8 ? 'Tsara ! (Très bien)' : 'Miezaha indray (Essayez encore)';

    return {
      score: mockScore,
      feedback: feedback,
      transcript: targetText // En mode réel, ce sera la transcription du modèle
    };
  }

  /**
   * Chatbot conversationnel (à utiliser pour la future fonctionnalité "Dialogue IA")
   * @param {string} userMessage
   * @param {string} context
   * @returns {Promise<string>}
   */
  async chat(userMessage, context = '') {
    if (!this.deviceCheck.canRunHeavyAI()) {
      return "Désolé, le mode conversationnel avancé nécessite un appareil plus puissant ou une connexion internet.";
    }

    // Simulation actuelle (à remplacer par WebLLM plus tard)
    await new Promise(resolve => setTimeout(resolve, 1000));
    return `Ceci est une réponse simulée à : "${userMessage}" dans le contexte : "${context}".`;
  }
}