/**
 * ConversationEngine - Moteur de conversation semi-libre
 * Lit les fichiers JSON du dossier content/fr/conversations/
 * et orchestre le flux avec le Teacher Avatar (TTS + états SVG)
 */
export class ConversationEngine {
  #dialogue = null;
  #currentNodeId = null;
  #attempts = {}; // Compteur de tentatives par nœud
  #container = null;
  #onComplete = null;

  constructor(dialogueId, onCompleteCallback) {
    this.dialogueId = dialogueId;
    this.#onComplete = onCompleteCallback;
  }

  async start(containerId = 'app') {
    this.#container = document.getElementById(containerId);
    this.#attempts = {};

    try {
      // Charger le dialogue depuis le dossier conversations/
      const response = await fetch(`/content/fr/conversations/${this.dialogueId}.json`);
      if (!response.ok) throw new Error(`Dialogue introuvable : ${this.dialogueId}`);
      this.#dialogue = await response.json();

      console.log(`[ConversationEngine] ✅ Dialogue chargé : ${this.#dialogue.titleFr}`);

      // Démarrer au premier nœud
      this.#currentNodeId = this.#dialogue.nodes[0].id;
      this.#renderNode();
    } catch (error) {
      console.error('[ConversationEngine] ❌ Erreur chargement:', error);
      this.#container.innerHTML = `
        <div style="text-align:center; padding:2rem; color:var(--ds-color-danger);">
          <p>Erreur : ${error.message}</p>
          <button onclick="location.hash='/themes'" style="margin-top:1rem; padding:10px 20px; background:var(--ds-color-primary); color:white; border:none; border-radius:8px; cursor:pointer;">
            Retour aux thèmes
          </button>
        </div>
      `;
    }
  }

  #renderNode() {
    const node = this.#dialogue.nodes.find(n => n.id === this.#currentNodeId);
    if (!node) {
      console.error(`[ConversationEngine] Nœud introuvable : ${this.#currentNodeId}`);
      return;
    }

    // Fin du dialogue ?
    if (node.isEnd) {
      this.#renderEnd(node);
      return;
    }

    // Nœud du Teacher (il parle)
    if (node.speaker === 'teacher') {
      this.#renderTeacherNode(node);
    }
    // Nœud de l'utilisateur (il choisit)
    else if (node.speaker === 'user') {
      this.#renderUserNode(node);
    }
  }

  #renderTeacherNode(node) {
    // Mettre à jour l'état de l'avatar si disponible
    if (window.teacherAvatar && node.svgState) {
      window.teacherAvatar.setState?.(node.svgState);
    }

    this.#container.innerHTML = `
      <section style="max-width: 600px; margin: 0 auto; padding: 2rem 1rem;">
        <button id="btn-quit-conversation" style="
          background: transparent; border: none; color: var(--ds-color-text-muted);
          cursor: pointer; font-size: 0.9rem; margin-bottom: 1rem;
        ">← Quitter la conversation</button>

        <div style="text-align:center; margin-bottom:1.5rem;">
          <span style="background:var(--ds-color-primary); color:white; padding:4px 12px; border-radius:20px; font-weight:600; font-size:0.8rem;">
            💬 ${this.#dialogue.titleFr}
          </span>
        </div>

        <div style="
          background: var(--ds-color-surface);
          padding: 2rem;
          border-radius: var(--ds-radius-lg);
          border: 2px solid var(--ds-color-primary);
          box-shadow: var(--ds-shadow-md);
          text-align: center;
        ">
          <div style="font-size: 4rem; margin-bottom: 1rem;">👩‍🏫</div>
          <div style="font-size: 0.85rem; color: var(--ds-color-text-muted); margin-bottom: 0.5rem;">
            Teacher Avatar • ${node.svgState || 'neutral'}
          </div>
          <p style="font-size: 1.2rem; color: var(--ds-color-text); margin-bottom: 0.5rem; font-weight: 500;">
            "${node.textFr}"
          </p>
          <p style="font-size: 0.95rem; color: var(--ds-color-text-muted); font-style: italic; margin-bottom: 1.5rem;">
            (${node.textMg})
          </p>

          <button id="btn-play-teacher" style="
            background: var(--ds-color-primary); color: white; border: none;
            padding: 12px 24px; border-radius: 12px; font-weight: 600;
            cursor: pointer; font-size: 1rem; margin-bottom: 1rem;
          ">🔊 Mihainoa (Écouter)</button>

          <div>
            <button id="btn-next-node" style="
              background: var(--ds-color-success); color: white; border: none;
              padding: 12px 24px; border-radius: 12px; font-weight: 600;
              cursor: pointer; font-size: 1rem; opacity: 0.5;
            " disabled>Manaraka → (Suivant)</button>
          </div>
        </div>
      </section>
    `;

    const btnPlay = document.getElementById('btn-play-teacher');
    const btnNext = document.getElementById('btn-next-node');
    let hasPlayed = false;

    btnPlay.addEventListener('click', () => {
      if (hasPlayed) return;
      hasPlayed = true;

      // Utiliser SpeechSynthesis avec fallback
      this.#speakFrench(node.audio.ttsTextFr, node.audio.ttsRate || 0.9);

      btnPlay.textContent = '🔊 ...';
      btnPlay.disabled = true;

      // Activer le bouton suivant après la durée estimée
      setTimeout(() => {
        btnNext.disabled = false;
        btnNext.style.opacity = '1';
        btnNext.style.animation = 'pulse-green 1.5s infinite';
        btnPlay.textContent = '✅ Vita';
      }, node.audio.estimatedDurationMs || 2000);
    });

    btnNext.addEventListener('click', () => {
      this.#currentNodeId = node.nextNode;
      this.#renderNode();
    });

    document.getElementById('btn-quit-conversation').addEventListener('click', () => {
      if (confirm('Quitter la conversation ?')) {
        location.hash = '/themes';
      }
    });
  }

  #renderUserNode(node) {
    // Initialiser le compteur de tentatives
    if (!this.#attempts[node.id]) this.#attempts[node.id] = 0;

    this.#container.innerHTML = `
      <section style="max-width: 600px; margin: 0 auto; padding: 2rem 1rem;">
        <button id="btn-quit-conversation" style="
          background: transparent; border: none; color: var(--ds-color-text-muted);
          cursor: pointer; font-size: 0.9rem; margin-bottom: 1rem;
        ">← Quitter la conversation</button>

        <div style="text-align:center; margin-bottom:1.5rem;">
          <span style="background:var(--ds-color-accent); color:white; padding:4px 12px; border-radius:20px; font-weight:600; font-size:0.8rem;">
            🎯 À votre tour !
          </span>
          ${this.#attempts[node.id] > 0 ? `
            <div style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--ds-color-accent);">
              Tentative ${this.#attempts[node.id]} / ${node.maxAttempts}
            </div>
          ` : ''}
        </div>

        <div style="
          background: var(--ds-color-surface);
          padding: 2rem;
          border-radius: var(--ds-radius-lg);
          border: 2px solid var(--ds-color-accent);
          box-shadow: var(--ds-shadow-md);
          text-align: center;
        ">
          <div style="font-size: 4rem; margin-bottom: 1rem;">🗣️</div>
          <p style="font-size: 1.1rem; color: var(--ds-color-text); margin-bottom: 1.5rem; font-weight: 500;">
            Que voulez-vous répondre ?
          </p>

          <div style="display: flex; flex-direction: column; gap: 1rem;">
            ${node.responseOptions.map((option, idx) => `
              <button class="btn-response-option" data-index="${idx}" style="
                background: var(--ds-color-surface-2);
                color: var(--ds-color-text);
                border: 2px solid var(--ds-color-border);
                padding: 1rem;
                border-radius: 12px;
                cursor: pointer;
                text-align: left;
                transition: all 0.2s;
                font-size: 1rem;
              ">
                <div style="font-weight: 600; margin-bottom: 0.25rem;">
                  ${idx === 0 ? '🅰️' : '🅱️'} ${option.textFr}
                </div>
                <div style="font-size: 0.85rem; color: var(--ds-color-text-muted); font-style: italic;">
                  (${option.textMg})
                </div>
              </button>
            `).join('')}
          </div>

          <div id="feedback-area" style="margin-top: 1.5rem; min-height: 80px;"></div>
        </div>
      </section>
    `;

    // Gestion des clics sur les options
    document.querySelectorAll('.btn-response-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index);
        const selectedOption = node.responseOptions[index];
        this.#handleUserChoice(node, selectedOption, btn);
      });

      // Effet hover
      btn.addEventListener('mouseenter', () => {
        btn.style.borderColor = 'var(--ds-color-primary)';
        btn.style.transform = 'translateY(-2px)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.borderColor = 'var(--ds-color-border)';
        btn.style.transform = 'translateY(0)';
      });
    });

