/**
 * OnboardingScreen - Introduction moderne inspirée des meilleures apps
 * 5 slides animés avec progression visuelle
 */
export class OnboardingScreen {
  #container = null;
  #currentSlide = 0;
  #onComplete = null;

  #slides = [
    {
      emoji: '🇲🇬',
      title: 'Manahoana !',
      subtitle: 'Bienvenue sur DagoSpeak',
      description: 'Votre professeur de français personnel, propulsé par l\'IA. Conçu spécialement pour vous, à Madagascar.',
      color: '#2563eb'
    },
    {
      emoji: '📱',
      title: 'Fonctionne partout',
      subtitle: 'Même sans internet',
      description: 'Apprenez dans le bus, à la campagne, ou en ville. DagoSpeak fonctionne 100% hors-ligne sur tous les téléphones.',
      color: '#10b981'
    },
    {
      emoji: '🎯',
      title: '10 thèmes progressifs',
      subtitle: 'Du débutant à l\'expert',
      description: 'Mots de survie, famille, marché, couleurs... Chaque thème vous rapproche de la maîtrise du français.',
      color: '#f59e0b'
    },
    {
      emoji: '🎤',
      title: 'Parlez comme un natif',
      subtitle: 'Correction vocale par IA',
      description: 'Notre tuteur intelligent écoute votre prononciation et vous corrige en temps réel. Comme un vrai prof !',
      color: '#8b5cf6'
    },
    {
      emoji: '🚀',
      title: 'Prêt à commencer ?',
      subtitle: 'Votre aventure commence maintenant',
      description: 'Choisissez votre niveau et faites votre première leçon en moins de 2 minutes. Miaraka isika !',
      color: '#ef4444'
    }
  ];

  constructor() {
    // Constructeur vide
  }

  show(onCompleteCallback) {
    this.#onComplete = onCompleteCallback;
    this.#currentSlide = 0;
    this.#render();
  }

  #render() {
    if (this.#container) this.#container.remove();

    this.#container = document.createElement('div');
    this.#container.id = 'onboarding-screen';
    this.#container.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      z-index: 99999; display: flex; flex-direction: column;
      align-items: center; justify-content: space-between;
      padding: 2rem 1.5rem; text-align: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      overflow: hidden;
    `;

    document.body.appendChild(this.#container);
    this.#updateSlide();
  }

  #updateSlide() {
    const slide = this.#slides[this.#currentSlide];
    const isLast = this.#currentSlide === this.#slides.length - 1;
    const progress = ((this.#currentSlide + 1) / this.#slides.length) * 100;

    this.#container.innerHTML = `
      <style>
        @keyframes floatIn {
          from { opacity: 0; transform: translateY(30px) scale(0.9); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .ob-emoji {
          font-size: 6rem; margin: 2rem 0 1rem;
          animation: floatIn 0.6s ease-out, pulse 3s ease-in-out infinite 0.6s;
          filter: drop-shadow(0 10px 20px rgba(0,0,0,0.3));
        }
        .ob-title {
          font-size: 2.2rem; font-weight: 800; color: white;
          margin: 0 0 0.5rem; animation: slideUp 0.6s ease-out 0.1s backwards;
        }
        .ob-subtitle {
          font-size: 1.1rem; color: ${slide.color}; font-weight: 600;
          margin: 0 0 1.5rem; animation: slideUp 0.6s ease-out 0.2s backwards;
        }
        .ob-desc {
          font-size: 1rem; color: rgba(255,255,255,0.8); line-height: 1.6;
          max-width: 400px; margin: 0 auto 2rem;
          animation: slideUp 0.6s ease-out 0.3s backwards;
        }
        .ob-btn {
          background: ${slide.color}; color: white; border: none;
          padding: 16px 48px; border-radius: 50px; font-weight: 700;
          font-size: 1.05rem; cursor: pointer; min-width: 220px;
          box-shadow: 0 8px 20px ${slide.color}66;
          transition: all 0.2s; animation: slideUp 0.6s ease-out 0.4s backwards;
        }
        .ob-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 24px ${slide.color}88; }
        .ob-btn:active { transform: translateY(0); }
        .ob-skip {
          background: transparent; color: rgba(255,255,255,0.5); border: none;
          padding: 8px 16px; font-size: 0.85rem; cursor: pointer;
          margin-top: 0.5rem;
        }
        .ob-skip:hover { color: rgba(255,255,255,0.8); }
        .ob-dots {
          display: flex; gap: 8px; margin-top: 1.5rem;
        }
        .ob-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: rgba(255,255,255,0.2); transition: all 0.3s;
        }
        .ob-dot.active {
          background: ${slide.color}; width: 24px; border-radius: 4px;
        }
        .ob-progress {
          position: absolute; top: 0; left: 0; height: 3px;
          background: ${slide.color}; transition: width 0.5s ease;
        }
      </style>

      <div class="ob-progress" style="width: ${progress}%;"></div>

      <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; width: 100%;">
        <div class="ob-emoji">${slide.emoji}</div>
        <h1 class="ob-title">${slide.title}</h1>
        <p class="ob-subtitle">${slide.subtitle}</p>
        <p class="ob-desc">${slide.description}</p>
      </div>

      <div style="width: 100%; max-width: 400px;">
        <button class="ob-btn" id="ob-next-btn">
          ${isLast ? '🚀 Commencer l\'aventure' : 'Suivant →'}
        </button>
        ${!isLast ? '<button class="ob-skip" id="ob-skip-btn">Passer</button>' : ''}
        <div class="ob-dots">
          ${this.#slides.map((_, i) => `<div class="ob-dot ${i === this.#currentSlide ? 'active' : ''}"></div>`).join('')}
        </div>
      </div>
    `;

    // Événements
    document.getElementById('ob-next-btn').addEventListener('click', () => this.#nextSlide());
    const skipBtn = document.getElementById('ob-skip-btn');
    if (skipBtn) skipBtn.addEventListener('click', () => this.#finish());
  }

  #nextSlide() {
    if (this.#currentSlide < this.#slides.length - 1) {
      this.#currentSlide++;
      this.#updateSlide();
    } else {
      this.#finish();
    }
  }

  #finish() {
    if (this.#container) {
      this.#container.style.transition = 'opacity 0.4s, transform 0.4s';
      this.#container.style.opacity = '0';
      this.#container.style.transform = 'scale(1.05)';

      setTimeout(() => {
        if (this.#container) this.#container.remove();
        if (this.#onComplete) this.#onComplete();
      }, 400);
    }
  }
}