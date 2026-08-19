/**
 * RolePlayEngine — Moteur de conversation guidé/défi
 * Architecture propre : aucun DOM, uniquement logique métier
 * Utilise SessionManager pour éliminer les callbacks fantômes
 */
import { sessionManager } from '../core/session-manager.js';
import { ttsService } from '../core/tts-service.js';

export class RolePlayEngine {
  #dialogue = null;
  #userRole = 'B';
  #mode = 'guided'; // 'guided' ou 'challenge'
  #currentIndex = 0;
  #sessionId = null;
  #state = 'IDLE'; // IDLE | PARTNER_SPEAKING | USER_TURN | FEEDBACK | ADVANCE
  #eventBus = null;
  #sttManager = null;
  
  // Configuration
  #config = {
    similarityThreshold: 0.60,
    minAcceptableSimilarity: 0.40,
    delayAfterTTS: 1500, // ms
    maxRetries: 2
  };

  constructor(dialogue, options = {}) {
    this.#dialogue = dialogue;
    this.#userRole = options.userRole || 'B';
    this.#mode = options.mode || 'guided';
    this.#eventBus = options.eventBus || window.bus;
    this.#sttManager = options.sttManager || window.sttManager;
    
    if (!this.#dialogue || !this.#dialogue.lines) {
      throw new Error('Dialogue invalide');
    }
    
    console.log(`[RolePlayEngine] Créé: ${dialogue.id}, mode=${this.#mode}, userRole=${this.#userRole}`);
  }

  /**
   * Démarre la session de Role Play
   */
  start() {
    const session = sessionManager.create('roleplay');
    this.#sessionId = session.id;
    this.#currentIndex = 0;
    this.#state = 'IDLE';
    
    this.#emit('roleplay:start', {
      sessionId: this.#sessionId,
      dialogueId: this.#dialogue.id,
      mode: this.#mode,
      userRole: this.#userRole,
      totalLines: this.#dialogue.lines.length
    });
    
    this.#advanceToNextTurn();
  }

  /**
   * Arrête la session et nettoie toutes les ressources
   */
  stop() {
    sessionManager.cancel('roleplay');
    this.#state = 'IDLE';
    this.#emit('roleplay:stopped', { sessionId: this.#sessionId });
    console.log(`[RolePlayEngine] Session arrêtée`);
  }

  /**
   * Passe au tour suivant (interne)
   */
  #advanceToNextTurn() {
    if (!sessionManager.isValid('roleplay', this.#sessionId)) {
      console.log('[RolePlayEngine] Session invalide, arrêt');
      return;
    }

    if (this.#currentIndex >= this.#dialogue.lines.length) {
      this.#complete();
      return;
    }

    const line = this.#dialogue.lines[this.#currentIndex];
    const isUserTurn = line.speaker === this.#userRole;

    this.#emit('roleplay:turn-start', {
      index: this.#currentIndex,
      total: this.#dialogue.lines.length,
      isUserTurn: isUserTurn,
      speaker: line.speaker,
      text: line.text,
      translation: line.translation
    });

    if (isUserTurn) {
      this.#startUserTurn();
    } else {
      this.#startPartnerTurn();
    }
  }

  /**
   * Tour du partenaire : TTS automatique
   */
  #startPartnerTurn() {
    this.#state = 'PARTNER_SPEAKING';
    const line = this.#dialogue.lines[this.#currentIndex];
    const speaker = this.#dialogue.participants[line.speaker];

    this.#emit('roleplay:partner-speaking', {
      index: this.#currentIndex,
      speaker: speaker.name,
      avatar: speaker.avatar,
      text: line.text,
      translation: line.translation
    });

    ttsService.speak(line.text, {
      gender: speaker.gender || 'female',
      onStart: () => {
        console.log(`[RolePlayEngine] TTS démarré pour tour ${this.#currentIndex}`);
      },
      onEnd: () => {
        if (!sessionManager.isValid('roleplay', this.#sessionId)) return;
        
        console.log(`[RolePlayEngine] TTS terminé pour tour ${this.#currentIndex}`);
        
        // Délai pédagogique avant de passer au tour suivant
        sessionManager.setTimeout('roleplay', () => {
          this.#currentIndex++;
          this.#advanceToNextTurn();
        }, this.#config.delayAfterTTS);
      }
    });
  }

  /**
   * Tour de l'utilisateur : active le micro
   */
  #startUserTurn() {
    this.#state = 'USER_TURN';
    const line = this.#dialogue.lines[this.#currentIndex];
    const speaker = this.#dialogue.participants[line.speaker];

    this.#emit('roleplay:user-turn', {
      index: this.#currentIndex,
      expectedText: this.#mode === 'guided' ? line.text : null, // Cacher en mode challenge
      translation: line.translation,
      speaker: speaker.name,
      avatar: speaker.avatar
    });
  }

  /**
   * Évalue la réponse de l'utilisateur (appelé par l'UI après STT)
   */
  evaluateUserResponse(transcript, engine = 'simulation') {
    if (!sessionManager.isValid('roleplay', this.#sessionId)) return;
    if (this.#state !== 'USER_TURN') return;

    this.#state = 'FEEDBACK';
    const line = this.#dialogue.lines[this.#currentIndex];
    const expected = line.text.toLowerCase();
    const actual = transcript.toLowerCase();

    // Mode simulation : pas d'évaluation réelle
    if (engine === 'simulation') {
      this.#emit('roleplay:feedback', {
        index: this.#currentIndex,
        status: 'simulation',
        message: 'Mode entraînement hors connexion',
        transcript: transcript,
        expected: this.#mode === 'guided' ? line.text : null
      });

      sessionManager.setTimeout('roleplay', () => {
        this.#currentIndex++;
        this.#advanceToNextTurn();
      }, 1500);
      return;
    }

    // Mode réel : calculer similarité
    const similarity = this.#calculateSimilarity(actual, expected);
    const result = this.#evaluateSimilarity(similarity);

    this.#emit('roleplay:feedback', {
      index: this.#currentIndex,
      status: result.status,
      score: similarity,
      message: result.message,
      transcript: transcript,
      expected: this.#mode === 'guided' ? line.text : null,
      hint: result.hint || null,
      xp: result.xp
    });

    if (result.status === 'success' || result.status === 'acceptable') {
      sessionManager.setTimeout('roleplay', () => {
        this.#currentIndex++;
        this.#advanceToNextTurn();
      }, 1500);
    } else {
      // Retry ou révéler la réponse
      this.#state = 'USER_TURN';
    }
  }

  /**
   * Calcul de similarité Levenshtein simplifié
   */
  #calculateSimilarity(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix = [];

    if (len1 === 0) return 0;
    if (len2 === 0) return 0;

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    const distance = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);
    return 1 - distance / maxLen;
  }

  /**
   * Évalue le score de similarité
   */
  #evaluateSimilarity(similarity) {
    if (similarity >= this.#config.similarityThreshold) {
      return {
        status: 'success',
        message: 'Très bien !',
        xp: 5
      };
    } else if (similarity >= this.#config.minAcceptableSimilarity) {
      return {
        status: 'acceptable',
        message: 'Bien !',
        xp: 3
      };
    } else {
      return {
        status: 'retry',
        message: 'À répéter',
        xp: 0
      };
    }
  }

  /**
   * Termine la session avec succès
   */
  #complete() {
    this.#state = 'IDLE';
    this.#emit('roleplay:complete', {
      sessionId: this.#sessionId,
      dialogueId: this.#dialogue.id,
      mode: this.#mode,
      totalLines: this.#dialogue.lines.length
    });
    
    console.log(`[RolePlayEngine] Session complétée: ${this.#dialogue.id}`);
  }

  /**
   * Émet un événement via Event Bus
   */
  #emit(event, data) {
    if (this.#eventBus && this.#eventBus.emit) {
      this.#eventBus.emit(event, data);
    }
  }

  /**
   * Getter pour l'état actuel
   */
  getState() {
    return this.#state;
  }

  /**
   * Getter pour l'index actuel
   */
  getCurrentIndex() {
    return this.#currentIndex;
  }

  /**
   * Getter pour le dialogue
   */
  getDialogue() {
    return this.#dialogue;
  }
}