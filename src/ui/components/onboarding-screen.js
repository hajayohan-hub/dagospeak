/**
 * OnboardingScreen - Page d'intro animée avec images 3D et icônes de langues flottantes
 */
export class OnboardingScreen {
  #container = null;
  #currentSlide = 0;
  #onComplete = null;
  #animationInterval = null;

  #slides = [
    {
      title: 'Manahoana ! Bienvenue sur DagoSpeak',
      subtitle: 'Votre professeur de français personnel',
      text: 'Apprenez à votre rythme, où que vous soyez, même sans internet.',
      image: '/assets/teacher-3d.png',
      action: 'Suivant',
      showLangIcons: true
    },
    {
      title: 'Écoutez, Parlez, Progressez',
      subtitle: 'Une méthode immersive et intelligente',
      text: 'Dialogues réels, tuteur vocal IA et correction en temps réel.',
      image: '/assets/user-pc-3d.png',
      image2: '/assets/user-mobile-3d.png',
      action: 'Suivant',
      showLangIcons: true
    },
    {
      title: 'Préparation du mode 100% Hors-ligne',
      subtitle: 'Téléchargement intelligent',
      text: 'Nous préparons le moteur vocal (~40 Mo). Cela ne se fera qu\'une seule fois !',
      image: '/assets/teacher-3d.png',
      action: 'Préparer mon espace',
      showLangIcons: false,
      isSetup: true
    }
  ];

  constructor() {
    // Constructeur vide - on attend show()
  }

  show(onCompleteCallback) {
    this.#onComplete = onCompleteCallback;
    this.#currentSlide = 0;
    this.#render();
  }

  #render() {
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
      overflow: hidden;
    `;

    document.body.appendChild(this.#container);
    this.#updateSlide();
  }

  #updateSlide() {
    const slide = this.#slides[this.#currentSlide];
    const isLast = this.#currentSlide === this.#slides.length - 1;

    // Injecter les styles d'animation une seule fois
    if (!document.getElementById('onboarding-animations')) {
      const style = document.createElement('style');
      style.id = 'onboarding-animations';
      style.innerHTML = `
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        @keyframes floatReverse {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(-5deg); }
        }
        @keyframes floatSlow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .lang-badge {
          position: absolute;
          background: white;
          padding: 8px 14px;
          border-radius: 16px;
          font-weight: 800;
          font-size: 1rem;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          color: var(--ds-color-primary, #2563eb);
          border: 2px solid #e0e7ff;
          z-index: 10;
        }
        .lang-1 { top: 15%; left: 10%; animation: float 4s ease-in-out infinite; }
        .lang-2 { top: 25%; right: 10%; animation: floatReverse 5s ease-in-out infinite 0.5s; }
        .lang-3 { bottom: 20%; left: 15%; animation: floatSlow 4.5s ease-in-out infinite 1s; }
        .lang-4 { bottom: 30%; right: 15%; animation: float 5.5s ease-in-out infinite 1.5s; }
        .lang-5 { top: 50%; left: 5%; animation: floatReverse 4s ease-in-out infinite 2s; }
        .lang-6 { top: 50%; right: 5%; animation: floatSlow 5s ease-in-out infinite 2.5s; }
        .hero-image {
          max-width: 280px;
          width: 100%;
          height: auto;
          animation: fadeInUp 0.8s ease-out, floatSlow 6s ease-in-out infinite;
          filter: drop-shadow(0 20px 40px rgba(0,0,0,0.15));
        }
        .hero-image-2 {
          max-width: 200px;
          width: 100%;
          height: auto;
          animation: fadeInUp 0.8s ease-out 0.2s backwards, float 5s ease-in-out infinite;
          filter: drop-shadow(0 15px 30px rgba(0,0,0,0.12));
        }
        .slide-title {
          animation: fadeInUp 0.6s ease-out 0.1s backwards;
        }
        .slide-subtitle {
          animation: fadeInUp 0.6s ease-out 0.2s backwards;
        }
        .slide-text {
          animation: fadeInUp 0.6s ease-out 0.3s backwards;
        }
        .slide-btn {
          animation: fadeInUp 0.6s ease-out 0.4s backwards;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .slide-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.4);
        }
        .slide-btn:active {
          transform: translateY(0);
        }
        .users-container {
          display: flex;
          justify-content: center;
          align-items: flex-end;
          gap: 1rem;
          position: relative;
        }
      `;
      document.head.appendChild(style);
    }

    // Contenu visuel (images + icônes de langues)
    let visualContent = '';

    if (slide.image2) {
      // Slide avec 2 utilisateurs
      visualContent = `
        <div class="users-container" style="position: relative; margin-bottom: 1rem;">
          ${slide.showLangIcons ? `
            <div class="lang-badge lang-1">🇫🇷 FR</div>
            <div class="lang-badge lang-2">🇬🇧 EN</div>
            <div class="lang-badge lang-3">🇬 MG</div>
            <div class="lang-badge lang-4">🇪🇸 ES</div>
            <div class="lang-badge lang-5">🇩🇪 DE</div>
            <div class="lang-badge lang-6">🇰🇷 KO</div>
          ` : ''}
          <img src="${slide.image}" alt="Utilisateur PC" class="hero-image"
               onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
          <div style="display:none; font-size: 6rem;">👨‍💻</div>
          <img src="${slide.image2}" alt="Utilisateur Mobile" class="hero-image-2"
               onerror="this.style.display='none';">
        </div>
      `;
    } else {
      // Slide avec une seule image
      visualContent = `
        <div style="position: relative; margin-bottom: 1rem;">
          ${slide.showLangIcons ? `
            <div class="lang-badge lang-1">🇫🇷 FR</div>
            <div class="lang-badge lang-2">🇬🇧 EN</div>
            <div class="lang-badge lang-3">🇬 MG</div>
            <div class="lang-badge lang-4">🇪🇸 ES</div>
            <div class="lang-badge lang-5">🇪 DE</div>
            <div class="lang-badge lang-6">🇰🇷 KO</div>
          ` : ''}
          <img src="${slide.image}" alt="${slide.title}" class="hero-image"
               onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
          <div style="display:none; font-size: 6rem; animation: pulse 2s ease-in-out infinite;">👩‍🏫</div>
        </div>
      `;
    }

    // Slide de setup ou slide normale
    if (slide.isSetup) {
      this.#container.innerHTML = `
        ${visualContent}
        <h2 class="slide-title" style="color: var(--ds-color-primary); margin-bottom: 0.5rem; font-size: 1.8rem;">
          ${slide.title}
        </h2>
        <p class="slide-subtitle" style="color: var(--ds-color-text-muted); font-size: 1rem; margin-bottom: 1rem; font-weight: 600;">
          ${slide.subtitle}
        </p>
        <p class="slide-text" style="color: var(--ds-color-text-muted); font-size: 1.05rem; margin-bottom: 2rem; line-height: 1.6; max-width: 400px;">
          ${slide.text}
        </p>
        <div id="setup-area" style="width: 100%; max-width: 350px;">
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
    } else {
      this.#container.innerHTML = `
        ${visualContent}
        <h2 class="slide-title" style="color: var(--ds-color-primary); margin-bottom: 0.5rem; font-size: 1.8rem;">
          ${slide.title}
        </h2>
        <p class="slide-subtitle" style="color: var(--ds-color-text-muted); font-size: 1rem; margin-bottom: 1rem; font-weight: 600;">
          ${slide.subtitle}
        </p>
        <p class="slide-text" style="color: var(--ds-color-text-muted); font-size: 1.05rem; margin-bottom: 2rem; line-height: 1.6; max-width: 400px;">
          ${slide.text}
        </p>
        <button class="slide-btn" id="btn-next-slide" style="
          background: linear-gradient(135deg, var(--ds-color-primary), var(--ds-color-accent));
          color: white;
          border: none;
          padding: 16px 40px;
          border-radius: 50px;
          font-weight: bold;
          font-size: 1.05rem;
          cursor: pointer;
          min-width: 220px;
          box-shadow: 0 4px 16px rgba(37, 99, 235, 0.3);
        ">
          ${slide.action} ${!isLast ? '→' : '🚀'}
        </button>
        <div style="margin-top: 2rem; display: flex; gap: 0.6rem; animation: fadeInUp 0.6s ease-out 0.5s backwards;">
          ${this.#slides.map((_, i) => `
            <div style="
              width: ${i === this.#currentSlide ? '24px' : '8px'};
              height: 8px;
              border-radius: 4px;
              background: ${i === this.#currentSlide ? 'var(--ds-color-primary)' : 'var(--ds-color-border)'};
              transition: all 0.3s ease;
            "></div>
          `).join('')}
        </div>
      `;

      const btnNext = document.getElementById('btn-next-slide');
      if (btnNext) {
        btnNext.addEventListener('click', () => {
          this.#currentSlide++;
          this.#updateSlide();
        });
      }
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

      await new Promise(r => setTimeout(r, 800));
      progressEl.style.width = '20%';
      detailEl.textContent = 'Sécurisation du stockage...';

      if (navigator.storage && navigator.storage.persist) {
        await navigator.storage.persist();
      }

      await new Promise(r => setTimeout(r, 1000));
      progressEl.style.width = '50%';
      detailEl.textContent = 'Téléchargement du moteur vocal (~40 Mo)...';

      await new Promise(r => setTimeout(r, 1500));
      progressEl.style.width = '80%';
      detailEl.textContent = 'Optimisation pour votre appareil...';

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
    progressEl.style.width = '100%';
    progressEl.style.background = 'var(--ds-color-success)';

    const isLowEnd = (navigator.deviceMemory || 4) < 4 || (navigator.hardwareConcurrency || 4) < 4;
    const isOnline = navigator.onLine;

    let offerTitle = '', offerDesc = '', offerPrice = '';

    if (isLowEnd) {
      offerTitle = '📱 DagoSpeak Lite (Recommandé)';
      offerDesc = 'Fonctionne 100% hors-ligne avec le moteur vocal léger. Idéal pour économiser votre batterie et vos données.';
      offerPrice = '9 000 Ar / mois';
    } else if (!isOnline) {
      offerTitle = ' DagoSpeak Standard';
      offerDesc = 'Moteur vocal local + synchronisation automatique de vos progrès dès que vous retrouvez une connexion.';
      offerPrice = '15 000 Ar / mois';
    } else {
      offerTitle = '🚀 DagoSpeak Premium Cloud';
      offerDesc = 'Reconnaissance vocale avancée par IA Cloud, dialogues illimités et correction grammaticale en temps réel.';
      offerPrice = '25 000 Ar / mois';
    }

    detailEl.innerHTML = `
      <div style="background: var(--ds-color-surface); padding: 1.5rem; border-radius: var(--ds-radius-lg); border: 2px solid var(--ds-color-primary); margin-top: 1rem; text-align: left;">
        <h3 style="color: var(--ds-color-primary); margin-bottom: 0.5rem;">${offerTitle}</h3>
        <p style="font-size: 0.9rem; color: var(--ds-color-text-muted); margin-bottom: 1rem;">${offerDesc}</p>
        <div style="font-size: 1.5rem; font-weight: bold; color: var(--ds-color-text); margin-bottom: 1rem;">${offerPrice}</div>
        <button id="btn-claim-offer" style="
          width: 100%;
          background: var(--ds-color-success);
          color: white;
          border: none;
          padding: 14px;
          border-radius: 12px;
          font-weight: bold;
          font-size: 1rem;
          cursor: pointer;
          margin-bottom: 0.5rem;
          transition: transform 0.2s;
        ">Choisir cette offre</button>
        <button id="btn-skip-offer" style="
          width: 100%;
          background: transparent;
          color: var(--ds-color-text-muted);
          border: 1px solid var(--ds-color-border);
          padding: 12px;
          border-radius: 12px;
          font-size: 0.9rem;
          cursor: pointer;
          transition: background 0.2s;
        ">Continuer gratuitement (Fonctions limitées)</button>
      </div>
    `;

    document.getElementById('btn-claim-offer').addEventListener('click', () => {
      alert('Redirection vers le paiement pour : ' + offerTitle + '\n(Intégration du gateway de paiement à venir)');
    });

    document.getElementById('btn-skip-offer').addEventListener('click', () => {
      this.#finishOnboarding();
    });
  }

  #finishOnboarding() {
    localStorage.setItem('dagospeak:onboardingComplete', 'true');
    if (this.#container) {
      this.#container.style.opacity = '0';
      this.#container.style.transition = 'opacity 0.5s ease';
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