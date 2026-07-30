/**
 * OnboardingScreen - Page d'intro avec images 3D, design unifié et animations dynamiques.
 */
export class OnboardingScreen {
  #container = null;
  #currentSlide = 0;
  #onComplete = null;

  #slides = [
    {
      image: '/assets/user_1.png', // Remplacez par vos chemins réels
      fallback: '🧑‍🏫',
      title: 'Manahoana ! Bienvenue sur DagoSpeak',
      titleMg: '(Tonga soa eto DagoSpeak)',
      text: 'La première plateforme d\'apprentissage des langues 100% hors-ligne pour les locuteurs Malgaches.',
      textMg: '(Ny sehatra voalohany fianarana fiteny 100% offline ho an\'ny Malagasy)',
      action: 'Suivant'
    },
    {
      image: '/assets/user_2.png',
      fallback: '🌍',
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
      image: '/assets/teacher-3d.png',
      fallback: '🎓',
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
      :root {
        --ob-primary: #2a9d8f;
        --ob-secondary: #f4a261;
        --ob-dark: #264653;
      }

      @keyframes obZoomIn {
        0% { transform: scale(0.6) translateY(30px); opacity: 0; }
        100% { transform: scale(1) translateY(0); opacity: 1; }
      }
      @keyframes obFloat {
        0%, 100% { transform: translateY(0px) scale(1); }
        50% { transform: translateY(-15px) scale(1.02); }
      }

      /* Animations pour 7 langues */
      @keyframes obFloatLang1 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-20px, -25px); } }
      @keyframes obFloatLang2 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(25px, -20px); } }
      @keyframes obFloatLang3 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-15px, 25px); } }
      @keyframes obFloatLang4 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(20px, 20px); } }
      @keyframes obFloatLang5 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-30px, 0px); } }
      @keyframes obFloatLang6 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(30px, 0px); } }
      @keyframes obFloatLang7 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(0px, -30px); } }

      @keyframes obSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      @keyframes obFadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

      @keyframes obPulseLogo {
        0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(42, 157, 143, 0.7); }
        70% { transform: scale(0.95); box-shadow: 0 0 0 10px rgba(42, 157, 143, 0); }
        100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(42, 157, 143, 0); }
      }

      @keyframes obBtnBounce {
        0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
        40% { transform: translateY(-6px); }
        60% { transform: translateY(-3px); }
      }

      @keyframes obGlowPulse {
        0% { box-shadow: 0 0 5px var(--ob-primary); }
        50% { box-shadow: 0 0 20px var(--ob-primary), 0 0 35px var(--ob-secondary); }
        100% { box-shadow: 0 0 5px var(--ob-primary); }
      }

      .ob-image {
        max-width: 240px; width: 100%; height: auto; border-radius: 20px;
        animation: obZoomIn 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards, obFloat 5s ease-in-out infinite 0.8s;
        filter: drop-shadow(0 15px 30px rgba(0,0,0,0.1));
        transition: transform 0.3s ease;
      }
      .ob-image:hover { transform: scale(1.05); }

      /* Image plus petite pour le dernier slide pour éviter le débordement */
      .ob-offer-image {
        max-width: 500px width: 100%; height: auto; !important;
        margin-top: -5px;
      }

      .ob-logo {
        position: absolute; top: 20px; left: 20px; width: 52px; height: 52px;
        background: linear-gradient(135deg, #2a9d8f 0%, #21867a 100%);
        border-radius: 16px; display: flex; align-items: center; justify-content: center;
        font-weight: 900; font-size: 1.6rem; color: white; font-family: sans-serif;
        box-shadow: 0 6px 20px rgba(42, 157, 143, 0.4);
        animation: obPulseLogo 2.5s infinite ease-in-out;
        z-index: 100;
        border: 2px solid rgba(255,255,255,0.4);
      }
      .ob-logo::after {
        content: ''; position: absolute; top: 6px; right: 6px; width: 10px; height: 10px;
        background: var(--ob-secondary); border-radius: 50%;
        border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      }

      .ob-lang-badge {
        position: absolute; background: white; padding: 6px 12px; border-radius: 12px;
        font-weight: 800; font-size: 0.75rem; box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        border: 2px solid #e0e7ff; color: var(--ob-primary);
      }

      /* Positions pour 7 langues */
      .ob-lang-1 { top: 5%; left: 0%; animation: obFloatLang1 4.5s ease-in-out infinite; }
      .ob-lang-2 { top: 5%; right: 0%; animation: obFloatLang2 5s ease-in-out infinite 0.5s; }
      .ob-lang-3 { bottom: 10%; left: 0%; animation: obFloatLang3 4s ease-in-out infinite 1s; }
      .ob-lang-4 { bottom: 10%; right: 0%; animation: obFloatLang4 5.5s ease-in-out infinite 1.5s; }
      .ob-lang-5 { top: 40%; left: -15%; animation: obFloatLang5 5s ease-in-out infinite 0.8s; }
      .ob-lang-6 { top: 40%; right: -15%; animation: obFloatLang6 4.8s ease-in-out infinite 1.2s; }
      .ob-lang-7 { top: 20%; left: 25%; animation: obFloatLang7 5.2s ease-in-out infinite 0.3s; }

      .ob-spinner {
        width: 50px; height: 50px; border: 5px solid rgba(42, 157, 143, 0.2);
        border-top-color: var(--ob-primary); border-radius: 50%; animation: obSpin 1s linear infinite;
        margin: 0 auto 1.5rem;
      }

      .ob-offer-btn {
        transition: all 0.3s ease;
        animation: obBtnBounce 2s infinite ease-in-out;
      }
      .ob-offer-btn:hover {
        transform: scale(1.02) !important;
        animation: obGlowPulse 1.5s infinite alternate !important;
      }
      .ob-premium-btn {
        animation-delay: 0.5s;
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
      background: radial-gradient(circle at 50% 10%, #f8f9fa 0%, #e9ecef 100%);
      z-index: 10000; display: flex; flex-direction: column;
      align-items: center; justify-content: center; padding: 2rem;
      padding-top: 70px; /* Espace pour le logo et les boutons */
      text-align: center; overflow-y: auto; font-family: 'Segoe UI', sans-serif;
      box-sizing: border-box;
    `;
    document.body.appendChild(this.#container);
    this.#updateSlide();
  }

  #updateSlide() {
    const slide = this.#slides[this.#currentSlide];
    const isFirst = this.#currentSlide === 0;
    const isLast = this.#currentSlide === this.#slides.length - 1;

    // Boutons séparés (Précédent à gauche, Passer à droite)
    const backButton = isFirst ? '' : `<button id="ob-btn-back" style="position: absolute; top: 24px; left: 90px; background: rgba(255,255,255,0.8); border: none; border-radius: 50%; width: 40px; height: 40px; font-size: 1.2rem; cursor: pointer; color: #2a9d8f; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: transform 0.2s; z-index: 101;">←</button>`;
    const skipButton = isLast ? '' : `<button id="ob-btn-skip" style="position: absolute; top: 24px; right: 20px; background: transparent; border: none; font-size: 0.9rem; cursor: pointer; color: #f4a261; padding: 8px 16px; font-weight: bold; z-index: 101;">Passer</button>`;

    let visualContent = '';
    let imageClass = 'ob-image';

    if (slide.isSetupSlide) {
      visualContent = `<div class="ob-spinner"></div>`;
    } else if (slide.image) {
      // Si c'est le slide des offres, on réduit la taille de l'image
      if (slide.isOfferSlide) imageClass = 'ob-image ob-offer-image';

      let langIcons = '';
      if (slide.showLangIcons) {
        langIcons = `
          <div class="ob-lang-badge ob-lang-1">🇫🇷 FR</div>
          <div class="ob-lang-badge ob-lang-2">🇬🇧 EN</div>
          <div class="ob-lang-badge ob-lang-3">🇲🇬 MG</div>
          <div class="ob-lang-badge ob-lang-4">🇩🇪 DE</div>
          <div class="ob-lang-badge ob-lang-5">🇪🇸 ES</div>
          <div class="ob-lang-badge ob-lang-6">🇰🇷 KR</div>
          <div class="ob-lang-badge ob-lang-7">🇨🇳 ZH</div>
        `;
      }
      visualContent = `
        <div style="position: relative; display: inline-block; margin-bottom: 0.5rem;">
          <img src="${slide.image}" alt="3D" class="${imageClass}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block'">
          <div style="display:none; font-size: 5rem; animation: obZoomIn 0.8s forwards;">${slide.fallback}</div>
          ${langIcons}
        </div>
      `;
    }

    if (slide.isOfferSlide) {
      this.#container.innerHTML = `
        <div class="ob-logo">DS</div>
        ${backButton}
        <div style="max-width: 500px; width: 100%; animation: obFadeInUp 0.6s ease-out; margin-top: -10px;">
          ${visualContent}
          <h2 style="color: #2a9d8f; margin-bottom: 0.5rem; font-size: 1.5rem;">${slide.title}</h2>
          <p style="color: #f4a261; font-size: 0.95rem; font-style: italic; margin-bottom: 0.5rem;">${slide.titleMg}</p>

          <!-- Option Gratuite -->
          <div style="background: linear-gradient(135deg, #2a9d8f 0%, #21867a 100%); color: white; padding: 1.5rem; border-radius: 16px; margin-bottom: 0.5rem; box-shadow: 0 8px 24px rgba(42, 157, 143, 0.3); border: 3px solid #21867a; position: relative; overflow: hidden;">
            <div style="position: absolute; top: -30px; right: -30px; width: 80px; height: 60px; background: rgba(255,255,255,0.1); border-radius: 50%;"></div>
            <div style="font-size: 1.2rem; font-weight: bold; margin-bottom: 0.5rem;">🆓 Option Gratuite</div>
            <div style="font-size: 0.9rem; margin-bottom: 0.5rem; opacity: 0.95;">Accès complet au niveau A0</div>
            <button id="ob-btn-free" class="ob-offer-btn" style="width: 100%; background: white; color: #21867a; border: none; padding: 14px; border-radius: 12px; font-weight: bold; font-size: 1rem; cursor: pointer; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">Commencer gratuitement</button>
          </div>

          <!-- Option Premium -->
          <div style="background: white; color: #334155; padding: 1.5rem; border-radius: 16px; border: 2px solid #e2e8f0; position: relative;">
            <div style="font-size: 1.2rem; font-weight: bold; margin-bottom: 0.5rem; color: #2a9d8f;">⭐ Premium Starter (A0-A2)</div>
            <div style="font-size: 0.85rem; margin-bottom: 1rem; color: #64748b;">Dictionnaire intelligent, Conversations IA, Certifications</div>
            <div style="font-size: 1.1rem; font-weight: bold; color: #f4a261; margin-bottom: 1rem;">15 000 Ar/mois (Mpianatra) / 20 000 Ar/mois (Mpiasa)</div>
            <button id="ob-btn-premium" class="ob-offer-btn ob-premium-btn" style="width: 100%; background: #2a9d8f; color: white; border: none; padding: 14px; border-radius: 12px; font-weight: bold; font-size: 1rem; cursor: pointer; box-shadow: 0 4px 12px rgba(42, 157, 143, 0.4);">Voir les offres Premium</button>
          </div>
        </div>
      `;

      document.getElementById('ob-btn-free')?.addEventListener('click', () => { localStorage.setItem('dagospeak:userType', 'free'); this.#finishOnboarding(); });
      document.getElementById('ob-btn-premium')?.addEventListener('click', () => { localStorage.setItem('dagospeak:userType', 'premium-interested'); this.#finishOnboarding(); });

    } else if (slide.isSetupSlide) {
      this.#container.innerHTML = `
        <div class="ob-logo">DS</div>
        ${backButton}
        <div style="max-width: 400px; width: 100%; animation: obFadeInUp 0.6s ease-out;">
          ${visualContent}
          <h2 style="color: #2a9d8f; margin-bottom: 0.5rem; font-size: 1.6rem;">${slide.title}</h2>
          <p style="color: #f4a261; font-size: 0.9rem; font-style: italic; margin-bottom: 1.5rem;">${slide.titleMg}</p>

          <div id="ob-setup-area" style="width: 100%; background: white; padding: 1.5rem; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <div id="ob-setup-status" style="margin-bottom: 1rem; font-weight: 600; color: #334155;">Vérification de l'appareil...</div>
            <div style="width: 100%; height: 10px; background: #e2e8f0; border-radius: 5px; overflow: hidden; margin-bottom: 1rem;">
              <div id="ob-setup-progress" style="width: 0%; height: 100%; background: #2a9d8f; transition: width 0.5s ease;"></div>
            </div>
            <p id="ob-setup-detail" style="font-size: 0.85rem; color: #64748b; margin: 0;"></p>
          </div>
        </div>
      `;
      this.#startSmartSetup();

    } else {
      this.#container.innerHTML = `
        <div class="ob-logo">DS</div>
        ${backButton}
        ${skipButton}
        <div style="max-width: 500px; width: 100%; animation: obFadeInUp 0.6s ease-out;">
          ${visualContent}
          <h2 style="color: #2a9d8f; margin-bottom: 0.5rem; font-size: 1.8rem;">${slide.title}</h2>
          <p style="color: #f4a261; font-size: 0.95rem; font-style: italic; margin-bottom: 1rem;">${slide.titleMg}</p>
          <p style="color: #475569; font-size: 1.05rem; margin-bottom: 0.5rem; line-height: 1.5;">${slide.text}</p>
          <p style="color: #f4a261; font-size: 0.9rem; font-style: italic; margin-bottom: 2rem; line-height: 1.5;">${slide.textMg}</p>

          <button id="ob-btn-next" style="background: #2a9d8f; color: white; border: none; padding: 14px 40px; border-radius: 50px; font-weight: bold; font-size: 1.05rem; cursor: pointer; min-width: 200px; box-shadow: 0 4px 12px rgba(42, 157, 143, 0.3); transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
            ${slide.action} →
          </button>
          <style>
            #ob-btn-next:hover { transform: scale(1.05) translateY(-2px); box-shadow: 0 8px 20px rgba(42, 157, 143, 0.4); }
          </style>

          <div style="margin-top: 2rem; display: flex; gap: 0.5rem; justify-content: center;">
            ${this.#slides.map((_, i) => `<div style="width: ${i === this.#currentSlide ? '24px' : '8px'}; height: 8px; border-radius: 4px; background: ${i === this.#currentSlide ? '#2a9d8f' : '#cbd5e1'}; transition: all 0.3s;"></div>`).join('')}
          </div>
        </div>
      `;

      document.getElementById('ob-btn-next')?.addEventListener('click', () => { this.#currentSlide++; this.#updateSlide(); });
    }

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