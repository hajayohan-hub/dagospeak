/**
 * OnboardingScreen - Page d'intro animée avec setup intelligent et offres dynamiques.
 */
export class OnboardingScreen {
  #container = null;
  #currentSlide = 0;
  #onComplete = null;
  #slides = [
    {
      icon: '🇲🇬',
      title: 'Manahoana ! Bienvenue sur DagoSpeak',
      text: 'Apprenez le malgache à votre rythme, où que vous soyez, même sans internet.',
      action: 'Suivant'
    },
    {
      icon: '🎧',
      title: 'Écoutez, Parlez, Progressez',
      text: 'Une méthode immersive avec des dialogues réels et un tuteur vocal intelligent.',
      action: 'Suivant'
    },
    {
      icon: '📶',
      title: 'Préparation du mode 100% Hors-ligne',
      text: 'Nous allons télécharger le moteur de reconnaissance vocale (~40 Mo). Cela ne se fera qu\'une seule fois !',
      action: 'Préparer mon espace'
    }
  ];

  constructor(onCompleteCallback) {
    this.#onComplete = onCompleteCallback;
    this.#render();
  }

  #render() {
    this.#container = document.createElement('div');
    this.#container.id = 'onboarding-screen';
    this.#container.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: var(--ds-color-bg); z-index: 10000;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 2rem; text-align: center;
    `;
    this.#updateSlide();
    document.body.appendChild(this.#container);
  }

  #updateSlide() {
    const slide = this.#slides[this.#currentSlide];

    if (this.#currentSlide < 2) {
      // ✅ Slides 0 et 1 : Afficher le bouton "Suivant"
      this.#container.innerHTML = `
        <div style="font-size: 5rem; margin-bottom: 1rem;">${slide.icon}</div>
        <h2 style="color: var(--ds-color-primary); margin-bottom: 1rem;">${slide.title}</h2>
        <p style="color: var(--ds-color-text-muted); font-size: 1.1rem; margin-bottom: 2rem; line-height: 1.6;">${slide.text}</p>
        <ds-button id="btn-next-slide" size="lg" variant="primary" style="width: 100%; max-width: 300px;">
          ${slide.action} →
        </ds-button>
        <div style="margin-top: 2rem; display: flex; gap: 0.5rem;">
          ${this.#slides.map((_, i) => `
            <div style="width: 10px; height: 10px; border-radius: 50%; background: ${i === this.#currentSlide ? 'var(--ds-color-primary)' : 'var(--ds-color-border)'}; transition: background 0.3s;"></div>
          `).join('')}
        </div>
      `;

      // ✅ Attacher l'event listener UNIQUEMENT si le bouton existe
      const btnNext = document.getElementById('btn-next-slide');
      if (btnNext) {
        btnNext.addEventListener('click', () => {
          this.#currentSlide++;
          this.#updateSlide();
        });
      }
    } else {
      // ✅ Slide 2 : Afficher la zone de téléchargement
      this.#container.innerHTML = `
        <div style="font-size: 5rem; margin-bottom: 1rem;">${slide.icon}</div>
        <h2 style="color: var(--ds-color-primary); margin-bottom: 1rem;">${slide.title}</h2>
        <p style="color: var(--ds-color-text-muted); font-size: 1.1rem; margin-bottom: 2rem; line-height: 1.6;">${slide.text}</p>
        <div id="setup-area" style="width: 100%; max-width: 350px;">
          <div id="setup-status" style="margin-bottom: 1rem; font-weight: 600; color: var(--ds-color-text);">Vérification de l'appareil...</div>
          <div style="width: 100%; height: 12px; background: var(--ds-color-border); border-radius: 6px; overflow: hidden; margin-bottom: 1rem;">
            <div id="setup-progress" style="width: 0%; height: 100%; background: var(--ds-color-primary); transition: width 0.3s;"></div>
          </div>
          <p id="setup-detail" style="font-size: 0.85rem; color: var(--ds-color-text-muted);"></p>
        </div>
      `;

      // ✅ Démarrer le setup intelligent
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
          throw new Error('Espace insuffisant. Libérez environ 60 Mo pour activer le mode hors-ligne.');
        }
      }

      detailEl.textContent = 'Sécurisation du stockage...';
      if (navigator.storage && navigator.storage.persist) {
        await navigator.storage.persist();
      }

      detailEl.textContent = 'Téléchargement du moteur vocal (~40 Mo)...';
      progressEl.style.width = '10%';

      const progressHandler = (data) => {
        progressEl.style.width = `${data.percent}%`;
        detailEl.textContent = data.message;
      };

      window.DagoSpeak.bus.on('vosk:progress', progressHandler);
      await window.DagoSpeak.shadowing.preloadVoskModel();
      window.DagoSpeak.bus.off('vosk:progress', progressHandler);

      this.#showDynamicOffer();

    } catch (error) {
      statusEl.textContent = 'Configuration interrompue';
      statusEl.style.color = 'var(--ds-color-danger)';
      detailEl.textContent = error.message + ' Vous pourrez réessayer plus tard dans les paramètres.';
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
      offerTitle = '📶 DagoSpeak Standard';
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
        <ds-button id="btn-claim-offer" size="lg" variant="success" style="width: 100%;">Choisir cette offre</ds-button>
        <ds-button id="btn-skip-offer" size="md" variant="ghost" style="width: 100%; margin-top: 0.5rem;">Continuer gratuitement (Fonctions limitées)</ds-button>
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
    this.#container.style.opacity = '0';
    this.#container.style.transition = 'opacity 0.5s';
    setTimeout(() => {
      this.#container.remove();
      if (this.#onComplete) this.#onComplete();
    }, 500);
  }
}