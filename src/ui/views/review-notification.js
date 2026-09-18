/**
 * ReviewNotification - UI de notification de révision
 * Affiche une notification non-intrusive au démarrage de l'app
 */

export class ReviewNotification {
  constructor() {
    this.container = null;
  }

  /**
   * Affiche la notification de révision
   * @param {Array} expressions - Liste des expressions à revoir
   * @param {string} message - Message personnalisé
   * @param {Function} onAccept - Callback si l'utilisateur accepte
   * @param {Function} onDismiss - Callback si l'utilisateur refuse
   */
  show(expressions, message, onAccept, onDismiss) {
    // Créer le conteneur de notification
    this.container = document.createElement('div');
    this.container.id = 'review-notification';
    this.container.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      max-width: 400px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 1.5rem;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
      z-index: 9998;
      animation: slideInRight 0.5s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;

    // Contenu de la notification
    const expressionsList = expressions.slice(0, 3).map(expr => 
      `<div style="padding: 0.5rem; background: rgba(255,255,255,0.1); border-radius: 8px; margin: 0.25rem 0;">
        <div style="font-weight: 600;">${expr.expression}</div>
        <div style="font-size: 0.85rem; opacity: 0.9;">
          ${expr.themes.join(', ')} • Maîtrise: ${Math.round(expr.mastery * 100)}%
        </div>
      </div>`
    ).join('');

    const moreCount = expressions.length - 3;
    const moreText = moreCount > 0 ? `<div style="text-align: center; margin-top: 0.5rem; opacity: 0.8;">... et ${moreCount} autre(s)</div>` : '';

    this.container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
        <div style="font-size: 1.5rem;">🧠</div>
        <button id="btn-close-notification" style="
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 1.2rem;
          line-height: 1;
        ">×</button>
      </div>
      
      <h3 style="margin: 0 0 0.5rem 0; font-size: 1.2rem;">Temps de révision !</h3>
      <p style="margin: 0 0 1rem 0; opacity: 0.95; line-height: 1.5;">${message}</p>
      
      <div style="margin: 1rem 0;">
        ${expressionsList}
        ${moreText}
      </div>
      
      <div style="display: flex; gap: 0.75rem; margin-top: 1.5rem;">
        <button id="btn-accept-review" style="
          flex: 1;
          padding: 0.75rem;
          background: white;
          color: #667eea;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          font-size: 1rem;
        ">
          🚀 Réviser maintenant
        </button>
        <button id="btn-dismiss-review" style="
          flex: 1;
          padding: 0.75rem;
          background: rgba(255,255,255,0.2);
          color: white;
          border: 1px solid rgba(255,255,255,0.3);
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          font-size: 1rem;
        ">
          Plus tard
        </button>
      </div>
      
      <style>
        @keyframes slideInRight {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      </style>
    `;

    document.body.appendChild(this.container);

    // Event listeners
    document.getElementById('btn-close-notification').addEventListener('click', () => {
      this.hide();
      if (onDismiss) onDismiss();
    });

    document.getElementById('btn-accept-review').addEventListener('click', () => {
      this.hide();
      if (onAccept) onAccept(expressions);
    });

    document.getElementById('btn-dismiss-review').addEventListener('click', () => {
      this.hide();
      if (onDismiss) onDismiss();
    });

    // Auto-dismiss après 30 secondes
    setTimeout(() => {
      if (this.container && document.body.contains(this.container)) {
        this.hide();
        if (onDismiss) onDismiss();
      }
    }, 30000);
  }

  /**
   * Cache la notification
   */
  hide() {
    if (this.container && document.body.contains(this.container)) {
      this.container.style.animation = 'slideInRight 0.3s ease reverse';
      setTimeout(() => {
        if (this.container && document.body.contains(this.container)) {
          document.body.removeChild(this.container);
        }
        this.container = null;
      }, 300);
    }
  }
}

export const reviewNotification = new ReviewNotification();
