import { reviewMode } from "./review-mode.js";
/**
 * ExpressionsView - UI pour visualiser et réviser les expressions mémorisées
 */

export class ExpressionsView {
  constructor() {
    this.container = null;
  }

  async render(container) {
    this.container = container;
    
    if (!window.expressionMemory) {
      container.innerHTML = `
        <div style="text-align:center; padding:3rem; color:var(--ds-color-text-muted);">
          <p>⚠️ Système de mémoire non disponible</p>
        </div>
      `;
      return;
    }

    const stats = window.expressionMemory.getStats();
    const allExpressions = window.expressionMemory.getAllExpressions();
    
    // Trier par maîtrise
    const mastered = allExpressions.filter(e => e.mastery >= 0.7);
    const learning = allExpressions.filter(e => e.mastery >= 0.4 && e.mastery < 0.7);
    const toReview = allExpressions.filter(e => e.mastery < 0.4 && e.attempts > 0);

    container.innerHTML = `
      <section style="max-width: 900px; margin: 0 auto; padding: 2rem 1rem;">
        <div style="display:flex; align-items:center; gap:1rem; margin-bottom:2rem;">
          <ds-button variant="ghost" size="sm" id="btn-back">← Retour</ds-button>
          <h2 style="margin:0; flex:1;">📊 Mes Expressions</h2>
        </div>

        <!-- Statistiques globales -->
        <div style="background:var(--ds-color-surface); padding:1.5rem; border-radius:var(--ds-radius-lg); margin-bottom:2rem; box-shadow:var(--ds-shadow-sm);">
          <h3 style="margin-top:0; margin-bottom:1rem;">Vue d'ensemble</h3>
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap:1rem;">
            <div style="text-align:center; padding:1rem; background:var(--ds-color-surface-2); border-radius:var(--ds-radius-md);">
              <div style="font-size:2rem; font-weight:bold; color:var(--ds-color-primary);">${stats.total}</div>
              <div style="font-size:0.9rem; color:var(--ds-color-text-muted);">Total</div>
            </div>
            <div style="text-align:center; padding:1rem; background:var(--ds-color-surface-2); border-radius:var(--ds-radius-md);">
              <div style="font-size:2rem; font-weight:bold; color:var(--ds-color-success);">${stats.mastered}</div>
              <div style="font-size:0.9rem; color:var(--ds-color-text-muted);">Maîtrisées</div>
            </div>
            <div style="text-align:center; padding:1rem; background:var(--ds-color-surface-2); border-radius:var(--ds-radius-md);">
              <div style="font-size:2rem; font-weight:bold; color:var(--ds-color-warning);">${stats.learning}</div>
              <div style="font-size:0.9rem; color:var(--ds-color-text-muted);">En apprentissage</div>
            </div>
            <div style="text-align:center; padding:1rem; background:var(--ds-color-surface-2); border-radius:var(--ds-radius-md);">
              <div style="font-size:2rem; font-weight:bold; color:var(--ds-color-danger);">${stats.toReview}</div>
              <div style="font-size:0.9rem; color:var(--ds-color-text-muted);">À revoir</div>
            </div>
          </div>
          
          <div style="margin-top:1.5rem;">
            <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
              <span style="font-size:0.9rem; font-weight:600;">Progression globale</span>
              <span style="font-size:0.9rem; color:var(--ds-color-text-muted);">${Math.round(stats.averageMastery * 100)}%</span>
            </div>
            <div style="width:100%; height:12px; background:var(--ds-color-surface-2); border-radius:6px; overflow:hidden;">
              <div style="width:${Math.round(stats.averageMastery * 100)}%; height:100%; background:linear-gradient(90deg, var(--ds-color-primary), var(--ds-color-success)); transition:width 0.5s;"></div>
            </div>
          </div>
        </div>

        ${toReview.length > 0 ? `
        <!-- Expressions à revoir -->
        <div style="background:var(--ds-color-danger-soft); padding:1.5rem; border-radius:var(--ds-radius-lg); margin-bottom:2rem; border:2px solid var(--ds-color-danger);">
          <h3 style="margin-top:0; color:var(--ds-color-danger);">⚠️ À revoir (${toReview.length})</h3>
          ${this.#renderExpressionList(toReview, 'danger')}
        </div>
        ` : ''}

        ${learning.length > 0 ? `
        <!-- Expressions en apprentissage -->
        <div style="background:var(--ds-color-warning-soft); padding:1.5rem; border-radius:var(--ds-radius-lg); margin-bottom:2rem; border:2px solid var(--ds-color-warning);">
          <h3 style="margin-top:0; color:var(--ds-color-warning);">📚 En apprentissage (${learning.length})</h3>
          ${this.#renderExpressionList(learning, 'warning')}
        </div>
        ` : ''}

        ${mastered.length > 0 ? `
        <!-- Expressions maîtrisées -->
        <div style="background:var(--ds-color-success-soft); padding:1.5rem; border-radius:var(--ds-radius-lg); margin-bottom:2rem; border:2px solid var(--ds-color-success);">
          <h3 style="margin-top:0; color:var(--ds-color-success);">✅ Maîtrisées (${mastered.length})</h3>
          ${this.#renderExpressionList(mastered, 'success')}
        </div>
        ` : ''}

        ${allExpressions.length === 0 ? `
        <div style="text-align:center; padding:3rem; background:var(--ds-color-surface); border-radius:var(--ds-radius-lg);">
          <div style="font-size:3rem; margin-bottom:1rem;">📝</div>
          <h3 style="color:var(--ds-color-text);">Aucune expression enregistrée</h3>
          <p style="color:var(--ds-color-text-muted);">
            Commencez à pratiquer dans les thèmes pour que vos expressions soient mémorisées automatiquement.
          </p>
          <ds-button variant="primary" id="btn-start-practice" style="margin-top:1rem;">
            Commencer à pratiquer
          </ds-button>
        </div>
        ` : ''}
      </section>
    `;

    // Event listeners
    document.getElementById('btn-back')?.addEventListener('click', () => {
      window.router.navigate('/');
    });

    document.getElementById('btn-start-practice')?.addEventListener('click', () => {
      window.router.navigate('/themes');
    });

    // Boutons de révision
    container.querySelectorAll('.btn-review').forEach(btn => {
      btn.addEventListener('click', () => {
        const expression = btn.dataset.expression;
        this.#startReview(expression);
      });
    });
  }

  #renderExpressionList(expressions, variant) {
    // Trier par maîtrise décroissante
    const sorted = [...expressions].sort((a, b) => b.mastery - a.mastery);
    
    return sorted.map(expr => {
      const masteryPercent = Math.round(expr.mastery * 100);
      const lastUsedDate = new Date(expr.lastUsed).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
      
      const colorClass = variant === 'success' ? 'var(--ds-color-success)' :
                         variant === 'warning' ? 'var(--ds-color-warning)' :
                         'var(--ds-color-danger)';
      
      return `
        <div style="background:var(--ds-color-surface); padding:1rem; border-radius:var(--ds-radius-md); margin-bottom:0.75rem; box-shadow:var(--ds-shadow-sm);">
          <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:0.5rem;">
            <div style="flex:1;">
              <div style="font-size:1.1rem; font-weight:600; color:var(--ds-color-text); margin-bottom:0.25rem;">
                ${expr.expression}
              </div>
              <div style="font-size:0.85rem; color:var(--ds-color-text-muted);">
                ${expr.themes.join(', ')} • Utilisé ${expr.usageCount} fois
              </div>
            </div>
            ${variant !== 'success' ? `
              <ds-button variant="primary" size="sm" class="btn-review" data-expression="${expr.expression}">
                🔄 Réviser
              </ds-button>
            ` : ''}
          </div>
          
          <div style="margin-top:0.75rem;">
            <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem;">
              <span style="font-size:0.8rem; font-weight:600;">Maîtrise</span>
              <span style="font-size:0.8rem; color:${colorClass}; font-weight:bold;">${masteryPercent}%</span>
            </div>
            <div style="width:100%; height:8px; background:var(--ds-color-surface-2); border-radius:4px; overflow:hidden;">
              <div style="width:${masteryPercent}%; height:100%; background:${colorClass}; transition:width 0.3s;"></div>
            </div>
          </div>
          
          <div style="font-size:0.75rem; color:var(--ds-color-text-muted); margin-top:0.5rem;">
            Dernière utilisation : ${lastUsedDate}
          </div>
        </div>
      `;
    }).join('');
  }

  #startReview(expression) {
    const expr = window.expressionMemory.getAllExpressions().find(e => e.expression === expression);
    if (expr && expr.themes.length > 0) {
      reviewMode.start(expression, expr.themes[0]);
    }
  }
}

export const expressionsView = new ExpressionsView();
