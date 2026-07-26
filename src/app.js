// ═══════════════════════════════════════════════════════════
// IMPORTS
// ═══════════════════════════════════════════════════════════
import './ui/components/ds-button.js';
import './ui/components/ds-quiz.js';
import { EventBus }            from './core/event-bus.js';
import { Container }           from './core/container.js';
import { Logger }              from './core/logger.js';
import { DagoDB }              from './storage/dago-db.js';
import { ContentLoader }       from './data/content-loader.js';
import { Router }              from './business/router.js';
import { SRSEngine }           from './engines/learning/srs.js';
import { GamificationEngine }  from './engines/gamification/index.js';
import { ShadowingEngine }     from './engines/pronunciation/shadowing.js';
import { RoleManager }         from './business/roles.js';
import { PaymentGateway }      from './payments/gateway.js';
import { MobileMoneyProvider } from './payments/providers/mobile-money.js';
// Import des nouveaux modules IA
import { AIManager } from './engines/ai/ai-manager.js';
import { SpeechRecognitionEngine } from './engines/pronunciation/speech-recognition.js';
import { TeacherAvatar } from './ui/components/teacher-avatar.js';
import { DownloadProgress } from './ui/components/download-progress.js';
import { FeedbackSounds } from './engines/audio/feedback-sounds.js';
import { OnboardingScreen } from './ui/components/onboarding-screen.js';


// ═══════════════════════════════════════════════════════════
// SUIVI DE PROGRESSION DES PARCOURS
// ═══════════════════════════════════════════════════════════
const journeyTracker = {
  getCompletedJourneys() {
    const saved = localStorage.getItem('dagospeak:completedJourneys');
    return saved ? JSON.parse(saved) : { lessons: [], practices: [], dialogues: [], roleplays: [], challenges: [] };
  },

  markJourneyComplete(type, themeId) {
    const journeys = this.getCompletedJourneys();
    if (!journeys[type].includes(themeId)) {
      journeys[type].push(themeId);
      localStorage.setItem('dagospeak:completedJourneys', JSON.stringify(journeys));
    }
  },

  isJourneyComplete(type, themeId) {
    const journeys = this.getCompletedJourneys();
    return journeys[type].includes(themeId);
  },

  getCompletionStats() {
    const journeys = this.getCompletedJourneys();
    const totalTypes = 5; // lessons, practices, dialogues, roleplays, challenges
    const totalThemes = 5; // survival, numbers, family, market, colors
    const totalJourneys = totalTypes * totalThemes;
    const completedJourneys = Object.values(journeys).reduce((sum, arr) => sum + arr.length, 0);
    return { completedJourneys, totalJourneys, percentage: (completedJourneys / totalJourneys) * 100 };
  }
};

// ═══════════════════════════════════════════════════════════
// TRADUCTION DE L'INTERFACE (FR → MG)
// ═══════════════════════════════════════════════════════════
const i18n = {
  chooseAnswer: "Safidio ny valiny marina :",
  listen: "🔊 Hihaino",
  speak: "🎤 Mitenena (Shadowing)",
  speakNow: "🎙️ Mitenena izao...",
  stopRecording: "⏹️ Ajanony",
  nextQuestion: "Manaraka →",
  backToThemes: "← Hiverina amin'ny lohahevitra",
  listenFirst: "1. Mihainoa aloha",
  answerQuiz: "2. Safidio ny valiny",
  tryPronunciation: "3. Andramo tenenina (Fanazaran-tena)",
  yourScore: "Ny naoty azonao",
  mastery: "Fahaiza-manao",
  excellent: "Tena tsara!",
  good: "Tsara",
  keepTrying: "Miezaha indray"
};

// ═══════════════════════════════════════════════════════════
// INITIALISATION DU CORE
// ═══════════════════════════════════════════════════════════
const bus       = new EventBus();
const container = new Container();
const logger    = new Logger('App');
const db        = new DagoDB();
const content   = new ContentLoader();
const router    = new Router('/');

const srs          = new SRSEngine(db, bus);
const gamification = new GamificationEngine(db, bus);
const shadowing    = new ShadowingEngine(bus);

const feedbackSounds = new FeedbackSounds();
window.feedbackSounds = feedbackSounds;
const speechRecognition = new SpeechRecognitionEngine(bus);
const roleManager  = new RoleManager(db);
const aiManager = new AIManager(bus);



const paymentGateway = new PaymentGateway();
paymentGateway.register('mobile_money', new MobileMoneyProvider());

container.register('bus', () => bus);
container.register('logger', () => logger);
container.register('db', () => db);
container.register('content', () => content);
container.register('srs', () => srs);
container.register('gamification', () => gamification);
container.register('roles', () => roleManager);
container.register('speechRecognition', () => speechRecognition);
container.register('payments', () => paymentGateway);
container.register('ai', () => aiManager);

// Initialisation asynchrone de l'IA en arrière-plan (ne bloque pas le démarrage)
aiManager.initialize().catch(err => console.warn('Init AI échouée:', err));


// ✅ Barre de progression pour Vosk
const downloadProgress = new DownloadProgress();
window.downloadProgress = downloadProgress;

// Écouter les événements de progression Vosk
bus.on('vosk:progress', (data) => {
  downloadProgress.update(data.percent, data.message);
});

bus.on('vosk:ready', () => {
  downloadProgress.success('Moteur vocal prêt pour le mode hors-ligne !');
});

bus.on('vosk:error', (data) => {
  downloadProgress.error('Erreur: ' + data.error);
});
window.DagoSpeak = { bus, container, logger, db, content, router, srs, gamification, shadowing, roleManager, paymentGateway };

// ═══════════════════════════════════════════════════════════
// ÉTAT & THÈME
// ═══════════════════════════════════════════════════════════
let currentLevel = localStorage.getItem('dagospeak:level') || 'A0';
let currentTheme = null; // Stocke le thème sélectionné (ex: 'family', 'market')

// Fonction globale pour sélectionner un niveau depuis l'HTML
window.selectLevel = (levelId) => {
  currentLevel = levelId;
  currentTheme = null; // Réinitialise le thème
  localStorage.setItem('dagospeak:level', currentLevel);
  updateLevelUI();
  router.navigate('/themes');
};

function updateLevelUI() {
  document.querySelectorAll('.ds-level-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.level === currentLevel);
  });
}

document.getElementById('level-selector')?.addEventListener('click', (e) => {
  const btn = e.target.closest('.ds-level-btn');
  if (btn) {
    // 1. Mettre à jour l'état
    currentLevel = btn.dataset.level;
    currentTheme = null;
    localStorage.setItem('dagospeak:level', currentLevel);
    updateLevelUI();
    logger.info(`Niveau changé vers : ${currentLevel}`);

    // 2. FORCER le re-rendu immédiat de la page des thèmes
    // Cela contourne le problème du "hash inchangé" du routeur
    renderThemes();

    // 3. S'assurer que l'URL est correcte (sans déclencher de rechargement inutile)
    if (window.location.hash !== '#/themes') {
      window.location.hash = '/themes';
    }
  }
});

function initTheme() {
  const saved = localStorage.getItem('dagospeak:theme');
  const theme = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
}

document.getElementById('theme-toggle')?.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('dagospeak:theme', next);
  logger.info(`Thème basculé : ${next}`);
});

// ═══════════════════════════════════════════════════════════
// VUES
// ═══════════════════════════════════════════════════════════

async function renderHome() {
  const main = document.getElementById('app');
  main.innerHTML = '<div style="text-align:center; padding:2rem;">Mamakiana...</div>';

  try {
    await roleManager.init();
    const profile = await gamification.getProfile();
    const manifest = await content.loadManifest('fr');

    // ✅ Dictionnaire des Niveaux avec Icônes
    const levelInfo = {
      'A0': { icon: '🌱', fr: 'Débutant', mg: 'Mpianatra' },
      'A1': { icon: '', fr: 'Élémentaire', mg: 'Fototra' }
    };

    const levelsHtml = manifest.levels.map(level => {
      const info = levelInfo[level.id] || { icon: '📚', fr: level.title, mg: '' };
      const isFree = level.id === 'A0' || level.id === 'A1';
      const isUnlocked = isFree || profile.isPremium;

      return `
        <div style="background: ${isUnlocked ? 'var(--ds-color-surface)' : 'var(--ds-color-surface-2)'};
                    padding: 1.5rem; border-radius: var(--ds-radius-lg);
                    border: 1px solid ${isUnlocked ? 'var(--ds-color-border)' : 'var(--ds-color-text-disabled)'};
                    opacity: ${isUnlocked ? 1 : 0.7};
                    display: flex; flex-direction: column; gap: 1rem; cursor: pointer; transition: transform 0.2s;"
             class="btn-select-level" data-level="${level.id}"
             onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform='translateY(0)'">

          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:1rem;">
              <div style="font-size: 2.5rem;">${info.icon}</div>
              <div>
                <h3 style="margin:0; color: var(--ds-color-primary);">Ambaratonga ${level.id}</h3>
                <p style="margin:4px 0 0 0; font-size: 0.9rem; font-weight:600;">${info.fr}</p>
                <p style="margin:2px 0 0 0; font-size: 0.8rem; color: var(--ds-color-text-muted); font-style:italic;">(${info.mg})</p>
              </div>
            </div>
            ${!isUnlocked ? '<span style="font-size:1.5rem;">🔒</span>' : '<span style="font-size:1.5rem;">🔓</span>'}
          </div>
        </div>
      `;
    }).join('');

    main.innerHTML = `
      <section class="ds-home" style="padding: 1rem;">
        <div style="text-align:center; margin-bottom: 2rem;">
          <h1 style="font-size: 2rem; margin: 0 0 0.5rem 0;">Manahoana ! 👋</h1>
          <p style="font-size: 1.1rem; color: var(--ds-color-text-muted);">Safidio ny ambaratonga (Choisissez le niveau)</p>
        </div>
        <div id="levels-container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
          ${levelsHtml}
        </div>
      </section>
    `;

    // Écouteurs
    document.getElementById('levels-container').addEventListener('click', (e) => {
      const levelBtn = e.target.closest('.btn-select-level');
      if (levelBtn) {
        currentLevel = levelBtn.dataset.level;
        currentTheme = null;
        localStorage.setItem('dagospeak:level', currentLevel);
        updateLevelUI();
        router.navigate('/themes');
        return;
      }
    });

    window.teacherAvatar.show('home');
    renderFloatingHomeButtons();
    logger.info('✅ Page d\'accueil rendue (Niveaux)');

  } catch (e) {
    console.error('❌ Erreur renderHome:', e);
    main.innerHTML = `<p style="color:red; text-align:center; padding:2rem;">Hadisoana: ${e.message}</p>`;
  }
}


// ✅ NOUVELLE FONCTION : Sélecteur de langues (corrigé pour mobile)
function showLanguageSelector() {
  // Fermer si déjà ouvert
  const existingModal = document.getElementById('language-modal');
  if (existingModal) {
    existingModal.remove();
    return;
  }

  const languages = [
    { code: 'fr', name: 'Français', flag: '🇫', status: 'Actif' },
    { code: 'en', name: 'English', flag: '🇬', status: 'Bientôt' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪', status: 'Bientôt' },
    { code: 'es', name: 'Español', flag: '🇪', status: 'Bientôt' },
    { code: 'it', name: 'Italiano', flag: '🇹', status: 'Bientôt' },
    { code: 'ko', name: '한국어', flag: '', status: 'Bientôt' }
  ];

  const modal = document.createElement('div');
  modal.id = 'language-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.7);
    z-index: 10001;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.3s ease-out;
    padding: 1rem;
  `;

  modal.innerHTML = `
    <div style="
      background: var(--ds-color-surface);
      padding: 2rem;
      border-radius: var(--ds-radius-lg);
      max-width: 500px;
      width: 100%;
      max-height: 80vh;
      overflow-y: auto;
      animation: slideUp 0.3s ease-out;
      position: relative;
    ">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <h2 style="margin: 0; color: var(--ds-color-primary); font-size: 1.3rem;"> Safidio ny teny</h2>
        <button id="close-lang-modal" style="
          background: var(--ds-color-surface-2);
          border: none;
          border-radius: 50%;
          width: 36px;
          height: 36px;
          font-size: 1.5rem;
          cursor: pointer;
          color: var(--ds-color-text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
          flex-shrink: 0;
        " aria-label="Fermer">×</button>
      </div>
      <div style="display: grid; gap: 1rem;">
        ${languages.map(lang => `
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem;
            background: ${lang.code === 'fr' ? 'var(--ds-color-primary-soft)' : 'var(--ds-color-surface-2)'};
            border-radius: var(--ds-radius-md);
            border: ${lang.code === 'fr' ? '2px solid var(--ds-color-primary)' : '1px solid var(--ds-color-border)'};
            opacity: ${lang.status === 'Actif' ? '1' : '0.7'};
          ">
            <div style="display: flex; align-items: center; gap: 1rem;">
              <span style="font-size: 2rem;">${lang.flag}</span>
              <div>
                <div style="font-weight: 600; color: var(--ds-color-text);">${lang.name}</div>
                ${lang.code === 'fr' ? '<div style="font-size: 0.8rem; color: var(--ds-color-success);">✓ Langue actuelle</div>' : ''}
              </div>
            </div>
            <span style="
              padding: 4px 12px;
              border-radius: 20px;
              font-size: 0.8rem;
              background: ${lang.status === 'Actif' ? 'var(--ds-color-success)' : 'var(--ds-color-text-disabled)'};
              color: white;
            ">${lang.status}</span>
          </div>
        `).join('')}
      </div>
      <div style="margin-top: 1.5rem; padding: 1rem; background: var(--ds-color-primary-soft); border-radius: var(--ds-radius-md); text-align: center;">
        <p style="margin: 0; font-size: 0.9rem; color: var(--ds-color-text-muted);">
          🚧 Les autres langues seront disponibles prochainement !
        </p>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // ✅ BOUTON FERMER - Support mobile et desktop
  const closeBtn = document.getElementById('close-lang-modal');
  const closeModal = () => {
    modal.remove();
  };

  // Support clic
  closeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeModal();
  });

  // Support tactile
  closeBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeModal();
  });

  // Fermer en cliquant à l'extérieur
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // Empêcher la propagation sur le contenu
  modal.querySelector('div[style*="background: var(--ds-color-surface)"]').addEventListener('click', (e) => {
    e.stopPropagation();
  });
}

