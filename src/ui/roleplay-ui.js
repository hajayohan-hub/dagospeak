/**
 * RolePlayUI — Interface du feed conversationnel
 * Écoute les événements du RolePlayEngine et met à jour le DOM
 * Feed permanent (pas de re-render à chaque tour)
 */
import { EventBus } from '../core/event-bus.js';

export class RolePlayUI {
  #container = null;
  #feedElement = null;
  #currentTurnElement = null;
  #bus = null;
  #engine = null;
  #handlers = new Map();
  #mode = 'guided';

  constructor(containerId, bus, engine, mode = 'guided') {
    this.#container = document.getElementById(containerId);
    this.#bus = bus || window.bus || new EventBus();  // ✅ Fallback sur nouvelle instance
    this.#engine = engine;
    this.#mode = mode;

    if (!this.#container) {
      throw new Error(`Container #${containerId} introuvable`);
    }

    console.log('[RolePlayUI] Bus disponible:', !!this.#bus);
    
    this.#initStructure();
    this.#bindEvents();

    console.log('[RolePlayUI] Initialisé');
  }

  /**
   * Initialise la structure HTML de base
   */
  #initStructure() {
    this.#container.innerHTML = `
      <div id="roleplay-feed" style="display:flex; flex-direction:column; gap:1rem; margin-bottom:1.5rem; min-height:200px;">
        <!-- Les échanges seront ajoutés ici -->
      </div>
      <div id="roleplay-current-turn" style="min-height:100px;">
        <!-- Le tour actif sera affiché ici -->
      </div>
      <div id="roleplay-controls" style="text-align:center; padding:1rem;">
        <!-- Boutons de contrôle -->
      </div>
    `;

    this.#feedElement = document.getElementById('roleplay-feed');
  }

  /**
   * Attache les écouteurs d'événements au moteur via Event Bus
   */
  #bindEvents() {
    const events = [
      'roleplay:start',
      'roleplay:partner-speaking',
      'roleplay:user-turn',
      'roleplay:feedback',
      'roleplay:turn-start',
      'roleplay:complete',
      'roleplay:stopped'
    ];

    events.forEach(event => {
      const handler = (data) => this.#handleEvent(event, data);
      this.#bus.on(event, handler);
      this.#handlers.set(event, handler);
    });
  }

  /**
   * Détache tous les écouteurs
   */
  destroy() {
    this.#handlers.forEach((handler, event) => {
      this.#bus.off(event, handler);
    });
    this.#handlers.clear();
    console.log('[RolePlayUI] Détruit');
  }

  /**
   * Gestionnaire central des événements
   */
  #handleEvent(event, data) {
    console.log(`[RolePlayUI] Événement: ${event}`, data);

    switch (event) {
      case 'roleplay:partner-speaking':
        this.#renderPartnerTurn(data);
        break;
      case 'roleplay:user-turn':
        this.#renderUserTurn(data);
        break;
      case 'roleplay:feedback':
        this.#renderFeedback(data);
        break;
      case 'roleplay:complete':
        this.#renderComplete(data);
        break;
      case 'roleplay:stopped':
        this.#cleanup();
        break;
    }
  }

  /**
   * Affiche le tour du partenaire (TTS automatique)
   */
  #renderPartnerTurn(data) {
    // Déplacer le tour actif précédent dans le feed
    this.#moveCurrentTurnToFeed();

    // Créer le nouveau tour partenaire
    const turnElement = document.createElement('div');
    turnElement.className = 'roleplay-turn roleplay-turn-partner';
    turnElement.dataset.index = data.index;
    turnElement.innerHTML = `
      <div style="background:var(--ds-color-surface); padding:1.5rem; border-radius:var(--ds-radius-lg); border:2px solid var(--ds-color-border); margin-bottom:1rem; box-shadow:var(--ds-shadow-sm);">
        <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.75rem;">
          <span style="font-size:1.5rem;" id="partner-avatar-${data.index}">${data.avatar}</span>
          <strong style="color:var(--ds-color-text);">${data.speaker}</strong>
          <span id="partner-indicator-${data.index}" style="font-size:1.2rem; margin-left:auto;">🔊</span>
        </div>
        <div style="font-size:1.2rem; font-weight:500; margin-bottom:0.5rem;">${data.text}</div>
        <div style="font-size:0.95rem; color:var(--ds-color-text-muted); font-style:italic;">${data.translation}</div>
      </div>
    `;

    this.#currentTurnElement = turnElement;
    this.#container.querySelector('#roleplay-current-turn').appendChild(turnElement);
    this.#scrollToCurrentTurn();

    // Animation du TTS
    const indicator = document.getElementById(`partner-indicator-${data.index}`);
    if (indicator) {
      indicator.textContent = '🗣️';
      indicator.style.animation = 'pulse 1s infinite';
    }
  }

  /**
   * Affiche le tour de l'utilisateur (micro actif)
   */
  #renderUserTurn(data) {
    // Déplacer le tour actif précédent dans le feed
    this.#moveCurrentTurnToFeed();

    // Créer le nouveau tour utilisateur
    const turnElement = document.createElement('div');
    turnElement.className = 'roleplay-turn roleplay-turn-user';
    turnElement.dataset.index = data.index;

    const expectedTextHtml = data.expectedText ? `
      <div style="background:var(--ds-color-primary-soft); padding:1rem; border-radius:var(--ds-radius-md); margin-bottom:1rem; border:1px dashed var(--ds-color-primary);">
        <div style="font-size:0.75rem; text-transform:uppercase; color:var(--ds-color-primary); margin-bottom:0.5rem; font-weight:bold;">
          Votre réponse attendue
        </div>
        <div style="font-size:1.1rem; font-weight:500;">${data.expectedText}</div>
        <div style="font-size:0.85rem; color:var(--ds-color-text-muted); font-style:italic; margin-top:0.25rem;">${data.translation}</div>
      </div>
    ` : `
      <div style="background:var(--ds-color-surface-2); padding:1rem; border-radius:var(--ds-radius-md); margin-bottom:1rem;">
        <div style="font-size:0.9rem; color:var(--ds-color-text-muted);">
          🎤 Répondez sans regarder la réponse
        </div>
      </div>
    `;

    turnElement.innerHTML = `
      <div style="background:var(--ds-color-surface); padding:1.5rem; border-radius:var(--ds-radius-lg); border:2px solid var(--ds-color-primary); margin-bottom:1rem; box-shadow:var(--ds-shadow-sm);">
        <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.75rem;">
          <span style="font-size:1.5rem;">${data.avatar}</span>
          <strong style="color:var(--ds-color-primary);">${data.speaker} (Anao / Vous)</strong>
        </div>
        ${expectedTextHtml}
        <div style="text-align:center; padding:1rem; background:var(--ds-color-primary-soft); border-radius:var(--ds-radius-md);">
          <div style="font-size:0.75rem; text-transform:uppercase; color:var(--ds-color-primary); margin-bottom:0.5rem; font-weight:bold;">
            Mitenena izao (Parlez maintenant)
          </div>
          <ds-button variant="primary" size="lg" id="btn-speak-v2" class="guide-active">
            🎤 Mitenena izao (Parler maintenant)
          </ds-button>
          <div id="speech-feedback-v2" style="margin-top:0.75rem; font-size:0.9rem; font-weight:600; min-height:1.5em;"></div>
        </div>
      </div>
    `;

    this.#currentTurnElement = turnElement;
    this.#container.querySelector('#roleplay-current-turn').appendChild(turnElement);
    this.#scrollToCurrentTurn();

    // Attacher le listener au bouton micro
    this.#bindSpeakButton(data.index);
  }

  /**
   * Attache le listener au bouton micro
   */
  #bindSpeakButton(index) {
    const btnSpeak = document.getElementById('btn-speak-v2');
    const speechFeedback = document.getElementById('speech-feedback-v2');

    if (!btnSpeak) return;

    let isRecording = false;

        btnSpeak.addEventListener('click', () => {
      if (isRecording) {
        window.shadowing?.forceStop();
        isRecording = false;
        btnSpeak.textContent = '🎤 Mitenena izao (Parler maintenant)';
        return;
      }

      btnSpeak.setAttribute('disabled', '');
      btnSpeak.textContent = '🎙️ Mandre... (Écoute en cours)';
      speechFeedback.innerHTML = '<span style="color:var(--ds-color-accent);">Mitenena izao... (Je vous écoute...)</span>';
      isRecording = true;

            // Utiliser STT Manager global
      const sttManager = window.sttManager;
      
      if (!sttManager) {
        speechFeedback.innerHTML = '<span style="color:var(--ds-color-danger);">⚠️ STT Manager non disponible</span>';
        console.error('[RolePlayUI] window.sttManager non disponible');
        return;
      }
      if (sttManager) {
        sttManager.startListening('fr-FR', {
          onResult: (result) => {
            isRecording = false;
            btnSpeak.removeAttribute('disabled');
            
            const transcript = result.transcript || '';
            const engine = result.isReal ? 'webspeech' : 'simulation';
            
            speechFeedback.innerHTML = `<div style="margin-bottom:0.5rem;"><strong>Vous avez dit :</strong> "${transcript}"</div>`;
            
            // Envoyer au moteur pour évaluation
            this.#engine.evaluateUserResponse(transcript, engine);
          },
          onError: (error) => {
            isRecording = false;
            btnSpeak.removeAttribute('disabled');
            btnSpeak.textContent = '🎤 Mitenena izao (Parler maintenant)';
            speechFeedback.innerHTML = `<span style="color:var(--ds-color-danger);">⚠️ Erreur: ${error}</span>`;
          }
        });
      } else {
        speechFeedback.innerHTML = '<span style="color:var(--ds-color-danger);">⚠️ STT Manager non disponible</span>';
      }
    });
  }

  /**
   * Affiche le feedback après évaluation STT
   */
  #renderFeedback(data) {
    const speechFeedback = document.getElementById('speech-feedback-v2');
    if (!speechFeedback) return;

    let html = '';
    let color = 'var(--ds-color-text-muted)';

    switch (data.status) {
      case 'success':
        color = 'var(--ds-color-success)';
        html += `<div style="color:${color}; font-size:1.1rem; font-weight:bold;">✅ ${data.message}</div>`;
        break;
      case 'acceptable':
        color = 'var(--ds-color-success)';
        html += `<div style="color:${color}; font-size:1.1rem; font-weight:bold;">✅ ${data.message}</div>`;
        break;
      case 'retry':
        color = 'var(--ds-color-accent)';
        html += `<div style="color:${color}; font-size:1.1rem; font-weight:bold;">🔄 ${data.message}</div>`;
        break;
      case 'simulation':
        color = 'var(--ds-color-primary)';
        html += `<div style="color:${color}; font-size:1rem;">${data.message}</div>`;
        break;
    }

    if (data.transcript) {
      html += `<div style="margin-top:0.5rem; font-size:0.9rem;">Vous avez dit : <em>"${data.transcript}"</em></div>`;
    }

    if (data.expected && this.#mode === 'guided') {
      html += `<div style="margin-top:0.25rem; font-size:0.85rem; color:var(--ds-color-text-muted);">Attendu : "${data.expected}"</div>`;
    }

    if (data.score !== undefined) {
      const percent = Math.round(data.score * 100);
      html += `<div style="margin-top:0.5rem; font-size:0.85rem;">Correspondance : ${percent}%</div>`;
    }

    speechFeedback.innerHTML = html;

    // Ajouter le feedback au feed si succès
    if (data.status === 'success' || data.status === 'acceptable' || data.status === 'simulation') {
      this.#moveCurrentTurnToFeed(true, data);
    }
  }

  /**
   * Déplace le tour actif courant dans le feed permanent
   */
  #moveCurrentTurnToFeed(withFeedback = false, feedbackData = null) {
    if (!this.#currentTurnElement) return;

    // Marquer comme terminé
    this.#currentTurnElement.style.opacity = '0.7';

    // Ajouter un badge de statut si feedback
    if (withFeedback && feedbackData) {
      const badge = document.createElement('div');
      badge.style.cssText = 'text-align:center; padding:0.5rem; background:var(--ds-color-success-soft); border-radius:var(--ds-radius-sm); margin-top:0.5rem;';
      badge.innerHTML = `<span style="color:var(--ds-color-success); font-weight:bold;">✓ Terminé</span>`;
      this.#currentTurnElement.appendChild(badge);
    }

    // Déplacer dans le feed
    this.#feedElement.appendChild(this.#currentTurnElement);
    this.#currentTurnElement = null;
  }

  /**
   * Affiche l'écran de complétion
   */
  #renderComplete(data) {
    this.#moveCurrentTurnToFeed();

    const completeElement = document.createElement('div');
    completeElement.style.cssText = 'text-align:center; padding:2rem; background:var(--ds-color-success-soft); border-radius:var(--ds-radius-lg); margin-top:1rem;';
    completeElement.innerHTML = `
      <div style="font-size:3rem; margin-bottom:1rem;">🎉</div>
      <h3 style="margin:0 0 0.5rem 0; color:var(--ds-color-success);">Role Play terminé !</h3>
      <p style="margin:0; color:var(--ds-color-text-muted);">
        Vous avez terminé ${data.totalLines} échanges.
      </p>
    `;

    this.#feedElement.appendChild(completeElement);
    this.#scrollToBottom();
  }

  /**
   * Nettoie l'interface
   */
  #cleanup() {
    this.#container.innerHTML = '';
    this.#currentTurnElement = null;
  }

  /**
   * Scroll vers le tour actif
   */
  #scrollToCurrentTurn() {
    if (this.#currentTurnElement) {
      setTimeout(() => {
        this.#currentTurnElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }

  /**
   * Scroll vers le bas du feed
   */
  #scrollToBottom() {
    setTimeout(() => {
      const lastChild = this.#feedElement.lastElementChild;
      if (lastChild) {
        lastChild.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }, 100);
  }

  /**
   * Met à jour la barre de progression
   */
  updateProgress(current, total) {
    const progressBar = document.getElementById('roleplay-progress-bar');
    const progressText = document.getElementById('roleplay-progress-text');

    if (progressBar) {
      const percent = (current / total) * 100;
      progressBar.style.width = `${percent}%`;
    }

    if (progressText) {
      progressText.textContent = `Andiany ${current + 1} / ${total}`;
    }
  }
}