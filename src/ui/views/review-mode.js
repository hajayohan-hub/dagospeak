import { sttManager } from '../../core/stt-manager.js';
import { expressionMemory } from '../../core/expression-memory.js';

/**
 * ReviewMode - Mode de révision intelligente pour les expressions faibles
 */
export class ReviewMode {
  constructor() {
    this.modal = null;
    this.currentExpression = null;
    this.currentTheme = null;
    this.attempts = 0;
    this.maxAttempts = 3;
  }

  async start(expression, theme) {
    this.currentExpression = expression;
    this.currentTheme = theme;
    this.attempts = 0;
    
    this.#createModal();
    this.#showExpressionView();
  }

  #createModal() {
    const existingModal = document.getElementById('review-modal');
    if (existingModal) {
      existingModal.remove();
    }

    this.modal = document.createElement('div');
    this.modal.id = 'review-modal';
    this.modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      animation: fadeIn 0.3s ease;
    `;

    document.body.appendChild(this.modal);
  }

  #showExpressionView() {
    const allExpressions = expressionMemory.getAllExpressions();
    const exprData = allExpressions.find(e => e.expression === this.currentExpression);
    const mastery = exprData?.mastery || 0;
    const masteryPercent = Math.round(mastery * 100);

    this.modal.innerHTML = `
      <div style="
        background: white;
        border-radius: 16px;
        padding: 2rem;
        max-width: 500px;
        width: 90%;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: slideUp 0.3s ease;
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <h2 style="margin: 0; color: var(--ds-color-primary);">🔄 Révision</h2>
          <button id="btn-close-review" style="
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            color: var(--ds-color-text-muted);
          ">✕</button>
        </div>

        <div style="text-align: center; margin-bottom: 2rem;">
          <div style="font-size: 0.9rem; color: var(--ds-color-text-muted); margin-bottom: 0.5rem;">
            Thème: ${this.currentTheme}
          </div>
          <div style="font-size: 1.8rem; font-weight: bold; color: var(--ds-color-text); margin-bottom: 1rem; line-height: 1.4;">
            "${this.currentExpression}"
          </div>
          <div style="display: inline-block; padding: 0.5rem 1rem; background: var(--ds-color-warning-soft); border-radius: 20px; font-size: 0.9rem;">
            Maîtrise actuelle: <strong>${masteryPercent}%</strong>
          </div>
        </div>

        <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem;">
          <button id="btn-listen" style="
            flex: 1;
            padding: 1rem;
            background: var(--ds-color-primary);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 1.1rem;
            cursor: pointer;
            transition: all 0.2s;
          ">
            🔊 Écouter
          </button>
          <button id="btn-speak" style="
            flex: 1;
            padding: 1rem;
            background: var(--ds-color-accent);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 1.1rem;
            cursor: pointer;
            transition: all 0.2s;
          ">
            🎤 Prononcer
          </button>
        </div>

        <div id="feedback-area" style="
          min-height: 60px;
          padding: 1rem;
          background: var(--ds-color-surface);
          border-radius: 8px;
          text-align: center;
          margin-bottom: 1rem;
        ">
          <div style="color: var(--ds-color-text-muted);">
            Écoutez puis prononcez l'expression
          </div>
        </div>

        <div style="display: flex; gap: 0.5rem; font-size: 0.85rem; color: var(--ds-color-text-muted); justify-content: center;">
          <span>Tentative ${this.attempts + 1}/${this.maxAttempts}</span>
        </div>
      </div>

