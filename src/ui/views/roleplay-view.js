/**
 * RolePlayView — Vue Role Play V2
 * Orchestre RolePlayEngine + RolePlayUI
 * Remplace progressivement l'ancienne fonction renderRolePlay
 */
import { RolePlayEngine } from '../../engines/roleplay-engine.js';
import { RolePlayUI } from '../roleplay-ui.js';
import { sessionManager } from '../../core/session-manager.js';
import { ttsService } from '../../core/tts-service.js';

export class RolePlayView {
    #engine = null;
  #ui = null;
  #dialogue = null;
  #mode = 'guided';
  #eventBus = null;  // ✅ Stocker l'instance d'EventBus

  /**
   * Rend la vue Role Play
   * @param {HTMLElement} main - Container principal de l'app
   * @param {string} themeId - ID du thème (ex: 'colors')
   * @param {string} mode - Mode de jeu ('guided' ou 'challenge')
   */
  async render(main, themeId, mode = 'guided') {
    this.#mode = mode;
    
    // Cleanup avant de commencer
    this.#cleanup();

    // Afficher un loader
    main.innerHTML = `
      <div style="text-align:center; padding:2rem;">
        <div style="font-size:2rem; margin-bottom:1rem;">🎭</div>
        <p>Famakiana ny Role Play...</p>
      </div>
    <!-- ✅ Notification du mode STT -->
            <div id="stt-mode-notification" style="
              text-align: center;
              padding: 0.75rem 1rem;
              margin-bottom: 1rem;
              border-radius: var(--ds-radius-md);
              background: var(--ds-color-primary-soft);
              border: 1px solid var(--ds-color-primary);
              font-size: 0.9rem;
            ">
              <span style="color: var(--ds-color-primary); font-weight: 600;">
                🎙️ Mode microphone actif
              </span>
      </div>
    `;



    try {
      // 1. Charger le dialogue
      // Importer ContentLoader directement
      const { ContentLoader } = await import('../../data/content-loader.js');
      const contentLoader = new ContentLoader();
      this.#dialogue = await contentLoader.loadSection('fr', 'dialogues', `${themeId}_dialogue`);
      
      if (!this.#dialogue || !this.#dialogue.lines) {
        throw new Error('Dialogue invalide');
      }

      console.log(`[RolePlayView] Dialogue chargé: ${this.#dialogue.id} (${this.#dialogue.lines.length} lignes)`);

      // 2. Désactiver TeacherAvatar pendant la session
      if (window.teacherAvatar) {
        window.teacherAvatar.setSessionActive(true);
      }

      // 3. Annuler tout TTS/STT précédent
      ttsService.cancel();
      if (window.shadowing) {
        window.shadowing.forceStop();
      }

            // 4. Créer l'interface
      main.innerHTML = `
        <section style="max-width: 600px; margin: 0 auto; padding: 2rem 1rem;">
          <div style="background:var(--ds-color-border); height:8px; border-radius:4px; margin-bottom:1rem; overflow:hidden;">
            <div id="roleplay-progress-bar" style="background:var(--ds-color-accent, #f59e0b); height:100%; width:0%; transition: width 0.3s ease;"></div>
          </div>

          <div style="display:flex; justify-content:space-between; margin-bottom:1rem; align-items:center;">
            <ds-button variant="ghost" size="sm" id="btn-back-roleplay">← Hiverina (Retour)</ds-button>
            <span id="roleplay-progress-text" style="font-weight:600; color:var(--ds-color-text-muted);">
              Andiany 1 / ${this.#dialogue.lines.length}
            </span>
          </div>

          <div style="text-align:center; margin-bottom:1rem;">
            <span style="background:var(--ds-color-accent, #f59e0b); color:white; padding:4px 12px; border-radius:20px; font-weight:600; font-size:0.8rem;">
              🎭 ${mode === 'guided' ? 'Role Play Guidé' : 'Défi'} • ${this.#dialogue.theme}
            </span>
          </div>

         <h2 style="text-align:center; margin-bottom:1rem;">💬 ${this.#dialogue.title}</h2>

        <div style="text-align:center; margin-bottom:1.5rem; padding:1rem; background:var(--ds-color-primary-soft); border-radius:var(--ds-radius-md);">
          <div style="font-size:0.9rem; color:var(--ds-color-text-muted); margin-bottom:0.5rem;">
            Vous jouez le rôle de
          </div>
          <div style="font-size:1.5rem; font-weight:bold; color:var(--ds-color-primary);">
            ${this.#dialogue.participants['B']?.avatar || '👤'} ${this.#dialogue.participants['B']?.name || 'Vous'}
          </div>
        </div>

            <!-- ✅ Notification du mode STT -->
            <div id="stt-mode-notification" style="text-align:center; padding:0.75rem 1rem; margin-bottom:1rem; border-radius:var(--ds-radius-md); background:var(--ds-color-primary-soft); border:1px solid var(--ds-color-primary); font-size:0.9rem;">
              <span style="color:var(--ds-color-primary); font-weight:600;">🎙️ Mode microphone actif</span>
            </div>

              <!-- ✅ Notification du mode STT -->
              <div id="stt-status-notification" style="text-align:center; padding:0.75rem 1rem; margin-bottom:1rem; border-radius:var(--ds-radius-md); background:var(--ds-color-surface-2); border:1px solid var(--ds-color-border); font-size:0.9rem;">
                <span style="color:var(--ds-color-text-muted); font-weight:600;">Reconnaissance vocale : chargement...</span>
              </div>

        <div id="roleplay-container">
          <!-- RolePlayUI va injecter le contenu ici -->
        </div>
        </section>
      `;

              // 5. Importer EventBus
        const { EventBus } = await import('../../core/event-bus.js');
        const eventBus = window.bus || new EventBus();
        
        this.#eventBus = eventBus;  // ✅ Stocker pour utilisation dans #bindProgressEvents

      // 6. Créer le moteur
      this.#engine = new RolePlayEngine(this.#dialogue, {
        mode: mode,
        
        eventBus: eventBus,
        sttManager: window.sttManager
      });

