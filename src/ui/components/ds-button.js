/**
 * <ds-button> — Bouton réutilisable de DagoSpeak.
 *
 * Attributs :
 *   - variant : "primary" (défaut) | "ghost" | "danger" | "success"
 *   - size    : "sm" | "md" (défaut) | "lg"
 *   - disabled
 *   - loading : affiche un spinner
 *
 * Exemples :
 *   <ds-button>Valider</ds-button>
 *   <ds-button variant="ghost" size="sm">Annuler</ds-button>
 *   <ds-button variant="danger" loading>Suppression…</ds-button>
 */

const template = document.createElement('template');
template.innerHTML = `
<style>
  :host {
    display: inline-block;
    vertical-align: middle;
  }

  button {
    /* Héritage typographique */
    font: inherit;
    font-weight: var(--ds-font-weight-semibold, 600);
    font-size: var(--ds-font-size-base, 1rem);
    line-height: 1;

    /* Dimensions et espacements */
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 44px; /* WCAG : cible tactile minimale */
    padding: 12px 20px;
    border: 2px solid transparent;
    border-radius: var(--ds-radius-md, 12px);
    cursor: pointer;

    /* Couleurs par défaut (primary) */
    background: var(--ds-color-primary, #0A8A6E);
    color: var(--ds-color-text-inverse, #fff);

    /* Transitions */
    transition:
      background var(--ds-duration-normal, 200ms) var(--ds-ease, ease),
      transform  var(--ds-duration-fast,   100ms) var(--ds-ease, ease),
      box-shadow var(--ds-duration-normal, 200ms) var(--ds-ease, ease);
  }

  /* ──── États ──── */
  button:hover {
    background: var(--ds-color-primary-hover, #087A61);
    transform: translateY(-1px);
    box-shadow: var(--ds-shadow-sm);
  }
  button:active {
    background: var(--ds-color-primary-active, #066B54);
    transform: translateY(0);
  }
  button:focus-visible {
    outline: 3px solid var(--ds-color-accent, #E8A33D);
    outline-offset: 2px;
  }

  /* ──── Variantes ──── */
  :host([variant="ghost"]) button {
    background: transparent;
    color: var(--ds-color-primary, #0A8A6E);
    border-color: var(--ds-color-border, #E5E5E0);
  }
  :host([variant="ghost"]) button:hover {
    background: var(--ds-color-primary-soft, #E6F5F1);
    border-color: var(--ds-color-primary, #0A8A6E);
  }

  :host([variant="danger"]) button {
    background: var(--ds-color-danger, #D64545);
  }
  :host([variant="danger"]) button:hover {
    background: #B83636;
  }

  :host([variant="success"]) button {
    background: var(--ds-color-success, #2F9E44);
  }
  :host([variant="success"]) button:hover {
    background: #267F37;
  }

  /* ──── Tailles ──── */
  :host([size="sm"]) button {
    min-height: 36px;
    padding: 8px 14px;
    font-size: var(--ds-font-size-sm, 0.875rem);
  }
  :host([size="lg"]) button {
    min-height: 52px;
    padding: 16px 28px;
    font-size: var(--ds-font-size-md, 1.125rem);
  }

  /* ──── États spéciaux ──── */
  :host([disabled]) button {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }

  :host([loading]) button {
    cursor: wait;
    color: transparent; /* cache le texte pendant le chargement */
  }

  .spinner {
    display: none;
    width: 18px; height: 18px;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    color: var(--ds-color-text-inverse, #fff);
  }
  :host([loading]) .spinner {
    display: inline-block;
    position: absolute;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Slot pour icône à gauche */
  ::slotted([slot="icon"]) {
    width: 18px; height: 18px;
  }
</style>

<button part="button" type="button">
  <span class="spinner" aria-hidden="true"></span>
  <slot name="icon"></slot>
  <slot></slot>
</button>
`;

export class DsButton extends HTMLElement {
  static get observedAttributes() {
    return ['variant', 'size', 'disabled', 'loading'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' })
        .appendChild(template.content.cloneNode(true));

    this._button = this.shadowRoot.querySelector('button');
  }

  connectedCallback() {
    // Valeurs par défaut si aucun attribut
    if (!this.hasAttribute('variant')) this.setAttribute('variant', 'primary');
    if (!this.hasAttribute('size'))    this.setAttribute('size', 'md');
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    if (name === 'disabled') {
      this._button.disabled = newValue !== null;
      this.setAttribute('aria-disabled', newValue !== null);
    }
    if (name === 'loading') {
      this.setAttribute('aria-busy', newValue !== null);
    }
  }

  // API programmatique
  focus() { this._button.focus(); }
  click() { this._button.click(); }
}

// Enregistrement global du composant
if (!customElements.get('ds-button')) {
  customElements.define('ds-button', DsButton);
}