// ✅ PAGE À PROPOS AVEC 3 ONGLETS
async function renderAbout() {
  const main = document.getElementById('app');
  let currentTab = 'about';

  const renderTab = (tab) => {
    if (tab === 'about') {
      main.innerHTML = `
        <section style="max-width: 700px; margin: 0 auto; padding: 2rem 1rem;">
          <ds-button variant="ghost" size="sm" id="btn-back" style="margin-bottom: 1rem;">← Miverina (Retour)</ds-button>
          <h1 style="text-align: center; margin-bottom: 2rem;"> Mombamomba ny DagoSpeak</h1>

          <div style="background: var(--ds-color-surface); padding: 2rem; border-radius: var(--ds-radius-lg); box-shadow: var(--ds-shadow-md); margin-bottom: 2rem; text-align: center;">
            <img src="/assets/mds-logo.png" alt="Mada Digital Services" style="max-width: 200px; margin-bottom: 1rem; border-radius: var(--ds-radius-md);" />
            <h2 style="color: var(--ds-color-primary); margin-bottom: 1rem;">Propulsé par Web Services Mada</h2>
            <p style="line-height: 1.6; margin-bottom: 1rem;">
              DagoSpeak dia <strong>plateforme d'auto-apprentissage des langues assistée par IA</strong>, offline-first, pour les locuteurs Malgaches.
            </p>
            <p style="line-height: 1.6; margin-bottom: 1rem;">
              <strong>Première application à Madagascar</strong> conçue pour fonctionner sur les téléphones modestes, permettant l'apprentissage de plusieurs langues (Français, Anglais, Allemand, Espagnol, Italien, Coréen) avec un guidage complet pour transformer un utilisateur débutant en expert.
            </p>
            <div style="margin-top: 1.5rem; padding: 1rem; background: var(--ds-color-primary-soft); border-radius: var(--ds-radius-md);">
              <p style="margin: 0; font-size: 0.9rem;"><strong>Équipe :</strong> Web Services Mada de Mada Digital Services (MDS)</p>
              <a href="https://www.facebook.com/WebServicesMada" target="_blank" style="display: inline-block; margin-top: 0.5rem; color: var(--ds-color-primary); text-decoration: none; font-weight: 600;">
                👉 Visiter notre page Facebook
              </a>
            </div>
          </div>

          <div style="background: var(--ds-color-surface); padding: 2rem; border-radius: var(--ds-radius-lg); box-shadow: var(--ds-shadow-md); margin-bottom: 2rem;">
            <h2 style="color: var(--ds-color-primary); margin-bottom: 1rem;"> Caractéristiques</h2>
            <ul style="line-height: 1.8; padding-left: 1.5rem;">
              <li>✅ 100% Offline-first (fonctionne sans internet)</li>
              <li>✅ Reconnaissance vocale avec IA</li>
              <li>✅ Adapté aux téléphones modestes (2GB RAM)</li>
              <li>✅ Progression gamifiée (XP, niveaux, badges)</li>
              <li>✅ Contenu bilingue Français-Malgache</li>
              <li>✅ Certifications officielles (A2, B2, C2)</li>
            </ul>
          </div>

          <div style="background: var(--ds-color-surface); padding: 2rem; border-radius: var(--ds-radius-lg); box-shadow: var(--ds-shadow-md);">
            <h2 style="color: var(--ds-color-primary); margin-bottom: 1rem;">📱 Appareils Supportés</h2>
            <ul style="line-height: 1.8; padding-left: 1.5rem;">
              <li>Android 5.0+ (Chrome, Firefox)</li>
              <li>iOS 12+ (Safari)</li>
              <li>Chrome OS (Chromebook)</li>
              <li>Windows 10+ (Edge, Chrome)</li>
              <li>macOS 10.14+ (Safari, Chrome)</li>
            </ul>
          </div>
        </section>
      `;
    } else if (tab === 'offers') {
      main.innerHTML = `
        <section style="max-width: 700px; margin: 0 auto; padding: 2rem 1rem;">
          <ds-button variant="ghost" size="sm" id="btn-back" style="margin-bottom: 1rem;">← Miverina (Retour)</ds-button>
          <h1 style="text-align: center; margin-bottom: 2rem;">💰 Tolotra (Offres)</h1>

          <div style="display: grid; gap: 1.5rem;">
            <div style="background: var(--ds-color-surface); padding: 2rem; border-radius: var(--ds-radius-lg); border: 2px solid var(--ds-color-border);">
              <h3 style="color: var(--ds-color-text); margin-bottom: 0.5rem;">🆓 Version Gratuite</h3>
              <p style="color: var(--ds-color-text-muted); margin-bottom: 1rem;">Pour toujours</p>
              <ul style="line-height: 1.8; padding-left: 1.5rem; margin-bottom: 1rem;">
                <li>✅ Niveau A0 complet</li>
                <li>✅ 5 thèmes de base</li>
                <li>✅ Mode hors-ligne</li>
                <li>❌ Niveaux avancés (A1, A2, B1, B2, C1, C2)</li>
                <li>❌ IA de correction avancée</li>
              </ul>
              <div style="font-size: 1.5rem; font-weight: bold; color: var(--ds-color-text);">0 Ar / mois</div>
            </div>

            <div style="background: var(--ds-color-primary-soft); padding: 2rem; border-radius: var(--ds-radius-lg); border: 2px solid var(--ds-color-primary); position: relative;">
              <div style="position: absolute; top: -10px; right: 20px; background: var(--ds-color-accent); color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: bold;">POPULAIRE</div>
              <h3 style="color: var(--ds-color-primary); margin-bottom: 0.5rem;">⭐ Premium</h3>
              <p style="color: var(--ds-color-text-muted); margin-bottom: 1rem;">Abonnement mensuel</p>
              <ul style="line-height: 1.8; padding-left: 1.5rem; margin-bottom: 1rem;">
                <li>✅ Tous les niveaux (A0 à C2)</li>
                <li>✅ Une langue séléctionnée</li>
                <li>✅ IA de correction avancée</li>
                <li>✅ Certifications officielles</li>
                <li>✅ Support prioritaire</li>
              </ul>
              <div style="font-size: 1.5rem; font-weight: bold; color: var(--ds-color-primary);">15 000 Ar / mois</div>
              <ds-button size="lg" variant="primary" style="width: 100%; margin-top: 1rem;">Manomboka (Commencer)</ds-button>
            </div>

            <div style="background: var(--ds-color-surface); padding: 2rem; border-radius: var(--ds-radius-lg); border: 2px solid var(--ds-color-border);">
              <h3 style="color: var(--ds-color-text); margin-bottom: 0.5rem;"> Certification Uniquement</h3>
              <p style="color: var(--ds-color-text-muted); margin-bottom: 1rem;">Paiement unique</p>
              <ul style="line-height: 1.8; padding-left: 1.5rem; margin-bottom: 1rem;">
                <li>✅ Examen de certification A2, B2 ou C2</li>
                <li>✅ Certificat officiel PDF</li>
                <li>✅ Reconnaissance internationale</li>
              </ul>
              <div style="font-size: 1.5rem; font-weight: bold; color: var(--ds-color-text);">50 000 Ar / certification</div>
            </div>
          </div>
        </section>
      `;
    } else if (tab === 'certification') {
      main.innerHTML = `
        <section style="max-width: 700px; margin: 0 auto; padding: 2rem 1rem;">
          <ds-button variant="ghost" size="sm" id="btn-back" style="margin-bottom: 1rem;">← Miverina (Retour)</ds-button>
          <h1 style="text-align: center; margin-bottom: 2rem;"> Certificat (Certification)</h1>

          <div style="background: var(--ds-color-surface); padding: 2rem; border-radius: var(--ds-radius-lg); box-shadow: var(--ds-shadow-md); margin-bottom: 2rem;">
            <h2 style="color: var(--ds-color-primary); margin-bottom: 1rem;"> Niveaux de Certification</h2>
            <div style="display: grid; gap: 1rem;">
              <div style="padding: 1.5rem; background: var(--ds-color-success-soft); border-radius: var(--ds-radius-md); border-left: 4px solid var(--ds-color-success);">
                <h3 style="color: var(--ds-color-success); margin-bottom: 0.5rem;">A2 - Débutant</h3>
                <p style="font-size: 0.9rem; line-height: 1.6;">Capable de communiquer dans des situations simples du quotidien.</p>
              </div>
              <div style="padding: 1.5rem; background: var(--ds-color-accent-soft); border-radius: var(--ds-radius-md); border-left: 4px solid var(--ds-color-accent);">
                <h3 style="color: var(--ds-color-accent); margin-bottom: 0.5rem;">B2 - Intermédiaire</h3>
                <p style="font-size: 0.9rem; line-height: 1.6;">Capable de comprendre et participer à des conversations complexes.</p>
              </div>
              <div style="padding: 1.5rem; background: var(--ds-color-primary-soft); border-radius: var(--ds-radius-md); border-left: 4px solid var(--ds-color-primary);">
                <h3 style="color: var(--ds-color-primary); margin-bottom: 0.5rem;">C2 - Avancé</h3>
                <p style="font-size: 0.9rem; line-height: 1.6;">Maîtrise complète de la langue, niveau expert.</p>
              </div>
            </div>
          </div>

          <div style="background: var(--ds-color-primary-soft); padding: 2rem; border-radius: var(--ds-radius-lg); border: 1px solid var(--ds-color-primary);">
            <h3 style="color: var(--ds-color-primary); margin-bottom: 1rem;">📝 Comment obtenir votre certification ?</h3>
            <ol style="line-height: 1.8; padding-left: 1.5rem;">
              <li>Complétez tous les parcours du niveau souhaité</li>
              <li>Atteignez un score minimum de 80% aux révisions</li>
              <li>Passez l'examen de certification (50 000 Ar)</li>
              <li>Recevez votre certificat officiel par email</li>
            </ol>
          </div>
        </section>
      `;
    }

    // Ajouter les onglets de navigation
    const tabsHtml = `
  <div style="position: sticky; top: 70px; background: var(--ds-color-bg); padding: 0.75rem 0; border-bottom: 1px solid var(--ds-color-border); margin-bottom: 2rem; z-index: 100; box-shadow: var(--ds-shadow-sm);">
    <div style="display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap;">
      <ds-button variant="${currentTab === 'about' ? 'primary' : 'ghost'}" size="sm" data-tab="about" style="flex: 1; min-width: 90px; font-size: 0.8rem;">
        ℹ️ Info
      </ds-button>
      <ds-button variant="${currentTab === 'offers' ? 'primary' : 'ghost'}" size="sm" data-tab="offers" style="flex: 1; min-width: 90px; font-size: 0.8rem;">
        💰 Offres
      </ds-button>
      <ds-button variant="${currentTab === 'certification' ? 'primary' : 'ghost'}" size="sm" data-tab="certification" style="flex: 1; min-width: 90px; font-size: 0.8rem;">
         Certificat
      </ds-button>
    </div>
  </div>
`;

    main.innerHTML = tabsHtml + main.innerHTML;

    document.getElementById('btn-back').addEventListener('click', () => router.navigate('/'));
    document.querySelectorAll('[data-tab]').forEach(btn => {
      // Support clic
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        currentTab = btn.dataset.tab;
        renderTab(currentTab);
      });
      // Support tactile
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        currentTab = btn.dataset.tab;
        renderTab(currentTab);
      });
    });
  };

  renderTab('about');
}



// Fonction helper pour gérer l'upgrade Premium
async function handleUpgrade(btn, profile) {
  btn.setAttribute('loading', '');
  try {
    const result = await paymentGateway.checkout('premium_monthly', 'mobile_money');
    alert(result.message + `\nID: ${result.transactionId}`);
    profile.isPremium = true;
    await db.put('progress', profile);
    renderHome(); // Rafraîchir pour enlever les cadenas
  } catch (err) {
    alert('Erreur de paiement.');
    btn.removeAttribute('loading');
  }
}

