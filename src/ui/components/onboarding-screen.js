/**
 * OnboardingScreen - Version Adaptative DagoSpeak
 * 2 modes : first-launch (6 slides) et update (3 slides)
 * Design sophistiqué : Vert #0A8A6E + Orange Doré #E8A33D
 * Formulaire élégant avec boutons retour et changement d'offre
 */
export class OnboardingScreen {
  #container = null;
  #currentSlide = 0;
  #onComplete = null;
  #userData = {};
  #mode = 'first-launch'; // 'first-launch' ou 'update'

  #regions = [
    "Analamanga (Antananarivo)", "Diana (Antsiranana)", "Haute Matsiatra (Fianarantsoa)",
    "Boeny (Mahajanga)", "Atsinanana (Toamasina)", "Atsimo-Andrefana (Toliara)",
    "Alaotra-Mangoro", "Amoron'i Mania", "Analanjirofo", "Androy", "Anosy",
    "Atsimo-Atsinanana", "Betsiboka", "Bongolava", "Ihorombe", "Itasy",
    "Melaky", "Menabe", "Sava", "Sofia", "Vakinankaratra", "Vatovavy-Fitovinany"
  ];

  constructor(mode = 'first-launch') {
    this.#mode = mode;
  }

  show(onCompleteCallback) {
    this.#onComplete = onCompleteCallback;
    this.#currentSlide = 0;
    this.#injectStyles();
    this.#render();
  }

  #injectStyles() {
    if (document.getElementById('ob-styles-v2')) return;
    const style = document.createElement('style');
    style.id = 'ob-styles-v2';
    style.innerHTML = `
      :root {
        --ob-primary: #0A8A6E;
        --ob-secondary: #E8A33D;
        --ob-dark: #264653;
        --ob-gradient: linear-gradient(135deg, #0A8A6E 0%, #087a62 100%);
      }

      @keyframes obZoomIn {
        0% { transform: scale(0.6) translateY(30px); opacity: 0; }
        100% { transform: scale(1) translateY(0); opacity: 1; }
      }

      @keyframes obFloat {
        0%, 100% { transform: translateY(0px) scale(1); }
        50% { transform: translateY(-15px) scale(1.02); }
      }

      @keyframes obFloatLang1 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-20px, -25px); } }
      @keyframes obFloatLang2 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(25px, -20px); } }
      @keyframes obFloatLang3 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-15px, 25px); } }
      @keyframes obFloatLang4 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(20px, 20px); } }
      @keyframes obFloatLang5 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-30px, 0px); } }
      @keyframes obFloatLang6 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(30px, 0px); } }

      @keyframes obSpin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      @keyframes obFadeInUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes obPulseLogo {
        0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(10, 138, 110, 0.7); }
        70% { transform: scale(0.95); box-shadow: 0 0 0 10px rgba(10, 138, 110, 0); }
        100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(10, 138, 110, 0); }
      }

      @keyframes obBtnBounce {
        0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
        40% { transform: translateY(-6px); }
        60% { transform: translateY(-3px); }
      }

      @keyframes obShimmer {
        0% { background-position: -200% center; }
        100% { background-position: 200% center; }
      }

      .ob-image {
        max-width: 240px;
        width: 100%;
        height: auto;
        border-radius: 20px;
        animation: obZoomIn 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards, obFloat 5s ease-in-out infinite 0.8s;
        filter: drop-shadow(0 15px 30px rgba(0,0,0,0.1));
      }

      .ob-logo {
        position: absolute;
        top: 20px;
        left: 20px;
        width: 52px;
        height: 52px;
        background: var(--ob-gradient);
        border-radius: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 900;
        font-size: 1.6rem;
        color: white;
        font-family: sans-serif;
        box-shadow: 0 6px 20px rgba(10, 138, 110, 0.4);
        animation: obPulseLogo 2.5s infinite ease-in-out;
        z-index: 100;
      }

      .ob-logo::after {
        content: '';
        position: absolute;
        top: 6px;
        right: 6px;
        width: 10px;
        height: 10px;
        background: var(--ob-secondary);
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      }

      .ob-lang-badge {
        position: absolute;
        background: white;
        padding: 6px 12px;
        border-radius: 12px;
        font-weight: 800;
        font-size: 0.75rem;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        border: 2px solid #e0e7ff;
        color: var(--ob-primary);
      }

      .ob-lang-1 { top: 5%; left: 0%; animation: obFloatLang1 4.5s ease-in-out infinite; }
      .ob-lang-2 { top: 5%; right: 0%; animation: obFloatLang2 5s ease-in-out infinite 0.5s; }
      .ob-lang-3 { bottom: 10%; left: 0%; animation: obFloatLang3 4s ease-in-out infinite 1s; }
      .ob-lang-4 { bottom: 10%; right: 0%; animation: obFloatLang4 5.5s ease-in-out infinite 1.5s; }
      .ob-lang-5 { top: 40%; left: -15%; animation: obFloatLang5 5s ease-in-out infinite 0.8s; }
      .ob-lang-6 { top: 40%; right: -15%; animation: obFloatLang6 4.8s ease-in-out infinite 1.2s; }

      .ob-spinner {
        width: 50px;
        height: 50px;
        border: 5px solid rgba(10, 138, 110, 0.2);
        border-top-color: var(--ob-primary);
        border-radius: 50%;
        animation: obSpin 1s linear infinite;
        margin: 0 auto 1.5rem;
      }

      .ob-offer-btn {
        transition: all 0.3s ease;
        animation: obBtnBounce 2s infinite ease-in-out;
      }

      .ob-offer-btn:hover {
        transform: scale(1.02) !important;
      }

      .ob-premium-btn {
        animation-delay: 0.5s;
      }

      .ob-input {
        width: 100%;
        padding: 12px 16px;
        border: 2px solid #e2e8f0;
        border-radius: 12px;
        font-size: 1rem;
        margin-bottom: 1rem;
        transition: border-color 0.3s;
        outline: none;
        box-sizing: border-box;
      }

      .ob-input:focus {
        border-color: var(--ob-primary);
      }

      .ob-select {
        width: 100%;
        padding: 12px 16px;
        border: 2px solid #e2e8f0;
        border-radius: 12px;
        font-size: 1rem;
        margin-bottom: 1rem;
        background: white;
        cursor: pointer;
        box-sizing: border-box;
      }

      .ob-btn-primary {
        background: var(--ob-gradient);
        color: white;
        border: none;
        padding: 14px 28px;
        border-radius: 12px;
        font-weight: 700;
        font-size: 1rem;
        cursor: pointer;
        transition: all 0.3s;
        box-shadow: 0 4px 12px rgba(10, 138, 110, 0.3);
      }

      .ob-btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(10, 138, 110, 0.4);
      }

      .ob-btn-secondary {
        background: white;
        color: var(--ob-primary);
        border: 2px solid var(--ob-primary);
        padding: 12px 24px;
        border-radius: 12px;
        font-weight: 600;
        font-size: 0.9rem;
        cursor: pointer;
        transition: all 0.3s;
      }

      .ob-btn-secondary:hover {
        background: var(--ob-primary);
        color: white;
      }

      .ob-shimmer {
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
        background-size: 200% 100%;
        animation: obShimmer 2s infinite;
      }
    `;
    document.head.appendChild(style);
  }

  #render() {
    if (this.#container) this.#container.remove();
    this.#container = document.createElement('div');
    this.#container.id = 'onboarding-screen';
    this.#container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: radial-gradient(circle at 50% 10%, #f8f9fa 0%, #e9ecef 100%);
      z-index: 10000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      padding-top: 70px;
      text-align: center;
      overflow-y: auto;
      font-family: 'Segoe UI', sans-serif;
      box-sizing: border-box;
    `;
    document.body.appendChild(this.#container);
    this.#updateSlide();
  }

  #updateSlide() {
    const slides = this.#mode === 'update' ? this.#getUpdateSlides() : this.#getFirstLaunchSlides();
    const slide = slides[this.#currentSlide];
    const isFirst = this.#currentSlide === 0;
    const isLast = this.#currentSlide === slides.length - 1;

    const backButton = isFirst ? '' : `
      <button id="ob-btn-back" style="
        position: absolute;
        top: 24px;
        left: 90px;
        background: rgba(255,255,255,0.8);
        border: none;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        font-size: 1.2rem;
        cursor: pointer;
        color: #0A8A6E;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        z-index: 101;
      ">←</button>
    `;

    let visualContent = '';
    if (slide.isSetupSlide) {
      visualContent = `<div class="ob-spinner"></div>`;
    } else if (slide.image) {
      let langIcons = '';
      if (slide.showLangIcons) {
        langIcons = `
          <div class="ob-lang-badge ob-lang-1">🇫🇷 FR</div>
          <div class="ob-lang-badge ob-lang-2">🇬🇧 EN</div>
          <div class="ob-lang-badge ob-lang-3">🇲🇬 MG</div>
          <div class="ob-lang-badge ob-lang-4">🇩🇪 DE</div>
          <div class="ob-lang-badge ob-lang-5">🇪🇸 ES</div>
          <div class="ob-lang-badge ob-lang-6">🇰🇷 KR</div>
        `;
      }
      visualContent = `
        <div style="position: relative; display: inline-block; margin-bottom: 0.5rem;">
          <img src="${slide.image}" alt="3D" class="ob-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='block'">
          <div style="display:none; font-size: 5rem; animation: obZoomIn 0.8s forwards;">${slide.fallback}</div>
          ${langIcons}
        </div>
      `;
    }

    // Render selon le type de slide
    if (slide.isOfferSlide) {
      this.#renderOfferSlide(slide, visualContent, backButton);
    } else if (slide.isFormSlide) {
      this.#renderFormSlide(slide, visualContent, backButton);
    } else if (slide.isSetupSlide) {
      this.#renderSetupSlide(slide, visualContent, backButton);
    } else if (slide.isCompleteSlide) {
      this.#renderCompleteSlide(slide, visualContent, backButton);
    } else {
      this.#renderStandardSlide(slide, visualContent, backButton, isLast);
    }

    // Bouton retour
    document.getElementById('ob-btn-back')?.addEventListener('click', () => {
      this.#currentSlide--;
      this.#updateSlide();
    });
  }

  #getFirstLaunchSlides() {
    return [
      {
        image: '/assets/teacher-3d.png',
        fallback: '👩‍🏫',
        title: 'Manahoana ! Bienvenue sur DagoSpeak',
        titleMg: '(Tonga soa eto DagoSpeak)',
        text: 'La première plateforme d\'apprentissage des langues 100% hors-ligne pour les locuteurs Malgaches.',
        textMg: '(Ny sehatra voalohany fianarana fiteny 100% offline ho an\'ny Malagasy)',
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
        title: 'Choisissez votre parcours',
        titleMg: '(Safidio ny lalanao)',
        text: 'Commencez gratuitement et passez au Premium quand vous serez prêt.',
        textMg: '(Atombohy maimaim-poana, miakara rehefa vonona ianao)',
        isOfferSlide: true
      },
      {
        title: 'Créez votre profil',
        titleMg: '(Mamorona ny mombamomba anao)',
        text: 'Personnalisez votre expérience d\'apprentissage.',
        textMg: '(Manokana ny fianaranao)',
        isFormSlide: true
      },
      {
        title: 'Mode 100% Hors-ligne',
        titleMg: '(Mode 100% Offline)',
        text: 'DagoSpeak s\'adapte à votre appareil. Nous préparons votre espace.',
        textMg: '(DagoSpeak mifanaraka amin\'ny findainao. Efa manomana ny toerana)',
        isSetupSlide: true
      },
      {
        image: '/assets/teacher-3d.png',
        fallback: '🎉',
        title: 'Tout est prêt !',
        titleMg: '(Vita ny fanomanana !)',
        text: 'Votre espace d\'apprentissage est configuré. Prêt à commencer ?',
        textMg: '(Vonona ny toerana fianarana. Vonona hanomboka ?)',
        isCompleteSlide: true
      }
    ];
  }

  #getUpdateSlides() {
    return [
      {
        image: '/assets/teacher-3d.png',
        fallback: '🔄',
        title: 'Mise à jour en cours...',
        titleMg: '(Fanavaozana atao...)',
        text: 'Nous installons les dernières améliorations.',
        textMg: '(Mametaka ny fanatsarana farany izahay)',
        isSetupSlide: true
      },
      {
        image: '/assets/users-3d.png',
        fallback: '✅',
        title: 'Mise à jour effectuée !',
        titleMg: '(Vita ny fanavaozana !)',
        text: 'Nouvelles fonctionnalités et corrections de bugs installées.',
        textMg: '(Fiasa vaovao sy fanamboarana hadisoana voapetraka)',
        isCompleteSlide: true
      }
    ];
  }

  #renderOfferSlide(slide, visualContent, backButton) {
    this.#container.innerHTML = `
      <div class="ob-logo">DS</div>
      ${backButton}
      <div style="max-width: 500px; width: 100%; animation: obFadeInUp 0.6s ease-out;">
        ${visualContent}
        <h2 style="color: #0A8A6E; margin-bottom: 0.5rem; font-size: 1.5rem;">${slide.title}</h2>
        <p style="color: #E8A33D; font-size: 0.95rem; font-style: italic; margin-bottom: 0.5rem;">${slide.titleMg}</p>

        <!-- Option Gratuite -->
        <div style="background: linear-gradient(135deg, #0A8A6E 0%, #087a62 100%); color: white; padding: 1.5rem; border-radius: 16px; margin-bottom: 0.5rem; box-shadow: 0 8px 24px rgba(10, 138, 110, 0.3); border: 3px solid #087a62;">
          <div style="font-size: 1.2rem; font-weight: bold; margin-bottom: 0.5rem;">🆓 Option Gratuite</div>
          <div style="font-size: 0.9rem; margin-bottom: 0.5rem; opacity: 0.95;">Accès complet au niveau A0</div>
          <button id="ob-btn-free" class="ob-offer-btn" style="
            width: 100%;
            background: white;
            color: #087a62;
            border: none;
            padding: 14px;
            border-radius: 12px;
            font-weight: bold;
            font-size: 1rem;
            cursor: pointer;
          ">Commencer gratuitement</button>
        </div>

        <!-- Option Premium -->
        <div style="background: white; color: #334155; padding: 1.5rem; border-radius: 16px; border: 2px solid #e2e8f0;">
          <div style="font-size: 1.2rem; font-weight: bold; margin-bottom: 0.5rem; color: #0A8A6E;">⭐ Premium Starter (A0-A2)</div>
          <div style="font-size: 0.85rem; margin-bottom: 1rem; color: #64748b;">Dictionnaire intelligent, Conversations IA, Certifications</div>
          <div style="font-size: 1.1rem; font-weight: bold; color: #E8A33D; margin-bottom: 1rem;">15 000 Ar/mois (Mpianatra) / 20 000 Ar/mois (Mpiasa)</div>
          <button id="ob-btn-premium" class="ob-offer-btn ob-premium-btn" style="
            width: 100%;
            background: #0A8A6E;
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
    `;

    document.getElementById('ob-btn-free')?.addEventListener('click', () => {
      this.#userData.tier = 'free';
      this.#currentSlide++;
      this.#updateSlide();
    });

    document.getElementById('ob-btn-premium')?.addEventListener('click', () => {
      this.#userData.tier = 'premium-interested';
      this.#currentSlide++;
      this.#updateSlide();
    });
  }

  #renderFormSlide(slide, visualContent, backButton) {
    const isPremium = this.#userData.tier === 'premium-interested';

    this.#container.innerHTML = `
      <div class="ob-logo">DS</div>
      ${backButton}
      <div style="max-width: 450px; width: 100%; animation: obFadeInUp 0.6s ease-out;">
        <h2 style="color: #0A8A6E; margin-bottom: 0.5rem; font-size: 1.6rem;">${slide.title}</h2>
        <p style="color: #E8A33D; font-size: 0.9rem; font-style: italic; margin-bottom: 1.5rem;">${slide.titleMg}</p>

        <div style="width: 100%; background: white; padding: 1.5rem; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); text-align: left;">
          <label style="display:block; margin-bottom:0.5rem; font-weight:600; color:#334155; font-size:0.9rem;">Prénom</label>
          <input type="text" id="ob-input-firstname" class="ob-input" placeholder="Ovy" value="${this.#userData.firstName || ''}">

          <label style="display:block; margin-bottom:0.5rem; font-weight:600; color:#334155; font-size:0.9rem;">Nom</label>
          <input type="text" id="ob-input-lastname" class="ob-input" placeholder="Rakoto" value="${this.#userData.lastName || ''}">

          <label style="display:block; margin-bottom:0.5rem; font-weight:600; color:#334155; font-size:0.9rem;">Région</label>
          <select id="ob-select-region" class="ob-select">
            <option value="">Sélectionnez votre région</option>
            ${this.#regions.map(r => `<option value="${r}" ${this.#userData.region === r ? 'selected' : ''}>${r}</option>`).join('')}
          </select>

          <label style="display:block; margin-bottom:0.5rem; font-weight:600; color:#334155; font-size:0.9rem;">Statut</label>
          <select id="ob-select-status" class="ob-select">
            <option value="">Sélectionnez votre statut</option>
            <option value="student" ${this.#userData.status === 'student' ? 'selected' : ''}>Étudiant (Mpianatra)</option>
            <option value="worker" ${this.#userData.status === 'worker' ? 'selected' : ''}>Travailleur (Mpiasa)</option>
            <option value="other" ${this.#userData.status === 'other' ? 'selected' : ''}>Autre (Hafa)</option>
          </select>

          ${isPremium ? `
            <div style="margin-top: 1.5rem; padding: 1rem; background: #fef3c7; border-radius: 12px; border-left: 4px solid #E8A33D;">
              <div style="font-weight: 600; color: #92400e; margin-bottom: 0.5rem;">💳 Simulation Mobile Money</div>
              <div style="font-size: 0.85rem; color: #78350f;">Numéro de téléphone (simulation)</div>
              <input type="tel" id="ob-input-phone" class="ob-input" placeholder="034 XX XXX XX" value="${this.#userData.phone || ''}" style="margin-top: 0.5rem;">
              <div style="font-size: 0.75rem; color: #92400e; margin-top: 0.5rem;">
                ℹ️ Mode démo : Aucun paiement réel ne sera effectué
              </div>
            </div>
          ` : ''}

          <div style="display: flex; gap: 0.75rem; margin-top: 1rem;">
            ${isPremium ? `
              <button id="ob-btn-change-offer" class="ob-btn-secondary" style="flex: 1;">
                ← Changer d'offre
              </button>
            ` : ''}
            <button id="ob-btn-save-profile" class="ob-btn-primary" style="flex: 2;">
              Enregistrer et Continuer →
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('ob-btn-change-offer')?.addEventListener('click', () => {
      this.#currentSlide--; // Retour au slide d'offre
      this.#updateSlide();
    });

    document.getElementById('ob-btn-save-profile')?.addEventListener('click', () => {
      this.#userData.firstName = document.getElementById('ob-input-firstname').value.trim() || 'Utilisateur';
      this.#userData.lastName = document.getElementById('ob-input-lastname').value.trim() || '';
      this.#userData.region = document.getElementById('ob-select-region').value || '';
      this.#userData.status = document.getElementById('ob-select-status').value || '';

      if (isPremium) {
        this.#userData.phone = document.getElementById('ob-input-phone').value.trim() || '';
      }

      this.#currentSlide++;
      this.#updateSlide();
    });
  }

  #renderSetupSlide(slide, visualContent, backButton) {
    this.#container.innerHTML = `
      <div class="ob-logo">DS</div>
      ${backButton}
      <div style="max-width: 400px; width: 100%; animation: obFadeInUp 0.6s ease-out;">
        ${visualContent}
        <h2 style="color: #0A8A6E; margin-bottom: 0.5rem; font-size: 1.6rem;">${slide.title}</h2>
        <p style="color: #E8A33D; font-size: 0.9rem; font-style: italic; margin-bottom: 1.5rem;">${slide.titleMg}</p>
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
  }

  #renderCompleteSlide(slide, visualContent, backButton) {
    this.#container.innerHTML = `
      <div class="ob-logo">DS</div>
      ${backButton}
      <div style="max-width: 500px; width: 100%; animation: obFadeInUp 0.6s ease-out;">
        ${visualContent}
        <h2 style="color: #0A8A6E; margin-bottom: 0.5rem; font-size: 1.8rem;">${slide.title}</h2>
        <p style="color: #E8A33D; font-size: 0.95rem; font-style: italic; margin-bottom: 1rem;">${slide.titleMg}</p>
        <p style="color: #475569; font-size: 1.05rem; margin-bottom: 2rem; line-height: 1.5;">${slide.text}</p>
        <p style="color: #E8A33D; font-size: 0.9rem; font-style: italic; margin-bottom: 2rem; line-height: 1.5;">${slide.textMg}</p>
        <button id="ob-btn-start" class="ob-btn-primary" style="
          width: 100%;
          padding: 16px;
          font-size: 1.1rem;
        ">
          🚀 Démarrer l'application
        </button>
      </div>
    `;

    document.getElementById('ob-btn-start')?.addEventListener('click', () => {
      this.#finishOnboarding();
    });
  }

  #renderStandardSlide(slide, visualContent, backButton, isLast) {
    const skipButton = isLast ? '' : `
      <button id="ob-btn-skip" style="
        position: absolute;
        top: 24px;
        right: 20px;
        background: transparent;
        border: none;
        font-size: 0.9rem;
        cursor: pointer;
        color: #E8A33D;
        padding: 8px 16px;
        font-weight: bold;
        z-index: 101;
      ">Passer</button>
    `;

    this.#container.innerHTML = `
      <div class="ob-logo">DS</div>
      ${backButton}
      ${skipButton}
      <div style="max-width: 500px; width: 100%; animation: obFadeInUp 0.6s ease-out;">
        ${visualContent}
        <h2 style="color: #0A8A6E; margin-bottom: 0.5rem; font-size: 1.8rem;">${slide.title}</h2>
        <p style="color: #E8A33D; font-size: 0.95rem; font-style: italic; margin-bottom: 1rem;">${slide.titleMg}</p>
        <p style="color: #475569; font-size: 1.05rem; margin-bottom: 0.5rem; line-height: 1.5;">${slide.text}</p>
        <p style="color: #E8A33D; font-size: 0.9rem; font-style: italic; margin-bottom: 2rem; line-height: 1.5;">${slide.textMg}</p>
        <button id="ob-btn-next" class="ob-btn-primary" style="min-width: 200px;">
          ${slide.action} →
        </button>
        <div style="margin-top: 2rem; display: flex; gap: 0.5rem; justify-content: center;">
          ${this.#getProgressDots()}
        </div>
      </div>
    `;

    document.getElementById('ob-btn-next')?.addEventListener('click', () => {
      this.#currentSlide++;
      this.#updateSlide();
    });

    document.getElementById('ob-btn-skip')?.addEventListener('click', () => {
      this.#finishOnboarding();
    });
  }

  #getProgressDots() {
    const slides = this.#mode === 'update' ? this.#getUpdateSlides() : this.#getFirstLaunchSlides();
    return slides.map((_, i) => `
      <div style="
        width: ${i === this.#currentSlide ? '24px' : '8px'};
        height: 8px;
        border-radius: 4px;
        background: ${i === this.#currentSlide ? '#0A8A6E' : '#cbd5e1'};
        transition: all 0.3s;
      "></div>
    `).join('');
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

  #saveUserProfile() {
    const isPremium = this.#userData.tier === 'premium-interested';
    const profile = {
      firstName: this.#userData.firstName || 'Utilisateur',
      lastName: this.#userData.lastName || '',
      region: this.#userData.region || '',
      status: this.#userData.status || '',
      phone: this.#userData.phone || '',
      tier: isPremium ? 'premium' : 'free',
      isPremium: isPremium,
      createdAt: new Date().toISOString()
    };

    localStorage.setItem('dagospeak:userProfile', JSON.stringify(profile));

    if (isPremium) {
      localStorage.setItem('dagospeak:isPremium', 'true');
    }
  }

  #finishOnboarding() {
    this.#saveUserProfile();
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