      <style>
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      </style>
    `;

    document.getElementById('btn-close-review').addEventListener('click', () => {
      this.close();
    });

    document.getElementById('btn-listen').addEventListener('click', () => {
      this.#playExpression();
    });

    document.getElementById('btn-speak').addEventListener('click', () => {
      this.#startSTT();
    });
  }

  #playExpression() {
    const btn = document.getElementById('btn-listen');
    btn.disabled = true;
    btn.textContent = '🔊 Lecture...';

    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(this.currentExpression);
      utterance.lang = 'fr-FR';
      utterance.rate = 0.9;
      
      utterance.onend = () => {
        btn.disabled = false;
        btn.textContent = '🔊 Écouter';
      };
      
      utterance.onerror = () => {
        btn.disabled = false;
        btn.textContent = '🔊 Écouter';
      };
      
      window.speechSynthesis.speak(utterance);
    }
  }

  async #startSTT() {
    const btn = document.getElementById('btn-speak');
    const feedbackArea = document.getElementById('feedback-area');
    
    btn.disabled = true;
    btn.textContent = '🎙️ Écoute...';
    feedbackArea.innerHTML = '<div style="color: var(--ds-color-accent);">Parlez maintenant...</div>';

    try {
      await sttManager.startListening('fr-FR', {
        onResult: (transcript, confidence) => {
          this.#evaluatePronunciation(transcript, confidence);
        },
        onError: (error) => {
          console.error('STT Error:', error);
          feedbackArea.innerHTML = `
            <div style="color: var(--ds-color-danger);">
              ⚠️ Erreur: ${error}
            </div>
          `;
          btn.disabled = false;
          btn.textContent = '🎤 Prononcer';
        }
      });
    } catch (error) {
      console.error('STT Error:', error);
      feedbackArea.innerHTML = `
        <div style="color: var(--ds-color-danger);">
          ⚠️ Impossible de démarrer la reconnaissance vocale
        </div>
      `;
      btn.disabled = false;
      btn.textContent = '🎤 Prononcer';
    }
  }

  #evaluatePronunciation(transcript, confidence) {
    this.attempts++;
    const feedbackArea = document.getElementById('feedback-area');
    const btn = document.getElementById('btn-speak');

    const similarity = this.#calculateSimilarity(transcript, this.currentExpression);
    const similarityPercent = Math.round(similarity * 100);

    const newMastery = this.#calculateNewMastery(similarity);
    expressionMemory.updateMastery(this.currentExpression, newMastery);

    let feedbackColor, feedbackText;
    if (similarity >= 0.8) {
      feedbackColor = 'var(--ds-color-success)';
      feedbackText = '✅ Excellent !';
    } else if (similarity >= 0.6) {
      feedbackColor = 'var(--ds-color-warning)';
      feedbackText = '👍 Bien !';
    } else {
      feedbackColor = 'var(--ds-color-danger)';
      feedbackText = '🔄 À réessayer';
    }

    feedbackArea.innerHTML = `
      <div style="color: ${feedbackColor}; font-weight: bold; margin-bottom: 0.5rem;">
        ${feedbackText}
      </div>
      <div style="font-size: 0.9rem; color: var(--ds-color-text-muted); margin-bottom: 0.5rem;">
        Vous avez dit: "${transcript}"
      </div>
      <div style="font-size: 0.9rem;">
        Similarité: <strong>${similarityPercent}%</strong> | Nouvelle maîtrise: <strong>${Math.round(newMastery * 100)}%</strong>
      </div>
    `;

    if (this.attempts < this.maxAttempts && similarity < 0.8) {
      feedbackArea.innerHTML += `
        <div style="margin-top: 1rem; display: flex; gap: 0.5rem; justify-content: center;">
          <button id="btn-retry" style="
            padding: 0.5rem 1rem;
            background: var(--ds-color-accent);
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
          ">
            🔄 Réessayer
          </button>
          <button id="btn-finish" style="
            padding: 0.5rem 1rem;
            background: var(--ds-color-primary);
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
          ">
            ✓ Terminer
          </button>
        </div>
      `;

      document.getElementById('btn-retry').addEventListener('click', () => {
        btn.disabled = false;
        btn.textContent = '🎤 Prononcer';
        feedbackArea.innerHTML = '<div style="color: var(--ds-color-text-muted);">Écoutez puis prononcez l\'expression</div>';
      });

      document.getElementById('btn-finish').addEventListener('click', () => {
        this.close();
        this.#showSuccessMessage();
      });
    } else {
      setTimeout(() => {
        this.close();
        this.#showSuccessMessage();
      }, 2000);
    }
  }

  #calculateSimilarity(text1, text2) {
    const t1 = text1.toLowerCase().trim();
    const t2 = text2.toLowerCase().trim();

    if (t1 === t2) return 1.0;

    const distance = this.#levenshteinDistance(t1, t2);
    const maxLength = Math.max(t1.length, t2.length);
    
    if (maxLength === 0) return 1.0;
    
    return 1 - (distance / maxLength);
  }

  #levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(
            dp[i - 1][j],
            dp[i][j - 1],
            dp[i - 1][j - 1]
          );
        }
      }
    }

    return dp[m][n];
  }

  #calculateNewMastery(similarity) {
    const allExpressions = expressionMemory.getAllExpressions();
    const currentMastery = allExpressions.find(e => e.expression === this.currentExpression)?.mastery || 0;
    
    const newMastery = (currentMastery * 0.7) + (similarity * 0.3);
    
    return Math.min(1, Math.max(0, newMastery));
  }

  #showSuccessMessage() {
    const allExpressions = expressionMemory.getAllExpressions();
    const mastery = allExpressions.find(e => e.expression === this.currentExpression)?.mastery || 0;
    const masteryPercent = Math.round(mastery * 100);

    this.modal.innerHTML = `
      <div style="
        background: white;
        border-radius: 16px;
        padding: 2rem;
        max-width: 400px;
        width: 90%;
        text-align: center;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: slideUp 0.3s ease;
      ">
        <div style="font-size: 4rem; margin-bottom: 1rem;">🎉</div>
        <h2 style="color: var(--ds-color-success); margin-bottom: 1rem;">
          Révision terminée !
        </h2>
        <p style="color: var(--ds-color-text); margin-bottom: 1rem;">
          Nouvelle maîtrise de l'expression:
        </p>
        <div style="font-size: 2rem; font-weight: bold; color: var(--ds-color-primary); margin-bottom: 1.5rem;">
          ${masteryPercent}%
        </div>
        <button id="btn-close-success" style="
          padding: 0.75rem 2rem;
          background: var(--ds-color-success);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          cursor: pointer;
        ">
          ✓ OK
        </button>
      </div>
    `;

    document.getElementById('btn-close-success').addEventListener('click', () => {
      this.close();
    });
  }

  close() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
    
    if (window.expressionsView) {
      window.expressionsView.render(document.getElementById('app'));
    }
  }
}

export const reviewMode = new ReviewMode();