async function renderLesson() {

  const main = document.getElementById('app');
  main.innerHTML = '<div style="text-align:center; padding:2rem;">Chargement de la leçon...</div>';

  // ✅ Afficher le header de progression flottant (uniquement hors accueil)
renderProgressHeader();
  // ✅ Synchroniser le profil après chaque parcours terminé
syncProfileWithJourneys();

  try {

    // À ajouter au début de chaque fonction de vue (sauf renderHome)
  const floatActions = document.getElementById('floating-home-actions');
  if (floatActions) floatActions.remove();

    const manifest = await content.loadManifest('fr');
    const levelData = manifest.levels.find(l => l.id === currentLevel);

    // ✅ VERROUILLAGE : On utilise strictement le thème sélectionné.
    // Fallback vers la 1ère unité du niveau seulement si currentTheme est vide (clic direct depuis le header).
    const unitId = currentTheme || levelData.units[0];
    currentTheme = unitId; // On sauvegarde pour cohérence

    const vocabData = await content.loadSection('fr', 'vocabulary', unitId);

    const themeNames = {
      'survival': 'Mots de survie', 'numbers': 'Les Nombres',
      'family': 'La Famille', 'market': 'Au Marché', 'colors': 'Les Couleurs'
    };
    const themeName = themeNames[unitId] || unitId;

    main.innerHTML = `
      <section style="max-width: 700px; margin: 0 auto; padding: 2rem 1rem;">
        <ds-button variant="ghost" size="sm" id="btn-back" style="margin-bottom: 1rem;">← Retour aux thèmes</ds-button>
        <div style="margin-bottom: 0.5rem;">
          <span style="background:var(--ds-color-accent); color:white; padding:4px 10px; border-radius:20px; font-weight:600; font-size:0.8rem;">Niveau ${currentLevel}</span>
        </div>
        <h2 style="margin-bottom: 0.5rem;">📖 Leçon : ${themeName}</h2>
        <p style="color:var(--ds-color-text-muted); margin-bottom: 2rem;">${vocabData.themeMg} • ${vocabData.items.length} mots à apprendre</p>

                <div style="display:grid; gap:1rem;">
          ${vocabData.items.map(item => `
            <div style="background:var(--ds-color-surface); padding:1.2rem; border-radius:var(--ds-radius-md); display:flex; justify-content:space-between; align-items:center; box-shadow:var(--ds-shadow-sm); border:1px solid var(--ds-color-border);">
              <div style="flex:1;">
                <strong style="font-size:1.2rem; color:var(--ds-color-primary);">${item.target}</strong>
                <!-- ✅ AFFICHAGE DE LA PHONÉTIQUE -->
                <span style="display:block; font-size:0.9rem; color:var(--ds-color-accent); font-family:monospace; margin: 4px 0; font-weight:600;">
                  [ ${item.phonetic || '...'} ]
                </span>
                <div style="font-size:0.9em; color:var(--ds-color-text-muted); font-style:italic; margin-top:8px; border-top:1px solid var(--ds-color-border); padding-top:8px;">
                  "${item.context}" <br>
                  <span style="font-size:0.85em; opacity:0.8;">(${item.contextTranslation})</span>
                </div>
              </div>
              <ds-button variant="primary" size="sm" class="play-audio" data-target="${item.target}" style="min-width: 90px; margin-left:1rem;">
                🔊 Mihainoa
              </ds-button>
            </div>
          `).join('')}
        </div>

        <div style="margin-top:2rem; text-align:center;">
          <ds-button id="btn-start-practice" size="lg" variant="success">🎯 Commencer la pratique de ce thème</ds-button>
        </div>
      </section>
    `;

    document.getElementById('btn-back').addEventListener('click', () => router.navigate('/themes'));

    // ✅ ALLUMAGE PROGRESSIF DES MOTS
        let currentWordIndex = 0;
        const wordButtons = document.querySelectorAll('.play-audio');
        if (wordButtons.length > 0) {
          // Allumer le premier mot
          wordButtons[0].classList.add('guide-active');
          wordButtons[0].style.animation = 'pulse-guide 2s infinite';

          wordButtons.forEach((btn, index) => {
            btn.addEventListener('click', () => {
              speechSynthesis.cancel();
              btn.textContent = '🔊 ...';
              const u = new SpeechSynthesisUtterance(btn.dataset.target);
              u.lang = 'fr-FR'; u.rate = 0.9;
              u.onend = () => {
                btn.textContent = '🔊 Mihainoa';
                btn.classList.remove('guide-active');
                btn.style.animation = 'none';

                // ✅ Allumer le mot suivant
                currentWordIndex = index + 1;
                if (currentWordIndex < wordButtons.length) {
                  wordButtons[currentWordIndex].classList.add('guide-active');
                  wordButtons[currentWordIndex].style.animation = 'pulse-guide 2s infinite';
                } else {
                  // ✅ Tous les mots écoutés : allumer le bouton de fin
                  const btnStartPractice = document.getElementById('btn-start-practice');
                  if (btnStartPractice) {
                    btnStartPractice.classList.add('guide-active');
                    btnStartPractice.style.animation = 'pulse-green 1.5s infinite';
                  }
                }
              };
              speechSynthesis.speak(u);
            });
          });
        }

        // ✅ TRADUCTION MALGACHE DU BOUTON DE FIN
        document.getElementById('btn-start-practice')?.addEventListener('click', () => {
          journeyTracker.markJourneyComplete('lessons', unitId);
          router.navigate('/practice');
        });

    document.getElementById('btn-start-practice')?.addEventListener('click', () => router.navigate('/practice'));

    window.teacherAvatar.show('lesson');

    logger.info(`✅ Page Leçon rendue pour le thème: ${unitId}`);

    setTimeout(() => {
      window.teacherAvatar.speak("Vous avez appris les mots de ce thème. Maintenant, cliquez sur Commencer la pratique pour tester vos connaissances !");
    }, 1000);


  } catch (e) {
    main.innerHTML = `<p style="color:red; text-align:center;">Erreur leçon: ${e.message}</p>`;
  }
}


// ═══════════════════════════════════════════════════════════
// HELPER TTS : Synthèse vocale avec gestion d'événements précise
// ═══════════════════════════════════════════════════════════
function speakWithFeedback(text, { onStart, onEnd, lang = 'fr-FR', rate = 0.9 } = {}) {
  speechSynthesis.cancel(); // Annule toute voix en cours

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = rate;

  let finished = false;

  utterance.onstart = () => {
    if (onStart) onStart();
  };

  utterance.onend = () => {
    if (finished) return;
    finished = true;
    if (onEnd) onEnd();
  };

  utterance.onerror = () => {
    if (finished) return;
    finished = true;
    if (onEnd) onEnd(); // Débloque quand même en cas d'erreur
  };

  speechSynthesis.speak(utterance);

  // 🔒 Sécurité : si onend ne se déclenche jamais (bug Chrome connu), on débloque après 10s
  setTimeout(() => {
    if (!finished) {
      finished = true;
      if (onEnd) onEnd();
    }
  }, 10000);
}

// ═══════════════════════════════════════════════════════════
// PRÉCHAUFFAGE TTS : Élimine la latence au premier clic
// ═══════════════════════════════════════════════════════════
function warmUpTTS() {
  if ('speechSynthesis' in window) {
    const warmup = new SpeechSynthesisUtterance('');
    warmup.volume = 0;
    speechSynthesis.speak(warmup);
    console.log('[TTS] Préchauffage effectué');
  }
}
// Appel au démarrage
window.addEventListener('load', warmUpTTS);

