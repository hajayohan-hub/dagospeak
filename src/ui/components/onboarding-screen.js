/**
 * OnboardingScreen - Page d'intro avec images 3D, animations et offres.
 */
export class OnboardingScreen {
  #container = null;
  #currentSlide = 0;
  #onComplete = null;

  #slides = [
    {
      image: '/assets/teacher-3d.png',
      fallback: '👩‍',
      title: 'Manahoana ! Bienvenue sur DagoSpeak',
      titleMg: '(Tonga soa eto DagoSpeak)',
      text: 'La première plateforme d\'apprentissage des langues 100% hors-ligne pour les locuteurs Malgaches.',
      textMg: '(Ny sehatra voalohany mianarana fiteny 100% offline ho an\'ny Malagasy)',
      action: 'Suivant'
    },
    {
      image: '/assets/users-3d.png',
      fallback: '👥',
      showLangIcons: true,
      title: 'Écoutez, Parlez, Progressez',
      titleMg: '(Mihainoa, Mitenena, Miroborobo)',
      text: 'Une méthode immersive avec un tuteur vocal intelligent et des certifications reconnues.',
      textMg: '(Fomba fianarana lalina miaraka amin\'ny mpampianatra intelligent sy fahazoana mari-pahaizana)',
      action: 'Suivant'
    },
    {
      title: 'Mode 100% Hors-ligne',
      titleMg: '(Mode 100% Offline)',
      text: 'DagoSpeak s\'adapte à votre appareil. Nous préparons votre espace d\'apprentissage.',
      textMg: '(DagoSpeak mifanaraka amin\'ny findainao. Efa manomana ny toerana fianarana)',
      isSetupSlide: true
    },
    {
      title: 'Choisissez votre parcours',
      titleMg: '(Safidio ny lalanao)',
      text: 'Notre plateforme évolue avec vous. Commencez gratuitement et passez au Premium.',
      textMg: '(Mandroso miaraka aminao ny platformanay. Atombohy maimaim-poana)',
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
      @keyframes obZoomIn {
        0% { transform: scale(0.6) translateY(30px); opacity: 0; }
        100% { transform: scale(1) translateY(0); opacity: 1; }
      }
      @keyframes obFloat {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-15px); }
      }
      @keyframes obFloatLang1 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-15px, -20px); } }
      @keyframes obFloatLang2 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(20px, -15px); } }
      @keyframes obFloatLang3 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-10px, 20px); } }
      @keyframes obFloatLang4 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(15px, 15px); } }
      @keyframes obFloatLang5 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(15px, 15px); } }
      @keyframes obSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      @keyframes obFadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

      .ob-image {
        max-width: 260px; width: 100%; height: auto;
        animation: obZoomIn 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards, obFloat 4s ease-in-out infinite 0.8s;
        filter: drop-shadow(0 15px 30px rgba(0,0,0,0.15));
      }
      .ob-lang-badge {
        position: absolute; background: white; padding: 6px 12px; border-radius: 12px;
        font-weight: 800; font-size: 0.85rem; box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        border: 2px solid #e0e7ff; color: #0A8A6E;
      }
      .ob-lang-1 { top: 10%; left: 5%; animation: obFloatLang1 4s ease-in-out infinite; }
      .ob-lang-2 { top: 15%; right: 5%; animation: obFloatLang2 5s ease-in-out infinite 0.5s; }
      .ob-lang-3 { bottom: 20%; left: 10%; animation: obFloatLang3 4.5s ease-in-out infinite 1s; }
      .ob-lang-4 { bottom: 15%; right: 10%; animation: obFloatLang4 5.5s ease-in-out infinite 1.5s; }
      .ob-lang-5 { top: 40%; left: 30%; animation: obFloatLang5 5.5s ease-in-out infinite 1.s; }

      .ob-spinner {
        width: 50px; height: 50px; border: 5px solid rgba(10, 138, 110, 0.2);
        border-top-color: #0A8A6E; border-radius: 50%; animation: obSpin 1s linear infinite;
        margin: 0 auto 1.5rem;
      }
    `;
    document.head.appendChild(style);
  }

  #render() {
    if (this.#container) this.#container.remove();
    this.#container = document.createElement('div');
    this.#container.id = 'onboarding-screen';
    this.#container.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: linear-gradient(135deg, #f0fdf4 0%, #e0e7ff 100%);
      z-index: 10000; display: flex; flex-direction: column;
      align-items: center; justify-content: center; padding: 2rem;
      text-align: center; overflow-y: auto;
    `;
    document.body.appendChild(this.#container);
    this.#updateSlide();
  }

  #updateSlide() {
    const slide = this.#slides[this.#currentSlide];
    const isFirst = this.#currentSlide === 0;
    const isLast = this.#currentSlide === this.#slides.length - 1;

    // Boutons de navigation
    const backButton = isFirst ? '' : `<button id="ob-btn-back" style="position: absolute; top: 20px; left: 20px; background: rgba(255,255,255,0.8); border: none; border-radius: 50%; width: 44px; height: 44px; font-size: 1.5rem; cursor: pointer; color: #0A8A6E; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">←</button>`;
    const skipButton = isLast ? '' : `<button id="ob-btn-skip" style="position: absolute; top: 20px; right: 20px; background: transparent; border: none; font-size: 0.9rem; cursor: pointer; color: #64748b; padding: 8px 16px;">Passer</button>`;

    let visualContent = '';

    if (slide.isSetupSlide) {
      visualContent = `<div class="ob-spinner"></div>`;
    } else if (slide.image) {
      // Slides avec images 3D
      let langIcons = '';
      if (slide.showLangIcons) {
        langIcons = `
          <div class="ob-lang-badge ob-lang-1">🇫🇷 FR</div>
          <div class="ob-lang-badge ob-lang-2">🇬🇧 EN</div>
          <div class="ob-lang-badge ob-lang-3">🇲🇬 MG</div>
          <div class="ob-lang-badge ob-lang-4">🇩🇪 DE</div>
          <div class="ob-lang-badge ob-lang-5">🇪🇸 ES</div>
        `;
      }
      visualContent = `
        <div style="position: relative; display: inline-block; margin-bottom: 1.5rem;">
          <img src="${slide.image}" alt="3D" class="ob-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='block'">
          <div style="display:none; font-size: 5rem; animation: obZoomIn 0.8s forwards;">${slide.fallback}</div>
          ${langIcons}
        </div>
      `;
    }

    // Construction du HTML principal
    if (slide.isOfferSlide) {
      this.#container.innerHTML = `
        ${backButton}
        <div style="max-width: 500px; width: 100%; animation: obFadeInUp 0.6s ease-out;">
          <h2 style="color: #0A8A6E; margin-bottom: 0.5rem; font-size: 1.8rem;">${slide.title}</h2>
          <p style="color: #059669; font-size: 0.95rem; font-style: italic; margin-bottom: 1.5rem;">${slide.titleMg}</p>

          <!-- Option Gratuite -->
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 1.5rem; border-radius: 16px; margin-bottom: 1rem; box-shadow: 0 8px 24px rgba(16, 185, 129, 0.3); border: 3px solid #059669;">
            <div style="font-size: 1.3rem; font-weight: bold; margin-bottom: 0.5rem;">🆓 Option Gratuite</div>
            <div style="font-size: 0.9rem; margin-bottom: 1rem; opacity: 0.95;">Accès complet au niveau A0</div>
            <button id="ob-btn-free" style="width: 100%; background: white; color: #059669; border: none; padding: 12px; border-radius: 12px; font-weight: bold; font-size: 1rem; cursor: pointer;">Commencer gratuitement</button>
          </div>

          <!-- Option Premium -->
          <div style="background: white; color: #334155; padding: 1.5rem; border-radius: 16px; border: 2px solid #e2e8f0;">
            <div style="font-size: 1.2rem; font-weight: bold; margin-bottom: 0.5rem; color: #0A8A6E;">⭐ Premium Starter (A0-A2)</div>
            <div style="font-size: 0.85rem; margin-bottom: 1rem; color: #64748b;">Dictionnaire intelligent, Conversations IA, Certifications</div>
            <div style="font-size: 1.1rem; font-weight: bold; color: #0A8A6E; margin-bottom: 1rem;">15 000 Ar/mois (Étudiants) / 20 000 Ar/mois</div>
            <button id="ob-btn-premium" style="width: 100%; background: #0A8A6E; color: white; border: none; padding: 12px; border-radius: 12px; font-weight: bold; font-size: 1rem; cursor: pointer;">Voir les offres Premium</button>
          </div>
        </div>
      `;

      // Listeners pour les offres
      document.getElementById('ob-btn-free')?.addEventListener('click', () => { localStorage.setItem('dagospeak:userType', 'free'); this.#finishOnboarding(); });
      document.getElementById('ob-btn-premium')?.addEventListener('click', () => { localStorage.setItem('dagospeak:userType', 'premium-interested'); this.#finishOnboarding(); });

    } else if (slide.isSetupSlide) {
      this.#container.innerHTML = `
        ${backButton}
        <div style="max-width: 400px; width: 100%; animation: obFadeInUp 0.6s ease-out;">
          ${visualContent}
          <h2 style="color: #0A8A6E; margin-bottom: 0.5rem; font-size: 1.6rem;">${slide.title}</h2>
          <p style="color: #059669; font-size: 0.9rem; font-style: italic; margin-bottom: 1.5rem;">${slide.titleMg}</p>

          <div id="ob-setup-area" style="width: 100%; background: white; padding: 1.5rem; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <div id="ob-setup-status" style="margin-bottom: 1rem; font-weight: 600; color: #334155;">Vérification de l'appareil...</div>
            <div style="width: 100%; height: 10px; background: #e2e8f0; border-radius: 5px; overflow: hidden; margin-bottom: 1rem;">
              <div id="ob-setup-progress" style="width: 0%; height: 100%; background: #0A8A6E; transition: width 0.5s ease;"></div>
            </div>
            <p id="ob-setup-detail" style="font-size: 0.85rem; color: #64748b; margin: 0;"></p>
          </div>
        </div>
      `;
      this.#startSmartSetup();

    } else {
      // Slides normaux (0 et 1)
      this.#container.innerHTML = `
        ${backButton}
        ${skipButton}
        <div style="max-width: 500px; width: 100%; animation: obFadeInUp 0.6s ease-out;">
          ${visualContent}
          <h2 style="color: #0A8A6E; margin-bottom: 0.5rem; font-size: 1.8rem;">${slide.title}</h2>
          <p style="color: #059669; font-size: 0.95rem; font-style: italic; margin-bottom: 1rem;">${slide.titleMg}</p>
          <p style="color: #475569; font-size: 1.05rem; margin-bottom: 0.5rem; line-height: 1.5;">${slide.text}</p>
          <p style="color: #64748b; font-size: 0.9rem; font-style: italic; margin-bottom: 2rem; line-height: 1.5;">${slide.textMg}</p>

          <button id="ob-btn-next" style="background: #0A8A6E; color: white; border: none; padding: 14px 40px; border-radius: 50px; font-weight: bold; font-size: 1.05rem; cursor: pointer; min-width: 200px; box-shadow: 0 4px 12px rgba(10, 138, 110, 0.3); transition: transform 0.2s;">
            ${slide.action} →
          </button>

          <div style="margin-top: 2rem; display: flex; gap: 0.5rem; justify-content: center;">
            ${this.#slides.map((_, i) => `<div style="width: ${i === this.#currentSlide ? '24px' : '8px'}; height: 8px; border-radius: 4px; background: ${i === this.#currentSlide ? '#0A8A6E' : '#cbd5e1'}; transition: all 0.3s;"></div>`).join('')}
          </div>
        </div>
      `;

      document.getElementById('ob-btn-next')?.addEventListener('click', () => { this.#currentSlide++; this.#updateSlide(); });
    }

    // Listeners globaux
    document.getElementById('ob-btn-back')?.addEventListener('click', () => { this.#currentSlide--; this.#updateSlide(); });
    document.getElementById('ob-btn-skip')?.addEventListener('click', () => { this.#finishOnboarding(); });
  }

  async #startSmartSetup() {
    const statusEl = document.getElementById('ob-setup-status');
    const progressEl = document.getElementById('ob-setup-progress');
    const detailEl = document.getElementById('ob-setup-detail');

    const steps = [
      { p: 20, s: 'Vérification de l\'espace...', d: 'Manamarina ny toerana...' },
      { p: 50, s: 'Sécurisation du stockage...', d: 'Miaro ny toerana fitehirizana...' },
      { p: 80, s: 'Optimisation pour votre appareil...', d: 'Manamboatra ho an\'ny findainao...' },
      { p: 100, s: 'Préparation terminée !', d: 'Vita ny fanomanana !' }
    ];

    for (const step of steps) {
      await new Promise(r => setTimeout(r, 800));
      progressEl.style.width = `${step.p}%`;
      statusEl.textContent = step.s;
      detailEl.textContent = step.d;
    }

    await new Promise(r => setTimeout(r, 500));
    this.#currentSlide++;
    this.#updateSlide();
  }

  #finishOnboarding() {
    localStorage.setItem('dagospeak:onboardingComplete', 'true');
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