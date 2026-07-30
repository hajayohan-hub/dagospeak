/**
 * OnboardingScreen - Page d'intro avec détection de compte, offres et formulaire d'inscription.
 * Thème : Vert (#0A8A6E) et Orange Doré (#E8A33D)
 */
export class OnboardingScreen {
  #container = null;
  #currentSlide = 0;
  #onComplete = null;

  // Les 22 régions de Madagascar
  #regions = [
    "Analamanga (Antananarivo)", "Diana (Antsiranana)", "Haute Matsiatra (Fianarantsoa)",
    "Boeny (Mahajanga)", "Atsinanana (Toamasina)", "Atsimo-Andrefana (Toliara)",
    "Alaotra-Mangoro", "Amoron'i Mania", "Analanjirofo", "Androy", "Anosy",
    "Atsimo-Atsinanana", "Betsiboka", "Bongolava", "Ihorombe", "Itasy",
    "Melaky", "Menabe", "Sava", "Sofia", "Vakinankaratra", "Vatovavy-Fitovinany"
  ];

  #slides = [
    {
      icon: '🇲🇬',
      title: 'Manahoana ! Bienvenue sur DagoSpeak',
      text: 'La première plateforme d\'apprentissage des langues 100% hors-ligne pour les locuteurs Malgaches.',
      action: 'Suivant'
    },
    {
      icon: '🎧',
      title: 'Écoutez, Parlez, Progressez',
      text: 'Une méthode immersive avec des dialogues réels, un tuteur vocal intelligent et des certifications reconnues.',
      action: 'Suivant'
    },
    {
      icon: '📶',
      title: 'Mode 100% Hors-ligne',
      text: 'DagoSpeak s\'adapte à votre appareil. Nous préparons votre espace d\'apprentissage en arrière-plan.',
      action: 'Suivant'
    },
    {
      icon: '🎓',
      title: 'Choisissez votre parcours',
      text: 'Notre plateforme évolue avec vous. Commencez gratuitement ou passez au Premium pour débloquer tout le potentiel.',
      action: null,
      isOfferSlide: true
    }
  ];

  constructor() {}

  show(onCompleteCallback) {
    this.#onComplete = onCompleteCallback;
    this.#currentSlide = 0;
    this.#injectStyles();
    this.#render();
  }

  #injectStyles() {
    if (document.getElementById('ob-styles')) return;
    const style = document.createElement('style');
    style.id = 'ob-styles';
    style.innerHTML = `
      :root { --ob-green: #0A8A6E; --ob-orange: #E8A33D; --ob-green-light: #d1fae5; }
      @keyframes obFadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes obPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.03); } }
      .ob-input {
        width: 100%; padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 12px;
        font-size: 1rem; margin-bottom: 1rem; transition: border-color 0.3s; outline: none;
      }
      .ob-input:focus { border-color: var(--ob-green); }
      .ob-select {
        width: 100%; padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 12px;
        font-size: 1rem; margin-bottom: 1rem; background: white; cursor: pointer;
      }
      .ob-btn-primary {
        background: linear-gradient(135deg, var(--ob-green) 0%, #087a62 100%);
        color: white; border: none; padding: 14px; border-radius: 12px;
        font-weight: bold; font-size: 1.05rem; cursor: pointer; width: 100%;
        box-shadow: 0 4px 12px rgba(10, 138, 110, 0.3); transition: transform 0.2s;
      }
      .ob-btn-primary:hover { transform: translateY(-2px); }
      .ob-btn-secondary {
        background: transparent; color: var(--ob-orange); border: 2px solid var(--ob-orange);
        padding: 14px; border-radius: 12px; font-weight: bold; font-size: 1.05rem;
        cursor: pointer; width: 100%; margin-top: 0.75rem; transition: all 0.2s;
      }
      .ob-btn-secondary:hover { background: var(--ob-orange); color: white; }
      .ob-btn-danger {
        background: transparent; color: #ef4444; border: 1px solid #ef4444;
        padding: 10px; border-radius: 12px; font-size: 0.9rem; cursor: pointer;
        margin-top: 1rem; width: 100%; transition: all 0.2s;
      }
      .ob-btn-danger:hover { background: #ef4444; color: white; }
    `;
    document.head.appendChild(style);
  }

  #render() {
    if (this.#container) this.#container.remove();
    this.#container = document.createElement('div');
    this.#container.id = 'onboarding-screen';
    this.#container.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: linear-gradient(135deg, #f0fdf4 0%, #fff7ed 100%);
      z-index: 10000; display: flex; flex-direction: column;
      align-items: center; justify-content: center; padding: 2rem;
      text-align: center; overflow-y: auto;
    `;
    document.body.appendChild(this.#container);

    // Vérifier si l'utilisateur a déjà un compte
    const userProfile = localStorage.getItem('dagospeak:userProfile');
    if (userProfile) {
      this.#renderWelcomeBack(JSON.parse(userProfile));
    } else {
      this.#updateSlide();
    }
  }

  #renderWelcomeBack(profile) {
    const tierLabel = profile.tier === 'premium' ? 'Compte Premium ⭐' : 'Compte Gratuit 🆓';
    const tierColor = profile.tier === 'premium' ? 'var(--ob-orange)' : 'var(--ob-green)';

    this.#container.innerHTML = `
      <div style="animation: obFadeInUp 0.6s ease-out; max-width: 400px; width: 100%;">
        <div style="font-size: 5rem; margin-bottom: 1rem;">👋</div>
        <h2 style="color: var(--ob-green); margin-bottom: 0.5rem; font-size: 1.8rem;">
          Bienvenue, ${profile.firstName} !
        </h2>
        <div style="background: ${tierColor}; color: white; padding: 8px 16px; border-radius: 20px;
                    font-weight: bold; font-size: 0.9rem; display: inline-block; margin-bottom: 1.5rem;">
          ${tierLabel}
        </div>
        <p style="color: #64748b; margin-bottom: 2rem; line-height: 1.6;">
          Heureux de vous revoir sur DagoSpeak. Vos progrès sont sauvegardés et votre tuteur IA vous attend.
        </p>
        <button id="ob-btn-start" class="ob-btn-primary" style="animation: obPulse 2s infinite;">
          🚀 Démarrer l'application
        </button>
        <button id="ob-btn-logout" class="ob-btn-danger">
          🚪 Se déconnecter (Changer de compte)
        </button>
      </div>
    `;

    document.getElementById('ob-btn-start').addEventListener('click', () => {
      localStorage.setItem('dagospeak:onboardingComplete', 'true');
      this.#finishOnboarding();
    });

    document.getElementById('ob-btn-logout').addEventListener('click', () => {
      if (confirm('Voulez-vous vraiment vous déconnecter ? Vos données locales seront effacées.')) {
        localStorage.removeItem('dagospeak:userProfile');
        localStorage.removeItem('dagospeak:onboardingComplete');
        localStorage.removeItem('dagospeak:isPremium');
        window.location.reload();
      }
    });
  }

  #updateSlide() {
    const slide = this.#slides[this.#currentSlide];
    const isFirst = this.#currentSlide === 0;
    const isLast = this.#currentSlide === this.#slides.length - 1;

    const backButton = isFirst ? '' : `
      <button id="ob-btn-back" style="position: absolute; top: 20px; left: 20px; background: white; border: none; border-radius: 50%; width: 44px; height: 44px; font-size: 1.5rem; cursor: pointer; color: var(--ob-green); box-shadow: 0 2px 8px rgba(0,0,0,0.1);">←</button>`;

    const skipButton = isLast ? '' : `
      <button id="ob-btn-skip" style="position: absolute; top: 20px; right: 20px; background: transparent; border: none; font-size: 0.9rem; cursor: pointer; color: #64748b; padding: 8px 16px;">Passer</button>`;

    if (!slide.isOfferSlide) {
      this.#container.innerHTML = `
        ${backButton}${skipButton}
        <div style="animation: obFadeInUp 0.6s ease-out; max-width: 500px; width: 100%;">
          <div style="font-size: 5rem; margin-bottom: 1rem;">${slide.icon}</div>
          <h2 style="color: var(--ob-green); margin-bottom: 0.5rem; font-size: 1.8rem;">${slide.title}</h2>
          <p style="color: #64748b; font-size: 1.05rem; margin-bottom: 2rem; line-height: 1.6;">${slide.text}</p>
          <button id="ob-btn-next" class="ob-btn-primary">${slide.action} →</button>
          <div style="margin-top: 2rem; display: flex; gap: 0.5rem; justify-content: center;">
            ${this.#slides.map((_, i) => `
              <div style="width: ${i === this.#currentSlide ? '24px' : '8px'}; height: 8px; border-radius: 4px;
                          background: ${i === this.#currentSlide ? 'var(--ob-green)' : '#cbd5e1'}; transition: all 0.3s;"></div>
            `).join('')}
          </div>
        </div>
      `;
      document.getElementById('ob-btn-next')?.addEventListener('click', () => { this.#currentSlide++; this.#updateSlide(); });
    } else {
      this.#renderOfferSlide(backButton, skipButton);
    }

    document.getElementById('ob-btn-back')?.addEventListener('click', () => { this.#currentSlide--; this.#updateSlide(); });
    document.getElementById('ob-btn-skip')?.addEventListener('click', () => this.#finishOnboarding());
  }

  #renderOfferSlide(backButton, skipButton) {
    this.#container.innerHTML = `
      ${backButton}${skipButton}
      <div style="animation: obFadeInUp 0.6s ease-out; max-width: 500px; width: 100%;">
        <div style="font-size: 4rem; margin-bottom: 1rem;">🎓</div>
        <h2 style="color: var(--ob-green); margin-bottom: 0.5rem; font-size: 1.8rem;">Choisissez votre parcours</h2>
        <p style="color: #64748b; margin-bottom: 1.5rem;">Créez votre compte pour commencer l'aventure.</p>

        <!-- Option Gratuite -->
        <div style="background: linear-gradient(135deg, var(--ob-green) 0%, #087a62 100%); color: white; padding: 1.5rem; border-radius: 16px; margin-bottom: 1rem; box-shadow: 0 8px 24px rgba(10, 138, 110, 0.3);">
          <div style="font-size: 1.3rem; font-weight: bold; margin-bottom: 0.5rem;">🆓 Compte Gratuit</div>
          <div style="font-size: 0.9rem; margin-bottom: 1rem; opacity: 0.95;">Accès au niveau A0, mode hors-ligne et Teacher IA de base.</div>
          <button id="ob-btn-free" class="ob-btn-primary" style="background: white; color: var(--ob-green);">Créer un compte gratuit</button>
        </div>

        <!-- Option Premium -->
        <div style="background: white; color: #334155; padding: 1.5rem; border-radius: 16px; border: 2px solid var(--ob-orange); position: relative;">
          <div style="position: absolute; top: -12px; right: 20px; background: var(--ob-orange); color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: bold;">RECOMMANDÉ</div>
          <div style="font-size: 1.3rem; font-weight: bold; margin-bottom: 0.5rem; color: var(--ob-orange);">⭐ Compte Premium</div>
          <div style="font-size: 0.9rem; margin-bottom: 1rem; color: #64748b;">Débloquez A1, A2, B1, B2, C1, C2, les examens de certification et les conversations avancées.</div>
          <div style="font-size: 1.1rem; font-weight: bold; color: var(--ob-green); margin-bottom: 1rem;">15 000 Ar/mois (Étudiants) / 20 000 Ar/mois</div>
          <button id="ob-btn-premium" class="ob-btn-primary" style="background: var(--ob-orange);">Créer un compte Premium</button>
        </div>
      </div>
    `;

    document.getElementById('ob-btn-free').addEventListener('click', () => this.#showRegistrationForm('free'));
    document.getElementById('ob-btn-premium').addEventListener('click', () => this.#showRegistrationForm('premium'));
  }

  #showRegistrationForm(tier) {
    const tierLabel = tier === 'premium' ? 'Premium ⭐' : 'Gratuit 🆓';

    this.#container.innerHTML = `
      <div style="animation: obFadeInUp 0.6s ease-out; max-width: 500px; width: 100%; text-align: left;">
        <button id="ob-btn-back-form" style="background: transparent; border: none; color: var(--ob-green); font-size: 1rem; cursor: pointer; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
          ← Retour aux offres
        </button>
        <h2 style="color: var(--ob-green); margin-bottom: 0.5rem; font-size: 1.6rem; text-align: center;">Création de compte ${tierLabel}</h2>
        <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 1.5rem; text-align: center;">Ces informations permettront au Teacher IA de personnaliser votre apprentissage.</p>

        <form id="ob-register-form" style="background: white; padding: 1.5rem; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          <label style="font-size: 0.85rem; font-weight: 600; color: #475569; display: block; margin-bottom: 0.25rem;">Prénom</label>
          <input type="text" id="reg-firstname" class="ob-input" required placeholder="Ex: Jean">

          <label style="font-size: 0.85rem; font-weight: 600; color: #475569; display: block; margin-bottom: 0.25rem;">Nom</label>
          <input type="text" id="reg-lastname" class="ob-input" required placeholder="Ex: Rakoto">

          <label style="font-size: 0.85rem; font-weight: 600; color: #475569; display: block; margin-bottom: 0.25rem;">Région à Madagascar</label>
          <select id="reg-region" class="ob-select" required>
            <option value="" disabled selected>Choisir une région...</option>
            ${this.#regions.map(r => `<option value="${r}">${r}</option>`).join('')}
          </select>

          <label style="font-size: 0.85rem; font-weight: 600; color: #475569; display: block; margin-bottom: 0.25rem;">Statut</label>
          <select id="reg-status" class="ob-select" required>
            <option value="" disabled selected>Choisir votre statut...</option>
            <option value="Etudiant">Étudiant(e)</option>
            <option value="Travailleur">Travailleur / Active</option>
            <option value="Autre">Autre</option>
          </select>

          <button type="submit" class="ob-btn-primary" style="margin-top: 0.5rem;">
            ✅ Valider et commencer
          </button>
        </form>
      </div>
    `;

    document.getElementById('ob-btn-back-form').addEventListener('click', () => this.#updateSlide());

    document.getElementById('ob-register-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const userData = {
        firstName: document.getElementById('reg-firstname').value.trim(),
        lastName: document.getElementById('reg-lastname').value.trim(),
        region: document.getElementById('reg-region').value,
        status: document.getElementById('reg-status').value,
        tier: tier,
        isPremium: tier === 'premium',
        createdAt: new Date().toISOString()
      };

      // Sauvegarde locale (sera synchronisée plus tard avec le backend)
      localStorage.setItem('dagospeak:userProfile', JSON.stringify(userData));
      if (tier === 'premium') {
        localStorage.setItem('dagospeak:isPremium', 'true');
      }

      localStorage.setItem('dagospeak:onboardingComplete', 'true');
      this.#finishOnboarding();
    });
  }

  #finishOnboarding() {
    if (this.#container) {
      this.#container.style.opacity = '0';
      this.#container.style.transition = 'opacity 0.5s ease';
      setTimeout(() => {
        if (this.#container) this.#container.remove();
        if (this.#onComplete) this.#onComplete();
      }, 500);
    }
  }
}