async function renderPractice() {
  const main = document.getElementById('app');
  main.innerHTML = '<div style="text-align:center; padding:2rem;">Miomana ny session...</div>';

  // ✅ Afficher le header de progression flottant (uniquement hors accueil)
renderProgressHeader();
  // ✅ Synchroniser le profil après chaque parcours terminé
syncProfileWithJourneys();

  try {
    // ✅ Supprimer les boutons flottants de l'accueil
    const floatActions = document.getElementById('floating-home-actions');
    if (floatActions) floatActions.remove();


    const manifest = await content.loadManifest('fr');
    const levelData = manifest.levels.find(l => l.id === currentLevel);
    const unitId = currentTheme || levelData.units[0];
    currentTheme = unitId;
    const vocabData = await content.loadSection('fr', 'vocabulary', unitId);

    // Mélanger les items pour la session
    const sessionQueue = [...vocabData.items].sort(() => Math.random() - 0.5);
    let currentIndex = 0;
    let themeScore = 0;
    let maxPossibleScore = sessionQueue.length * 15;
    let shadowEvalHandler = null;
    let currentCorrectAnswer = "";
    let quizAnswered = false;

    // Ajouter le style pulse-guide si pas déjà présent
    if (!document.getElementById('pulse-guide-style')) {
      const style = document.createElement('style');
      style.id = 'pulse-guide-style';
      style.innerHTML = `
        @keyframes pulse-guide {
          0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); transform: scale(1); }
          70% { box-shadow: 0 0 0 8px rgba(59, 130, 246, 0); transform: scale(1.03); }
          100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); transform: scale(1); }
        }
        @keyframes pulse-green {
          0% { transform: scale(0.98); box-shadow: 0 0 0 0 rgba(47, 158, 68, 0.7); }
          70% { transform: scale(1.02); box-shadow: 0 0 0 10px rgba(47, 158, 68, 0); }
          100% { transform: scale(0.98); box-shadow: 0 0 0 0 rgba(47, 158, 68, 0); }
        }
        .guide-active {
          animation: pulse-guide 2s infinite !important;
          border: 2px solid var(--ds-color-primary) !important;
        }
      `;
      document.head.appendChild(style);
    }

    const renderQuestion = (index) => {
      if (index >= sessionQueue.length) {
        renderSessionComplete();
        return;
      }

      shadowing.forceStop();
      speechSynthesis.cancel();
      if (shadowEvalHandler) {
        bus.off('pronunciation:evaluated', shadowEvalHandler);
        shadowEvalHandler = null;
      }

      quizAnswered = false;
      const itemData = sessionQueue[index];
      const progressPercent = (index / sessionQueue.length) * 100;

      let questionText = "";
      let options = [];

      if (itemData.quizType === "mg_to_fr") {
        questionText = `Comment dit-on "<strong>${itemData.source}</strong>" en français ?`;
        currentCorrectAnswer = itemData.target;
        const pool = vocabData.items.filter(i => i.id !== itemData.id && i.target).map(i => i.target);
        options = [currentCorrectAnswer, ...pool.sort(() => Math.random() - 0.5).slice(0, 2)];
      } else {
        questionText = `Que signifie "<strong>${itemData.target}</strong>" en malgache ?`;
        currentCorrectAnswer = itemData.source;
        const pool = vocabData.items.filter(i => i.id !== itemData.id && i.source).map(i => i.source);
        options = [currentCorrectAnswer, ...pool.sort(() => Math.random() - 0.5).slice(0, 2)];
      }

      options = [...new Set(options.filter(opt => opt && opt.trim() !== ""))];
      while (options.length < 3) options.push("Valiny fanampiny");
      options = options.sort(() => Math.random() - 0.5);

      main.innerHTML = `
        <section style="max-width: 600px; margin: 0 auto; padding: 2rem 1rem; padding-top: 1rem;">
          <div style="background:var(--ds-color-border); height:8px; border-radius:4px; margin-bottom:1rem; overflow:hidden;">
            <div style="background:var(--ds-color-primary); height:100%; width:${progressPercent}%; transition: width 0.3s ease;"></div>
          </div>

          <div style="display:flex; justify-content:space-between; margin-bottom:1rem; align-items:center;">
            <ds-button variant="ghost" size="sm" id="btn-back-practice">← Hiverina (Retour)</ds-button>
            <span style="font-weight:600; color:var(--ds-color-text-muted);">
              Fanazaran-tena ${index + 1} / ${sessionQueue.length}
            </span>
          </div>

          <div style="text-align:center; margin-bottom:1rem;">
            <span style="background:var(--ds-color-primary); color:white; padding:4px 12px; border-radius:20px; font-weight:600; font-size:0.8rem;">
              🎯 Fanazaran-tena (Révisions) • ${unitId}
            </span>
          </div>

          <h2 style="text-align:center; margin-bottom:1.5rem; font-size:1.3rem;">${questionText}</h2>

          <div style="display:flex; flex-direction:column; gap:1rem;">
            <!-- ÉTAPE 1 : Écoute -->
            <div id="step-listen" class="guide-active" style="text-align:center; padding:1rem; background:var(--ds-color-surface-2); border-radius:var(--ds-radius-md);">
              <div style="font-size:0.75rem; text-transform:uppercase; color:var(--ds-color-text-muted); margin-bottom:0.5rem;">
                Étape 1 : Hihainoa (Écoutez)
              </div>
              <ds-button variant="primary" size="md" id="btn-listen" class="guide-active">🔊 Hihainoa (Écouter)</ds-button>
            </div>

            <!-- ÉTAPE 2 : Quiz -->
            <div id="step-quiz" style="text-align:center; padding:1rem; background:var(--ds-color-surface-2); border-radius:var(--ds-radius-md); opacity:0.5; pointer-events:none; transition:all 0.3s;">
              <div style="font-size:0.75rem; text-transform:uppercase; color:var(--ds-color-text-muted); margin-bottom:0.5rem;">
                Étape 2 : Valio (Répondez)
              </div>
              <ds-quiz id="active-quiz" item-id="${itemData.id}" options="${JSON.stringify(options).replace(/"/g, '&quot;')}" correct="${currentCorrectAnswer}"></ds-quiz>
            </div>

            <!-- ÉTAPE 3 : Shadowing -->
            <div id="step-shadow" style="text-align:center; padding:1rem; background:var(--ds-color-primary-soft); border-radius:var(--ds-radius-md); border: 1px dashed var(--ds-color-primary); opacity:0.5; pointer-events:none; transition:all 0.3s;">
              <div style="font-size:0.75rem; text-transform:uppercase; color:var(--ds-color-primary); margin-bottom:0.5rem; font-weight:bold;">
                Étape 3 : Mitenena (Prononcez)
              </div>
              <ds-button variant="primary" size="lg" id="btn-shadow" class="guide-active">🎤 Mitenena izao (Parler maintenant)</ds-button>
              <div id="shadow-feedback" style="margin-top:0.75rem; font-size:0.9rem; font-weight:600; min-height:1.5em;"></div>
            </div>

            <!-- Bouton Suivant -->
            <div id="step-next" style="text-align:center; margin-top:0.5rem; opacity:0.5; pointer-events:none; transition:all 0.3s;">
              <ds-button id="btn-next" disabled variant="success" size="lg" style="width:100%;">
                Manaraka → (Suivant)
              </ds-button>
            </div>
          </div>
        </section>
      `;

      // --- GESTION DES ÉVÉNEMENTS ---
      document.getElementById('btn-back-practice').addEventListener('click', () => {
        shadowing.forceStop();
        speechSynthesis.cancel();
        router.navigate('/theme-detail');
      });

      const stepQuiz = document.getElementById('step-quiz');
      const stepShadow = document.getElementById('step-shadow');
      const btnNext = document.getElementById('btn-next');
      const unlockNext = () => {
        btnNext.disabled = false;
        btnNext.removeAttribute('disabled');
        document.getElementById('step-next').style.opacity = '1';
        document.getElementById('step-next').style.pointerEvents = 'auto';
        btnNext.style.animation = "pulse-green 1.5s infinite";
      };

      // ÉTAPE 1 : Écoute
      document.getElementById('btn-listen').addEventListener('click', () => {
        const btnListen = document.getElementById('btn-listen');
        const originalText = btnListen.textContent;

        speakWithFeedback(itemData.target, {
          onStart: () => {
            btnListen.textContent = '🔊 ...';
            btnListen.classList.remove('guide-active');
            document.getElementById('step-listen').classList.remove('guide-active');
          },
          onEnd: () => {
            btnListen.textContent = originalText;
            stepQuiz.style.opacity = '1';
            stepQuiz.style.pointerEvents = 'auto';
            document.getElementById('active-quiz').classList.add('guide-active');
          }
        });
      });

      // ÉTAPE 2 : Quiz avec intervention de l'Avatar
      const quizEl = document.getElementById('active-quiz');
      quizEl.addEventListener('quiz:answered', async (e) => {
        if (quizAnswered) return;
        quizAnswered = true;

        await srs.schedule(e.detail.itemId, e.detail.isCorrect ? 4 : 1);

        // Dans le handler quiz:answered
          if (e.detail.isCorrect) {
            quizEl.classList.add('correct-answer');
            setTimeout(() => quizEl.classList.remove('correct-answer'), 500);
          } else {
            quizEl.classList.add('wrong-answer');
            setTimeout(() => quizEl.classList.remove('wrong-answer'), 400);
          }

        if (e.detail.isCorrect) {
          themeScore += 10;
          await gamification.addXP(10, 'Quiz réussi');
          if (typeof feedbackSounds !== 'undefined') feedbackSounds.playSuccess();
          // L'Avatar félicite
          setTimeout(() => window.teacherAvatar.speak("Excellent !"), 500);
        } else {
          if (typeof feedbackSounds !== 'undefined') feedbackSounds.playRetry();
          // L'Avatar corrige automatiquement
          setTimeout(() => {
            window.teacherAvatar.speak(`Faux. La bonne réponse est : ${currentCorrectAnswer}`);
          }, 500);
        }

        stepQuiz.classList.remove('guide-active');
        stepShadow.style.opacity = '1';
        stepShadow.style.pointerEvents = 'auto';
        document.getElementById('btn-shadow').classList.add('guide-active');
        checkCompletion();
      });

      // ÉTAPE 3 : Shadowing
      const btnShadow = document.getElementById('btn-shadow');
      const shadowFeedback = document.getElementById('shadow-feedback');
      let isRecording = false;

      btnShadow.addEventListener('click', () => {
        if (isRecording) {
          shadowing.forceStop();
          isRecording = false;
          btnShadow.textContent = '🎤 Mitenena izao (Parler maintenant)';
          return;
        }

        btnShadow.setAttribute('disabled', '');
        btnShadow.textContent = '🎙️ Mandre... (Écoute en cours)';
        shadowFeedback.innerHTML = '<span style="color:var(--ds-color-accent);">Mitenena izao... (Je vous écoute...)</span>';
        isRecording = true;
        shadowing.startRecording();
      });

      shadowEvalHandler = (data) => {
        isRecording = false;
        btnShadow.removeAttribute('disabled');

        if (data.error === 'not_supported') {
          shadowFeedback.innerHTML = '<span style="color:var(--ds-color-danger);">⚠️ Tsy mandeha ny mikrô</span>';
          btnShadow.textContent = '🎤 Mitenena izao';
          unlockNext();
          return;
        }

        if (data.transcript) {
          const similarity = calculateSimilarity(data.transcript.toLowerCase(), itemData.target.toLowerCase());

          if (similarity > 0.60) {
            if (typeof feedbackSounds !== 'undefined') feedbackSounds.playSuccess();
            shadowFeedback.innerHTML = `<span style="color:var(--ds-color-success);">✅ Tena tsara ! (Très bien !)</span>`;
            btnShadow.textContent = '✅ Vita';
            gamification.addXP(5, 'Shadowing - excellente prononciation');
            document.getElementById('btn-shadow').classList.remove('guide-active');
            unlockNext();
          } else if (similarity > 0.40) {
            if (typeof feedbackSounds !== 'undefined') feedbackSounds.playSuccess();
            shadowFeedback.innerHTML = `<span style="color:var(--ds-color-success);">✅ Tsara ! (Bien !)</span>`;
            btnShadow.textContent = '✅ Vita';
            gamification.addXP(3, 'Shadowing - bonne prononciation');
            document.getElementById('btn-shadow').classList.remove('guide-active');
            unlockNext();
          } else {
            if (typeof feedbackSounds !== 'undefined') feedbackSounds.playRetry();
            shadowFeedback.innerHTML = `<span style="color:var(--ds-color-accent);">🔄 Havereno (À répéter)</span>`;
            btnShadow.textContent = ' Mitenena indray (Réessayer)';
          }
        } else {
          shadowFeedback.innerHTML = '<span style="color:var(--ds-color-text-muted);">⚠️ Tsy re ny feo</span>';
          btnShadow.textContent = '🎤 Mitenena izao';
        }
      };

      bus.on('pronunciation:evaluated', shadowEvalHandler);

      // Bouton Suivant
      btnNext.addEventListener('click', () => {
        if (shadowEvalHandler) {
          bus.off('pronunciation:evaluated', shadowEvalHandler);
          shadowEvalHandler = null;
        }
        currentIndex++;
        renderQuestion(currentIndex);
      });
    };

    const checkCompletion = () => {
      // Vérifier si toutes les étapes sont complétées
      const quizAnswered = document.getElementById('active-quiz')?.dataset.answered === 'true';
      const shadowDone = document.getElementById('btn-shadow')?.textContent.includes('✅');

      if (quizAnswered && shadowDone) {
        unlockNext();
      }
    };

    const renderSessionComplete = async () => {
      if (shadowEvalHandler) {
        bus.off('pronunciation:evaluated', shadowEvalHandler);
        shadowEvalHandler = null;
      }

      if (typeof feedbackSounds !== 'undefined') feedbackSounds.playCelebration();
      await gamification.addXP(50, 'Session de révision terminée');
      journeyTracker.markJourneyComplete('practices', unitId);

      // Voix du Teacher Avatar pour féliciter
      setTimeout(() => {
        window.teacherAvatar.speak("Félicitations ! Vous avez terminé la session de révision. Passons aux dialogues maintenant !");
      }, 800);

      main.innerHTML = `
        <section style="max-width: 600px; margin: 0 auto; padding: 2rem 1rem; text-align:center;">
          <div style="font-size:4rem; margin-bottom:1rem;">🎯</div>
          <h2 style="color:var(--ds-color-success);">Fanazaran-tena Vita ! (Révisions terminées)</h2>
          <p style="color:var(--ds-color-text-muted); margin-bottom:0.5rem;">
            Vous avez complété la session de révision pour "${unitId}".
          </p>
          <p style="color:var(--ds-color-accent); font-weight:bold; margin-bottom:2rem;">
            Score : ${themeScore} / ${maxPossibleScore} XP
          </p>

          <div style="background:var(--ds-color-primary-soft); padding:1.5rem; border-radius:var(--ds-radius-lg); border:1px solid var(--ds-color-primary); margin-bottom:1.5rem;">
            <h3 style="color:var(--ds-color-primary); margin-bottom:0.5rem;"> Vonona ho an'ny Resaka ? (Prêt pour les Dialogues ?)</h3>
            <p style="color:var(--ds-color-text-muted); font-size:0.9rem; margin-bottom:1rem;">
              Maintenant, pratiquez avec des conversations réelles !
            </p>
            <ds-button id="btn-go-dialogues" size="lg" variant="success" class="guide-active" style="width:100%;">
              Manomboka ny Resaka → (Commencer les Dialogues)
            </ds-button>
          </div>

          <ds-button id="btn-back-themes" variant="ghost" size="sm" style="width:100%;">
            ← Hiverina amin'ny lohahevitra (Retour aux thèmes)
          </ds-button>
        </section>
      `;

      document.getElementById('btn-go-dialogues').addEventListener('click', () => router.navigate('/dialogues'));
      document.getElementById('btn-back-themes').addEventListener('click', () => router.navigate('/themes'));
    };

    renderQuestion(currentIndex);
    window.teacherAvatar.show('practice');
    logger.info(`✅ Session de révision démarrée pour le thème: ${unitId}`);

  } catch (error) {
    console.error('❌ Erreur renderPractice:', error);
    main.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--ds-color-danger);">
      <p>Hadisoana: ${error.message}</p>
      <ds-button onclick="location.hash='/themes'">Hiverina</ds-button>
    </div>`;
  }
}


async function renderDialogues() {

  const main = document.getElementById('app');
  main.innerHTML = '<div style="text-align:center; padding:2rem;">Chargement des dialogues...</div>';

  // ✅ Afficher le header de progression flottant (uniquement hors accueil)
renderProgressHeader();
  // ✅ Synchroniser le profil après chaque parcours terminé
syncProfileWithJourneys();

  try {

    // À ajouter au début de chaque fonction de vue (sauf renderHome)
    const floatActions = document.getElementById('floating-home-actions');
    if (floatActions) floatActions.remove();

    const manifest = await content.loadManifest('fr');
    const levelData = manifest.levels.find(l => l.id === currentLevel);

    // Verrouillage sur le thème choisi
    const unitId = currentTheme || levelData.units[0];
    currentTheme = unitId;

    const dialogueId = `${unitId}_dialogue`;
    console.log(`[DEBUG] Tentative de chargement du dialogue : ${dialogueId}`);

    const dialogue = await content.loadSection('fr', 'dialogues', dialogueId);

    const themeNames = {
      'survival': 'Mots de survie', 'numbers': 'Les Nombres',
      'family': 'La Famille', 'market': 'Au Marché', 'colors': 'Les Couleurs'
    };
    const themeName = themeNames[unitId] || unitId;

    let chatHtml = dialogue.lines.map(line => {
      const speaker = dialogue.participants[line.speaker];
      const isMe = line.speaker === 'B';
      return `
        <div style="display:flex; flex-direction:column; align-items:${isMe ? 'flex-end' : 'flex-start'}; margin-bottom: 1.5rem;">
          <div style="background:${isMe ? 'var(--ds-color-primary)' : 'var(--ds-color-surface-2)'}; color:${isMe ? 'white' : 'var(--ds-color-text)'}; padding: 12px 16px; border-radius: ${isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px'}; max-width: 85%; box-shadow: var(--ds-shadow-sm);">
            <div style="font-size:0.8em; opacity:0.7; margin-bottom:4px;">${speaker.avatar} ${speaker.name}</div>
            <div style="font-size:1.05rem; font-weight:500;">${line.text}</div>
            <div style="font-size:0.85em; opacity:0.8; margin-top:4px; font-style:italic;">${line.translation}</div>
          </div>
          <ds-button variant="ghost" size="sm" class="play-dialog-audio" data-text="${line.text}" style="margin-top:4px; min-height:28px; padding:4px 8px;">🔊 Écouter</ds-button>
        </div>
      `;
    }).join('');

    main.innerHTML = `
      <section style="max-width: 600px; margin: 0 auto; padding: 2rem 1rem;">
        <ds-button variant="ghost" size="sm" id="btn-back" style="margin-bottom: 1rem;">← Retour aux thèmes</ds-button>

        <div style="text-align:center; margin-bottom:1.5rem;">
          <span style="background:var(--ds-color-accent); color:white; padding:4px 10px; border-radius:20px; font-weight:600; font-size:0.8rem;">
            Niveau ${currentLevel} • ${themeName}
          </span>
        </div>

        <h2 style="text-align:center; margin-bottom:0.5rem;">💬 ${dialogue.title}</h2>
        <p style="text-align:center; color:var(--ds-color-text-muted); margin-bottom:2rem;">${dialogue.titleMg}</p>

        <div style="background:var(--ds-color-bg); padding:1.5rem; border-radius:var(--ds-radius-lg); border:1px solid var(--ds-color-border);">
          ${chatHtml}
        </div>

        <!-- ✅ NOUVEAU FLUX : Dialogues → Role Play → Défi -->
                <div style="margin-top: 2rem; display: flex; flex-direction: column; gap: 0.75rem; text-align: center;">
          <ds-button id="btn-go-roleplay" size="lg" variant="primary" class="guide-active" style="width: 100%;">
            🎭 Role Play Guidé (miaraka amin'ny valiny / avec réponses)
          </ds-button>
          <ds-button id="btn-restart-practice" size="md" variant="ghost" style="width: 100%;">
            🔄 Averina ny fanadiniana (Refaire les révisions)
          </ds-button>
          <ds-button id="btn-dialogue-next" size="md" variant="ghost" style="width: 100%;">
            ← Hiverina amin'ny lohahevitra (Retour aux thèmes)
          </ds-button>
        </div>
      </section>
    `;

    // Écouteurs d'événements
    document.getElementById('btn-back').addEventListener('click', () => router.navigate('/themes'));

    document.getElementById('btn-go-roleplay').addEventListener('click', () => {
      router.navigate('/roleplay');
    });

    document.getElementById('btn-restart-practice').addEventListener('click', () => {
      router.navigate('/practice');
    });

    document.getElementById('btn-dialogue-next').addEventListener('click', () => {
      router.navigate('/themes');
    });

    document.querySelectorAll('.play-dialog-audio').forEach(btn => {
      btn.addEventListener('click', () => {
        const originalText = btn.textContent;
        speakWithFeedback(btn.dataset.text, {
          onStart: () => { btn.textContent = '🔊 ...'; },
          onEnd: () => { btn.textContent = originalText; }
        });
      });
    });

    logger.info(`✅ Page Dialogues rendue pour le thème: ${unitId}`);

    journeyTracker.markJourneyComplete('dialogues', unitId);

    window.teacherAvatar.show('dialogues');

        // ✅ Voix du Teacher Avatar pour guider vers le Role Play
    setTimeout(() => {
      window.teacherAvatar.speak("Vous avez lu le dialogue. Maintenant, cliquez sur Role Play Guidé pour le jouer vous-même !");
    }, 1000);

  } catch (e) {
    console.error('❌ Erreur renderDialogues:', e);
    main.innerHTML = `
      <div style="text-align:center; padding:2rem; color:var(--ds-color-danger);">
        <p style="margin-bottom: 1rem; font-weight:bold;">Aucun dialogue trouvé pour ce thème.</p>
        <p style="font-size:0.9rem; margin-bottom: 1.5rem;">Détail : ${e.message}</p>
        <ds-button onclick="location.hash='/themes'" style="margin-top:1rem;">Retour aux thèmes</ds-button>
      </div>
    `;
  }
}

// ═══════════════════════════════════════════════════════════
// VUE : ROLE PLAY GUIDÉ (L'utilisateur joue avec les réponses visibles)
// ═══════════════════════════════════════════════════════════
async function renderRolePlay() {
  const main = document.getElementById('app');
  main.innerHTML = '<div style="text-align:center; padding:2rem;">Mamakiana ny Role Play...</div>';

  renderProgressHeader();
  // ✅ Synchroniser le profil après chaque parcours terminé
  syncProfileWithJourneys();

  try {
    const unitId = currentTheme;
    if (!unitId) {
      router.navigate('/themes');
      return;
    }

    const dialogue = await content.loadSection('fr', 'dialogues', `${unitId}_dialogue`);
    const themeNames = {
      'survival': 'Mots de survie', 'numbers': 'Les Nombres',
      'family': 'La Famille', 'market': 'Au Marché', 'colors': 'Les Couleurs'
    };
    const themeName = themeNames[unitId] || unitId;

    let currentLineIndex = 0;
    let shadowEvalHandler = null;

    // ✅ FONCTION SÉPARÉE (pas à l'intérieur de renderLine)
    const renderRolePlayComplete = async () => {
      if (shadowEvalHandler) {
        bus.off('pronunciation:evaluated', shadowEvalHandler);
        shadowEvalHandler = null;
      }

      await gamification.addXP(30, 'Role Play Guidé terminé');

      // ✅ Voix française de félicitation
      setTimeout(() => {
        window.teacherAvatar.speak("Très bien ! Vous avez terminé le Role Play Guidé. Maintenant, passez au Défi pour tester votre mémoire !");
      }, 800);

      main.innerHTML = `
        <section style="max-width: 600px; margin: 0 auto; padding: 2rem 1rem; text-align:center;">
          <div style="font-size:4rem; margin-bottom:1rem;">🎭</div>
          <h2 style="color:var(--ds-color-accent);">Role Play Vita ! (Terminé)</h2>
          <p style="color:var(--ds-color-text-muted); margin-bottom:0.5rem;">
            Nilalao ny anjara asa rehetra tao amin'ny "${dialogue.title}" ianao.
          </p>
          <p style="color:var(--ds-color-text-muted); margin-bottom:2rem; font-style:italic;">
            +30 XP azo !
          </p>

          <div style="background:var(--ds-color-primary-soft); padding:1.5rem; border-radius:var(--ds-radius-lg); border:1px solid var(--ds-color-primary); margin-bottom:1.5rem;">
            <h3 style="color:var(--ds-color-primary); margin-bottom:0.5rem;">🏆 Vonona ho an'ny Fanamby ? (Prêt pour le Défi ?)</h3>
            <p style="color:var(--ds-color-text-muted); font-size:0.9rem; margin-bottom:1rem;">
              Avereno milalao ny resaka <strong>tsy misy valiny</strong> mba hanamarinana ny fahatsiarovanao !
            </p>
            <ds-button id="btn-go-challenge" size="lg" variant="success" class="guide-active" style="width:100%;">
              Manomboka ny Fanamby → (Commencer le Défi)
            </ds-button>
          </div>

          <ds-button id="btn-back-themes" variant="ghost" size="sm" style="width:100%;">
            ← Hiverina amin'ny lohahevitra (Retour aux thèmes)
          </ds-button>
        </section>
      `;

      document.getElementById('btn-go-challenge').addEventListener('click', () => router.navigate('/challenge'));
      document.getElementById('btn-back-themes').addEventListener('click', () => router.navigate('/themes'));
    };

    const renderLine = () => {
      if (currentLineIndex >= dialogue.lines.length) {
        renderRolePlayComplete();
        return;
      }

      const line = dialogue.lines[currentLineIndex];
      const speaker = dialogue.participants[line.speaker];
      const isUserTurn = line.speaker === 'B';
      const progressPercent = (currentLineIndex / dialogue.lines.length) * 100;

      main.innerHTML = `
        <section style="max-width: 600px; margin: 0 auto; padding: 2rem 1rem;">
          <div style="background:var(--ds-color-border); height:8px; border-radius:4px; margin-bottom:1rem; overflow:hidden;">
            <div style="background:var(--ds-color-accent, #f59e0b); height:100%; width:${progressPercent}%; transition: width 0.3s ease;"></div>
          </div>

          <div style="display:flex; justify-content:space-between; margin-bottom:1rem; align-items:center;">
            <ds-button variant="ghost" size="sm" id="btn-back-dialogues">← Hiverina (Retour)</ds-button>
            <span style="font-weight:600; color:var(--ds-color-text-muted);">
              Andiany ${currentLineIndex + 1} / ${dialogue.lines.length}
            </span>
          </div>

          <div style="text-align:center; margin-bottom:1rem;">
            <span style="background:var(--ds-color-accent, #f59e0b); color:white; padding:4px 12px; border-radius:20px; font-weight:600; font-size:0.8rem;">
              🎭 Role Play Guidé • ${themeName}
            </span>
          </div>

          <h2 style="text-align:center; margin-bottom:1.5rem;">💬 ${dialogue.title}</h2>

          <div style="background:var(--ds-color-surface); padding:1.5rem; border-radius:var(--ds-radius-lg); border:2px solid ${isUserTurn ? 'var(--ds-color-primary)' : 'var(--ds-color-border)'}; margin-bottom:1.5rem; box-shadow:var(--ds-shadow-sm);">
            <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.75rem;">
              <span style="font-size:1.5rem;">${speaker.avatar}</span>
              <strong style="color:${isUserTurn ? 'var(--ds-color-primary)' : 'var(--ds-color-text)'};">
                ${speaker.name} ${isUserTurn ? '(Anao / Vous)' : ''}
              </strong>
            </div>
            <div style="font-size:1.2rem; font-weight:500; margin-bottom:0.5rem;">${line.text}</div>
            <div style="font-size:0.95rem; color:var(--ds-color-text-muted); font-style:italic;">${line.translation}</div>
          </div>

          <div style="display:flex; flex-direction:column; gap:0.75rem;">
            <div id="step-listen" class="${!isUserTurn ? 'guide-active' : ''}" style="text-align:center; padding:1rem; background:var(--ds-color-surface-2); border-radius:var(--ds-radius-md);">
              <div style="font-size:0.75rem; text-transform:uppercase; color:var(--ds-color-text-muted); margin-bottom:0.5rem;">Étape 1 : Hihainoa (Écoutez)</div>
              <ds-button variant="primary" size="md" id="btn-listen" class="${!isUserTurn ? 'guide-active' : ''}">🔊 Hihainoa (Écouter)</ds-button>
            </div>

            ${isUserTurn ? `
              <div id="step-speak" style="text-align:center; padding:1rem; background:var(--ds-color-primary-soft); border-radius:var(--ds-radius-md); border: 1px dashed var(--ds-color-primary); opacity:0.5; pointer-events:none; transition:all 0.3s;">
                <div style="font-size:0.75rem; text-transform:uppercase; color:var(--ds-color-primary); margin-bottom:0.5rem; font-weight:bold;">Étape 2 : Mitenena (Parlez à votre tour)</div>
                <ds-button variant="primary" size="lg" id="btn-speak">🎤 Mitenena izao (Parler maintenant)</ds-button>
                <div id="speech-feedback" style="margin-top:0.75rem; font-size:0.9rem; font-weight:600; min-height:1.5em;"></div>
              </div>
            ` : `
              <div style="text-align:center; padding:1rem; background:var(--ds-color-surface-2); border-radius:var(--ds-radius-md); color:var(--ds-color-text-muted);">
                👂 Hihainoa an'i ${speaker.name} (Écoutez ${speaker.name})
              </div>
            `}

            <div id="step-next" style="text-align:center; margin-top:0.5rem; opacity:0.5; pointer-events:none; transition:all 0.3s;">
              <ds-button id="btn-next" disabled variant="success" size="lg" style="width:100%;">
                Manaraka → (Suivant)
              </ds-button>
            </div>
          </div>
        </section>
      `;

      document.getElementById('btn-back-dialogues').addEventListener('click', () => {
        speechSynthesis.cancel();
        shadowing.forceStop();
        if (currentLineIndex > 0) {
          currentLineIndex--;
          renderLine();
        } else {
          router.navigate('/dialogues');
        }
      });

      const btnNext = document.getElementById('btn-next');
      const unlockNext = () => {
        btnNext.disabled = false;
        btnNext.removeAttribute('disabled');
        document.getElementById('step-next').style.opacity = '1';
        document.getElementById('step-next').style.pointerEvents = 'auto';
        btnNext.style.animation = "pulse-green 1.5s infinite";
      };

      document.getElementById('btn-listen').addEventListener('click', () => {
        const btnListen = document.getElementById('btn-listen');
        const originalText = btnListen.textContent;

        speakWithFeedback(line.text, {
          onStart: () => {
            btnListen.textContent = '🔊 ...';
            btnListen.classList.remove('guide-active');
            document.getElementById('step-listen').classList.remove('guide-active');
            if (isUserTurn) {
              const stepSpeak = document.getElementById('step-speak');
              stepSpeak.style.opacity = '1';
              stepSpeak.style.pointerEvents = 'auto';
              document.getElementById('btn-speak').classList.add('guide-active');
            }
          },
          onEnd: () => {
            btnListen.textContent = originalText;
            if (!isUserTurn) {
              unlockNext();
            }
          }
        });
      });

      if (isUserTurn) {
        const btnSpeak = document.getElementById('btn-speak');
        const speechFeedback = document.getElementById('speech-feedback');
        let isRecording = false;

        btnSpeak.addEventListener('click', () => {
          if (isRecording) {
            shadowing.forceStop();
            isRecording = false;
            btnSpeak.textContent = '🎤 Mitenena izao (Parler maintenant)';
            return;
          }

          btnSpeak.setAttribute('disabled', '');
          btnSpeak.textContent = '🎙️ Mandre... (Écoute en cours)';
          speechFeedback.innerHTML = '<span style="color:var(--ds-color-accent);">Mitenena izao... (Je vous écoute...)</span>';
          isRecording = true;
          shadowing.startRecording();
        });

        shadowEvalHandler = (data) => {
          isRecording = false;
          btnSpeak.removeAttribute('disabled');

          if (data.error === 'not_supported') {
            speechFeedback.innerHTML = '<span style="color:var(--ds-color-danger);">⚠️ Tsy mandeha ny mikrô</span>';
            btnSpeak.textContent = '🎤 Mitenena izao';
            unlockNext();
            return;
          }

          if (data.transcript) {
            const similarity = calculateSimilarity(data.transcript.toLowerCase(), line.text.toLowerCase());

            if (similarity > 0.60) {
              speechFeedback.innerHTML = `<span style="color:var(--ds-color-success);">✅ Tena tsara ! (Très bien !)</span>`;
              btnSpeak.textContent = '✅ Vita';
              gamification.addXP(5, 'Role Play - excellente prononciation');
              document.getElementById('btn-speak').classList.remove('guide-active');
              unlockNext();
            } else if (similarity > 0.40) {
              speechFeedback.innerHTML = `<span style="color:var(--ds-color-success);">✅ Tsara ! (Bien !)</span>`;
              btnSpeak.textContent = '✅ Vita';
              gamification.addXP(3, 'Role Play - bonne prononciation');
              document.getElementById('btn-speak').classList.remove('guide-active');
              unlockNext();
            } else {
              speechFeedback.innerHTML = `<span style="color:var(--ds-color-accent);">🔄 Havereno (À répéter)</span>`;
              btnSpeak.textContent = '🎤 Mitenena indray (Réessayer)';
            }
          } else {
            speechFeedback.innerHTML = '<span style="color:var(--ds-color-text-muted);">⚠️ Tsy re ny feo</span>';
            btnSpeak.textContent = '🎤 Mitenena izao';
          }
        };

        // ✅ IMPORTANT : Enregistrer le handler
        bus.on('pronunciation:evaluated', shadowEvalHandler);
      }

      // ✅ IMPORTANT : Gestion du bouton Suivant
      btnNext.addEventListener('click', () => {
        if (shadowEvalHandler) {
          bus.off('pronunciation:evaluated', shadowEvalHandler);
          shadowEvalHandler = null;
        }
        currentLineIndex++;
        renderLine();
      });
    };

    renderLine();

    journeyTracker.markJourneyComplete('roleplays', unitId);

    window.teacherAvatar.show('roleplay');

    logger.info(`✅ Role Play Guidé démarré pour le thème: ${unitId}`);

  } catch (e) {
    console.error('❌ Erreur renderRolePlay:', e);
    main.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--ds-color-danger);">
      <p>Hadisoana: ${e.message}</p>
      <ds-button onclick="location.hash='/themes'">Hiverina</ds-button>
    </div>`;
  }
}