      // 7. Créer l'interface
      this.#ui = new RolePlayUI('roleplay-container', eventBus, this.#engine, mode);

      // 8. Attacher les écouteurs d'événements pour la progression
      this.#bindProgressEvents();

      // 9. Attacher le bouton retour
      document.getElementById('btn-back-roleplay').addEventListener('click', () => {
        this.#cleanup();
        if (window.router) {

        // ✅ Mettre à jour la notification STT (Reconnaissance vocale)
        const sttStatusNotification = document.getElementById("stt-status-notification");
        if (sttStatusNotification && window.sttManager) {
          const isSimulation = window.sttManager.isSimulationMode();
          if (isSimulation) {
            sttStatusNotification.innerHTML = '<span style="color:var(--ds-color-accent); font-weight:600;">🎭 Reconnaissance vocale : Mode simulation hors-ligne (évaluation simplifiée)</span>';
            sttStatusNotification.style.background = "var(--ds-color-accent-soft, #fef3c7)";
            sttStatusNotification.style.borderColor = "var(--ds-color-accent)";
          } else {
            sttStatusNotification.innerHTML = '<span style="color:var(--ds-color-primary); font-weight:600;">🌐 Reconnaissance vocale : Mode Web API (temps réel)</span>';
            sttStatusNotification.style.background = "var(--ds-color-primary-soft)";
            sttStatusNotification.style.borderColor = "var(--ds-color-primary)";
          }
        }
          window.router.navigate('/dialogues');
        }
      });

      // 10. Démarrer la session
      this.#engine.start();

