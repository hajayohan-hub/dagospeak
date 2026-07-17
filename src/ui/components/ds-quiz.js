/**
 * Composant Web <ds-quiz>
 * Affiche les options de réponse et gère la sélection.
 */
export class DsQuiz extends HTMLElement {
  constructor() {
    super();
    this.#answered = false;
  }

  #answered = false;
  #correctAnswer = '';
  #options = [];

  static get observedAttributes() {
    return ['options', 'correct', 'item-id'];
  }

  connectedCallback() {
    this.#options = JSON.parse(this.getAttribute('options') || '[]');
    this.#correctAnswer = this.getAttribute('correct') || '';
    this.render();
    this.attachEvents();
  }

  render() {
    // ✅ ICI : Aucun mot "Question". Uniquement les options et le feedback.
    this.innerHTML = `
      <div class="quiz-options" style="display: flex; flex-direction: column; gap: 0.75rem;">
        ${this.#options.map(opt => `
          <button class="quiz-btn" data-value="${opt}" style="
            width: 100%;
            padding: 1rem;
            text-align: left;
            background: var(--ds-color-surface);
            border: 2px solid var(--ds-color-border);
            border-radius: var(--ds-radius-md);
            font-size: 1rem;
            font-weight: 500;
            color: var(--ds-color-text);
            cursor: pointer;
            transition: all 0.2s ease;
          ">
            ${opt}
          </button>
        `).join('')}
      </div>
      <div class="feedback" style="
        margin-top: 1rem;
        padding: 0.75rem;
        border-radius: var(--ds-radius-md);
        font-weight: 600;
        text-align: center;
        display: none;
      "></div>
    `;
  }

  attachEvents() {
    const buttons = this.querySelectorAll('.quiz-btn');
    this._feedback = this.querySelector('.feedback');
    this._optionsContainer = this.querySelector('.quiz-options');

    buttons.forEach(btn => {
      btn.addEventListener('click', () => this.#handleAnswer(btn.dataset.value, btn));
    });
  }

  #handleAnswer(selectedValue, btnElement) {
    if (this.#answered) return;
    this.#answered = true;

    const isCorrect = selectedValue === this.#correctAnswer;
    const itemId = this.getAttribute('item-id') || 'unknown';

    if (isCorrect) {
      btnElement.style.background = 'var(--ds-color-success-soft, #d1fae5)';
      btnElement.style.borderColor = 'var(--ds-color-success, #10b981)';
      btnElement.style.color = 'var(--ds-color-success, #047857)';
      this._feedback.textContent = 'Tsara ! (Correct)';
      this._feedback.style.background = 'var(--ds-color-success-soft, #d1fae5)';
      this._feedback.style.color = 'var(--ds-color-success, #047857)';
    } else {
      btnElement.style.background = 'var(--ds-color-danger-soft, #fee2e2)';
      btnElement.style.borderColor = 'var(--ds-color-danger, #ef4444)';
      btnElement.style.color = 'var(--ds-color-danger, #b91c1c)';
      this._feedback.textContent = `Diso (Faux). La bonne réponse était : ${this.#correctAnswer}`;
      this._feedback.style.background = 'var(--ds-color-danger-soft, #fee2e2)';
      this._feedback.style.color = 'var(--ds-color-danger, #b91c1c)';

      // Montrer la bonne réponse
      Array.from(this._optionsContainer.children).forEach(child => {
        if (child.dataset.value === this.#correctAnswer) {
          child.style.background = 'var(--ds-color-success-soft, #d1fae5)';
          child.style.borderColor = 'var(--ds-color-success, #10b981)';
        }
      });
    }

    this._feedback.style.display = 'block';

    this.dispatchEvent(new CustomEvent('quiz:answered', {
      bubbles: true,
      composed: true,
      detail: { itemId, selected: selectedValue, isCorrect }
    }));
  }
}

customElements.define('ds-quiz', DsQuiz);