    document.getElementById('btn-quit-conversation').addEventListener('click', () => {
      if (confirm('Quitter la conversation ?')) {
        location.hash = '/themes';
      }
    });
  }

  #handleUserChoice(node, option, btnElement) {
    const feedbackArea = document.getElementById('feedback-area');
    this.#attempts[node.id]++;

    // Désactiver tous les boutons
    document.querySelectorAll('.btn-response-option').forEach(b => b.disabled = true);

    if (option.isCorrect) {
      // ✅ BONNE RÉPONSE
      btnElement.style.borderColor = 'var(--ds-color-success)';
      btnElement.style.background = 'var(--ds-color-success-soft)';

      feedbackArea.innerHTML = `
        <div style="background: var(--ds-color-success-soft); padding: 1rem; border-radius: 12px; border-left: 4px solid var(--ds-color-success);">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">✅</div>
          <p style="color: var(--ds-color-success); font-weight: 600; margin-bottom: 0.25rem;">
            ${node.feedbackOnSuccess.textFr}
          </p>
          <p style="color: var(--ds-color-text-muted); font-style: italic; font-size: 0.9rem;">
            (${node.feedbackOnSuccess.textMg})
          </p>
        </div>
        <button id="btn-continue" style="
          margin-top: 1rem; background: var(--ds-color-success); color: white;
          border: none; padding: 12px 24px; border-radius: 12px;
          font-weight: 600; cursor: pointer; font-size: 1rem; width: 100%;
        ">Manaraka → (Continuer)</button>
      `;

      // Jouer le feedback vocal
      this.#speakFrench(node.feedbackOnSuccess.audio.ttsTextFr, node.feedbackOnSuccess.audio.ttsRate || 0.9);

      // Mettre à jour l'avatar
      if (window.teacherAvatar && node.feedbackOnSuccess.svgState) {
        window.teacherAvatar.setState?.(node.feedbackOnSuccess.svgState);
      }

      document.getElementById('btn-continue').addEventListener('click', () => {
        this.#currentNodeId = node.nextNodeOnSuccess;
        this.#renderNode();
      });

    } else {
      // ❌ MAUVAISE RÉPONSE
      btnElement.style.borderColor = 'var(--ds-color-danger)';
      btnElement.style.background = 'var(--ds-color-danger-soft, #fee2e2)';

      // Vérifier si on a atteint le max de tentatives
      if (this.#attempts[node.id] >= node.maxAttempts) {
        // Révéler la réponse
        feedbackArea.innerHTML = `
          <div style="background: var(--ds-color-accent-soft, #fef3c7); padding: 1rem; border-radius: 12px; border-left: 4px solid var(--ds-color-accent);">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">💡</div>
            <p style="color: var(--ds-color-text); font-weight: 600; margin-bottom: 0.25rem;">
              Pas de souci, on continue !
            </p>
            <p style="color: var(--ds-color-text-muted); font-size: 0.9rem;">
              La bonne réponse était : <strong>${node.responseOptions.find(o => o.isCorrect).textFr}</strong>
            </p>
          </div>
          <button id="btn-continue" style="
            margin-top: 1rem; background: var(--ds-color-accent); color: white;
            border: none; padding: 12px 24px; border-radius: 12px;
            font-weight: 600; cursor: pointer; font-size: 1rem; width: 100%;
          ">Manaraka → (Continuer)</button>
        `;

        document.getElementById('btn-continue').addEventListener('click', () => {
          this.#currentNodeId = node.nextNodeOnMaxAttemptsReached;
          this.#renderNode();
        });
      } else {
        // Feedback d'erreur, on peut réessayer
        feedbackArea.innerHTML = `
          <div style="background: var(--ds-color-danger-soft, #fee2e2); padding: 1rem; border-radius: 12px; border-left: 4px solid var(--ds-color-danger);">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">🔄</div>
            <p style="color: var(--ds-color-danger); font-weight: 600; margin-bottom: 0.25rem;">
              ${node.feedbackOnFail.textFr}
            </p>
            <p style="color: var(--ds-color-text-muted); font-style: italic; font-size: 0.9rem;">
              (${node.feedbackOnFail.textMg})
            </p>
          </div>
          <button id="btn-retry" style="
            margin-top: 1rem; background: var(--ds-color-accent); color: white;
            border: none; padding: 12px 24px; border-radius: 12px;
            font-weight: 600; cursor: pointer; font-size: 1rem; width: 100%;
          ">🔁 Réessayer</button>
        `;

        // Jouer le feedback vocal
        this.#speakFrench(node.feedbackOnFail.audio.ttsTextFr, node.feedbackOnFail.audio.ttsRate || 0.9);

        document.getElementById('btn-retry').addEventListener('click', () => {
          this.#renderUserNode(node);
        });
      }
    }
  }

  #renderEnd(node) {
    // Félicitations finales
    if (window.teacherAvatar) {
      window.teacherAvatar.setState?.(node.svgState || 'celebrating');
      setTimeout(() => {
        window.teacherAvatar.speak?.("Félicitations ! Vous avez terminé la conversation !");
      }, 500);
    }

    this.#container.innerHTML = `
      <section style="max-width: 600px; margin: 0 auto; padding: 2rem 1rem; text-align: center;">
        <div style="font-size: 5rem; margin-bottom: 1rem;">🎉</div>
        <h2 style="color: var(--ds-color-success); margin-bottom: 1rem;">
          Conversation terminée !
        </h2>
        <p style="color: var(--ds-color-text); font-size: 1.1rem; margin-bottom: 0.5rem;">
          ${node.textFr}
        </p>
        <p style="color: var(--ds-color-text-muted); font-style: italic; margin-bottom: 2rem;">
          (${node.textMg})
        </p>

        <div style="background: var(--ds-color-success-soft); padding: 1.5rem; border-radius: var(--ds-radius-lg); border: 2px solid var(--ds-color-success); margin-bottom: 1.5rem;">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">🏆</div>
          <p style="color: var(--ds-color-success); font-weight: 600;">
            +50 XP pour cette conversation !
          </p>
        </div>

        <button onclick="location.hash='/themes'" style="
          background: var(--ds-color-primary); color: white; border: none;
          padding: 14px 28px; border-radius: 12px; font-weight: 600;
          cursor: pointer; font-size: 1rem; width: 100%;
        ">
          ← Retour aux thèmes
        </button>
      </section>
    `;

    // Ajouter les XP via gamification si disponible
    if (window.DagoSpeak?.gamification) {
      window.DagoSpeak.gamification.addXP?.(50, 'Conversation semi-libre terminée');
    }

    if (this.#onComplete) this.#onComplete();
  }

  #speakFrench(text, rate = 0.9) {
    if (!('speechSynthesis' in window)) {
      console.warn('[ConversationEngine] SpeechSynthesis non supporté');
      return;
    }

    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = rate;
    speechSynthesis.speak(utterance);
  }
}