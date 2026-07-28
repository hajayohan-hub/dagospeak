/**
 * OnboardingScreen - Page d'intro avec 4 slides + navigation retour + offres par niveau
 * S'exécute toujours à l'ouverture si l'app a été fermée
 */
export class OnboardingScreen {
  #container = null;
  #currentSlide = 0;
  #onComplete = null;
  #onSkip = null;

  #slides = [
    {
      icon: '🇲🇬',
      title: 'Manahoana ! Bienvenue sur DagoSpeak',
      text: 'La première plateforme d\'apprentissage des langues 100% hors-ligne pour les locuteurs Malgaches. Propulsé par CPA Madagascar et les équipes de Web Services Mada.',
      action: 'Suivant'
    },
    {
      icon: '🎧',
      title: 'Écoutez, Parlez, Progressez',
      text: 'Une méthode immersive avec des dialogues réels, un tuteur vocal intelligent, un dictionnaire intelligent et des conversations semi-libres. Certifications reconnues par World Of Training et Yelandar.',
      action: 'Suivant'
    },
    {
      icon: '📶',
      title: 'Mode 100% Hors-ligne',
      text: 'DagoSpeak s\'adapte à votre appareil. Si votre téléphone est modeste, nous utilisons la synthèse vocale du navigateur. Si vous avez assez d\'espace, nous téléchargeons les moteurs vocaux avancés pour une expérience optimale.',
      action: 'Suivant'
    },
    {
      icon: '🎓',
      title: 'Choisissez votre parcours',
      text: 'Notre plateforme évolue avec vous. Commencez gratuitement et passez au Premium quand vous êtes prêt.',
      action: null, // Pas de bouton suivant, on affiche les offres
      isOfferSlide: true
    }
  ];

  constructor() {
    // Le constructeur ne fait rien - on attend l'appel à show()
  }

  show(onCompleteCallback, onSkipCallback) {
    this.#onComplete = onCompleteCallback;
    this.#onSkip = onSkipCallback || (() => {});
    this.#currentSlide = 0;
    this.#render();
  }

  #render() {
    // Supprimer l'ancien container s'il existe
    if (this.#container) {
      this.#container.remove();
    }

    this.#container = document.createElement('div');
    this.#container.id = 'onboarding-screen';
    this.#container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, #f0f4ff 0%, #e0e7ff 100%);
      z-index: 10000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      text-align: center;
      overflow-y: auto;
    `;

    document.body.appendChild(this.#container);
    this.#updateSlide();
  }

  #updateSlide() {
    const slide = this.#slides[this.#currentSlide];
    const isFirstSlide = this.#currentSlide === 0;
    const isLastSlide = this.#currentSlide === this.#slides.length - 1;

    // Bouton retour (caché sur le premier slide)
    const backButton = isFirstSlide ? '' : `
      <button id="btn-back-slide" style="
        position: absolute;
        top: 20px;
        left: 20px;
        background: var(--ds-color-surface-2);
        border: none;
        border-radius: 50%;
        width: 44px;
        height: 44px;
        font-size: 1.5rem;
        cursor: pointer;
        color: var(--ds-color-text);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      ">←</button>
    `;

    // Bouton passer (toujours visible)
    const skipButton = `
      <button id="btn-skip-onboarding" style="
        position: absolute;
        top: 20px;
        right: 20px;
        background: transparent;
        border: none;
        font-size: 0.9rem;
        cursor: pointer;
        color: var(--ds-color-text-muted);
        padding: 8px 16px;
      ">Passer</button>
    `;

    if (!slide.isOfferSlide) {
      // Slides normaux (0, 1, 2)
      this.#container.innerHTML = `
        ${backButton}
        ${skipButton}
        <div style="font-size: 5rem; margin-bottom: 1rem; animation: fadeInUp 0.6s ease-out;">${slide.icon}</div>
        <h2 style="color: var(--ds-color-primary); margin-bottom: 1rem; font-size: 1.8rem; animation: fadeInUp 0.6s ease-out 0.1s backwards;">${slide.title}</h2>
        <p style="color: var(--ds-color-text-muted); font-size: 1.05rem; margin-bottom: 2rem; line-height: 1.6; max-width: 500px; animation: fadeInUp 0.6s ease-out 0.2s backwards;">${slide.text}</p>
        <button id="btn-next-slide" style="
          background: var(--ds-color-primary);
          color: white;
          border: none;
          padding: 16px 40px;
          border-radius: 50px;
          font-weight: bold;
          font-size: 1.05rem;
          cursor: pointer;
          min-width: 200px;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
          animation: fadeInUp 0.6s ease-out 0.3s backwards;
        ">
          ${slide.action} →
        </button>
        <div style="margin-top: 2rem; display: flex; gap: 0.5rem; animation: fadeInUp 0.6s ease-out 0.4s backwards;">
          ${this.#slides.map((_, i) => `
            <div style="width: ${i === this.#currentSlide ? '24px' : '8px'}; height: 8px; border-radius: 4px; background: ${i === this.#currentSlide ? 'var(--ds-color-primary)' : 'var(--ds-color-border)'}; transition: all 0.3s;"></div>
          `).join('')}
        </div>
      `;

      // Attacher les event listeners
      const btnNext = document.getElementById('btn-next-slide');
      if (btnNext) {
        btnNext.addEventListener('click', () => {
          this.#currentSlide++;
          this.#updateSlide();
        });
      }

      const btnBack = document.getElementById('btn-back-slide');
      if (btnBack) {
        btnBack.addEventListener('click', () => {
          this.#currentSlide--;
          this.#updateSlide();
        });
      }

      const btnSkip = document.getElementById('btn-skip-onboarding');
      if (btnSkip) {
        btnSkip.addEventListener('click', () => {
          this.#finishOnboarding();
        });
      }
    } else {
      // Slide d'offre (slide 3)
      this.#container.innerHTML = `
        ${backButton}
        ${skipButton}
        <div style="font-size: 4rem; margin-bottom: 1rem; animation: fadeInUp 0.6s ease-out;">🎓</div>
        <h2 style="color: var(--ds-color-primary); margin-bottom: 0.5rem; font-size: 1.8rem; animation: fadeInUp 0.6s ease-out 0.1s backwards;">Choisissez votre parcours</h2>
        <p style="color: var(--ds-color-text-muted); font-size: 1rem; margin-bottom: 2rem; animation: fadeInUp 0.6s ease-out 0.2s backwards;">Notre plateforme évolue avec vous</p>

        <div style="width: 100%; max-width: 500px; animation: fadeInUp 0.6s ease-out 0.3s backwards;">
          <!-- Option GRATUITE - Mise en évidence -->
          <div style="
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            padding: 1.5rem;
            border-radius: 16px;
            margin-bottom: 1rem;
            box-shadow: 0 8px 24px rgba(16, 185, 129, 0.3);
            border: 3px solid #059669;
          ">
            <div style="font-size: 1.5rem; font-weight: bold; margin-bottom: 0.5rem;">🆓 Option Gratuite</div>
            <div style="font-size: 0.95rem; margin-bottom: 1rem; opacity: 0.95;">
              Accès complet au niveau A0 (Débutant) avec tous les thèmes de base
            </div>
            <button id="btn-free-option" style="
              width: 100%;
              background: white;
              color: #059669;
              border: none;
              padding: 14px;
              border-radius: 12px;
              font-weight: bold;
              font-size: 1.05rem;
              cursor: pointer;
            ">Commencer gratuitement</button>
          </div>

          <!-- Option PREMIUM -->
          <div style="
            background: var(--ds-color-surface);
            color: var(--ds-color-text);
            padding: 1.5rem;
            border-radius: 16px;
            border: 2px solid var(--ds-color-border);
          ">
            <div style="font-size: 1.3rem; font-weight: bold; margin-bottom: 0.5rem; color: var(--ds-color-primary);">⭐ Premium par Niveau</div>
            <div style="font-size: 0.9rem; margin-bottom: 1rem; color: var(--ds-color-text-muted);">
              Débloquez les niveaux avancés et les certifications
            </div>
            <div style="text-align: left; font-size: 0.85rem; margin-bottom: 1rem;">
              <div style="margin-bottom: 0.5rem;"><strong>A0-A2 (Starter) :</strong> 15 000 Ar/mois (étudiants) / 20 000 Ar/mois</div>
              <div style="margin-bottom: 0.5rem;"><strong>B1-B2 :</strong> 25 000 Ar/mois</div>
              <div style="margin-bottom: 0.5rem;"><strong>C1-C2 :</strong> 30 000 Ar/mois</div>
              <div><strong>Certification A2 :</strong> 50 000 Ar (une fois)</div>
            </div>
            <button id="btn-premium-option" style="
              width: 100%;
              background: var(--ds-color-primary);
              color: white;
              border: none;
              padding: 14px;
              border-radius: 12px;
              font-weight: bold;
              font-size: 1rem;
              cursor: pointer;
            ">Voir les offres Premium</button>
          </div>
        </div>

        <div style="margin-top: 2rem; display: flex; gap: 0.5rem; animation: fadeInUp 0.6s ease-out 0.4s backwards;">
          ${this.#slides.map((_, i) => `
            <div style="width: ${i === this.#currentSlide ? '24px' : '8px'}; height: 8px; border-radius: 4px; background: ${i === this.#currentSlide ? 'var(--ds-color-primary)' : 'var(--ds-color-border)'}; transition: all 0.3s;"></div>
          `).join('')}
        </div>
      `;

      // Attacher les event listeners pour les options
      const btnBack = document.getElementById('btn-back-slide');
      if (btnBack) {
        btnBack.addEventListener('click', () => {
          this.#currentSlide--;
          this.#updateSlide();
        });
      }

      const btnSkip = document.getElementById('btn-skip-onboarding');
      if (btnSkip) {
        btnSkip.addEventListener('click', () => {
          this.#finishOnboarding();
        });
      }

      const btnFree = document.getElementById('btn-free-option');
      if (btnFree) {
        btnFree.addEventListener('click', () => {
          // Marquer l'utilisateur comme gratuit
          localStorage.setItem('dagospeak:userType', 'free');
          this.#finishOnboarding();
        });
      }

      const btnPremium = document.getElementById('btn-premium-option');
      if (btnPremium) {
        btnPremium.addEventListener('click', () => {
          // Marquer l'utilisateur comme intéressé par Premium
          localStorage.setItem('dagospeak:userType', 'premium-interested');
          this.#finishOnboarding();
        });
      }
    }
  }

  #finishOnboarding() {
    // Ne pas sauvegarder dans localStorage - l'onboarding s'exécutera toujours
    if (this.#container) {
      this.#container.style.opacity = '0';
      this.#container.style.transition = 'opacity 0.5s';
      setTimeout(() => {
        if (this.#container) {
          this.#container.remove();
        }
        if (this.#onComplete) {
          this.#onComplete();
        }
      }, 500);
    }
  }
}