      console.log(`[RolePlayView] ✅ Role Play ${mode} démarré pour le thème: ${themeId}`);

    } catch (e) {
      console.error('❌ Erreur RolePlayView:', e);
      main.innerHTML = `
        <div style="text-align:center; padding:2rem; color:var(--ds-color-danger);">
          <p>Hadisoana: ${e.message}</p>
          <ds-button onclick="location.hash='/themes'">Hiverina</ds-button>
        </div>
      `;
    }
  }

    /**
   * Attache les événements pour mettre à jour la progression et gérer la complétion
   */
   /**
   * Attache les événements pour mettre à jour la progression et gérer la complétion
   */
  #bindProgressEvents() {
    console.log('[RolePlayView] #bindProgressEvents appelé');
    
    if (!this.#eventBus) {
      console.error('[RolePlayView] EventBus non disponible');
      return;
    }
    
    console.log('[RolePlayView] EventBus disponible, attachement des écouteurs');

    // ✅ Mettre à jour la barre de progression à chaque tour
    this.#eventBus.on('roleplay:turn-start', (data) => {
      console.log('[RolePlayView] Événement roleplay:turn-start reçu:', data);
      
      if (this.#ui) {
        this.#ui.updateProgress(data.index, data.total);
      }
      
      // Mettre à jour la barre de progression dans RolePlayView
      const progressBar = document.getElementById('roleplay-progress-bar');
      const progressText = document.getElementById('roleplay-progress-text');
      
      if (progressBar) {
        const percent = ((data.index + 1) / data.total) * 100;
        progressBar.style.width = `${percent}%`;
      }
      
      if (progressText) {
        progressText.textContent = `Andiany ${data.index + 1} / ${data.total}`;
      }
    });

    // ✅ Gérer la complétion
    this.#eventBus.on('roleplay:complete', (data) => {
      console.log('[RolePlayView] Événement roleplay:complete reçu:', data);
      
      // 1. Ajouter XP
      const xpEarned = this.#mode === 'guided' ? 30 : 50;
      if (window.gamification) {
        window.gamification.addXP(xpEarned, `Role Play ${this.#mode} terminé`);
      }

      // 2. Marquer le parcours comme terminé
      if (window.journeyTracker) {
        const journeyType = this.#mode === 'guided' ? 'roleplays' : 'challenges';
        window.journeyTracker.markJourneyComplete(journeyType, this.#dialogue.theme);
      }

      // 3. Sauvegarder le profil
      if (window.saveProfile) {
        window.saveProfile();
      }

      // 4. Réactiver TeacherAvatar
      if (window.teacherAvatar) {
        window.teacherAvatar.setSessionActive(false);
      }

      // 5. Afficher les boutons de navigation
      this.#showCompletionButtons();

      // 6. Félicitations vocales
      ttsService.speak("Très bien ! Vous avez terminé le Role Play.", {
        gender: 'female'
      });
    });
  }

  /**
   * Affiche les boutons de navigation après complétion
   */
  #showCompletionButtons() {
    console.log('[RolePlayView] Affichage des boutons de complétion');
    
    const container = document.getElementById('roleplay-container');
    if (!container) {
      console.error('[RolePlayView] roleplay-container introuvable');
      return;
    }

    const buttonsHtml = `
      <div style="display:flex; flex-direction:column; gap:1rem; margin-top:2rem; padding:1.5rem; background:var(--ds-color-surface); border-radius:var(--ds-radius-lg); box-shadow:var(--ds-shadow-sm);">
        <h3 style="text-align:center; margin:0; color:var(--ds-color-success);">🎉 Role Play terminé !</h3>
        
        <div style="display:flex; gap:1rem; justify-content:center; flex-wrap:wrap;">
          <ds-button variant="ghost" size="md" id="btn-back-to-dialogues">
            ← Hiverina (Retour aux dialogues)
          </ds-button>
          
          ${this.#mode === 'guided' ? `
            <ds-button variant="primary" size="lg" id="btn-go-to-challenge">
              🎯 Mandeha any amin'ny Défi (Aller au Défi)
            </ds-button>
          ` : `
            <ds-button variant="primary" size="lg" id="btn-back-to-themes">
              🏠 Hiverina any amin'ny thèmes (Retour aux thèmes)
            </ds-button>
          `}
        </div>
      </div>
    `;

    container.insertAdjacentHTML('beforeend', buttonsHtml);
    console.log('[RolePlayView] Boutons de complétion ajoutés au DOM');

    // Attacher les listeners
    const btnBackToDialogues = document.getElementById('btn-back-to-dialogues');
    if (btnBackToDialogues) {
      btnBackToDialogues.addEventListener('click', () => {
        console.log('[RolePlayView] Bouton retour aux dialogues cliqué');
        this.#cleanup();
        if (window.router) {
          window.router.navigate('/dialogues');
        } else {
          console.warn('[RolePlayView] window.router non disponible, utilisation fallback');
          window.location.hash = '/dialogues';
        }
      });
    }

    const btnGoToChallenge = document.getElementById('btn-go-to-challenge');
    if (btnGoToChallenge) {
      btnGoToChallenge.addEventListener('click', () => {
        console.log('[RolePlayView] Bouton aller au défi cliqué');
        this.#cleanup();
        if (window.router) {
          window.router.navigate('/challenge');
        } else {
          console.warn('[RolePlayView] window.router non disponible, utilisation fallback');
          window.location.hash = '/challenge';
        }
      });
    }

    const btnBackToThemes = document.getElementById('btn-back-to-themes');
    if (btnBackToThemes) {
      btnBackToThemes.addEventListener('click', () => {
        console.log('[RolePlayView] Bouton retour aux thèmes cliqué');
        this.#cleanup();
        if (window.router) {
          window.router.navigate('/themes');
        } else {
          console.warn('[RolePlayView] window.router non disponible, utilisation fallback');
          window.location.hash = '/themes';
        }
      });
    }

    // Scroll vers les boutons
    setTimeout(() => {
      const buttons = container.querySelector('[id^="btn-"]');
      if (buttons) {
        buttons.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 300);
  }

  /**
   * Nettoie toutes les ressources
   */
  #cleanup() {
    // Détruire l'UI
    if (this.#ui) {
      this.#ui.destroy();
      this.#ui = null;
    }

    // Arrêter le moteur
    if (this.#engine) {
      this.#engine.stop();
      this.#engine = null;
    }

    // Annuler la session
    sessionManager.cancel('roleplay');

    // Annuler TTS
    ttsService.cancel();

    // Arrêter STT
    if (window.shadowing) {
      window.shadowing.forceStop();
    }

    // Réactiver TeacherAvatar
    if (window.teacherAvatar) {
      window.teacherAvatar.setSessionActive(false);
    }

    console.log('[RolePlayView] Nettoyage terminé');
  }
}

// Instance globale pour faciliter l'intégration
export const rolePlayView = new RolePlayView();