// ═══════════════════════════════════════════════════════════
// VUE : DÉFI (L'utilisateur joue sans les réponses visibles)
// ═══════════════════════════════════════════════════════════
async function renderChallenge() {
  const main = document.getElementById('app');
  main.innerHTML = '<div style="text-align:center; padding:2rem;">Miomana ny fanamby...</div>';

  renderProgressHeader();
  // ✅ Synchroniser le profil après chaque parcours terminé
  syncProfileWithJourneys();

  try {
    const unitId = currentTheme;
    if (!unitId) {
      router.navigate('/themes');
      return;
    }

    const dialogue = await content.loadSection('fr', 'dialogues', `${unitId}_dialogue`);
    const themeNames = {
      'survival': 'Mots de survie', 'numbers': 'Les Nombres',
      'family': 'La Famille', 'market': 'Au Marché', 'colors': 'Les Couleurs'
    };
    const themeName = themeNames[unitId] || unitId;

    let currentLineIndex = 0;
    let shadowEvalHandler = null;

    if (!document.getElementById('pulse-guide-style')) {
      const style = document.createElement('style');
      style.id = 'pulse-guide-style';
      style.innerHTML = `
        @keyframes pulse-guide {
          0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); transform: scale(1); }
          70% { box-shadow: 0 0 0 8px rgba(59, 130, 246, 0); transform: scale(1.03); }
          100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); transform: scale(1); }
        }
        @keyframes pulse-green {
          0% { transform: scale(0.98); box-shadow: 0 0 0 0 rgba(47, 158, 68, 0.7); }
          70% { transform: scale(1.02); box-shadow: 0 0 0 10px rgba(47, 158, 68, 0); }
          100% { transform: scale(0.98); box-shadow: 0 0 0 0 rgba(47, 158, 68, 0); }
        }
        .guide-active {
          animation: pulse-guide 2s infinite !important;
          border: 2px solid var(--ds-color-primary) !important;
        }
      `;
      document.head.appendChild(style);
    }

    const renderLine = () => {
      if (currentLineIndex >= dialogue.lines.length) {
        renderChallengeComplete();
        return;
      }

      const line = dialogue.lines[currentLineIndex];
      const speaker = dialogue.participants[line.speaker];
      const isUserTurn = line.speaker === 'B';
      const progressPercent = (currentLineIndex / dialogue.lines.length) * 100;

      // ✅ Réinitialiser le compteur d'erreurs à CHAQUE réplique
      let lineMistakes = 0;
      const MAX_LINE_MISTAKES = 2;

      main.innerHTML = `
        <section style="max-width: 600px; margin: 0 auto; padding: 2rem 1rem;">
          <div style="background:var(--ds-color-border); height:8px; border-radius:4px; margin-bottom:1rem; overflow:hidden;">
            <div style="background:var(--ds-color-danger, #ef4444); height:100%; width:${progressPercent}%; transition: width 0.3s ease;"></div>
          </div>

          <div style="display:flex; justify-content:space-between; margin-bottom:1rem; align-items:center;">
            <ds-button variant="ghost" size="sm" id="btn-back-guided">← Hiverina (Retour)</ds-button>
            <span style="font-weight:600; color:var(--ds-color-text-muted);">
              Andiany ${currentLineIndex + 1} / ${dialogue.lines.length}
            </span>
          </div>

          <div style="text-align:center; margin-bottom:1rem;">
            <span style="background:var(--ds-color-danger, #ef4444); color:white; padding:4px 12px; border-radius:20px; font-weight:600; font-size:0.8rem;">
              🏆 Fanamby (Défi) • ${themeName}
            </span>
          </div>

          <h2 style="text-align:center; margin-bottom:1.5rem;">💬 ${dialogue.title}</h2>

          <div style="background:var(--ds-color-surface); padding:1.5rem; border-radius:var(--ds-radius-lg); border:2px solid ${isUserTurn ? 'var(--ds-color-danger, #ef4444)' : 'var(--ds-color-border)'}; margin-bottom:1.5rem; box-shadow:var(--ds-shadow-sm);">
            <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.75rem;">
              <span style="font-size:1.5rem;">${speaker.avatar}</span>
              <strong style="color:${isUserTurn ? 'var(--ds-color-danger, #ef4444)' : 'var(--ds-color-text)'};">
                ${speaker.name} ${isUserTurn ? '(Anao izao / À vous)' : ''}
              </strong>
            </div>

            ${isUserTurn ? `
              <div style="font-size:1.1rem; font-weight:500; color:var(--ds-color-text-muted); font-style:italic; margin-bottom:0.5rem;">
                🤔 Inona no valiny? (Quelle est la réponse ?)
              </div>
              <div style="font-size:0.9rem; color:var(--ds-color-text-muted);">
                (Tsarovy ny Role Play Guidé / Souvenez-vous du Role Play Guidé)
              </div>
            ` : `
              <div style="font-size:1.1rem; font-weight:500; margin-bottom:0.5rem;">${line.text}</div>
              <div style="font-size:0.9rem; color:var(--ds-color-text-muted); font-style:italic;">${line.translation}</div>
            `}
          </div>

          <div style="display:flex; flex-direction:column; gap:0.75rem;">
            ${!isUserTurn ? `
              <div id="step-listen" class="guide-active" style="text-align:center; padding:1.5rem; background:var(--ds-color-surface-2); border-radius:var(--ds-radius-md);">
                <div style="font-size:0.75rem; text-transform:uppercase; color:var(--ds-color-text-muted); margin-bottom:0.5rem;">
                  👂 Hihainoa an'i ${speaker.name} (Écoutez ${speaker.name})
                </div>
                <div id="partner-speaking-indicator" style="font-size:2rem; margin:1rem 0;">🔊</div>
                <div style="font-size:0.9rem; color:var(--ds-color-text-muted);">
                  Miresaka izy... (Il/elle parle...)
                </div>
              </div>
            ` : `
              <div id="step-speak" class="guide-active" style="text-align:center; padding:1rem; background:var(--ds-color-primary-soft); border-radius:var(--ds-radius-md); border: 1px dashed var(--ds-color-primary);">
                <div style="font-size:0.75rem; text-transform:uppercase; color:var(--ds-color-primary); margin-bottom:0.5rem; font-weight:bold;">
                  Mitenena tsy misy fanampiana (Parlez sans aide)
                </div>
                <ds-button variant="primary" size="lg" id="btn-speak" class="guide-active">🎤 Mitenena izao (Parler maintenant)</ds-button>
                <div id="speech-feedback" style="margin-top:0.75rem; font-size:0.9rem; font-weight:600; min-height:1.5em;"></div>
              </div>
            `}

            <div id="step-next" style="text-align:center; margin-top:0.5rem; opacity:0.5; pointer-events:none; transition:all 0.3s;">
              <ds-button id="btn-next" disabled variant="success" size="lg" style="width:100%;">
                Manaraka → (Suivant)
              </ds-button>
            </div>
          </div>
        </section>
      `;

      // --- GESTION DES ÉVÉNEMENTS ---
      document.getElementById('btn-back-guided').addEventListener('click', () => {
        shadowing.forceStop();
        speechSynthesis.cancel();
        if (currentLineIndex > 0) {
          currentLineIndex--;
          renderLine();
        } else {
          router.navigate('/roleplay');
        }
      });

      const btnNext = document.getElementById('btn-next');
      const unlockNext = () => {
        btnNext.disabled = false;
        btnNext.removeAttribute('disabled');
        document.getElementById('step-next').style.opacity = '1';
        document.getElementById('step-next').style.pointerEvents = 'auto';
        btnNext.style.animation = "pulse-green 1.5s infinite";
      };

      if (!isUserTurn) {
        const indicator = document.getElementById('partner-speaking-indicator');

        speakWithFeedback(line.text, {
          onStart: () => {
            indicator.textContent = '🗣️';
            indicator.style.animation = 'pulse-guide 1s infinite';
          },
          onEnd: () => {
            indicator.textContent = '✅';
            indicator.style.animation = 'none';
            document.getElementById('step-listen').classList.remove('guide-active');
            unlockNext();
          }
        });
      } else {
        const btnSpeak = document.getElementById('btn-speak');
        const speechFeedback = document.getElementById('speech-feedback');
        let isRecording = false;

        btnSpeak.addEventListener('click', () => {
          if (isRecording) {
            shadowing.forceStop();
            isRecording = false;
            btnSpeak.textContent = '🎤 Mitenena izao (Parler maintenant)';
            return;
          }

          btnSpeak.setAttribute('disabled', '');
          btnSpeak.textContent = '🎙️ Mandre... (Écoute en cours)';
          speechFeedback.innerHTML = '<span style="color:var(--ds-color-accent);">Mitenena izao... (Je vous écoute...)</span>';
          isRecording = true;
          shadowing.startRecording();
        });

        shadowEvalHandler = async (data) => {
          isRecording = false;
          btnSpeak.removeAttribute('disabled');

          if (data.error === 'not_supported') {
            speechFeedback.innerHTML = '<span style="color:var(--ds-color-danger);">⚠️ Tsy mandeha ny mikrô (Micro non supporté)</span>';
            btnSpeak.textContent = '🎤 Mitenena izao (Parler maintenant)';
            unlockNext();
            return;
          }

          if (data.transcript) {
            const similarity = calculateSimilarity(data.transcript.toLowerCase(), line.text.toLowerCase());

            if (similarity > 0.60) {
              // ✅ TRÈS BIEN
              feedbackSounds.playSuccess();
              speechFeedback.innerHTML = `<span style="color:var(--ds-color-success);">✅ Tena tsara ! (Très bien !)</span>`;
              btnSpeak.textContent = '✅ Vita';
              gamification.addXP(10, 'Défi - excellente prononciation');
              document.getElementById('step-speak').classList.remove('guide-active');
              unlockNext();
            } else if (similarity > 0.40) {
              // ✅ BIEN
              feedbackSounds.playSuccess();
              speechFeedback.innerHTML = `<span style="color:var(--ds-color-success);">✅ Tsara ! (Bien !)</span>`;
              btnSpeak.textContent = '✅ Vita';
              gamification.addXP(7, 'Défi - bonne prononciation');
              document.getElementById('step-speak').classList.remove('guide-active');
              unlockNext();
            } else {
              // ❌ À RÉPÉTER
              lineMistakes++;
              feedbackSounds.playRetry();
              speechFeedback.innerHTML = `
                <div>
                  <span style="color:var(--ds-color-danger);">🔄 Havereno (À répéter)</span>
                  <div style="margin-top:0.5rem; font-size:0.85rem; color:var(--ds-color-text-muted);">
                    Navoaka: "${data.transcript}" <br>
                    Valiny marina: <strong>"${line.text}"</strong>
                  </div>
                </div>
              `;
              btnSpeak.textContent = '🎤 Mitenena indray (Réessayer)';

              if (lineMistakes >= MAX_LINE_MISTAKES) {
                // Après 2 essais sur LA MÊME réplique, on montre la réponse et on passe
                speechFeedback.innerHTML += `<div style="margin-top:0.5rem; color:var(--ds-color-accent);">Tsy maninona, andeha isika ! (Pas grave, on continue !)</div>`;
                document.getElementById('step-speak').classList.remove('guide-active');
                unlockNext();
              }
            }
          } else {
            speechFeedback.innerHTML = '<span style="color:var(--ds-color-text-muted);">⚠️ Tsy re ny feo (Aucune voix détectée). Réessayez.</span>';
            btnSpeak.textContent = '🎤 Mitenena izao (Parler maintenant)';
          }
        };
        bus.on('pronunciation:evaluated', shadowEvalHandler);
      }

      btnNext.addEventListener('click', () => {
        if (shadowEvalHandler) {
          bus.off('pronunciation:evaluated', shadowEvalHandler);
          shadowEvalHandler = null;
        }
        currentLineIndex++;
        renderLine();
      });
    };

    const renderChallengeComplete = async () => {
      if (shadowEvalHandler) {
        bus.off('pronunciation:evaluated', shadowEvalHandler);
        shadowEvalHandler = null;
      }
      speechSynthesis.cancel();
      feedbackSounds.playCelebration();
      await gamification.addXP(100, 'Défi terminé !');

      window.teacherAvatar.markThemeMastered(currentTheme);

      // ✅ Voix du Teacher Avatar pour féliciter
      setTimeout(() => {
        window.teacherAvatar.speak("Félicitations ! Vous avez réussi le défi ! Vous êtes prêt pour la conversation libre.");
      }, 800);

      main.innerHTML = `
        <section style="max-width: 600px; margin: 0 auto; padding: 2rem 1rem; text-align:center;">
          <div style="font-size:5rem; margin-bottom:1rem;">🏆</div>
          <h2 style="color:var(--ds-color-success);">Fanamby Vita ! (Défi Réussi !)</h2>
          <p style="color:var(--ds-color-text-muted); margin-bottom:0.5rem;">
            Nahay nilalao ny anjara asa tamin'ny "${dialogue.title}" ianao !
          </p>
          <p style="color:var(--ds-color-accent); font-weight:bold; margin-bottom:2rem;">
            +100 XP azo ! 🎖️ Badge de maîtrise débloqué
          </p>

          <div style="background:var(--ds-color-success-soft, #d1fae5); padding:1.5rem; border-radius:var(--ds-radius-lg); border:1px solid var(--ds-color-success); margin-bottom:1.5rem;">
            <h3 style="color:var(--ds-color-success); margin-bottom:0.5rem;">🎓 Lohahevitra "${themeName}" vita !</h3>
            <p style="color:var(--ds-color-text-muted); font-size:0.9rem; margin-bottom:1rem;">
              Vonona hifampiresaka amin'ny IA ianao (ho avy).
              <br><em>(Vous êtes prêt pour la conversation IA - bientôt disponible)</em>
            </p>
          </div>

          <div style="display:flex; flex-direction:column; gap:0.75rem;">
            <ds-button id="btn-back-themes" size="lg" variant="primary" style="width:100%;">
              ← Misafidy lohahevitra hafa (Choisir un autre thème)
            </ds-button>
          </div>
        </section>
      `;

      document.getElementById('btn-back-themes').addEventListener('click', () => router.navigate('/themes'));
    };

    renderLine();

    journeyTracker.markJourneyComplete('challenges', unitId);

    window.teacherAvatar.show('challenge');

    console.log(`✅ [DEBUG] Défi démarré pour le thème: ${unitId}`);

  } catch (e) {
    console.error('❌ Erreur renderChallenge:', e);
    main.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--ds-color-danger);">
      <p>Hadisoana: ${e.message}</p>
      <ds-button onclick="location.hash='/themes'">Hiverina</ds-button>
    </div>`;
  }
}

// ═══════════════════════════════════════════════════════════
// UTILITAIRE : Calcul de similarité entre deux chaînes
// ═══════════════════════════════════════════════════════════
function calculateSimilarity(str1, str2) {
  // Nettoyage basique
  const clean = (s) => s.replace(/[^\w\sàâäéèêëïîôùûüÿç]/gi, '').trim();
  const s1 = clean(str1);
  const s2 = clean(str2);

  if (s1 === s2) return 1;
  if (!s1 || !s2) return 0;

  // Algorithme de Levenshtein simplifié (distance d'édition)
  const matrix = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));

  for (let i = 0; i <= s1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= s2.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= s2.length; j++) {
    for (let i = 1; i <= s1.length; i++) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,     // suppression
        matrix[j - 1][i] + 1,     // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  const distance = matrix[s2.length][s1.length];
  const maxLength = Math.max(s1.length, s2.length);
  return maxLength === 0 ? 1 : 1 - (distance / maxLength);
}

async function renderProfile() {
  const main = document.getElementById('app');
  main.innerHTML = '<div style="text-align:center; padding:2rem;">Chargement du profil...</div>';

  try {
    const profile = await gamification.getProfile();
    const stats = journeyTracker.getCompletionStats();

    main.innerHTML = `
      <section style="max-width: 600px; margin: 0 auto; padding: 2rem 1rem;">
        <ds-button variant="ghost" size="sm" id="btn-back" style="margin-bottom: 1rem;">← Miverina (Retour)</ds-button>
        <h2 style="text-align: center; margin-bottom: 2rem;">👤 Mombamomba ahy (Mon Profil)</h2>

        <div style="background: var(--ds-color-surface); padding: 2rem; border-radius: var(--ds-radius-lg); box-shadow: var(--ds-shadow-md); text-align:center; margin-bottom: 2rem;">
          <div style="font-size: 3rem; margin-bottom: 0.5rem;"></div>
          <h3 style="color: var(--ds-color-primary);">Ambaratonga ${profile.level}</h3>
          <p style="color: var(--ds-color-text-muted);">${profile.xp} XP azo</p>
          <div style="margin-top: 1rem; font-size: 1.5rem; color: var(--ds-color-accent); font-weight: bold;">🔥 ${profile.streak} andro</div>
        </div>

        <div style="background: var(--ds-color-primary-soft); padding: 1.5rem; border-radius: var(--ds-radius-lg); border: 1px solid var(--ds-color-primary); margin-bottom: 1.5rem;">
          <h3 style="color: var(--ds-color-primary); margin-bottom: 1rem;">📊 Fandrosoana (Progression)</h3>
          <div style="font-size: 2rem; font-weight: bold; color: var(--ds-color-primary); margin-bottom: 0.5rem;">${Math.round(stats.percentage)}%</div>
          <div style="color: var(--ds-color-text-muted); font-size: 0.9rem;">
            ${stats.completedJourneys} / ${stats.totalJourneys} parcours terminés
          </div>
        </div>

        <div style="background: var(--ds-color-surface); padding: 1.5rem; border-radius: var(--ds-radius-lg); border: 1px solid var(--ds-color-border);">
          <h3 style="color: var(--ds-color-text); margin-bottom: 1rem;"> Tatitra (Rapports)</h3>
          <div style="display: grid; gap: 0.75rem;">
            <div style="display: flex; justify-content: space-between; padding: 0.75rem; background: var(--ds-color-surface-2); border-radius: var(--ds-radius-md);">
              <span>📖 Leçons</span>
              <strong>${journeyTracker.getCompletedJourneys().lessons.length} / 5</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.75rem; background: var(--ds-color-surface-2); border-radius: var(--ds-radius-md);">
              <span>🎯 Révisions</span>
              <strong>${journeyTracker.getCompletedJourneys().practices.length} / 5</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.75rem; background: var(--ds-color-surface-2); border-radius: var(--ds-radius-md);">
              <span>💬 Dialogues</span>
              <strong>${journeyTracker.getCompletedJourneys().dialogues.length} / 5</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.75rem; background: var(--ds-color-surface-2); border-radius: var(--ds-radius-md);">
              <span>🎭 Role Play</span>
              <strong>${journeyTracker.getCompletedJourneys().roleplays.length} / 5</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.75rem; background: var(--ds-color-surface-2); border-radius: var(--ds-radius-md);">
              <span> Défis</span>
              <strong>${journeyTracker.getCompletedJourneys().challenges.length} / 5</strong>
            </div>
          </div>
        </div>
      </section>
    `;

    document.getElementById('btn-back').addEventListener('click', () => router.navigate('/'));
    logger.info('✅ Page Profil rendue');
  } catch (e) {
    main.innerHTML = `<p style="color:red; text-align:center;">Erreur profil: ${e.message}</p>`;
  }
}



// --- VUE : LISTE DES THÈMES DU NIVEAU ---
async function renderThemes() {
  const main = document.getElementById('app');
  main.innerHTML = '<div style="text-align:center; padding:2rem;">Chargement des thèmes...</div>';

  try {
    const manifest = await content.loadManifest('fr');
    const levelData = manifest.levels.find(l => l.id === currentLevel);
    currentTheme = null;

    // ✅ Dictionnaire des Thèmes (Icônes, Titres FR/MG)
    const themeInfo = {
      'survival':  { icon: '🆘', fr: 'Mots de survie', mg: 'Teny fototra' },
      'family':    { icon: '‍👩‍👧', fr: 'La Famille', mg: 'Ny Fianakaviana' },
      'market':    { icon: '🛒', fr: 'Le Marché', mg: 'Ny Tsena' },
      'numbers':   { icon: '', fr: 'Nombres (1-10)', mg: 'Ny Isa (1-10)' },
      'numbers2':  { icon: '🧮', fr: 'Nombres (11-20)', mg: 'Ny Isa (11-20)' },
      'colors':    { icon: '🎨', fr: 'Les Couleurs', mg: 'Ny Loko' },
      'days':      { icon: '', fr: 'Les Jours', mg: 'Ny Andro' },
      'months':    { icon: '🗓️', fr: 'Les Mois', mg: 'Ny Volana' },
      'greetings': { icon: '👋', fr: 'Salutations', mg: 'Fiarahabana' },
      'body':      { icon: '🧍', fr: 'Le Corps', mg: 'Ny Vatana' }
    };

    const journeys = journeyTracker.getCompletedJourneys();
    const journeyTypes = ['lessons', 'practices', 'dialogues', 'roleplays', 'challenges'];

    const themesHtml = levelData.units.map(unitId => {
      const info = themeInfo[unitId] || { icon: '📁', fr: unitId, mg: unitId };

      // Calcul de la progression pour les points colorés
      let doneCount = 0;
      journeyTypes.forEach(type => {
        if (journeys[type] && journeys[type].includes(unitId)) doneCount++;
      });

      let statusDot = ''; // Non commencé
      let statusText = 'Non commencé';
      if (doneCount === 5) { statusDot = ''; statusText = 'Terminé (100%)'; }
      else if (doneCount > 0) { statusDot = ''; statusText = `En cours (${doneCount}/5)`; }

      return `
        <div class="btn-select-theme" data-theme="${unitId}" style="background:var(--ds-color-surface); padding:1.5rem; border-radius:var(--ds-radius-lg); border:1px solid var(--ds-color-border); cursor:pointer; transition:transform 0.2s; display:flex; flex-direction:column; gap:0.5rem;"
             onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform='translateY(0)'">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size: 2.5rem;">${info.icon}</div>
            <div style="font-size: 1.5rem;" title="${statusText}">${statusDot}</div>
          </div>
          <h3 style="color:var(--ds-color-primary); margin:0.5rem 0 0 0;">${info.fr}</h3>
          <p style="color:var(--ds-color-text-muted); font-size:0.85rem; margin:0; font-style:italic;">${info.mg}</p>
        </div>
      `;
    }).join('');

    main.innerHTML = `
      <section style="max-width: 700px; margin: 0 auto; padding: 2rem 1rem;">
        <ds-button variant="ghost" size="sm" id="btn-back-home" style="margin-bottom: 1rem;">← Retour à l'accueil</ds-button>
        <h2 style="margin-bottom: 0.5rem;">Niveau ${currentLevel} : Thèmes</h2>
        <p style="color:var(--ds-color-text-muted); margin-bottom: 2rem;">Safidio ny lohahevitra (Choisissez un thème) :</p>
        <div id="themes-container" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap:1rem;">
          ${themesHtml}
        </div>
      </section>
    `;

    document.getElementById('btn-back-home').addEventListener('click', () => router.navigate('/'));
    document.getElementById('themes-container').addEventListener('click', (e) => {
      const card = e.target.closest('.btn-select-theme');
      if (card) {
        currentTheme = card.dataset.theme;
        localStorage.setItem('dagospeak:theme', currentTheme);
        router.navigate('/theme-detail');
      }
    });
    window.teacherAvatar.show('themes');
  } catch (e) {
    main.innerHTML = `<p style="color:red; text-align:center;">Erreur: ${e.message}</p>`;
  }
}

// --- VUE : DÉTAIL D'UN THÈME (Les 3 actions) ---
async function renderThemeDetail() {
  const main = document.getElementById('app');
  if (!currentTheme) { router.navigate('/themes'); return; }

  main.innerHTML = '<div style="text-align:center; padding:2rem;">Chargement...</div>';

  try {
    const unitData = await content.loadSection('fr', 'vocabulary', currentTheme);
    const themeInfo = {
      'survival': 'Mots de survie', 'numbers': 'Nombres (1-10)', 'family': 'La Famille',
      'market': 'Le Marché', 'colors': 'Les Couleurs', 'numbers2': 'Nombres (11-20)',
      'days': 'Les Jours', 'months': 'Les Mois', 'greetings': 'Salutations', 'body': 'Le Corps'
    };
    const themeName = themeInfo[currentTheme] || currentTheme;

    main.innerHTML = `
      <section style="max-width: 600px; margin: 0 auto; padding: 2rem 1rem; text-align:center;">
        <ds-button variant="ghost" size="sm" id="btn-back-themes" style="margin-bottom: 1rem; float:left;">← Thèmes</ds-button>
        <div style="clear:both; padding-top:1rem;">
          <span style="background:var(--ds-color-accent); color:white; padding:4px 12px; border-radius:20px; font-weight:600; font-size:0.8rem;">Niveau ${currentLevel}</span>
        </div>
        <h1 style="margin-top:1rem; color:var(--ds-color-primary);">${themeName}</h1>
        <p style="color:var(--ds-color-text-muted); margin-bottom: 2rem;">${unitData.themeMg || ''} • ${unitData.items.length} mots</p>

        <div style="display:flex; flex-direction:column; gap:1rem; text-align:left;">

          <!-- SECTION LEÇON -->
          <div style="background:var(--ds-color-surface); padding:1rem; border-radius:var(--ds-radius-md); border:1px solid var(--ds-color-border);">
            <h3 style="margin:0 0 1rem 0; color:var(--ds-color-text);">📖 Leçon (Fianarana)</h3>
            <ds-button variant="primary" size="md" style="width:100%; margin-bottom:0.5rem;" onclick="window.location.hash='/lesson'">
              1. Les Mots (Ny Teny) - <span style="font-size:0.8em; opacity:0.8;">Gratuit</span>
            </ds-button>
            <ds-button variant="ghost" size="md" style="width:100%; opacity:0.6;" disabled>
              2. Les Phrases & Contextes - <span style="font-size:0.8em;">🔒 Premium</span>
            </ds-button>
          </div>

          <!-- SECTION RÉVISIONS -->
          <div style="background:var(--ds-color-surface); padding:1rem; border-radius:var(--ds-radius-md); border:1px solid var(--ds-color-border);">
            <h3 style="margin:0 0 1rem 0; color:var(--ds-color-text);"> Révisions (Fanazaran-tena)</h3>
            <ds-button variant="success" size="md" style="width:100%; margin-bottom:0.5rem;" onclick="window.location.hash='/practice'">
              1. Quiz & Shadowing (Mots) - <span style="font-size:0.8em; opacity:0.8;">Gratuit</span>
            </ds-button>
            <ds-button variant="ghost" size="md" style="width:100%; opacity:0.6;" disabled>
              2. Quiz & Shadowing (Phrases) - <span style="font-size:0.8em;">🔒 Premium</span>
            </ds-button>
          </div>

          <!-- SECTION DIALOGUE -->
          <div style="background:var(--ds-color-surface); padding:1rem; border-radius:var(--ds-radius-md); border:1px solid var(--ds-color-border);">
            <h3 style="margin:0 0 1rem 0; color:var(--ds-color-text);"> Dialogue (Resaka)</h3>
            <ds-button variant="accent" size="md" style="width:100%;" onclick="window.location.hash='/dialogues'">
              Écouter et jouer le dialogue - <span style="font-size:0.8em; opacity:0.8;">Gratuit</span>
            </ds-button>
          </div>

        </div>
      </section>
    `;

    document.getElementById('btn-back-themes').addEventListener('click', () => router.navigate('/themes'));
    window.teacherAvatar.show('theme-detail');
  } catch (e) {
    main.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--ds-color-danger);"> <p>Erreur: ${e.message}</p> <ds-button onclick="window.location.hash='/themes'">Retour</ds-button> </div>`;
  }
}


