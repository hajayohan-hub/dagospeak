/**
 * OnboardingScreen - Page d'intro avec images 3D, animations et offres dynamiques
 */
export class OnboardingScreen {
  #container = null;
  #currentSlide = 0;
  #onComplete = null;
  #slides = [
    {
      title: 'Manahoana ! Bienvenue sur DagoSpeak',
      subtitle: 'Votre professeur personnel propulsé par IA',
      text: 'Apprenez le français à votre rythme, où que vous soyez, même sans internet.',
      action: 'Suivant',
      image: '/assets/teacher-3d.png',
      imageAlt: 'Teacher AI'
    },
    {
      title: 'Apprenez plusieurs langues',
      subtitle: 'Français, Anglais, Allemand, Espagnol et plus',
      text: 'Sur PC ou mobile, avec un dictionnaire intelligent et des conversations guidées.',
      action: 'Suivant',
      image: '/assets/users-3d.png',
      imageAlt: 'Utilisateurs multilingues',
      showLangIcons: true
    },
    {
      title: 'Préparation du mode 100% Hors-ligne',
      subtitle: 'Configuration intelligente',
      text: 'Nous adaptons l\'application à votre appareil pour une expérience optimale.',
      action: 'Préparer mon espace',
      image: null
    }
  ];

  constructor() {}

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
      background: linear-gradient(135deg, #f0f4ff 0%, #e0e7ff 100%);
      z-index: 10000; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 2rem; text-align: center; overflow: hidden;
    `;

    document.body.appendChild(this.#container);
    this.#updateSlide();
  }

  #updateSlide() {
    const slide = this.#slides[this.#currentSlide];
    const isFirst = this.#currentSlide === 0;
    const isLast = this.#currentSlide === this.#slides.length - 1;

    // Injecter les styles d'animation une seule fois
    if (!document.getElementById('onboarding-animations')) {
      const style = document.createElement('style');
      style.id = 'onboarding-animations';
      style.innerHTML = `
        @keyframes zoomIn {
          0% { transform: scale(0.3) rotate(-5deg); opacity: 0; }
          60% { transform: scale(1.05) rotate(2deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }
        @keyframes floatLang1 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(-20px, -25px) rotate(10deg); }
        }
        @keyframes floatLang2 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(25px, -20px) rotate(-8deg); }
        }
        @keyframes floatLang3 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(-15px, 20px) rotate(5deg); }
        }
        @keyframes floatLang4 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(20px, 25px) rotate(-5deg); }
        }
        @keyframes floatLang5 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(-25px, 10px) rotate(8deg); }
        }
        @keyframes floatLang6 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(15px, -30px) rotate(-10deg); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseBtn {
          0%, 100% { transform: scale(1); box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3); }
          50% { transform: scale(1.03); box-shadow: 0 6px 20px rgba(37, 99, 235, 0.5); }
        }
        .ob-image {
          animation: zoomIn 0.8s ease-out, float 4s ease-in-out infinite 0.8s;
          max-width: 280px; width: 100%; height: auto;
          filter: drop-shadow(0 20px 40px rgba(0,0,0,0.15));
        }
        .ob-title { animation: fadeInUp 0.6s ease-out 0.2s backwards; }
        .ob-subtitle { animation: fadeInUp 0.6s ease-out 0.3s backwards; }
        .ob-text { animation: fadeInUp 0.6s ease-out 0.4s backwards; }
        .ob-btn { animation: fadeInUp 0.6s ease-out 0.5s backwards; }
        .ob-btn:hover { animation: pulseBtn 1.5s ease-in-out infinite; }
        .ob-dots { animation: fadeInUp 0.6s ease-out 0.6s backwards; }
        .lang-badge {
          position: absolute; background: white; padding: 8px 14px;
          border-radius: 16px; font-weight: 800; font-size: 1rem;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          border: 2px solid #e0e7ff;
        }
        .lang-fr { top: 10%; left: 5%; animation: floatLang1 4s ease-in-out infinite; color: #2563eb; }
        .lang-en { top: 5%; right: 10%; animation: floatLang2 5s ease-in-out infinite 0.5s; color: #dc2626; }
        .lang-mg { top: 40%; right: 0%; animation: floatLang3 4.5s ease-in-out infinite 1s; color: #16a34a; }
        .lang-de { bottom: 30%; left: 0%; animation: floatLang4 5.5s ease-in-out infinite 1.5s; color: #1f2937; }
        .lang-es { bottom: 15%; right: 5%; animation: floatLang5 4s ease-in-out infinite 2s; color: #ea580c; }
        .lang-jp { top: 45%; left: 0%; animation: floatLang6 5s ease-in-out infinite 2.5s; color: #be123c; }
      `;
      document.head.appendChild(style);
    }

    // Bouton retour (caché sur le premier slide)
    const backButton = isFirst ? '' : `
      <button id="btn-back-slide" style="
        position: absolute; top: 20px; left: 20px;
        background: var(--ds-color-surface-2); border: none;
        border-radius: 50%; width: 44px; height: 44px;
        font-size: 1.5rem; cursor: pointer; color: var(--ds-color-text);
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      ">←</button>
    `;

    // Bouton passer (toujours visible)
    const skipButton = `
      <button id="btn-skip-onboarding" style="
        position: absolute; top: 20px; right: 20px;
        background: transparent; border: none;
        font-size: 0.9rem; cursor: pointer;
        color: var(--ds-color-text-muted); padding: 8px 16px;
      ">Passer</button>
    `;

    if (slide.image) {
      // Slides avec images 3D (0 et 1)
      let langIcons = '';
      if (slide.showLangIcons) {
        langIcons = `
          <div class="lang-badge lang-fr">🇫🇷 FR</div>
          <div class="lang-badge lang-en">🇬🇧 EN</div>
          <div class="lang-badge lang-mg">🇲🇬 MG</div>
          <div class="lang-badge lang-de">🇪 DE</div>
          <div class="lang-badge lang-es">🇪🇸 ES</div>
          <div class="lang-badge lang-jp">🇵 JP</div>
        `;
      }

      this.#container.innerHTML = `
        ${backButton}
        ${skipButton}
        <div style="position: relative; display: inline-block; margin-bottom: 1rem;">
          <img src="${slide.image}" alt="${slide.imageAlt}" class="ob-image"
               onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
          <div style="display:none; font-size: 6rem;">${isFirst ? '👩🏫' : '👫'}</div>
          ${langIcons}
        </div>
        <h2 class="ob-title" style="color: var(--ds-color-primary); margin-bottom: 0.5rem; font-size: 1.8rem;">
          ${slide.title}
        </h2>
        <p class="ob-subtitle" style="color: var(--ds-color-accent); font-size: 1rem; margin-bottom: 1rem; font-weight: 600;">
          ${slide.subtitle}
        </p>
        <p class="ob-text" style="color: var(--ds-color-text-muted); font-size: 1.05rem; margin-bottom: 2rem; line-height: 1.6; max-width: 500px;">
          ${slide.text}
        </p>
        <button id="btn-next-slide" class="ob-btn" style="
          background: var(--ds-color-primary); color: white; border: none;
          padding: 16px 40px; border-radius: 50px; font-weight: bold;
          font-size: 1.05rem; cursor: pointer; min-width: 200px;
        ">
          ${slide.action} →
        </button>
        <div class="ob-dots" style="margin-top: 2rem; display: flex; gap: 0.5rem;">
          ${this.#slides.map((_, i) => `
            <div style="width: ${i === this.#currentSlide ? '24px' : '8px'}; height: 8px;
              border-radius: 4px;
              background: ${i === this.#currentSlide ? 'var(--ds-color-primary)' : 'var(--ds-color-border)'};
              transition: all 0.3s;"></div>
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
        btnSkip.addEventListener('click', () => this.#finishOnboarding());
      }
    } else {
      // Slide 2 : Setup intelligent
      this.#container.innerHTML = `
        ${backButton}
        ${skipButton}
        <div style="font-size: 5rem; margin-bottom: 1rem; animation: zoomIn 0.8s ease-out;">${slide.title.includes('Hors-ligne') ? '' : '⚙️'}</div>
        <h2 class="ob-title" style="color: var(--ds-color-primary); margin-bottom: 0.5rem; font-size: 1.8rem;">
          ${slide.title}
        </h2>
        <p class="ob-subtitle" style="color: var(--ds-color-accent); font-size: 1rem; margin-bottom: 1rem; font-weight: 600;">
          ${slide.subtitle}
        </p>
        <p class="ob-text" style="color: var(--ds-color-text-muted); font-size: 1.05rem; margin-bottom: 2rem; line-height: 1.6;">
          ${slide.text}
        </p>
        <div id="setup-area" style="width: 100%; max-width: 350px; animation: fadeInUp 0.6s ease-out 0.3s backwards;">
          <div id="setup-status" style="margin-bottom: 1rem; font-weight: 600; color: var(--ds-color-text);">
            Vérification de l'appareil...
          </div>
          <div style="width: 100%; height: 12px; background: var(--ds-color-border); border-radius: 6px; overflow: hidden; margin-bottom: 1rem;">
            <div id="setup-progress" style="width: 0%; height: 100%; background: linear-gradient(90deg, var(--ds-color-primary), var(--ds-color-accent)); transition: width 0.5s ease;"></div>
          </div>
          <p id="setup-detail" style="font-size: 0.85rem; color: var(--ds-color-text-muted);"></p>
        </div>
      `;
      this.#startSmartSetup();
    }
  }

  async #startSmartSetup() {
    const statusEl = document.getElementById('setup-status');
    const progressEl = document.getElementById('setup-progress');
    const detailEl = document.getElementById('setup-detail');

    try {
      detailEl.textContent = 'Vérification de l\'espace disponible...';
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        const availableMB = (estimate.quota - estimate.usage) / (1024 * 1024);
        if (availableMB < 60) {
          throw new Error('Espace insuffisant. Libérez environ 60 Mo.');
        }
      }

      progressEl.style.width = '20%';
      await new Promise(r => setTimeout(r, 600));

      detailEl.textContent = 'Sécurisation du stockage...';
      if (navigator.storage && navigator.storage.persist) {
        await navigator.storage.persist();
      }

      progressEl.style.width = '50%';
      await new Promise(r => setTimeout(r, 800));

      detailEl.textContent = 'Optimisation pour votre appareil...';
      progressEl.style.width = '80%';
      await new Promise(r => setTimeout(r, 800));

      progressEl.style.width = '100%';
      detailEl.textContent = 'Préparation terminée !';
      await new Promise(r => setTimeout(r, 500));

      this.#showDynamicOffer();
    } catch (error) {
      statusEl.textContent = 'Configuration interrompue';
      statusEl.style.color = 'var(--ds-color-danger)';
      detailEl.textContent = error.message + ' Vous pourrez réessayer plus tard.';
      setTimeout(() => this.#finishOnboarding(), 5000);
    }
  }

  #showDynamicOffer() {
    const statusEl = document.getElementById('setup-status');
    const detailEl = document.getElementById('setup-detail');
    const progressEl = document.getElementById('setup-progress');

    statusEl.textContent = '🎉 Préparation terminée !';
    progressEl.style.background = 'var(--ds-color-success)';

    const isLowEnd = (navigator.deviceMemory || 4) < 4 || (navigator.hardwareConcurrency || 4) < 4;
    const isOnline = navigator.onLine;

    let offerTitle = '', offerDesc = '', offerPrice = '';
    if (isLowEnd) {
      offerTitle = ' DagoSpeak Lite (Recommandé)';
      offerDesc = 'Fonctionne 100% hors-ligne avec le moteur vocal léger.';
      offerPrice = '15 000 Ar / mois';
    } else if (!isOnline) {
      offerTitle = '📶 DagoSpeak Standard';
      offerDesc = 'Moteur vocal local + synchronisation automatique.';
      offerPrice = '25 000 Ar / mois';
    } else {
      offerTitle = '🚀 DagoSpeak Premium';
      offerDesc = 'Reconnaissance vocale avancée par IA Cloud.';
      offerPrice = '30 000 Ar / mois';
    }

    detailEl.innerHTML = `
      <div style="background: var(--ds-color-surface); padding: 1.5rem; border-radius: var(--ds-radius-lg);
        border: 2px solid var(--ds-color-primary); margin-top: 1rem; text-align: left;
        animation: fadeInUp 0.6s ease-out;">
        <h3 style="color: var(--ds-color-primary); margin-bottom: 0.5rem;">${offerTitle}</h3>
        <p style="font-size: 0.9rem; color: var(--ds-color-text-muted); margin-bottom: 1rem;">${offerDesc}</p>
        <div style="font-size: 1.5rem; font-weight: bold; color: var(--ds-color-text); margin-bottom: 1rem;">${offerPrice}</div>
        <button id="btn-claim-offer" style="
          width: 100%; background: var(--ds-color-success); color: white;
          border: none; padding: 14px; border-radius: 12px;
          font-weight: bold; font-size: 1rem; cursor: pointer; margin-bottom: 0.5rem;
        ">Choisir cette offre</button>
        <button id="btn-skip-offer" style="
          width: 100%; background: transparent; color: var(--ds-color-text-muted);
          border: 1px solid var(--ds-color-border); padding: 12px;
          border-radius: 12px; font-size: 0.9rem; cursor: pointer;
        ">Continuer gratuitement</button>
      </div>
    `;

    document.getElementById('btn-claim-offer').addEventListener('click', () => {
      alert('Redirection vers le paiement pour : ' + offerTitle);
    });
    document.getElementById('btn-skip-offer').addEventListener('click', () => {
      this.#finishOnboarding();
    });
  }

  #finishOnboarding() {
    localStorage.setItem('dagospeak:onboardingComplete', 'true');
    if (this.#container) {
      this.#container.style.opacity = '0';
      this.#container.style.transition = 'opacity 0.5s';
      setTimeout(() => {
        if (this.#container) this.#container.remove();
        if (this.#onComplete) this.#onComplete();
      }, 500);
    }
  }
}