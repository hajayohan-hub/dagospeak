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

          <h2 style="text-align:center; margin-bottom:1.5rem;">💬 ${this.#dialogue.title}</h2>

          <div id="roleplay-container">
            <!-- RolePlayUI va injecter le contenu ici -->
          </div>
        </section>
      `;

      // 5. Importer EventBus
      const { EventBus } = await import('../../core/event-bus.js');
      const eventBus = window.bus || new EventBus();

      // 6. Créer le moteur
      this.#engine = new RolePlayEngine(this.#dialogue, {
        userRole: 'B',
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
   * Attache les événements pour mettre à jour la progression
   */
  #bindProgressEvents() {
    if (!window.bus) return;

    window.bus.on('roleplay:turn-start', (data) => {
      if (this.#ui) {
        this.#ui.updateProgress(data.index, data.total);
      }
    });

    window.bus.on('roleplay:complete', (data) => {
      console.log('[RolePlayView] Role Play complété:', data);
      
      // Ajouter XP
      if (window.gamification) {
        window.gamification.addXP(30, `Role Play ${this.#mode} terminé`);
      }

      // Marquer le parcours comme terminé
      if (window.journeyTracker) {
        const journeyType = this.#mode === 'guided' ? 'roleplays' : 'challenges';
        window.journeyTracker.markJourneyComplete(journeyType, this.#dialogue.theme);
      }

      // Sauvegarder le profil
      if (window.saveProfile) {
        window.saveProfile();
      }

      // Réactiver TeacherAvatar
      if (window.teacherAvatar) {
        window.teacherAvatar.setSessionActive(false);
      }

      // Félicitations vocales
      ttsService.speak("Très bien ! Vous avez terminé le Role Play.", {
        gender: 'female'
      });

      // Transition automatique vers le Défi après 3 secondes
      if (this.#mode === 'guided') {
        setTimeout(() => {
          if (window.router) {
            console.log('[RolePlayView] Transition vers le Défi...');
            // Pour l'instant, on reste sur la page de complétion
            // Plus tard : router.navigate('/challenge');
          }
        }, 3000);
      }
    });
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