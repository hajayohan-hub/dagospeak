/**
 * <ds-quiz> — Composant de quiz interactif.
 * 
 * Attributs :
 *   - question : La question à poser
 *   - options : Chaîne JSON des options (ex: '["A", "B", "C"]')
 *   - correct : L'index ou la valeur de la bonne réponse
 * 
 * Événements émis :
 *   - quiz:answered (détail: { selected, isCorrect, itemId })
 */
const template = document.createElement('template');
template.innerHTML = `
<style>
  :host { display: block; }
  .quiz-container {
    background: var(--ds-color-surface);
    border-radius: var(--ds-radius-lg);
    padding: var(--ds-space-5);
    box-shadow: var(--ds-shadow-md);
    text-align: center;
  }
  .question {
    font-size: var(--ds-font-size-xl);
    font-weight: var(--ds-font-weight-semibold);
    margin-bottom: var(--ds-space-5);
    color: var(--ds-color-text);
  }
  .options {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--ds-space-3);
  }
  @media (min-width: 640px) {
    .options { grid-template-columns: 1fr 1fr; }
  }
  .option-btn {
    width: 100%;
    text-align: left;
    justify-content: flex-start;
  }
  .option-btn.correct {
    background: var(--ds-color-success) !important;
    color: white !important;
  }
  .option-btn.incorrect {
    background: var(--ds-color-danger) !important;
    color: white !important;
  }
  .feedback {
    margin-top: var(--ds-space-4);
    font-weight: var(--ds-font-weight-semibold);
    min-height: 1.5em;
  }
  .feedback.success { color: var(--ds-color-success); }
  .feedback.error { color: var(--ds-color-danger); }
</style>

<div class="quiz-container" role="group" aria-labelledby="quiz-question">
  <h3 id="quiz-question" class="question"><slot name="question">Question</slot></h3>
  <div class="options" id="options-container"></div>
  <div class="feedback" id="feedback" aria-live="polite"></div>
</div>
`;

export class DsQuiz extends HTMLElement {
  #options = [];
  #correctAnswer = '';
  #answered = false;

  static get observedAttributes() {
    return ['options', 'correct', 'item-id'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).appendChild(template.content.cloneNode(true));
    this._optionsContainer = this.shadowRoot.getElementById('options-container');
    this._feedback = this.shadowRoot.getElementById('feedback');
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    if (name === 'options') {
      try {
        this.#options = JSON.parse(newValue);
      } catch (e) {
        this.#options = [];
      }
    }
    if (name === 'correct') {
      this.#correctAnswer = newValue;
    }
    if (this.#options.length > 0 && !this.#answered) {
      this.#renderOptions();
    }
  }

  #renderOptions() {
    this._optionsContainer.innerHTML = '';
    this.#options.forEach((opt, index) => {
      const btn = document.createElement('ds-button');
      btn.setAttribute('variant', 'ghost');
      btn.setAttribute('size', 'lg');
      btn.classList.add('option-btn');
      btn.textContent = opt;
      btn.dataset.value = opt;
      
      btn.addEventListener('click', () => this.#handleAnswer(opt, btn));
      this._optionsContainer.appendChild(btn);
    });
  }

    #handleAnswer(selectedValue, btnElement) {
    if (this.#answered) return;
    this.#answered = true;

    const isCorrect = selectedValue === this.#correctAnswer;
    const itemId = this.getAttribute('item-id') || 'unknown';

    // ✅ CORRECTION DES FEEDBACKS (Tsara / Diso)
    if (isCorrect) {
      btnElement.classList.add('correct');
      this._feedback.textContent = 'Tsara ! (Correct)'; // ✅ Corrigé
      this._feedback.className = 'feedback success';
    } else {
      btnElement.classList.add('incorrect');
      this._feedback.textContent = `Diso (Faux). La bonne réponse était : ${this.#correctAnswer}`; // ✅ Corrigé
      this._feedback.className = 'feedback error';

      // Montrer la bonne réponse en vert pour l'apprentissage
      Array.from(this._optionsContainer.children).forEach(child => {
        if (child.dataset.value === this.#correctAnswer) {
          child.classList.add('correct');
        }
      });
    }

    // Émettre l'événement pour les moteurs SRS et Gamification
    this.dispatchEvent(new CustomEvent('quiz:answered', {
      bubbles: true,
      composed: true,
      detail: { itemId, selected: selectedValue, isCorrect }
    }));
  }
}

if (!customElements.get('ds-quiz')) {
  customElements.define('ds-quiz', DsQuiz);
}