// ✅ HEADER DE PROGRESSION FLOTTANT (Pour Leçons, Pratique, Dialogues)
function renderProgressHeader() {
  if (window.location.hash === '#' || window.location.hash === '#/' || window.location.hash === '') return;

  const oldHeader = document.getElementById('floating-progress-header');
  if (oldHeader) oldHeader.remove();

  const header = document.createElement('div');
  header.id = 'floating-progress-header';
  header.style.cssText = `
    position: fixed;
    top: 65px;
    left: 50%;
    transform: translateX(-50%);
    background: transparent;
    padding: 8px 16px;
    z-index: 999;
    display: flex;
    gap: 16px;
    align-items: center;
    font-size: 0.95rem;
    font-weight: 700;
    animation: slideDown 0.4s ease-out;
  `;

  const getProfileData = () => {
    try {
      const journeys = JSON.parse(localStorage.getItem('dagospeak:completedJourneys') ||
        '{"lessons":[],"practices":[],"dialogues":[],"roleplays":[],"challenges":[]}');
      const completedCount = Object.values(journeys).reduce((sum, arr) => sum + arr.length, 0);
      const totalCount = 50; // 10 thèmes × 5 types
      const percentage = Math.round((completedCount / totalCount) * 100);

      const totalXP =
        (journeys.lessons.length * 20) +
        (journeys.practices.length * 30) +
        (journeys.dialogues.length * 25) +
        (journeys.roleplays.length * 40) +
        (journeys.challenges.length * 50);

      return { xp: totalXP, percentage, completedCount };
    } catch (e) {
      return { xp: 0, percentage: 0, completedCount: 0 };
    }
  };

  const data = getProfileData();

  // ✅ Icônes flottantes sans background, juste les emojis + textes
  header.innerHTML = `
    <div style="display:flex; align-items:center; gap:4px; color: var(--ds-color-accent); text-shadow: 0 1px 2px rgba(255,255,255,0.8);">
      <span style="font-size:1.3rem;"></span>
      <span>3</span>
    </div>
    <div style="display:flex; align-items:center; gap:4px; color: var(--ds-color-primary); text-shadow: 0 1px 2px rgba(255,255,255,0.8);">
      <span style="font-size:1.3rem;">⭐</span>
      <span>${data.xp} XP</span>
    </div>
    <div style="display:flex; align-items:center; gap:4px; color: var(--ds-color-text); text-shadow: 0 1px 2px rgba(255,255,255,0.8);">
      <span style="font-size:1.3rem;">📊</span>
      <span>${data.percentage}%</span>
    </div>
  `;

  document.body.appendChild(header);

  // Rafraîchissement
  if (!window._progressHeaderInterval) {
    window._progressHeaderInterval = setInterval(() => {
      const currentHeader = document.getElementById('floating-progress-header');
      if (!currentHeader) {
        clearInterval(window._progressHeaderInterval);
        window._progressHeaderInterval = null;
        return;
      }
      const newData = getProfileData();
      currentHeader.innerHTML = `
        <div style="display:flex; align-items:center; gap:4px; color: var(--ds-color-accent); text-shadow: 0 1px 2px rgba(255,255,255,0.8);">
          <span style="font-size:1.3rem;">🔥</span>
          <span>3</span>
        </div>
        <div style="display:flex; align-items:center; gap:4px; color: var(--ds-color-primary); text-shadow: 0 1px 2px rgba(255,255,255,0.8);">
          <span style="font-size:1.3rem;">⭐</span>
          <span>${newData.xp} XP</span>
        </div>
        <div style="display:flex; align-items:center; gap:4px; color: var(--ds-color-text); text-shadow: 0 1px 2px rgba(255,255,255,0.8);">
          <span style="font-size:1.3rem;">📊</span>
          <span>${newData.percentage}%</span>
        </div>
      `;
    }, 2000);
  }
}

  // ✅ ÉCOUTER LE BUS D'ÉVÉNEMENTS EXISTANT (si disponible)
  if (typeof bus !== 'undefined') {
    const refreshOnEvent = () => {
      const currentHeader = document.getElementById('floating-progress-header');
      if (currentHeader) {
        // Forcer un rafraîchissement immédiat
        const newData = getProfileData();
        currentHeader.querySelector('div:nth-child(2) span:last-child').textContent = `${newData.xp} XP`;
        currentHeader.querySelector('div:nth-child(4) span:last-child').textContent = `${newData.percentage}%`;
      }
    };

    // Écouter les événements de gamification existants
    bus.on('gamification:xp-added', refreshOnEvent);
    bus.on('gamification:level-up', refreshOnEvent);
    bus.on('gamification:badge-earned', refreshOnEvent);
  }


// ✅ CSS pour l'animation (à ajouter une seule fois)
if (!document.getElementById('progress-header-style')) {
  const style = document.createElement('style');
  style.id = 'progress-header-style';
  style.innerHTML = `
    @keyframes slideDown {
      from { transform: translateY(-100%); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

// ✅ BOUTONS FLOTTANTS "COMMENCER" ET "GUIDE" (Au-dessus du Teacher Avatar)
// ✅ BOUTONS FLOTTANTS "COMMENCER" ET "GUIDE" (Version blindée)
function renderFloatingHomeButtons() {
  // Ne s'affiche QUE sur la page d'accueil
  if (window.location.hash !== '#' && window.location.hash !== '#/' && window.location.hash !== '') return;

  // Éviter les doublons
  if (document.getElementById('floating-home-actions')) return;

  const container = document.createElement('div');
  container.id = 'floating-home-actions';
  container.style.cssText = `
    position: fixed;
    bottom: 195px;
    right: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    z-index: 9998; /* Juste en dessous du Teacher Avatar (9999) */
    animation: slideInRight 0.5s ease-out;
  `;

  container.innerHTML = `
    <button id="btn-float-start" style="background: var(--ds-color-success, #22c55e); color: white; border: none; padding: 12px 20px; border-radius: 50px; font-weight: bold; font-size: 0.95rem; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.2); display: flex; align-items: center; gap: 8px; min-width: 150px; justify-content: center;">
      🚀 Commencer
    </button>
    <button id="btn-float-guide" style="background: var(--ds-color-primary, #2563eb); color: white; border: none; padding: 12px 20px; border-radius: 50px; font-weight: bold; font-size: 0.95rem; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.2); display: flex; align-items: center; gap: 8px; min-width: 150px; justify-content: center;">
      ❓ Guide
    </button>
  `;

  document.body.appendChild(container);

  // Action du bouton Commencer
  document.getElementById('btn-float-start').addEventListener('click', () => {
    window.teacherAvatar.speak("Bienvenue ! Choisissez un niveau pour commencer votre apprentissage du français.");
    setTimeout(() => {
      router.navigate('/themes');
    }, 2500);
  });

  // Action du bouton Guide
  document.getElementById('btn-float-guide').addEventListener('click', () => {
    showAppGuide();
  });
}

// ✅ MODAL DE GUIDE D'UTILISATION (Version blindée)
function showAppGuide() {
  // Fermer s'il est déjà ouvert
  if (document.getElementById('guide-modal')) {
    document.getElementById('guide-modal').remove();
    return;
  }

  const modal = document.createElement('div');
  modal.id = 'guide-modal';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.7); z-index: 10000;
    display: flex; align-items: center; justify-content: center; padding: 1rem;
    animation: fadeIn 0.3s ease-out;
  `;

  modal.innerHTML = `
    <div style="background: var(--ds-color-surface, white); padding: 2rem; border-radius: 16px; max-width: 500px; width: 100%; max-height: 85vh; overflow-y: auto; position: relative; color: var(--ds-color-text, black);">
      <button id="close-guide-btn" style="position: absolute; top: 15px; right: 15px; background: none; border: none; font-size: 1.8rem; cursor: pointer; color: var(--ds-color-text-muted, gray); line-height: 1;">×</button>

      <h2 style="color: var(--ds-color-primary, #2563eb); margin-bottom: 1.5rem; text-align: center;">📖 Guide DagoSpeak</h2>

      <ol style="line-height: 1.8; padding-left: 1.5rem; font-size: 0.95rem;">
        <li style="margin-bottom: 10px;"><strong>🔄 Actualisation :</strong> Si l'app semble bloquée, actualisez la page (F5 ou tirer vers le bas sur mobile).</li>
        <li style="margin-bottom: 10px;"><strong>🌐 Globe (Haut) :</strong> Pour changer la langue d'apprentissage.</li>
        <li style="margin-bottom: 10px;"><strong>ℹ️ Info (Haut) :</strong> À propos de l'app, offres et certifications.</li>
        <li style="margin-bottom: 10px;"><strong>👩‍🏫 Avatar (Bas droite) :</strong> Cliquez dessus à tout moment pour un conseil ou une traduction.</li>
        <li style="margin-bottom: 10px;"><strong>🏠 📚 👤 (Footer) :</strong> Naviguez entre l'Accueil, les Thèmes et votre Profil.</li>
      </ol>

      <button id="btn-understand-guide" style="width: 100%; background: var(--ds-color-primary, #2563eb); color: white; border: none; padding: 14px; border-radius: 12px; font-weight: bold; font-size: 1rem; cursor: pointer; margin-top: 1.5rem;">
        J'ai compris, merci !
      </button>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
    const el = document.getElementById('guide-modal');
    if (el) el.remove();
  };

  document.getElementById('close-guide-btn').addEventListener('click', closeModal);
  document.getElementById('btn-understand-guide').addEventListener('click', closeModal);

  // Fermer en cliquant en dehors du modal
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
}


// ✅ SYNCHRONISATION AUTOMATIQUE DU PROFIL
function syncProfileWithJourneys() {
  const journeys = JSON.parse(localStorage.getItem('dagospeak:completedJourneys') ||
    '{"lessons":[],"practices":[],"dialogues":[],"roleplays":[],"challenges":[]}');

  const completedCount = Object.values(journeys).reduce((sum, arr) => sum + arr.length, 0);

  // Calculer les XP
  const totalXP =
    (journeys.lessons.length * 20) +
    (journeys.practices.length * 30) +
    (journeys.dialogues.length * 25) +
    (journeys.roleplays.length * 40) +
    (journeys.challenges.length * 50);

  // Déterminer le niveau
  let level = 'A0';
  if (totalXP >= 500) level = 'A2';
  else if (totalXP >= 300) level = 'A1';
  else if (totalXP >= 100) level = 'A0+';

  // Mettre à jour le profil dans localStorage
  const profile = {
    xp: totalXP,
    level: level,
    streak: parseInt(localStorage.getItem('dagospeak:streak') || '0'),
    badges: [],
    completedJourneys: completedCount,
    lastActivity: new Date().toISOString()
  };

  localStorage.setItem('dagospeak:profile', JSON.stringify(profile));
  localStorage.setItem('dagospeak:lastActivity', new Date().toISOString());

  console.log('[Profile] Synchronisé:', profile);
}

// ═══════════════════════════════════════════════════════════
// ROUTEUR & DÉMARRAGE (Onboarding temporairement désactivé)
// ═══════════════════════════════════════════════════════════
router.addRoute('/', renderHome);
router.addRoute('/themes', renderThemes);
router.addRoute('/theme-detail', renderThemeDetail);
router.addRoute('/lesson', renderLesson);
router.addRoute('/practice', renderPractice);
router.addRoute('/dialogues', renderDialogues);
router.addRoute('/profile', renderProfile);
router.addRoute('/roleplay', renderRolePlay);
router.addRoute('/challenge', renderChallenge);
router.addRoute('/about', renderAbout);

initTheme();
updateLevelUI();

// ✅ ONBOARDING DÉSACTIVÉ TEMPORAIREMENT (Vosk désactivé)
// Démarrage direct de l'application
router.start();
logger.info('✅ Application démarrée (mode normal)');

// ... (Gardez tout votre code existant concernant le Service Worker et le bandeau de mise à jour PWA en dessous)

// Mise à jour de l'état actif de la barre de navigation mobile
function updateMobileNavActiveState() {
  const currentHash = window.location.hash.slice(1) || '/';
  document.querySelectorAll('.ds-mobile-nav a').forEach(link => {
    link.classList.toggle('active', link.dataset.route === currentHash);
  });
}

// Appeler cette fonction à chaque changement de route
window.addEventListener('hashchange', updateMobileNavActiveState);
updateMobileNavActiveState(); // Appel initial

// ═══════════════════════════════════════════════════════════
// GESTION AUTOMATIQUE DES MISES À JOUR PWA
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// GESTION DES MISES À JOUR AUTOMATIQUES
// ═══════════════════════════════════════════════════════════
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('[App] ✅ SW enregistré:', registration.scope);

      // Écouter les messages du SW (nouvelle version disponible)
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'NEW_VERSION') {
          console.log('[App] 🔄 Nouvelle version détectée, reload dans 3 secondes...');

          // Affiche un bandeau discret
          const banner = document.createElement('div');
          banner.id = 'update-banner';
          banner.style.cssText = `
            position: fixed;
            bottom: 90px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--ds-color-primary, #2563eb);
            color: white;
            padding: 12px 24px;
            border-radius: 50px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 9999;
            font-size: 0.9rem;
            font-weight: 500;
            animation: slideUp 0.3s ease-out;
            display: flex;
            align-items: center;
            gap: 12px;
          `;
          banner.innerHTML = `
            <span>🔄 Mise à jour disponible</span>
            <button id="btn-reload-now" style="background:white; color:var(--ds-color-primary,#2563eb); border:none; padding:6px 12px; border-radius:20px; font-weight:bold; cursor:pointer;">Actualiser</button>
          `;
          document.body.appendChild(banner);

          // Style pour l'animation
          if (!document.getElementById('update-banner-style')) {
            const style = document.createElement('style');
            style.id = 'update-banner-style';
            style.innerHTML = `@keyframes slideUp { from { transform: translate(-50%, 100%); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }`;
            document.head.appendChild(style);
          }

          // Bouton reload manuel
          document.getElementById('btn-reload-now').addEventListener('click', () => {
            window.location.reload();
          });

          // Auto-reload après 3 secondes si l'utilisateur ne clique pas
          setTimeout(() => {
            if (document.getElementById('update-banner')) {
              window.location.reload();
            }
          }, 3000);
        }
      });

      // Vérifie les mises à jour toutes les 5 minutes
      setInterval(() => {
        registration.update().then(() => {
          console.log('[App] 🔄 Vérification des mises à jour...');
        });
      }, 5 * 60 * 1000);

    } catch (error) {
      console.warn('[App] ⚠️ Échec SW:', error);
    }
  });
}

function showUpdateBanner() {
  if (document.getElementById('pwa-update-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'pwa-update-banner';
  banner.innerHTML = `
    <div style="position:fixed; bottom:80px; left:50%; transform:translateX(-50%); background:var(--ds-color-primary,#2563eb); color:white; padding:12px 20px; border-radius:50px; box-shadow:0 4px 12px rgba(0,0,0,0.2); display:flex; align-items:center; gap:12px; z-index:9999; font-size:0.9rem; font-weight:500; animation:slideUp 0.3s ease-out;">
      <span>🔄 Nouvelle version disponible !</span>
      <button id="btn-reload-app" style="background:white; color:var(--ds-color-primary,#2563eb); border:none; padding:6px 12px; border-radius:20px; font-weight:bold; cursor:pointer; font-size:0.85rem;">Actualiser</button>
    </div>`;
  document.body.appendChild(banner);

  if (!document.getElementById('slide-up-style')) {
    const style = document.createElement('style');
    style.id = 'slide-up-style';
    style.innerHTML = `@keyframes slideUp { from { transform: translate(-50%, 100%); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }`;
    document.head.appendChild(style);
  }

  document.getElementById('btn-reload-app').addEventListener('click', () => window.location.reload(true));
}

logger.info('✅ Application démarrée');