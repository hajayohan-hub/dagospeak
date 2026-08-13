// ═══════════════════════════════════════════════════════════
// IMPORTS
// ═══════════════════════════════════════════════════════════
import './ui/components/ds-button.js';
import './core/device-check.js';  // ✅ Détection appareil modeste (doit charger tôt)
import './core/share-manager.js';  // ✅ Partage natif (app + certificat)
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
import './engines/audio/audio-loader.js';  // ✅ MP3 pré-enregistrés avec fallback TTS
import { OnboardingScreen } from './ui/components/onboarding-screen.js';
import { ConversationEngine } from './ui/components/conversation-engine.js';
import { DictionarySearch } from './ui/components/dictionary-search.js';

const teacherAvatar = new TeacherAvatar();
window.teacherAvatar = teacherAvatar;

// ═══════════════════════════════════════════════════════════
// HELPER : Lire les réglages utilisateur depuis localStorage
// ═══════════════════════════════════════════════════════════
function getSettings() {
  try {
    return JSON.parse(localStorage.getItem('dagospeak:settings') || '{}');
  } catch (e) {
    return {};
  }
}

// ═══════════════════════════════════════════════════════════
// MODÈLE FREEMIUM : 5 premiers thèmes gratuits, les autres Premium
// ═══════════════════════════════════════════════════════════
let levelsConfig = null; // Sera chargé depuis levels.json

function isThemeLocked(themeId, profile) {
  // Fallback si levels.json n'est pas encore chargé
  if (!levelsConfig || !levelsConfig.levels) {
    const freeThemes = ['survival', 'family', 'market', 'numbers', 'colors'];
    return !freeThemes.includes(themeId) && !profile.isPremium;
  }

  const levelConfig = levelsConfig.levels[currentLevel] || levelsConfig.levels['A0'];
  if (!levelConfig) return true;

  // Si le niveau n'est pas publié, tout est verrouillé
  if (levelConfig.published === false) return true;

  // Vérifier si le thème est dans la liste des thèmes gratuits
  const isFreeTheme = levelConfig.freeThemes?.includes(themeId);
  if (isFreeTheme) return false;

  // Sinon, vérifier si l'utilisateur est Premium
  const userProfile = JSON.parse(localStorage.getItem('dagospeak:userProfile') || '{}');
  return !userProfile.isPremium;
}


/// ═══════════════════════════════════════════════════════════
// SUIVI DE PROGRESSION DES PARCOURS (VERSION CENTRALISÉE)
// ═══════════════════════════════════════════════════════════
const journeyTracker = {
  // ✅ TOUS les types de parcours (y compris phrases)
  getCompletedJourneys() {
    const saved = localStorage.getItem('dagospeak:completedJourneys');
    return saved ? JSON.parse(saved) : {
      lessons: [],
      practices: [],
      dialogues: [],
      roleplays: [],
      challenges: [],
      phraseLessons: [],      // ✅ AJOUTÉ
      phrasePractices: []     // ✅ AJOUTÉ
    };
  },

  markJourneyComplete(type, themeId) {
    const journeys = this.getCompletedJourneys();
    if (!journeys[type]) journeys[type] = []; // Sécurité
    if (!journeys[type].includes(themeId)) {
      journeys[type].push(themeId);
      localStorage.setItem('dagospeak:completedJourneys', JSON.stringify(journeys));
    }
  },

  isJourneyComplete(type, themeId) {
    const journeys = this.getCompletedJourneys();
    return journeys[type] && journeys[type].includes(themeId);
  },

  // ✅ Calcul UNIFIÉ (utilisé partout)
  getCompletionStats() {
    const journeys = this.getCompletedJourneys();
    const allTypes = ['lessons', 'practices', 'dialogues', 'roleplays', 'challenges', 'phraseLessons', 'phrasePractices'];
    const completedJourneys = allTypes.reduce((sum, type) => sum + (journeys[type]?.length || 0), 0);
    const totalJourneys = 70; // 10 thèmes × 7 types
    return {
      completedJourneys,
      totalJourneys,
      percentage: Math.round((completedJourneys / totalJourneys) * 100)
    };
  }
};

// ═══════════════════════════════════════════════════════════
// GESTION CENTRALISÉE DU PROFIL (Source de vérité unique)
// ═══════════════════════════════════════════════════════════
function getProfileData() {
  try {
    const journeys = journeyTracker.getCompletedJourneys();
    const allTypes = ['lessons', 'practices', 'dialogues', 'roleplays', 'challenges', 'phraseLessons', 'phrasePractices'];
    const completedCount = allTypes.reduce((sum, type) => sum + (journeys[type]?.length || 0), 0);

    // ✅ Calcul XP UNIFIÉ
    const xpWeights = {
      lessons: 20, practices: 30, dialogues: 25, roleplays: 40,
      challenges: 50, phraseLessons: 25, phrasePractices: 35
    };
    const totalXP = allTypes.reduce((sum, type) => {
      return sum + ((journeys[type]?.length || 0) * (xpWeights[type] || 0));
    }, 0);

    // ✅ Calcul du streak
    const lastActivity = localStorage.getItem('dagospeak:lastActivity');
    let streak = parseInt(localStorage.getItem('dagospeak:streak') || '0');
    if (lastActivity) {
      const lastDate = new Date(lastActivity);
      const today = new Date();
      const diffDays = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
      if (diffDays > 1) {
        streak = 0;
        localStorage.setItem('dagospeak:streak', '0');
      }
    }

    // ✅ Calcul du niveau CECR
    let level = 'A0';
    if (totalXP >= 500) level = 'A2';
    else if (totalXP >= 300) level = 'A1';
    else if (totalXP >= 100) level = 'A0+';

    // ✅ Badges basés sur les thèmes complétés
    const themesCompleted = new Set();
    allTypes.forEach(type => {
      if (journeys[type]) journeys[type].forEach(t => themesCompleted.add(t));
    });
    const badges = [];
    if (themesCompleted.size >= 1) badges.push('🌱');
    if (themesCompleted.size >= 3) badges.push('⭐');
    if (themesCompleted.size >= 5) badges.push('🏆');
    if (themesCompleted.size >= 10) badges.push('👑');

    // ✅ Pourcentage UNIFIÉ
    const totalJourneys = 70;
    const percentage = Math.round((completedCount / totalJourneys) * 100);

    // ✅✅✅ CORRECTION CRITIQUE : Fusionner avec le profil utilisateur de l'onboarding
    // pour récupérer isPremium, firstName, lastName, etc.
    let isPremium = false;
    let userProfile = {};
    try {
      const userProfileRaw = localStorage.getItem('dagospeak:userProfile');
      if (userProfileRaw) {
        userProfile = JSON.parse(userProfileRaw);
        isPremium = userProfile.isPremium === true;
      }
    } catch (e) {
      console.warn('[Profile] Erreur lecture userProfile:', e);
    }

    // ✅ Vérifier aussi le flag direct (pour compatibilité)
    if (localStorage.getItem('dagospeak:isPremium') === 'true') {
      isPremium = true;
    }

    return {
      xp: totalXP,
      level: level,
      streak: streak,
      badges: badges,
      completedJourneys: completedCount,
      totalJourneys: totalJourneys,
      percentage: percentage,
      themesCompleted: themesCompleted.size,
      lastActivity: lastActivity,
      // ✅✅✅ NOUVEAU : Inclure les données Premium et utilisateur
      isPremium: isPremium,
      firstName: userProfile.firstName || 'Utilisateur',
      lastName: userProfile.lastName || '',
      region: userProfile.region || '',
      status: userProfile.status || '',
      tier: userProfile.tier || 'free'
    };
  } catch (e) {
    console.error('Erreur getProfileData:', e);
    return {
      xp: 0, level: 'A0', streak: 0, badges: [],
      completedJourneys: 0, totalJourneys: 70, percentage: 0,
      themesCompleted: 0, isPremium: false
    };
  }
}

// ✅ Sauvegarde du profil (appelée après chaque parcours)
function saveProfile() {
  const profile = getProfileData();
  localStorage.setItem('dagospeak:profile', JSON.stringify(profile));
  localStorage.setItem('dagospeak:lastActivity', new Date().toISOString());

  // Incrémenter le streak si pas déjà fait aujourd'hui
  const lastActivity = localStorage.getItem('dagospeak:lastActivity');
  const today = new Date().toDateString();
  if (lastActivity && new Date(lastActivity).toDateString() !== today) {
    const streak = parseInt(localStorage.getItem('dagospeak:streak') || '0');
    localStorage.setItem('dagospeak:streak', String(streak + 1));
  } else if (!lastActivity) {
    localStorage.setItem('dagospeak:streak', '1');
  }

  console.log('[Profile] Sauvegardé:', profile);
  return profile;
}

// ✅ Ancienne fonction (pour compatibilité)
function syncProfileWithJourneys() {
  return saveProfile();
}

    // ═══════════════════════════════════════════════════════════
    // CERTIFICATION A2 — Vérification d'éligibilité
    // ═══════════════════════════════════════════════════════════
    async function checkCertificationEligibility() {
      try {
        const response = await fetch('/content/fr/certification-a2.json');
        const certConfig = await response.json();
        const profile = getProfileData();

        const requirements = certConfig.requirements;

        const eligibility = {
          isEligible: false,
          themesCompleted: profile.themesCompleted,
          journeysCompleted: profile.completedJourneys,
          streak: profile.streak,
          totalJourneysRequired: requirements.totalJourneysRequired,
          minThemesRequired: requirements.minThemesCompleted,
          minStreakRequired: requirements.minStreakDays,
          progressPercentage: Math.min(100, Math.round((profile.completedJourneys / requirements.totalJourneysRequired) * 100)),
          missingRequirements: []
        };

        // Vérifier chaque critère
        if (profile.themesCompleted < requirements.minThemesCompleted) {
          eligibility.missingRequirements.push(`Thèmes: ${profile.themesCompleted}/${requirements.minThemesCompleted}`);
        }
        if (profile.streak < requirements.minStreakDays) {
          eligibility.missingRequirements.push(`Streak: ${profile.streak}/${requirements.minStreakDays} jours`);
        }
        if (profile.completedJourneys < requirements.totalJourneysRequired) {
          eligibility.missingRequirements.push(`Parcours: ${profile.completedJourneys}/${requirements.totalJourneysRequired}`);
        }

        eligibility.isEligible = eligibility.missingRequirements.length === 0;

        return { eligibility, certConfig };
      } catch (e) {
        console.error('[Certification] Erreur vérification:', e);
        return { eligibility: { isEligible: false }, certConfig: null };
      }
    }




// ═══════════════════════════════════════════════════════════
// FLUX PÉDAGOGIQUE CENTRALISÉ
// ═══════════════════════════════════════════════════════════
const JOURNEY_FLOW = [
  'lesson',
  'practice',
  'lesson-phrases',
  'practice-phrases',
  'dialogues',
  'roleplay',
  'challenge'
];

// Fonction pour obtenir l'étape suivante
function getNextJourney(currentStep) {
  const currentIndex = JOURNEY_FLOW.indexOf(currentStep);
  if (currentIndex === -1 || currentIndex >= JOURNEY_FLOW.length - 1) {
    return null; // Dernière étape ou étape invalide
  }
  return JOURNEY_FLOW[currentIndex + 1];
}

// Fonction pour naviguer vers l'étape suivante
function goToNextJourney(currentStep) {
  const nextStep = getNextJourney(currentStep);
  if (nextStep) {
    console.log(`[Flux] Navigation: ${currentStep} → ${nextStep}`);
    router.navigate(`/${nextStep}`);
  } else {
    console.log(`[Flux] Thème terminé! Retour aux thèmes.`);
    router.navigate('/themes');
  }
}


// ═══════════════════════════════════════════════════════════
// TRADUCTION DE L'INTERFACE (FR → MG)
// ═══════════════════════════════════════════════════════════
const i18n = {
  chooseAnswer: "Safidio ny valiny marina :",
  listen: "🔊 Mihainoa",
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


// ═══════════════════════════════════════════════════════════
// PONT DE SYNCHRONISATION PREMIUM (Onboarding -> Gamification)
// ═══════════════════════════════════════════════════════════
// Cette fonction permet à l'onboarding de mettre à jour le statut Premium
// dans la base de données (IndexedDB) utilisée par GamificationEngine.
window.syncPremiumToDB = async (isPremium) => {
  try {
    // 1. On récupère le profil actuel depuis le moteur de gamification
    const currentProfile = await gamification.getProfile();

    // 2. On met à jour le flag isPremium
    currentProfile.isPremium = isPremium;

    // 3. On sauvegarde dans IndexedDB (exactement comme dans handleUpgrade)
    await db.put('progress', currentProfile);

    console.log(`[App] ✅ Statut Premium synchronisé dans la DB: ${isPremium}`);
  } catch (err) {
    console.warn('[App] ⚠️ Échec synchronisation Premium DB:', err);
  }
};


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
// GESTION DU STATUT RÉSEAU (UX Offline Clair)
// ═══════════════════════════════════════════════════════════
function showNetworkStatus(isOnline) {
  // Supprimer l'ancienne notification si elle existe
  const existing = document.getElementById('network-toast');
  if (existing) existing.remove();

  if (!isOnline) {
    const toast = document.createElement('div');
    toast.id = 'network-toast';
    toast.style.cssText = `
      position: fixed; top: 80px; left: 50%; transform: translateX(-50%);
      background: #f59e0b; color: white; padding: 8px 16px; border-radius: 20px;
      font-size: 0.85rem; font-weight: 600; z-index: 9998;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      display: flex; align-items: center; gap: 8px;
      animation: slideDown 0.3s ease-out;
    `;
    toast.innerHTML = `<span>📶</span> Mode hors-ligne (Vos progrès sont sauvegardés)`;
    document.body.appendChild(toast);

    // Disparaît après 4 secondes
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.5s';
        setTimeout(() => toast.remove(), 500);
      }
    }, 4000);
  }
}

// Écouteurs globaux
window.addEventListener('online', () => {
  console.log('✅ Connexion rétablie');
  // Optionnel : déclencher une sync ici si tu as des données en attente
});

window.addEventListener('offline', () => {
  console.log('⚠️ Mode hors-ligne activé');
  showNetworkStatus(false);
});

// Écouteurs globaux de réseau (à placer avec votre showNetworkStatus existant)
window.addEventListener('online', () => {
  console.log('✅ Connexion rétablie');
  const existing = document.getElementById('network-toast');
  if (existing) existing.remove();

  // Toast de synchronisation
  const toast = document.createElement('div');
  toast.id = 'network-toast';
  toast.style.cssText = `position: fixed; top: 80px; left: 50%; transform: translateX(-50%); background: var(--ds-color-primary, #0A8A6E); color: white; padding: 8px 16px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; z-index: 9998; box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: flex; align-items: center; gap: 8px; animation: slideDown 0.3s ease-out;`;
  toast.innerHTML = `<span>🔄</span> Synchronisation des progrès...`;
  document.body.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.5s';
      setTimeout(() => toast.remove(), 500);
    }
  }, 3000);

  // TODO: Ici, appeler votre fonction de sync IndexedDB vers le backend si elle existe
  // ex: syncOfflineDataToServer();
});

// Vérifier l'état au démarrage
if (!navigator.onLine) {
  showNetworkStatus(false);
}

// ═══════════════════════════════════════════════════════════
// VUES
// ═══════════════════════════════════════════════════════════

/// ═══════════════════════════════════════════════════════════
// HERO CAROUSEL — Auto-slides + navigation manuelle (VERSION ROBUSTE)
// ═══════════════════════════════════════════════════════════
function initHeroCarousel() {
  console.log('[HeroCarousel] 🔄 Initialisation...');

  // ✅ Attendre que le DOM soit peint
  setTimeout(() => {
    const carousel = document.getElementById('hero-carousel');
    if (!carousel) {
      console.warn('[HeroCarousel] ⚠️ Pas de carousel trouvé dans le DOM');
      return;
    }

    const slides = carousel.querySelectorAll('.hero-slide');
    const dots = carousel.querySelectorAll('.hero-dot');

    if (slides.length === 0) {
      console.warn('[HeroCarousel] ⚠️ Aucune slide trouvée');
      return;
    }

    console.log(`[HeroCarousel] ✅ ${slides.length} slides trouvées`);

    let current = 0;
    let timer = null;

    // ✅ Appareils modestes : intervalle plus long (économie CPU/batterie)
    const isLowEnd = window.deviceCheck?.isLowEnd();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const INTERVAL = isLowEnd ? 8000 : 5000;

    const goTo = (index) => {
      slides[current].classList.remove('active');
      dots[current]?.classList.remove('active');
      dots[current]?.setAttribute('aria-selected', 'false');

      current = (index + slides.length) % slides.length;

      slides[current].classList.add('active');
      dots[current]?.classList.add('active');
      dots[current]?.setAttribute('aria-selected', 'true');
    };

    const stopAuto = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const startAuto = () => {
      if (reducedMotion) {
        console.log('[HeroCarousel] ⏸️ Auto-slide désactivé (reduced motion)');
        return;
      }
      stopAuto();
      timer = setInterval(() => {
        if (!carousel.isConnected) {
          stopAuto();
          return;
        }
        goTo(current + 1);
      }, INTERVAL);
      console.log(`[HeroCarousel] ▶️ Auto-slide démarré (intervalle: ${INTERVAL}ms)`);
    };

    // Navigation manuelle via les dots
    dots.forEach((dot, i) => {
      dot.addEventListener('click', () => {
        goTo(i);
        startAuto();
      });
    });

    // ✅ Pause au toucher (mobile) / survol (desktop)
    carousel.addEventListener('touchstart', stopAuto, { passive: true });
    carousel.addEventListener('touchend', () => setTimeout(startAuto, 3000), { passive: true });
    carousel.addEventListener('mouseenter', stopAuto);
    carousel.addEventListener('mouseleave', startAuto);

    startAuto();
  }, 100); // ✅ Attendre 100ms pour que le DOM soit peint
}


async function renderHome() {
  console.log('[renderHome] 1. Début de la fonction');
  updateNavActiveState();
  const main = document.getElementById('app');

  // ✅ NOUVEAU : Supprime le splash screen avant de charger le contenu
  const splash = document.getElementById('app-splash');
  if (splash) {
    splash.style.animation = 'splash-fadeOut 0.2s ease-out';
    setTimeout(() => splash.remove(), 200);
  }

  main.innerHTML = '<div style="text-align:center; padding:2rem;">Famakiana...</div>';

  try {
    console.log('[renderHome] 2. Chargement de roleManager...');
    await roleManager.init();

    console.log('[renderHome] 3. Chargement du profil...');
    const profile = await gamification.getProfile();
    const profileData = getProfileData();

    console.log('[renderHome] 4. Chargement du manifeste...');
    const manifest = await content.loadManifest('fr');

    // Charger la configuration des niveaux
    if (!levelsConfig) {
      try {
        const response = await fetch('/content/fr/levels.json');
        levelsConfig = await response.json();
        console.log('[App] ✅ levels.json chargé');
      } catch (e) {
        console.warn('[App] ⚠️ Impossible de charger levels.json:', e);
        levelsConfig = {
          levels: {
            A0: { freeThemes: ['survival', 'family', 'market', 'numbers', 'colors'] }
          }
        };
      }
    }

    console.log('[renderHome] 5. Manifeste chargé avec succès:', manifest);


   // ✅ 1. HERO CAROUSEL — Slides automatiques (témoignages, certification, pub)
      // ✅ 1. HERO CAROUSEL — Transparent avec images 3D + textes
const heroSlides = [
  {
    img: '/assets/hero-bg.png',
    fallback: '🇲🇬',
    type: 'image-only' // ✅ Image seule, grande
  },
  {
    img: '/assets/teacher-3d.png',
    fallback: '👩‍🏫',
    badge: 'BIENVENUE • TONGASOA',
    title: 'Manahoana ! 👋',
    text: 'Apprenez le français avec l\'IA, 100% hors-ligne.',
    sub: 'Mianara fiteny miaraka amin\'ny IA'
  },
  {
    img: '/assets/teacher-3d.png',
    fallback: '👩‍🏫',
    type: 'image-only' // ✅ Image seule, grande
  },
  {
    img: null,
    fallback: '🙋🏽‍♀️',
    badge: 'TÉMOIGNAGE VÉRIFIÉ ✅',
    title: '« Je parle français au marché ! »',
    text: 'Hanta, commerçante à Antananarivo — 3 mois sur DagoSpeak.',
    sub: 'Ny teny fototra dia tena ilaina'
  },
  {
    img: '/assets/users-3d.png',
    fallback: '👥',
    type: 'image-only' // ✅ Image seule, grande
  },
  {
    img: null,
    fallback: '🙋🏽‍♂️',
    badge: 'TÉMOIGNAGE VÉRIFIÉ ✅',
    title: '« Certifié A2, embauché ! »',
    text: 'Rivo, étudiant à Fianarantsoa — certification reconnue.',
    sub: 'Nahazo ny sertifikà A2 izy'
  },
  {
    img: null,
    fallback: '🎓',
    badge: 'CERTIFICATION RECONNUE',
    title: 'Certification A2 officielle',
    text: 'Délivrée avec nos écoles partenaires : World Of Training, Yelandar et plus.',
    sub: 'Sertifikà eken\'ny sekoly mpiara-miasa'
  },
  {
    img: null,
    fallback: '📴',
    badge: '100% HORS-LIGNE',
    title: 'Apprenez sans connexion',
    text: 'Sur tous les appareils, même modestes. Vos progrès sauvegardés.',
    sub: 'Mianara na dia tsy misy afindrano aza'
  }
];

    // ✅ 0. USER GREETING — Avatar personnalisé + prénom + statut
  const userProfileRaw = localStorage.getItem('dagospeak:userProfile');
  const userProfileGreeting = userProfileRaw ? JSON.parse(userProfileRaw) : {
    firstName: 'Apprenant',
    lastName: '',
    isPremium: false
  };
  const greetingName = userProfileGreeting.firstName || 'Apprenant';
  const greetingInitials = `${(userProfileGreeting.firstName || 'A')[0]}${(userProfileGreeting.lastName || '')[0] || ''}`.toUpperCase();
  const isPremiumGreeting = userProfileGreeting.isPremium === true || localStorage.getItem('dagospeak:isPremium') === 'true';

  const userGreetingHtml = `
    <div class="user-greeting" id="user-greeting">
      <div class="user-greeting-avatar ${isPremiumGreeting ? 'premium' : 'free'}">
        ${greetingInitials}
      </div>
      <div class="user-greeting-content">
        <div class="user-greeting-name">Salama, ${greetingName} ! 👋</div>
        <div class="user-greeting-status">
          <span class="user-greeting-badge ${isPremiumGreeting ? 'premium' : 'free'}">
            ${isPremiumGreeting ? '⭐ Premium' : '🆓 Gratuit'}
          </span>
          <span class="user-greeting-level">Niveau ${profileData.level}</span>
        </div>
      </div>
      <button class="user-greeting-profile-btn" id="btn-goto-profile" aria-label="Voir mon profil">
        👤
      </button>
    </div>
  `;

const heroHtml = `
  <div class="hero-carousel" id="hero-carousel" aria-roledescription="carrousel" aria-label="Présentation DagoSpeak">
    ${heroSlides.map((s, i) => {
      const isImageOnly = s.type === 'image-only';
      return `
        <div class="hero-slide ${i === 0 ? 'active' : ''} ${isImageOnly ? 'image-only' : ''}"
             role="group" aria-label="Slide ${i + 1} sur ${heroSlides.length}">
          ${s.img ? `
            <img class="hero-slide-img" src="${s.img}" alt="" loading="lazy" decoding="async"
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
            <span class="hero-slide-fallback" style="display:none;" aria-hidden="true">${s.fallback}</span>
          ` : `
            <span class="hero-slide-fallback" aria-hidden="true">${s.fallback}</span>
          `}
          ${!isImageOnly ? `
            <div class="hero-slide-content">
              <span class="hero-slide-badge">${s.badge}</span>
              <div class="hero-slide-title">${s.title}</div>
              <div class="hero-slide-text">${s.text}</div>
              <div class="hero-slide-sub">${s.sub}</div>
            </div>
          ` : ''}
        </div>
      `;
    }).join('')}
    <div class="hero-dots" role="tablist" aria-label="Navigation des slides">
      ${heroSlides.map((_, i) => `
        <button class="hero-dot ${i === 0 ? 'active' : ''}" data-slide="${i}"
                role="tab" aria-selected="${i === 0}" aria-label="Aller au slide ${i + 1}"></button>
      `).join('')}
    </div>
  </div>
`;

    // ✅ 2. CARTE "REPRENDRE L'APPRENTISSAGE" (si progression existe)
    let resumeCardHtml = '';
    if (profileData.completedJourneys > 0) {
      const lastTheme = localStorage.getItem('dagospeak:theme') || 'survival';
      const themeNames = {
        'survival': 'Mots de survie', 'family': 'Famille', 'market': 'Marché',
        'numbers': 'Nombres', 'colors': 'Couleurs', 'days': 'Jours',
        'months': 'Mois', 'greetings': 'Salutations', 'body': 'Corps',
        'alphabet1': 'Alphabet (A-M)', 'alphabet2': 'Alphabet (N-Z)', 'numbers2': 'Nombres (11-20)'
      };
      const themeName = themeNames[lastTheme] || lastTheme;

      resumeCardHtml = `
        <div class="home-resume-card" id="btn-resume-learning">
          <div class="home-resume-icon">🎯</div>
          <div class="home-resume-content">
            <p class="home-resume-title">Reprendre : ${themeName}</p>
            <p class="home-resume-subtitle">${profileData.completedJourneys} parcours terminés • ${profileData.percentage}% complété</p>
          </div>
          <div class="home-resume-arrow">→</div>
        </div>
      `;
    }

    // ✅ 3. STATISTIQUES RAPIDES
    const statsHtml = `
      <div class="home-stats-grid">
        <div class="home-stat-card">
          <span class="home-stat-icon">⭐</span>
          <div class="home-stat-value">${profileData.xp}</div>
          <div class="home-stat-label">XP Total</div>
        </div>
        <div class="home-stat-card">
          <span class="home-stat-icon">🔥</span>
          <div class="home-stat-value">${profileData.streak}</div>
          <div class="home-stat-label">Jours</div>
        </div>
        <div class="home-stat-card">
          <span class="home-stat-icon">🏆</span>
          <div class="home-stat-value">${profileData.level}</div>
          <div class="home-stat-label">Niveau</div>
        </div>
        <div class="home-stat-card">
          <span class="home-stat-icon">📊</span>
          <div class="home-stat-value">${profileData.percentage}%</div>
          <div class="home-stat-label">Progression</div>
        </div>
      </div>
    `;

    // ✅ 4. BOUTON DICTIONNAIRE
    const dictionaryBtnHtml = `
      <button class="home-dictionary-btn" id="btn-open-dictionary">
        <span class="home-dictionary-icon">📖</span>
        <p class="home-dictionary-title">Dictionnaire Intelligent</p>
        <p class="home-dictionary-subtitle">Rakibolana FR ↔ MG • 102 mots disponibles</p>
      </button>
    `;

    // ✅ 5. CARTES DE NIVEAUX AMÉLIORÉES
    const levelInfo = {
      'A0': {
        icon: '🌱',
        titleFr: 'Niveau A0',
        titleMg: 'Ambaratonga A0 : Mpianatra',
        descFr: 'Les premiers mots pour survivre au quotidien',
        descMg: 'Ny teny voalohany hahafahana miaina isan\'andro'
      },
      'A1': {
        icon: '📚',
        titleFr: 'Niveau A1',
        titleMg: 'Ambaratonga A1 : Fototra',
        descFr: 'Vocabulaire essentiel : famille, marché, couleurs',
        descMg: 'Teny ilaina : fianakaviana, tsena, loko'
      }
    };

    const levelsHtml = manifest.levels.map((level, idx) => {
      const isFree = level.id === 'A0' || level.id === 'A1';
      const isUnlocked = isFree || profile.isPremium;
      const info = levelInfo[level.id] || {
        icon: '📁',
        titleFr: `Niveau ${level.id}`,
        titleMg: '',
        descFr: level.description || '',
        descMg: ''
      };

      return `
        <div class="home-level-card ${!isUnlocked ? 'locked' : ''} btn-select-level"
             data-level="${level.id}"
             style="animation-delay: ${1.1 + idx * 0.1}s">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div style="display:flex; align-items:center; gap: 1.2rem;">
              <div class="home-level-icon">${info.icon}</div>
              <div>
                <h3 class="home-level-title">${info.titleFr}</h3>
                <p class="home-level-title-mg">${info.titleMg}</p>
              </div>
            </div>
            <span style="font-size:1.8rem;">${isUnlocked ? '🔓' : '🔒'}</span>
          </div>
          <div>
            <p class="home-level-desc">${info.descFr}</p>
            <p class="home-level-desc-mg">${info.descMg}</p>
          </div>
          ${isUnlocked ? `
            <ds-button class="btn-select-level" data-level="${level.id}"
                       variant="${level.id === 'A0' ? 'success' : 'primary'}" size="sm"
                       style="margin-top: 0.5rem;">
              Jereo ny lohahevitra (Voir les thèmes)
            </ds-button>
          ` : `
            <ds-button class="btn-upgrade" data-level="${level.id}" variant="accent" size="sm">
              ⭐ Débloquer avec Premium
            </ds-button>
          `}
        </div>
      `;
    }).join('');

    // ✅ 6. SECTION FONCTIONNALITÉS CLÉS
    const featuresHtml = `
      <div class="home-features-section">
        <h3 class="home-features-title">✨ Pourquoi DagoSpeak ?</h3>
        <div class="home-features-grid">
          <div class="home-feature-item">
            <span class="home-feature-icon">📴</span>
            <p class="home-feature-text">100% Hors-ligne</p>
          </div>
          <div class="home-feature-item">
            <span class="home-feature-icon">🤖</span>
            <p class="home-feature-text">Teacher Avatar IA</p>
          </div>
          <div class="home-feature-item">
            <span class="home-feature-icon">🎤</span>
            <p class="home-feature-text">Reconnaissance vocale</p>
          </div>
          <div class="home-feature-item">
            <span class="home-feature-icon">📱</span>
            <p class="home-feature-text">Appareils modestes</p>
          </div>
        </div>
      </div>
    `;

    // ✅ 6.5 BOUTON PARTAGER L'APP (croissance virale)
    const shareAppHtml = `
      <div style="margin-top: 1.5rem; padding: 1.5rem; background: linear-gradient(135deg, var(--ds-color-primary) 0%, var(--ds-color-accent) 100%); border-radius: var(--ds-radius-lg); text-align: center; color: white;">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">🤝</div>
        <h3 style="margin-bottom: 0.5rem; font-size: 1.1rem;">Inviter des amis</h3>
        <p style="font-size: 0.85rem; opacity: 0.9; margin-bottom: 1rem;">Apprendre à plusieurs, c'est plus motivant !</p>
        <button id="btn-share-app" style="
          background: white;
          color: var(--ds-color-primary);
          border: none;
          padding: 12px 24px;
          border-radius: 50px;
          font-weight: 700;
          font-size: 0.95rem;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          width: 100%;
        ">📤 Partager DagoSpeak</button>
      </div>
    `;

    // ✅ 7. INJECTION DANS LE DOM
    main.innerHTML = `
      <section class="ds-home" style="padding: 1rem; max-width: 800px; margin: 0 auto;">
        ${userGreetingHtml}
        ${heroHtml}
        ${resumeCardHtml}
        ${statsHtml}
        ${dictionaryBtnHtml}

        <h2 class="home-levels-title">Safidio ny ambaratonga</h2>
        <p class="home-levels-subtitle">(Choisissez votre niveau d'apprentissage)</p>

        <div id="levels-container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
          ${levelsHtml}
        </div>

        ${featuresHtml}
        ${shareAppHtml}
      </section>
    `;

    // ✅ 8. ÉCOUTEURS D'ÉVÉNEMENTS
    // Bouton "Reprendre l'apprentissage"
    document.getElementById('btn-resume-learning')?.addEventListener('click', () => {
      const lastTheme = localStorage.getItem('dagospeak:theme') || 'survival';
      currentTheme = lastTheme;
      router.navigate('/theme-detail');
    });

    // Bouton Dictionnaire
    document.getElementById('btn-open-dictionary')?.addEventListener('click', () => {
      // ✅ Initialiser le hero carousel
      router.navigate('/dictionary');
    });

    // ✅ Bouton aller au profil depuis la salutation
    document.getElementById('btn-goto-profile')?.addEventListener('click', () => {
      router.navigate('/profile');
    });


    // ✅ Bouton Partager l'app
      document.getElementById('btn-share-app')?.addEventListener('click', async () => {
        const btn = document.getElementById('btn-share-app');
        btn.textContent = '📤 Partage en cours...';

        const result = await window.shareManager.shareApp();

        if (result.method === 'cancelled') {
          btn.textContent = '📤 Partager DagoSpeak';
        } else if (result.success) {
          btn.textContent = '✅ Merci pour le partage !';
          setTimeout(() => { btn.textContent = '📤 Partager DagoSpeak'; }, 2000);
        } else {
          btn.textContent = '📤 Partager DagoSpeak';
        }
      });

    // ✅ ÉCOUTEUR 100% INFAILLIBLE (gère parfaitement le Shadow DOM avec composedPath)
      // ✅ ÉCOUTEUR INFAILLIBLE avec AbortController (évite les fuites)
        // Supprimer l'ancien écouteur si existe
        if (window._levelsContainerAbort) {
          window._levelsContainerAbort.abort();
        }
        window._levelsContainerAbort = new AbortController();

        document.getElementById('levels-container').addEventListener('click', (e) => {
          const path = e.composedPath();
          const target = path.find(el => el instanceof HTMLElement && el.dataset?.level);

          if (target) {
            const selectedLevel = target.dataset.level;
            console.log(`[Home] ✅ Clic détecté sur le niveau : ${selectedLevel}`);

            currentLevel = selectedLevel;
            currentTheme = null;
            localStorage.setItem('dagospeak:level', currentLevel);
            updateLevelUI();

            console.log('[Home] 🚀 Navigation vers /themes en cours...');
            router.navigate('/themes');

            e.preventDefault();
            e.stopPropagation();
            return;
          }
        }, { signal: window._levelsContainerAbort.signal });

      // ✅ Initialiser le hero carousel (auto-slides)
      initHeroCarousel();


    // ✅ SÉCURITÉ : Vérifier que l'avatar est bien initialisé
    if (window.teacherAvatar) {
      window.teacherAvatar.show('home');
    } else {
      console.warn('[renderHome] TeacherAvatar pas encore initialisé');
    }

    renderFloatingHomeButtons();

    logger.info('✅ Page d\'accueil rendue (version améliorée)');
    } catch (e) {
    showError(main, e, {
      title: 'Erreur de démarrage',
      subtitle: 'L\'application n\'a pas pu démarrer correctement',
      backRoute: '/',
      backLabel: '🔄 Recharger la page',
      retry: true
    });
  }
}


// ═══════════════════════════════════════════════════════════
// GÉNÉRATION DU CERTIFICAT A2 (Canvas natif - 100% offline)
// ═══════════════════════════════════════════════════════════
async function downloadCertificate(fullName, issueDate) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 850;
  const ctx = canvas.getContext('2d');

  // ─── Fond dégradé ───
  const bgGradient = ctx.createLinearGradient(0, 0, 1200, 850);
  bgGradient.addColorStop(0, '#ffffff');
  bgGradient.addColorStop(1, '#f4f4f0');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, 1200, 850);

  // ─── Bordure extérieure (ocre) ───
  ctx.strokeStyle = '#E8A33D';
  ctx.lineWidth = 16;
  ctx.strokeRect(30, 30, 1140, 790);

  // ─── Bordure intérieure (verte) ───
  ctx.strokeStyle = '#0A8A6E';
  ctx.lineWidth = 3;
  ctx.strokeRect(60, 60, 1080, 730);

  // ─── Cercles dans les coins ───
  const corners = [
    { x: 60, y: 60 }, { x: 1140, y: 60 },
    { x: 60, y: 790 }, { x: 1140, y: 790 }
  ];
  ctx.fillStyle = '#E8A33D';
  corners.forEach(c => {
    ctx.beginPath();
    ctx.arc(c.x, c.y, 12, 0, Math.PI * 2);
    ctx.fill();
  });

  // ─── Trophée ───
  ctx.font = '100px serif';
  ctx.textAlign = 'center';
  ctx.fillText('🏆', 600, 180);

  // ─── Titre ───
  ctx.fillStyle = '#0A8A6E';
  ctx.font = 'bold 52px Arial, sans-serif';
  ctx.fillText('Certificat de Maîtrise', 600, 260);

  // ─── Sous-titre ───
  ctx.fillStyle = '#6b7280';
  ctx.font = '26px Arial, sans-serif';
  ctx.fillText('Niveau A2 - Français pour débutants', 600, 305);

  // ─── Séparation ───
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(250, 340);
  ctx.lineTo(950, 340);
  ctx.stroke();

  // ─── "Décerné à" ───
  ctx.fillStyle = '#1A1A1A';
  ctx.font = '24px Arial, sans-serif';
  ctx.fillText('Décerné à', 600, 400);

  // ─── Nom ───
  ctx.fillStyle = '#0A8A6E';
  ctx.font = 'bold 48px Georgia, serif';
  ctx.fillText(fullName || 'Apprenant DagoSpeak', 600, 465);

  // ─── Ligne sous le nom ───
  ctx.strokeStyle = '#E8A33D';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(350, 490);
  ctx.lineTo(850, 490);
  ctx.stroke();

  // ─── Félicitations ───
  ctx.fillStyle = '#374151';
  ctx.font = '22px Arial, sans-serif';
  ctx.fillText('Pour avoir complété avec succès l\'ensemble du programme', 600, 555);
  ctx.fillText('d\'apprentissage du français niveau A2 sur DagoSpeak', 600, 590);

  // ─── Statistiques ───
  const profile = getProfileData();
  ctx.fillStyle = '#E8A33D';
  ctx.font = 'bold 28px Arial, sans-serif';
  ctx.fillText(`${profile.xp} XP  •  ${profile.completedJourneys} parcours  •  ${profile.themesCompleted} thèmes`, 600, 650);

  // ─── Date ───
  ctx.strokeStyle = '#9ca3af';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(200, 730);
  ctx.lineTo(450, 730);
  ctx.stroke();
  ctx.fillStyle = '#374151';
  ctx.font = '20px Arial, sans-serif';
  ctx.fillText(issueDate, 325, 755);
  ctx.fillStyle = '#9ca3af';
  ctx.font = '16px Arial, sans-serif';
  ctx.fillText('Date d\'émission', 325, 778);

  // ─── Signature ───
  ctx.beginPath();
  ctx.moveTo(750, 730);
  ctx.lineTo(1000, 730);
  ctx.stroke();
  ctx.fillStyle = '#0A8A6E';
  ctx.font = 'italic 24px Georgia, serif';
  ctx.fillText('DagoSpeak', 875, 720);
  ctx.fillStyle = '#9ca3af';
  ctx.font = '16px Arial, sans-serif';
  ctx.fillText('DagoSpeak Madagascar', 875, 778);

  // ✅ Retourne le blob (pour téléchargement ET partage)
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve({ blob, canvas });
    }, 'image/png');
  });
}

// ═══════════════════════════════════════════════════════════
// VUE : CERTIFICATION A2
// ═══════════════════════════════════════════════════════════
async function renderCertification() {
  updateNavActiveState();
  const main = document.getElementById('app');
  main.innerHTML = getSkeletonProfile();

  try {
    const profile = getProfileData();
    const userProfile = JSON.parse(localStorage.getItem('dagospeak:userProfile') || '{}');
    const fullName = `${userProfile.firstName || 'Apprenant'} ${userProfile.lastName || ''}`.trim();

    // Critères par défaut (fallback si le fichier JSON est manquant)
    const requirements = {
      minThemesCompleted: 10,
      minStreakDays: 7,
      totalJourneysRequired: 70
    };

    // Essayer de charger la config, sinon utiliser les valeurs par défaut
    try {
      const response = await fetch('/content/fr/certification-a2.json');
      if (response.ok) {
        const certConfig = await response.json();
        Object.assign(requirements, certConfig.requirements);
      }
    } catch (e) {
      console.warn('[Certification] Config file not found, using defaults');
    }

    // Calcul de l'éligibilité
    const eligibility = {
      isEligible: false,
      themesCompleted: profile.themesCompleted,
      journeysCompleted: profile.completedJourneys,
      streak: profile.streak,
      totalJourneysRequired: requirements.totalJourneysRequired,
      minThemesRequired: requirements.minThemesCompleted,
      minStreakRequired: requirements.minStreakDays,
      progressPercentage: Math.min(100, Math.round((profile.completedJourneys / requirements.totalJourneysRequired) * 100)),
      missingRequirements: []
    };

    if (profile.themesCompleted < requirements.minThemesCompleted) {
      eligibility.missingRequirements.push(`Thèmes: ${profile.themesCompleted}/${requirements.minThemesCompleted}`);
    }
    if (profile.streak < requirements.minStreakDays) {
      eligibility.missingRequirements.push(`Streak: ${profile.streak}/${requirements.minStreakDays} jours`);
    }
    if (profile.completedJourneys < requirements.totalJourneysRequired) {
      eligibility.missingRequirements.push(`Parcours: ${profile.completedJourneys}/${requirements.totalJourneysRequired}`);
    }

    eligibility.isEligible = eligibility.missingRequirements.length === 0;

    const issueDate = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });

    if (eligibility.isEligible) {
      // ✅ CERTIFICAT DÉBLOQUÉ
      main.innerHTML = `
        <section style="max-width: 600px; margin: 0 auto; padding: 2rem 1rem; animation: fadeInUp 0.4s ease-out;">
          <ds-button variant="ghost" size="sm" id="btn-back-cert" style="margin-bottom: 1rem;">← Retour au profil</ds-button>

          <div style="text-align: center; margin-bottom: 2rem;">
            <div style="font-size: 4rem; margin-bottom: 1rem;">🎓</div>
            <h2 style="color: var(--ds-color-success); margin-bottom: 0.5rem;">Félicitations !</h2>
            <p style="color: var(--ds-color-text-muted);">Vous avez obtenu la certification A2</p>
          </div>

          <div id="certificate" style="
            background: linear-gradient(135deg, var(--ds-color-surface) 0%, var(--ds-color-surface-2) 100%);
            border: 8px solid var(--ds-color-accent);
            border-radius: var(--ds-radius-lg);
            padding: 2rem 1.5rem;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0,0,0,0.15);
            position: relative;
          ">
            <div style="position: absolute; top: 15px; right: 15px; font-size: 2.5rem; opacity: 0.2;">🏆</div>

            <h1 style="color: var(--ds-color-primary); font-size: 1.5rem; margin-bottom: 0.25rem;">Certificat de Maîtrise</h1>
            <p style="color: var(--ds-color-text-muted); font-size: 0.9rem; margin-bottom: 1.5rem;">Niveau A2 - Français pour débutants</p>

            <div style="border-top: 2px solid var(--ds-color-border); border-bottom: 2px solid var(--ds-color-border); padding: 1.5rem 0; margin: 1rem 0;">
              <p style="color: var(--ds-color-text); font-size: 0.95rem; margin-bottom: 0.5rem;">Décerné à</p>
              <h2 style="color: var(--ds-color-text); font-size: 1.5rem; margin-bottom: 0.75rem;">${fullName || 'Apprenant DagoSpeak'}</h2>
              <p style="color: var(--ds-color-text-muted); line-height: 1.5; font-size: 0.9rem;">
                Pour avoir complété avec succès l'ensemble du programme d'apprentissage du français niveau A2
              </p>
            </div>

            <div style="display: flex; justify-content: space-around; margin-top: 1.5rem; font-size: 0.85rem;">
              <div>
                <p style="color: var(--ds-color-text-muted); margin: 0;">Date</p>
                <p style="color: var(--ds-color-text); font-weight: 600; margin: 0;">${issueDate}</p>
              </div>
              <div>
                <p style="color: var(--ds-color-text-muted); margin: 0;">Validité</p>
                <p style="color: var(--ds-color-text); font-weight: 600; margin: 0;">À vie</p>
              </div>
            </div>

            <p style="color: var(--ds-color-text-muted); font-size: 0.75rem; margin-top: 1.5rem; font-style: italic;">
              DagoSpeak Madagascar
            </p>
          </div>

          <div style="display: flex; gap: 0.75rem; margin-top: 1.5rem;">
            <button id="btn-download-cert" style="
              flex: 1;
              background: var(--ds-color-surface);
              color: var(--ds-color-primary);
              border: 2px solid var(--ds-color-primary);
              padding: 14px 16px;
              border-radius: var(--ds-radius-md);
              font-weight: 600;
              font-size: 0.95rem;
              cursor: pointer;
            ">📥 Télécharger</button>

            <button id="btn-share-cert" style="
              flex: 1;
              background: var(--ds-color-primary);
              color: white;
              border: none;
              padding: 14px 16px;
              border-radius: var(--ds-radius-md);
              font-weight: 600;
              font-size: 0.95rem;
              cursor: pointer;
            ">📤 Partager</button>
          </div>
        </section>
      `;

     document.getElementById('btn-back-cert')?.addEventListener('click', () => router.navigate('/profile'));

// ✅ Télécharger le certificat
document.getElementById('btn-download-cert')?.addEventListener('click', async () => {
  const btn = document.getElementById('btn-download-cert');
  btn.textContent = '⏳ Génération...';

  const nameEl = document.querySelector('#certificate h2');
  const certFullName = nameEl ? nameEl.textContent.trim() : fullName;

  const { blob } = await downloadCertificate(certFullName, issueDate);

  if (blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `DagoSpeak-Certification-A2-${certFullName.replace(/\s+/g, '-')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    btn.textContent = '✅ Téléchargé !';
    if (window.haptics) window.haptics.medium();
  } else {
    btn.textContent = '❌ Erreur';
  }

  setTimeout(() => { btn.textContent = '📥 Télécharger'; }, 2000);
});

      // ✅ Partager le certificat
      document.getElementById('btn-share-cert')?.addEventListener('click', async () => {
        const btn = document.getElementById('btn-share-cert');
        btn.textContent = '⏳ Préparation...';

        const nameEl = document.querySelector('#certificate h2');
        const certFullName = nameEl ? nameEl.textContent.trim() : fullName;
        const fileName = `DagoSpeak-Certification-A2-${certFullName.replace(/\s+/g, '-')}.png`;

        const { blob } = await downloadCertificate(certFullName, issueDate);

        if (blob) {
          const result = await window.shareManager.shareCertificate(blob, fileName);

          if (result.method === 'cancelled') {
            btn.textContent = '📤 Partager';
          } else if (result.success) {
            btn.textContent = '✅ Partagé !';
          } else if (result.method === 'fallback-download') {
            // Pas de support partage fichier → télécharger à la place
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            btn.textContent = '📥 Téléchargé';
          } else {
            btn.textContent = '📤 Partager';
          }
        }

        setTimeout(() => { btn.textContent = '📤 Partager'; }, 2000);
      });

    } else {
      // ❌ PAS ENCORE ÉLIGIBLE
      main.innerHTML = `
        <section style="max-width: 600px; margin: 0 auto; padding: 2rem 1rem; animation: fadeInUp 0.4s ease-out;">
          <ds-button variant="ghost" size="sm" id="btn-back-cert" style="margin-bottom: 1rem;">← Retour au profil</ds-button>

          <div style="text-align: center; margin-bottom: 2rem;">
            <div style="font-size: 4rem; margin-bottom: 1rem;">🎯</div>
            <h2 style="color: var(--ds-color-primary); margin-bottom: 0.5rem;">Certification A2</h2>
            <p style="color: var(--ds-color-text-muted);">Progressez vers votre certification</p>
          </div>

          <div style="background: var(--ds-color-surface); padding: 2rem; border-radius: var(--ds-radius-lg); box-shadow: var(--ds-shadow-md); text-align: center; margin-bottom: 1.5rem;">
            <p style="color: var(--ds-color-text); font-weight: 600; margin-bottom: 1rem;">Progression globale</p>
            <div style="
              width: 120px;
              height: 120px;
              border-radius: 50%;
              background: conic-gradient(
                var(--ds-color-primary) 0deg ${eligibility.progressPercentage * 3.6}deg,
                var(--ds-color-surface-2) ${eligibility.progressPercentage * 3.6}deg 360deg
              );
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto;
              position: relative;
            ">
              <div style="
                width: 100px;
                height: 100px;
                border-radius: 50%;
                background: var(--ds-color-surface);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.5rem;
                font-weight: 700;
                color: var(--ds-color-primary);
              ">
                ${eligibility.progressPercentage}%
              </div>
            </div>
          </div>

          <div style="background: var(--ds-color-surface); padding: 1.5rem; border-radius: var(--ds-radius-lg); box-shadow: var(--ds-shadow-md);">
            <h3 style="color: var(--ds-color-text); margin-bottom: 1rem;">Critères à remplir</h3>
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--ds-color-surface-2); border-radius: var(--ds-radius-md);">
                <span>📚 Thèmes complétés</span>
                <strong style="color: ${eligibility.themesCompleted >= eligibility.minThemesRequired ? 'var(--ds-color-success)' : 'var(--ds-color-text)'};">
                  ${eligibility.themesCompleted}/${eligibility.minThemesRequired}
                </strong>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--ds-color-surface-2); border-radius: var(--ds-radius-md);">
                <span>🎯 Parcours terminés</span>
                <strong style="color: ${eligibility.journeysCompleted >= eligibility.totalJourneysRequired ? 'var(--ds-color-success)' : 'var(--ds-color-text)'};">
                  ${eligibility.journeysCompleted}/${eligibility.totalJourneysRequired}
                </strong>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--ds-color-surface-2); border-radius: var(--ds-radius-md);">
                <span>🔥 Streak minimum</span>
                <strong style="color: ${eligibility.streak >= eligibility.minStreakRequired ? 'var(--ds-color-success)' : 'var(--ds-color-text)'};">
                  ${eligibility.streak}/${eligibility.minStreakRequired} jours
                </strong>
              </div>
            </div>

            ${eligibility.missingRequirements.length > 0 ? `
              <div style="margin-top: 1.5rem; padding: 1rem; background: var(--ds-color-warning-soft, #fef3c7); border-radius: var(--ds-radius-md); border-left: 4px solid var(--ds-color-warning);">
                <p style="color: var(--ds-color-text); font-size: 0.9rem; margin: 0;">
                  <strong>Il vous manque :</strong><br>
                  ${eligibility.missingRequirements.join('<br>')}
                </p>
              </div>
            ` : ''}
          </div>

          <button id="btn-continue-learning" style="
            width: 100%;
            background: var(--ds-color-primary);
            color: white;
            border: none;
            padding: 14px 24px;
            border-radius: var(--ds-radius-md);
            font-weight: 600;
            font-size: 1rem;
            cursor: pointer;
            margin-top: 1.5rem;
          ">🚀 Continuer l'apprentissage</button>
        </section>
      `;

      document.getElementById('btn-back-cert')?.addEventListener('click', () => router.navigate('/profile'));
      document.getElementById('btn-continue-learning')?.addEventListener('click', () => router.navigate('/themes'));
    }

    logger.info(`✅ Page Certification rendue (éligible: ${eligibility.isEligible})`);
  } catch (e) {
    console.error('[Certification] Erreur:', e);
    showError(main, e, {
      title: 'Erreur de certification',
      subtitle: 'Impossible de vérifier votre éligibilité',
      backRoute: '/profile',
      backLabel: '← Retour au profil',
      retry: true
    });
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
  updateNavActiveState();
  const main = document.getElementById('app');
  let currentTab = 'info';

  const renderTab = (tab) => {
    currentTab = tab;

    let contentHtml = '';

    if (tab === 'info') {
      contentHtml = `
        <section style="max-width: 700px; margin: 0 auto; padding: 2rem 1rem;">
          <ds-button variant="ghost" size="sm" id="btn-back" style="margin-bottom: 1rem;">← Miverina (Retour)</ds-button>
          <h1 style="text-align: center; margin-bottom: 2rem;">️ Mombamomba ny DagoSpeak</h1>

          <div style="background: var(--ds-color-surface); padding: 2rem; border-radius: var(--ds-radius-lg); box-shadow: var(--ds-shadow-md); margin-bottom: 2rem; text-align: center;">
            <img src="/assets/mds-logo.png" loading="lazy" decoding="async alt="Mada Digital Services" style="max-width: 200px; margin-bottom: 1rem; border-radius: var(--ds-radius-md);" />
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
              <li>✅ Reconnaissance vocale avec IA (Whisper + Web Speech API)</li>
              <li>✅ Adapté aux téléphones modestes (2GB RAM)</li>
              <li>✅ Dictionnaire intelligent intégré</li>
              <li>✅ Conversations semi-libres avec Teacher IA</li>
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
      contentHtml = `
        <section style="max-width: 700px; margin: 0 auto; padding: 2rem 1rem;">
          <ds-button variant="ghost" size="sm" id="btn-back" style="margin-bottom: 1rem;">← Miverina (Retour)</ds-button>
          <h1 style="text-align: center; margin-bottom: 2rem;">💰 Tolotra (Offres)</h1>

          <div style="background: var(--ds-color-primary-soft); padding: 1.5rem; border-radius: var(--ds-radius-lg); border: 1px solid var(--ds-color-primary); margin-bottom: 2rem; text-align: center;">
            <h3 style="color: var(--ds-color-primary); margin-bottom: 0.5rem;">🎓 Offres basées sur les niveaux d'apprentissage</h3>
            <p style="color: var(--ds-color-text-muted); font-size: 0.9rem; margin: 0;">
              Notre plateforme évolue avec vous. Commencez gratuitement et passez au Premium quand vous êtes prêt.
            </p>
          </div>

          <div style="display: grid; gap: 1.5rem;">
            <!-- Option Gratuite - MISE EN ÉVIDENCE -->
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 2rem; border-radius: var(--ds-radius-lg); box-shadow: 0 8px 24px rgba(16, 185, 129, 0.3); border: 3px solid #059669;">
              <h3 style="margin-bottom: 0.5rem; font-size: 1.5rem;">🆓 Option Gratuite</h3>
              <p style="margin-bottom: 1rem; opacity: 0.95;">Accès complet au niveau A0 (Débutant)</p>
              <ul style="line-height: 1.8; padding-left: 1.5rem; margin-bottom: 1rem;">
                <li>✅ 5 thèmes de base (Survie, Famille, Marché, Nombres, Couleurs)</li>
                <li>✅ Mode hors-ligne complet</li>
                <li>✅ Teacher Avatar IA</li>
                <li>✅ Progression gamifiée</li>
                <li> Niveaux avancés (A1, A2, B1, B2, C1, C2)</li>
                <li>❌ Certifications officielles</li>
              </ul>
              <div style="font-size: 1.5rem; font-weight: bold;">0 Ar / mois</div>
            </div>

            <!-- Premium Starter A0-A2 - POPULAIRE -->
            <div style="background: var(--ds-color-surface); padding: 2rem; border-radius: var(--ds-radius-lg); border: 2px solid var(--ds-color-primary); position: relative;">
              <div style="position: absolute; top: -10px; right: 20px; background: var(--ds-color-accent); color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: bold;">POPULAIRE</div>
              <h3 style="color: var(--ds-color-primary); margin-bottom: 0.5rem;">⭐ Premium Starter (A0-A2)</h3>
              <p style="color: var(--ds-color-text-muted); margin-bottom: 1rem;">Niveaux Débutant à Intermédiaire</p>
              <ul style="line-height: 1.8; padding-left: 1.5rem; margin-bottom: 1rem;">
                <li>✅ Tous les thèmes A0, A1, A2</li>
                <li>✅ Dictionnaire intelligent</li>
                <li>✅ Conversations semi-libres avec Teacher IA</li>
                <li>✅ Examens de certification interne</li>
                <li>✅ Certifications reconnues (World Of Training, Yelandar)</li>
              </ul>
              <div style="font-size: 1.3rem; font-weight: bold; color: var(--ds-color-primary); margin-bottom: 0.5rem;">
                15 000 Ar / mois <span style="font-size: 0.9rem; font-weight: normal;">(Étudiants partenaires)</span>
              </div>
              <div style="font-size: 1.3rem; font-weight: bold; color: var(--ds-color-primary); margin-bottom: 1rem;">
                20 000 Ar / mois <span style="font-size: 0.9rem; font-weight: normal;">(Travailleurs)</span>
              </div>
              <div style="font-size: 0.9rem; color: var(--ds-color-text-muted); margin-bottom: 1rem;">
                Certification A2 : 50 000 Ar (une fois)
              </div>
              <ds-button size="lg" variant="primary" style="width: 100%;">Manomboka (Commencer)</ds-button>
            </div>

            <!-- Premium B1-B2 -->
            <div style="background: var(--ds-color-surface); padding: 2rem; border-radius: var(--ds-radius-lg); border: 2px solid var(--ds-color-border);">
              <h3 style="color: var(--ds-color-text); margin-bottom: 0.5rem;">🎯 Premium Intermédiaire (B1-B2)</h3>
              <p style="color: var(--ds-color-text-muted); margin-bottom: 1rem;">Niveau Intermédiaire à Avancé</p>
              <ul style="line-height: 1.8; padding-left: 1.5rem; margin-bottom: 1rem;">
                <li>✅ Tous les thèmes B1, B2</li>
                <li>✅ Conversations avancées</li>
                <li>✅ Certification B2 reconnue</li>
              </ul>
              <div style="font-size: 1.5rem; font-weight: bold; color: var(--ds-color-text);">25 000 Ar / mois</div>
            </div>

            <!-- Premium C1-C2 -->
            <div style="background: var(--ds-color-surface); padding: 2rem; border-radius: var(--ds-radius-lg); border: 2px solid var(--ds-color-border);">
              <h3 style="color: var(--ds-color-text); margin-bottom: 0.5rem;"> Premium Expert (C1-C2)</h3>
              <p style="color: var(--ds-color-text-muted); margin-bottom: 1rem;">Niveau Expert à Maîtrise</p>
              <ul style="line-height: 1.8; padding-left: 1.5rem; margin-bottom: 1rem;">
                <li>✅ Tous les thèmes C1, C2</li>
                <li>✅ Conversations libres avec IA</li>
                <li>✅ Certification C2 reconnue</li>
              </ul>
              <div style="font-size: 1.5rem; font-weight: bold; color: var(--ds-color-text);">30 000 Ar / mois</div>
            </div>
          </div>

          <div style="margin-top: 2rem; padding: 1.5rem; background: var(--ds-color-surface-2); border-radius: var(--ds-radius-lg); text-align: center;">
            <p style="margin: 0; font-size: 0.9rem; color: var(--ds-color-text-muted);">
               Propulsé par <strong>CPA Madagascar</strong> et les équipes de <strong>Web Services Mada</strong>, <strong>Mobile Services Mada</strong> de <strong>MDS (Mada Digital Services)</strong>
            </p>
            <p style="margin: 0.5rem 0 0 0; font-size: 0.85rem; color: var(--ds-color-text-muted);">
              🎓 Partenaires de certification : <strong>World Of Training</strong> et <strong>Yelandar</strong>
            </p>
          </div>
        </section>
      `;
    } else if (tab === 'certification') {
      contentHtml = `
        <section style="max-width: 700px; margin: 0 auto; padding: 2rem 1rem;">
          <ds-button variant="ghost" size="sm" id="btn-back" style="margin-bottom: 1rem;">← Miverina (Retour)</ds-button>
          <h1 style="text-align: center; margin-bottom: 2rem;">🎓 Certificat (Certification)</h1>

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
          <ds-button variant="${currentTab === 'info' ? 'primary' : 'ghost'}" size="sm" data-tab="info" style="flex: 1; min-width: 90px; font-size: 0.8rem;">
            ️ Info
          </ds-button>
          <ds-button variant="${currentTab === 'offers' ? 'primary' : 'ghost'}" size="sm" data-tab="offers" style="flex: 1; min-width: 90px; font-size: 0.8rem;">
            💰 Offres
          </ds-button>
          <ds-button variant="${currentTab === 'certification' ? 'primary' : 'ghost'}" size="sm" data-tab="certification" style="flex: 1; min-width: 90px; font-size: 0.8rem;">
            🎓 Certificat
          </ds-button>
        </div>
      </div>
    `;

    main.innerHTML = tabsHtml + contentHtml;

    document.getElementById('btn-back').addEventListener('click', () => router.navigate('/'));
    document.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        renderTab(btn.dataset.tab);
      });
    });
  };

  renderTab('info');
}



// Fonction helper pour gérer l'upgrade Premium
async function renderLesson() {
  const main = document.getElementById('app');
  main.innerHTML = '<div style="text-align:center; padding:2rem;">Chargement de la leçon...</div>';
  renderProgressHeader();

  try {
    const floatActions = document.getElementById('floating-home-actions');
    if (floatActions) floatActions.remove();

    // ✅ NOUVEAU : Validation de currentTheme
    if (!currentTheme || currentTheme === 'null') {
      // Rediriger vers les thèmes si pas de thème sélectionné
      router.navigate('/themes');
      return;
    }

    const manifest = await content.loadManifest('fr');

    const levelData = manifest.levels.find(l => l.id === currentLevel);

    if (!levelData) {
      throw new Error(`Niveau ${currentLevel} introuvable dans le manifest`);
    }

    const unitId = currentTheme || levelData.units[0];
    currentTheme = unitId;

    console.log(`[renderLesson] Chargement vocabulaire pour: ${unitId}`);
    const vocabData = await content.loadSection('fr', 'vocabulary', unitId);

    // ✅ NOUVEAU : Logs de debug
    console.log('[renderLesson] vocabData:', vocabData);
    console.log('[renderLesson] words:', vocabData?.words);

    // ✅ NOUVEAU : Validation robuste de vocabData
    if (!vocabData) {
      throw new Error(`Données de vocabulaire introuvables pour le thème "${unitId}"`);
    }

    // ✅ NOUVEAU : Gérer différentes structures possibles
    const words = vocabData.items || vocabData.words || [];

    if (!Array.isArray(words)) {
      console.error('[renderLesson] vocabData structure:', vocabData);
      throw new Error(`Structure de vocabulaire invalide pour "${unitId}". Expected array, got: ${typeof words}`);
    }

    if (words.length === 0) {
      throw new Error(`Aucun mot trouvé pour le thème "${unitId}"`);
    }

    // ✅ NOUVEAU : Barre de progression de la leçon
    const totalWords = words.length;
    // ✅ NOUVEAU : Utiliser un objet pour stocker l'état (évite les conflits de scope)
      const lessonState = {
        currentWordIndex: 0,
        totalWords: words.length
      };

      // ✅ NOUVEAU : Fonction pour mettre à jour la progression
      window.updateLessonProgress = (currentIndex) => {
        lessonState.currentWordIndex = currentIndex;
        const percent = Math.round(((currentIndex + 1) / lessonState.totalWords) * 100);

        const progressBar = document.getElementById('progress-bar-fill');
        const wordNum = document.getElementById('current-word-num');

        if (progressBar) {
          progressBar.style.width = `${percent}%`;
        }
        if (wordNum) {
          wordNum.textContent = currentIndex + 1;
        }

        const percentEl = document.querySelector('#lesson-progress span:last-child');
        if (percentEl) {
          percentEl.textContent = `${percent}%`;
        }
      };

      // Barre de progression HTML
      const progressHtml = `
        <div id="lesson-progress" style="
          position: sticky;
          top: 110px;
          background: var(--ds-color-surface);
          padding: 1rem;
          margin: -1rem -1rem 1.5rem -1rem;
          border-bottom: 1px solid var(--ds-color-border);
          z-index: 100;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        ">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
            <span style="font-size:0.85rem; font-weight:600; color:var(--ds-color-text-muted);">
              Mot <span id="current-word-num">1</span> sur ${lessonState.totalWords}
            </span>
            <span style="font-size:0.85rem; font-weight:600; color:var(--ds-color-primary);">
              ${Math.round((1 / lessonState.totalWords) * 100)}%
            </span>
          </div>
          <div style="
            width: 100%;
            height: 8px;
            background: var(--ds-color-surface-2);
            border-radius: 4px;
            overflow: hidden;
          ">
            <div id="progress-bar-fill" style="
              width: ${(1 / lessonState.totalWords) * 100}%;
              height: 100%;
              background: linear-gradient(90deg, var(--ds-color-primary), var(--ds-color-accent));
              border-radius: 4px;
              transition: width 0.4s ease;
            "></div>
          </div>
        </div>
      `;

    // ✅ NOUVEAU : Fonction pour mettre à jour la progression
    window.updateLessonProgress = (currentIndex) => {
      const percent = Math.round(((currentIndex + 1) / totalWords) * 100);
      const progressBar = document.getElementById('progress-bar-fill');
      const wordNum = document.getElementById('current-word-num');

      if (progressBar) {
        progressBar.style.width = `${percent}%`;
      }
      if (wordNum) {
        wordNum.textContent = currentIndex + 1;
      }

      const percentEl = document.querySelector('#lesson-progress span:last-child');
      if (percentEl) {
        percentEl.textContent = `${percent}%`;
      }
    };


    const themeNames = {
      'alphabet1': 'Alphabet - Partie 1',
      'alphabet2': 'Alphabet - Partie 2',
      'survival': 'Mots de survie',
      'numbers': 'Les Nombres',
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
                <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
                  <span style="font-size: 2rem;">${item.icon || '📝'}</span>
                  <strong style="font-size:1.2rem; color:var(--ds-color-primary);">${item.target}</strong>
                </div>
                <!-- ✅ AFFICHAGE DE LA PHONÉTIQUE -->
                <span style="display:block; font-size:0.9rem; color:var(--ds-color-accent); font-family:monospace; margin: 4px 0; font-weight:600;">
                  [ ${item.phonetic || '...'} ]
                </span>
                <div style="font-size:0.9em; color:var(--ds-color-text-muted); font-style:italic; margin-top:8px; border-top:1px solid var(--ds-color-border); padding-top:8px;">
                  "${item.context}" <br>
                  <span style="font-size:0.85em; opacity:0.8;">(${item.contextTranslation})</span>
                </div>
              </div>
              <ds-button variant="primary" size="sm" class="play-audio"
               data-target="${item.target || word.wordFr || word.fr}"
               data-word-id="${item.id || word.id || (item.target || word.wordFr || word.fr)?.toLowerCase().replace(/\s+/g, '-')}"
               style="min-width: 90px; margin-left:1rem;">
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

    // ✅ ALLUMAGE PROGRESSIF DES MOTS (intégré avec la barre de progression)
     // ✅ ALLUMAGE PROGRESSIF DES MOTS (utilise lessonState)
      const wordButtons = document.querySelectorAll('.play-audio');

      if (wordButtons.length > 0) {
        // Allumer le premier mot
        wordButtons[0].classList.add('guide-active');
        wordButtons[0].style.animation = 'pulse-guide 2s infinite';

        // Initialiser la barre de progression
        if (window.updateLessonProgress) {
          window.updateLessonProgress(0);
        }

        wordButtons.forEach((btn, index) => {
          btn.addEventListener('click', () => {
            speechSynthesis.cancel();
            btn.textContent = '🔊 ...';

            const wordId = btn.dataset.wordId || btn.dataset.target?.toLowerCase().replace(/\s+/g, '-');

            speakWithFeedback(btn.dataset.target, {
              rate: 0.9,
              gender: 'female',
              themeId: currentTheme,  // ✅ Passer le thème actuel
              wordId: wordId,         // ✅ Passer l'ID du mot
              onStart: () => {
                btn.textContent = '🔊 ...';
              },
              onEnd: () => {
                btn.textContent = '🔊 Mitenena';
                btn.classList.remove('guide-active');
                btn.style.animation = 'none';

                // ✅ NOUVEAU : Utiliser lessonState au lieu de currentWordIndex
                lessonState.currentWordIndex = index + 1;

                if (lessonState.currentWordIndex < wordButtons.length) {
                  wordButtons[lessonState.currentWordIndex].classList.add('guide-active');
                  wordButtons[lessonState.currentWordIndex].style.animation = 'pulse-guide 2s infinite';

                  // Mettre à jour la barre de progression
                  if (window.updateLessonProgress) {
                    window.updateLessonProgress(lessonState.currentWordIndex);
                  }
                } else {
                  // Leçon terminée : animation de succès
                  const progressBar = document.getElementById('progress-bar-fill');
                  if (progressBar) {
                    progressBar.classList.add('complete');
                  }

                  if (window.teacherAvatar) {
                    window.teacherAvatar.speakFeedback("Leçon terminée ! Bravo !", "success");
                  }

                  const btnStartPractice = document.getElementById('btn-start-practice');
                  if (btnStartPractice) {
                    btnStartPractice.classList.add('guide-active');
                    btnStartPractice.style.animation = 'pulse-green 1.5s infinite';
                  }
                }
              }
            });
          });
        });



        // ✅ BOUTON DE FIN : Marquer la leçon comme terminée et passer à la pratique
         document.getElementById('btn-start-practice')?.addEventListener('click', () => {
           journeyTracker.markJourneyComplete('lessons', unitId);
           saveProfile();
           goToNextJourney('lesson'); // → va automatiquement vers 'practice'
         });

     window.teacherAvatar.show('lesson');
     logger.info(`✅ Page Leçon rendue pour le thème: ${unitId}`);

       setTimeout(() => {
         window.teacherAvatar.speak("Vous avez appris les mots. Cliquez sur Commencer la pratique pour tester vos connaissances !");
       }, 1000);

     }

         } catch (e) {
      showError(main, e, {
        title: 'Erreur de leçon',
        subtitle: 'Impossible de charger la leçon',
        backRoute: '/themes',
        backLabel: '← Retour aux thèmes',
        retry: true
      });
    }
  }  // ← ✅ Fermeture correcte de renderLesson()


// ═══════════════════════════════════════════════════════════
// VUE : LEÇON - PHRASES DE CONTEXTE (Écouter et répéter les phrases)
// ═══════════════════════════════════════════════════════════
async function renderLessonPhrases() {
  updateNavActiveState();
  const main = document.getElementById('app');
  main.innerHTML = getSkeletonLesson();
  renderProgressHeader();

  try {
    const floatActions = document.getElementById('floating-home-actions');
    if (floatActions) floatActions.remove();

    // ✅ NOUVEAU : Validation de currentTheme
    if (!currentTheme || currentTheme === 'null') {
      // Rediriger vers les thèmes si pas de thème sélectionné
      router.navigate('/themes');
      return;
    }


    const manifest = await content.loadManifest('fr');
    const levelData = manifest.levels.find(l => l.id === currentLevel);
    const unitId = currentTheme || levelData.units[0];
    currentTheme = unitId;
    const vocabData = await content.loadSection('fr', 'vocabulary', unitId);

    const themeNames = {
      'survival': 'Mots de survie', 'numbers': 'Les Nombres',
      'family': 'La Famille', 'market': 'Au Marché', 'colors': 'Les Couleurs',
      'numbers2': 'Nombres (11-20)', 'days': 'Les Jours', 'months': 'Les Mois',
      'greetings': 'Salutations', 'body': 'Le Corps'
    };
    const themeName = themeNames[unitId] || unitId;

    main.innerHTML = `
      <section style="max-width: 700px; margin: 0 auto; padding: 2rem 1rem;">
        <ds-button variant="ghost" size="sm" id="btn-back" style="margin-bottom: 1rem;">← Retour au thème</ds-button>
        <div style="margin-bottom: 0.5rem;">
          <span style="background:var(--ds-color-accent); color:white; padding:4px 10px; border-radius:20px; font-weight:600; font-size:0.8rem;">Niveau ${currentLevel}</span>
        </div>
        <h2 style="margin-bottom: 0.5rem;">📝 Phrases : ${themeName}</h2>
        <p style="color:var(--ds-color-text-muted); margin-bottom: 2rem;">
          Écoutez et répétez chaque phrase de contexte
        </p>

        <div style="display:grid; gap:1rem;">
          ${vocabData.items.map((item, idx) => `
            <div style="background:var(--ds-color-surface); padding:1.2rem; border-radius:var(--ds-radius-md); display:flex; justify-content:space-between; align-items:center; box-shadow:var(--ds-shadow-sm); border:1px solid var(--ds-color-border);">
              <div style="flex:1;">
                <div style="font-size:0.8rem; color:var(--ds-color-text-muted); margin-bottom:4px;">
                  ${item.icon || '📝'} ${item.target} → ${item.source}
                </div>
                <strong style="font-size:1.1rem; color:var(--ds-color-primary); display:block; margin-bottom:4px;">
                  "${item.context}"
                </strong>
                <div style="font-size:0.85rem; color:var(--ds-color-text-muted); font-style:italic;">
                  (${item.contextTranslation})
                </div>
              </div>
              <ds-button variant="primary" size="sm" class="play-phrase" data-phrase="${item.context}" style="min-width: 90px; margin-left:1rem;">
                🔊 Mihainoa & Mitenena
              </ds-button>
            </div>
          `).join('')}
        </div>

        <div style="margin-top:2rem; text-align:center;">
          <ds-button id="btn-start-practice-phrases" size="lg" variant="success">
            🎯 Mihainoa ny fanazaran-tena (Commencer la révision des phrases)
          </ds-button>
        </div>
      </section>
    `;

    document.getElementById('btn-back').addEventListener('click', () => router.navigate('/theme-detail'));

    // Allumage progressif des phrases
    let currentPhraseIndex = 0;
    const phraseButtons = document.querySelectorAll('.play-phrase');
          if (phraseButtons.length > 0) {
        phraseButtons[0].classList.add('guide-active');
        phraseButtons[0].style.animation = 'pulse-guide 2s infinite';

        phraseButtons.forEach((btn, index) => {
          btn.addEventListener('click', () => {
            speechSynthesis.cancel();
            btn.textContent = '🔊 ...';

            speakWithFeedback(btn.dataset.phrase, {
              rate: 0.9,
              gender: 'female',
              onEnd: () => {
                btn.textContent = '🔊 Mihainoa';
                btn.classList.remove('guide-active');
                btn.style.animation = 'none';

                currentPhraseIndex = index + 1;

                if (currentPhraseIndex < phraseButtons.length) {
                  phraseButtons[currentPhraseIndex].classList.add('guide-active');
                  phraseButtons[currentPhraseIndex].style.animation = 'pulse-guide 2s infinite';
                } else {
                  const btnStart = document.getElementById('btn-start-practice-phrases');
                  if (btnStart) {
                    btnStart.classList.add('guide-active');
                    btnStart.style.animation = 'pulse-green 1.5s infinite';
                  }
                }
              }
            });
          }); // ✅ Ferme addEventListener
        }); // ✅ Ferme forEach
      } // ✅ Ferme le if (phraseButtons.length > 0)

    // ✅ NOUVEAU CODE :
        document.getElementById('btn-start-practice-phrases')?.addEventListener('click', () => {
          journeyTracker.markJourneyComplete('phraseLessons', unitId);
          saveProfile();
          goToNextJourney('lesson-phrases'); // → va automatiquement vers 'practice-phrases'
        });

    window.teacherAvatar.show('lesson');
    logger.info(`✅ Page Leçon Phrases rendue pour le thème: ${unitId}`);
    setTimeout(() => {
      window.teacherAvatar.speak("Écoutez chaque phrase de contexte et répétez-la à voix haute !");
    }, 1000);
  } catch (e) {
    main.innerHTML = `<p style="color:red; text-align:center;">Erreur: ${e.message}</p>`;
  }
}


 // ═══════════════════════════════════════════════════════════
// VUE : ALPHABET (Écoute et répétition - Version améliorée)
// ═══════════════════════════════════════════════════════════
async function renderAlphabet() {
  const main = document.getElementById('app');
  main.innerHTML = '<div style="text-align:center; padding:2rem;">Chargement de l\'alphabet...</div>';
  renderProgressHeader();

  try {
    const floatActions = document.getElementById('floating-home-actions');
    if (floatActions) floatActions.remove();

    // ✅ NOUVEAU : Validation de currentTheme
    if (!currentTheme || currentTheme === 'null') {
      currentTheme = 'alphabet1';
      localStorage.setItem('dagospeak:theme', currentTheme);
      console.log('[Alphabet] Thème par défaut défini: alphabet1');
    }

    // ✅ NOUVEAU : Vérifier que c'est bien un thème alphabet
    if (currentTheme !== 'alphabet1' && currentTheme !== 'alphabet2') {
      currentTheme = 'alphabet1';
      localStorage.setItem('dagospeak:theme', currentTheme);
      console.log('[Alphabet] Thème corrigé vers alphabet1');
    }

    const vocabData = await content.loadSection('fr', 'vocabulary', currentTheme);

    if (!vocabData) {
      throw new Error('Données d\'alphabet introuvables');
    }

    const isPart1 = currentTheme === 'alphabet1';
    const title = isPart1 ? 'Alphabet - Partie 1 (A-M)' : 'Alphabet - Partie 2 (N-Z)';
    const titleMg = isPart1 ? 'Alfabe - Ampahany 1 (A-M)' : 'Alfabe - Ampahany 2 (N-Z)';

    // ✅ COULEURS ATTRAYANTES POUR CHAQUE LETTRE (cycle de 8 couleurs)
    const letterColors = [
      '#ef4444', '#f97316', '#eab308', '#22c55e',
      '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'
    ];

    // ✅ FONCTION HELPER : Récupérer la lettre (supporte ancien + nouveau format)
    const getLetter = (item) => item.target || item.wordFr || '?';
    const getPhonetic = (item) => item.phonetic || '';
    const getContext = (item) => item.context || '';
    const getContextTranslation = (item) => item.contextTranslation || item.context?.exampleMg || '';
    const getAudioText = (item) => item.audio?.ttsTextFr || item.target || item.wordFr || '';

    main.innerHTML = `
      <section style="max-width: 800px; margin: 0 auto; padding: 2rem 1rem;">
        <ds-button variant="ghost" size="sm" id="btn-back" style="margin-bottom: 1rem;">← Retour aux thèmes</ds-button>

        <div style="text-align:center; margin-bottom: 1.5rem;">
          <span style="background:var(--ds-color-accent); color:white; padding:4px 12px; border-radius:20px; font-weight:600; font-size:0.8rem;">Niveau A0</span>
        </div>

        <h2 class="alphabet-title-float" style="text-align:center; margin-bottom: 0.5rem;">🔤 ${title}</h2>
        <p style="text-align:center; color:var(--ds-color-text-muted); font-style:italic; margin-bottom: 2rem;">${titleMg}</p>

        <div class="alphabet-instruction-bounce" style="background:var(--ds-color-primary-soft); padding:1rem; border-radius:var(--ds-radius-md); margin-bottom:2rem; text-align:center; border:1px solid var(--ds-color-primary);">
          <p style="margin:0; color:var(--ds-color-primary); font-weight:600;">
            👆 Tsindrio ny karatra tsirairay hihainoana sy hamerena ny litera
          </p>
          <p style="margin:0.25rem 0 0 0; font-size:0.85rem; color:var(--ds-color-text-muted); font-style:italic;">
            (Cliquez sur chaque carte pour écouter et répéter la lettre)
          </p>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap:1rem;">
          ${vocabData.items.map((item, idx) => {
            const letter = getLetter(item);
            const phonetic = getPhonetic(item);
            const context = getContext(item);
            const contextTranslation = getContextTranslation(item);
            const color = letterColors[idx % letterColors.length];

            return `
              <div class="alphabet-card card-animate" data-index="${idx}" data-letter="${letter}" style="
                background:var(--ds-color-surface);
                padding:1.2rem 0.8rem;
                border-radius:var(--ds-radius-md);
                border:3px solid var(--ds-color-border);
                cursor:pointer;
                transition: all 0.3s ease;
                text-align:center;
                position:relative;
                overflow:hidden;
                animation: cardAppear 0.5s ease-out ${idx * 0.05}s both;
              ">
                <!-- ✅ LETTRE STYLISÉE (plus fiable que les emojis) -->
                <div class="letter-display" style="
                  width:70px; height:70px; margin:0 auto 0.5rem auto;
                  background: linear-gradient(135deg, ${color} 0%, ${color}dd 100%);
                  color:white;
                  border-radius:16px;
                  display:flex; align-items:center; justify-content:center;
                  font-size:2.5rem; font-weight:900;
                  box-shadow: 0 4px 12px ${color}66;
                  font-family: 'Arial Black', sans-serif;
                  letter-spacing:-2px;
                ">${letter}</div>

                <div style="font-size:0.8rem; color:var(--ds-color-accent); font-family:monospace; margin-bottom:0.5rem; font-weight:600;">
                  [${phonetic}]
                </div>

                <div style="font-size:0.85rem; font-weight:600; color:var(--ds-color-text); margin-bottom:0.25rem; line-height:1.3;">
                  ${context}
                </div>
                <div style="font-size:0.75rem; color:var(--ds-color-text-muted); font-style:italic; line-height:1.3;">
                  ${contextTranslation}
                </div>

                <div class="listen-indicator" style="margin-top:0.5rem; font-size:1.2rem; opacity:0.3; transition: all 0.3s;">🔊</div>
              </div>
            `;
          }).join('')}
        </div>

        <div id="alphabet-complete-section" style="display:none; margin-top:2rem; text-align:center;">
          <div class="celebration-bounce" style="background:var(--ds-color-success-soft); padding:1.5rem; border-radius:var(--ds-radius-lg); border:2px solid var(--ds-color-success); margin-bottom:1rem;">
            <div style="font-size:3rem; margin-bottom:0.5rem;">🎉</div>
            <h3 style="color:var(--ds-color-success); margin-bottom:0.5rem;">Très bien !</h3>
            <p style="color:var(--ds-color-text); margin-bottom:0.25rem;">
              ${isPart1
                ? 'Vous avez terminé la première moitié de l\'alphabet !'
                : 'Vous avez terminé l\'alphabet complet !'}
            </p>
            <p style="color:var(--ds-color-text-muted); font-size:0.9rem; font-style:italic; margin-bottom:1rem;">
              ${isPart1
                ? '(Vita ny ampahany voalohany ny alfabe !)'
                : '(Vita ny alfabe manontolo !)'}
            </p>
          </div>
          ${isPart1 ? `
            <ds-button id="btn-go-part2" class="guide-active" size="lg" variant="success" style="width:100%; animation: pulse-green 1.5s infinite;">
              📝 Apprendre la 2ème partie (N-Z) →
            </ds-button>
          ` : `
            <ds-button id="btn-go-first-theme" class="guide-active" size="lg" variant="primary" style="width:100%; animation: pulse-green 1.5s infinite;">
              🚀 Commencer le premier thème (Survie) →
            </ds-button>
          `}
        </div>
      </section>
    `;

    // ✅ INJECTION DU CSS D'ANIMATION (une seule fois)
    if (!document.getElementById('alphabet-animations-style')) {
      const style = document.createElement('style');
      style.id = 'alphabet-animations-style';
      style.innerHTML = `
        /* Apparition progressive des cartes au chargement */
        @keyframes cardAppear {
          from { opacity: 0; transform: translateY(20px) scale(0.9); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* Flottement doux sur les cartes non écoutées */
        @keyframes gentleFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }

        /* Pulsation subtile de la lettre */
        @keyframes letterPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }

        /* Rebond de célébration */
        @keyframes celebrationBounce {
          0%, 100% { transform: translateY(0); }
          25% { transform: translateY(-10px); }
          75% { transform: translateY(-5px); }
        }

        /* Titre qui flotte doucement */
        @keyframes titleFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }

        /* Instruction qui rebondit légèrement */
        @keyframes instructionBounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }

        .alphabet-card:not(.completed):not(.active) {
          animation: gentleFloat 3s ease-in-out infinite, cardAppear 0.5s ease-out both;
        }

        .alphabet-card.active {
          border-color: var(--ds-color-primary) !important;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2);
          transform: scale(1.05);
        }

        .alphabet-card.active .letter-display {
          animation: letterPulse 1.5s ease-in-out infinite;
        }

        .alphabet-card.completed {
          border-color: var(--ds-color-success) !important;
          opacity: 0.85;
        }

        .alphabet-card.completed .letter-display {
          filter: brightness(1.1);
        }

        .alphabet-title-float {
          animation: titleFloat 3s ease-in-out infinite;
        }

        .alphabet-instruction-bounce {
          animation: instructionBounce 2.5s ease-in-out infinite;
        }

        .celebration-bounce {
          animation: celebrationBounce 2s ease-in-out infinite;
        }

        /* Effet de brillance au survol */
        .alphabet-card:hover:not(.completed):not(.active) {
          transform: translateY(-4px) scale(1.02);
          box-shadow: 0 8px 20px rgba(0,0,0,0.1);
        }
      `;
      document.head.appendChild(style);
    }

    document.getElementById('btn-back').addEventListener('click', () => router.navigate('/themes'));

    // ✅ GESTION DES CARTES ALPHABET
    let currentCardIndex = 0;
    const cards = document.querySelectorAll('.alphabet-card');
    const totalCards = cards.length;

    // Allumer la première carte
    if (cards.length > 0) {
      cards[0].classList.add('active');
    }

         cards.forEach((card, index) => {
        card.addEventListener('click', () => {
          // Ne permettre que le clic sur la carte active
          if (index !== currentCardIndex) return;

          const item = vocabData.items[index];
          const indicator = card.querySelector('.listen-indicator');

          // Animation de clic
          card.style.transform = 'scale(0.95)';
          setTimeout(() => { card.style.transform = ''; }, 150);

          // Écouter la lettre
          speechSynthesis.cancel();
          indicator.style.opacity = '1';
          indicator.textContent = '🔊 ...';

          speakWithFeedback(item.target, {
            rate: 0.8,
            gender: 'female',
            onEnd: () => {
              indicator.textContent = '✅';
              indicator.style.opacity = '1';
              card.classList.remove('active');
              card.classList.add('completed');
              card.style.pointerEvents = 'none';

              currentCardIndex = index + 1;

              // Allumer la carte suivante
              if (currentCardIndex < cards.length) {
                setTimeout(() => {
                  cards[currentCardIndex].classList.add('active');
                  cards[currentCardIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 500);
              } else {
                // Toutes les cartes terminées
                setTimeout(() => {
                  document.getElementById('alphabet-complete-section').style.display = 'block';
                  document.getElementById('alphabet-complete-section').scrollIntoView({ behavior: 'smooth' });

                  if (isPart1) {
                    window.teacherAvatar.speak("Très bien ! Vous avez terminé la première moitié de l'alphabet. Maintenant, cliquez sur le bouton qui s'allume pour apprendre la deuxième partie !");
                  } else {
                    window.teacherAvatar.speak("Félicitations ! Vous avez terminé l'alphabet complet ! Maintenant, cliquez sur le bouton pour commencer votre premier thème !");
                  }
                }, 800);
              }
            }
          });
        }); // ✅ Ferme addEventListener
      }); // ✅ Ferme forEach



    // Bouton vers partie 2 ou premier thème
   const btnNext = document.getElementById(isPart1 ? 'btn-go-part2' : 'btn-go-first-theme');
      if (btnNext) {
        btnNext.addEventListener('click', () => {
          if (isPart1) {
            currentTheme = 'alphabet2';
            localStorage.setItem('dagospeak:theme', currentTheme);
            // ✅ Appel direct de renderAlphabet() pour re-rendre avec le nouveau thème
            renderAlphabet();
          } else {
            currentTheme = 'survival';
            localStorage.setItem('dagospeak:theme', currentTheme);
            router.navigate('/theme-detail');
          }
        });
      }

    window.teacherAvatar.show('lesson');
    setTimeout(() => {
      window.teacherAvatar.speak("Cliquez sur chaque carte pour écouter et répéter chaque lettre de l'alphabet !");
    }, 1000);

    logger.info(`✅ Page Alphabet rendue: ${currentTheme}`);
  } catch (e) {
    main.innerHTML = `<p style="color:red; text-align:center;">Erreur: ${e.message}</p>`;
  }
}


// ✅ CHARGEMENT ASYNCHRONE DES VOIX (Correction du bug Chrome mobile)
let voicesAreLoaded = false;
function loadVoices() {
  speechSynthesis.getVoices();
  voicesAreLoaded = true;
}
if (speechSynthesis.onvoiceschanged !== undefined) {
  speechSynthesis.onvoiceschanged = loadVoices;
}
loadVoices(); // Appel immédiat au démarrage

// ═══════════════════════════════════════════════════════════
// GESTIONNAIRE DE VOIX PAR GENRE - VERSION OPTIMISÉE
// ═══════════════════════════════════════════════════════════

function getVoiceByGender(gender, lang = 'fr-FR') {
  let voices = speechSynthesis.getVoices();
  if (voices.length === 0) {
    voices = speechSynthesis.getVoices(); // Force reload si vide (quirk Chrome)
  }
  const frenchVoices = voices.filter(v => v.lang.startsWith('fr'));

  if (frenchVoices.length === 0) return voices[0] || null;

  const maleKeywords = ['male', 'homme', 'thomas', 'paul', 'daniel', 'henri', 'google français'];
  const femaleKeywords = ['female', 'femme', 'julie', 'alice', 'amelie', 'marie', 'virginie', 'audrey', 'google français'];

  if (frenchVoices.length >= 2) {
    if (gender === 'male' || gender === 'boy') {
      for (let kw of maleKeywords) {
        const match = frenchVoices.find(v => v.name.toLowerCase().includes(kw));
        if (match) return match;
      }
      return frenchVoices[0]; // Fallback sur la 1ère voix
    }
    if (gender === 'female' || gender === 'girl') {
      for (let kw of femaleKeywords) {
        const match = frenchVoices.find(v => v.name.toLowerCase().includes(kw));
        if (match) return match;
      }
      return frenchVoices[1]; // Fallback sur la 2ème voix
    }
  }

  // ⚠️ Si une seule voix existe, on la retourne.
  // La différenciation se fera UNIQUEMENT via les profils PITCH/RATE dans speakWithFeedback.
  return frenchVoices[0];
}

// ═══════════════════════════════════════════════════════════
// PROFILS VOCAUX : Combinaison pitch + rate pour distinction MAXIMALE
// ═══════════════════════════════════════════════════════════
const VOICE_PROFILES = {
  male:   { pitch: 0.55, rate: 0.82, volume: 1.0 },  // Grave + lent = homme adulte
  female: { pitch: 1.25, rate: 0.95, volume: 1.0 },  // Aiguë + normal = femme adulte
  boy:    { pitch: 1.55, rate: 1.0,  volume: 0.9 },  // Très aigu + normal = garçon
  girl:   { pitch: 1.75, rate: 1.05, volume: 0.9 }   // Encore plus aigu + rapide = fille
};

/**
 * Parler un mot/phrase avec MP3 pré-enregistré (fallback TTS)
 * @param {string} text - Texte à prononcer
 * @param {object} options - Options : rate, gender, onEnd, themeId, wordId
 */
async function speakWithFeedback(text, options = {}) {
  if (!text) {
    if (options.onEnd) options.onEnd();
    return;
  }

  // ✅ NOUVEAU : Essayer de charger un MP3 si on a un thème + mot ID
  if (options.themeId && options.wordId && window.audioLoader) {
    const mp3Path = `${options.themeId}/${options.wordId}.mp3`;

    try {
      const result = await window.audioLoader.playAudio(mp3Path, text, {
        rate: options.rate || 0.9,
        gender: options.gender || 'female',
        onStart: options.onStart,
        onEnd: options.onEnd
      });

      // ✅ MP3 joué avec succès → on sort
      if (result.method === 'mp3') {
        console.log(`[speakWithFeedback] ✅ MP3 joué: ${mp3Path}`);
        return;
      }

      // ✅ TTS déjà joué par AudioLoader → on sort AUSSI (ne pas rejouer !)
      if (result.method === 'tts') {
        console.log(`[speakWithFeedback] ⚠️ MP3 manquant → TTS déjà joué par AudioLoader: ${mp3Path}`);
        return;
      }

      // Seul cas où on continue : method === 'none' (aucun audio disponible)
      console.log(`[speakWithFeedback] ❌ Aucun audio disponible pour: ${mp3Path}`);
    } catch (e) {
      console.warn('[speakWithFeedback] Erreur MP3, fallback TTS:', e);
    }

// Ce fallback TTS ne sera atteint que si AudioLoader n'a rien pu jouer du tout
  }

  // Fallback : Web Speech API (comportement actuel)
  if (!('speechSynthesis' in window)) {
    if (options.onEnd) options.onEnd();
    return;
  }

  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'fr-FR';
  utterance.rate = options.rate || 0.9;
  utterance.pitch = options.pitch || 1.1;

  // Sélection de la voix
  const voices = speechSynthesis.getVoices();
  const frenchVoice = voices.find(v =>
    v.lang.startsWith('fr') &&
    (options.gender === 'male' ?
      v.name.toLowerCase().includes('male') || v.name.includes('Thomas') :
      v.name.toLowerCase().includes('female') || v.name.includes('Amélie') || v.name.includes('Marie'))
  ) || voices.find(v => v.lang.startsWith('fr'));

  if (frenchVoice) utterance.voice = frenchVoice;

  console.log(`[TTS] 🎙️ gender=${options.gender || 'female'}, voice=${frenchVoice?.name || 'default'}`);

  if (options.onStart) options.onStart();
  utterance.onend = () => {
    if (options.onEnd) options.onEnd();
  };
  utterance.onerror = () => {
    if (options.onEnd) options.onEnd();
  };

  speechSynthesis.speak(utterance);
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
  updateNavActiveState();
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

    // ✅ NOUVEAU : Validation de currentTheme
    if (!currentTheme || currentTheme === 'null') {
      // Rediriger vers les thèmes si pas de thème sélectionné
      router.navigate('/themes');
      return;
    }


    const manifest = await content.loadManifest('fr');
    const levelData = manifest.levels.find(l => l.id === currentLevel);
    const unitId = currentTheme || levelData.units[0];
    currentTheme = unitId;
    const vocabData = await content.loadSection('fr', 'vocabulary', unitId);

    // ✅ NOUVEAU : Précharger les MP3 du thème en arrière-plan
      const words = vocabData.items || vocabData.words || [];
      if (window.audioLoader && words.length > 0) {
        // Préparer les IDs pour les MP3
        const wordsForPreload = words.map(w => ({
          id: w.id || w.wordFr?.toLowerCase().replace(/\s+/g, '-'),
          wordFr: w.wordFr || w.fr,
          fr: w.fr
        }));

        // Lancer en arrière-plan (ne bloque pas le rendu)
        window.audioLoader.preloadTheme(unitId, wordsForPreload).catch(e => {
          console.warn('[renderLesson] Préchargement MP3 échoué:', e);
        });
      }

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
                Étape 1 : Mihainoa (Écoutez)
              </div>
              <ds-button variant="primary" size="md" id="btn-listen" class="guide-active">🔊 Mihainoa (Écouter)</ds-button>
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
               themeScore += 10;
               await gamification.addXP(10, 'Quiz réussi');
               if (typeof feedbackSounds !== 'undefined') feedbackSounds.playSuccess();
               // ✅ Avatar félicite en français
               setTimeout(() => window.teacherAvatar.speak("Excellent !"), 500);
             } else {
               quizEl.classList.add('wrong-answer');
               setTimeout(() => quizEl.classList.remove('wrong-answer'), 400);
               if (typeof feedbackSounds !== 'undefined') feedbackSounds.playRetry();
               // ✅ Avatar corrige en français, sans prononcer le mot malgache
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
      saveProfile();

      // Voix du Teacher Avatar pour féliciter
      setTimeout(() => {
          window.teacherAvatar.speak("Excellent ! Vous maîtrisez les mots. Passons maintenant à l'apprentissage des phrases !");
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

      // ✅ NOUVEAU CODE avec flux centralisé :
        document.getElementById('btn-go-dialogues').addEventListener('click', () => {
          goToNextJourney('practice'); // → va automatiquement vers 'lesson-phrases'
        });
        document.getElementById('btn-back-themes').addEventListener('click', () => router.navigate('/themes'));
      };

    renderQuestion(currentIndex);
    window.teacherAvatar.show('practice');
    logger.info(`✅ Session de révision démarrée pour le thème: ${unitId}`);

    } catch (e) {
    showError(main, e, {
      title: 'Erreur de pratique',
      subtitle: 'Impossible de charger les exercices',
      backRoute: '/theme-detail',
      backLabel: '← Retour aux activités',
      retry: true
    });
  }
}



// ═══════════════════════════════════════════════════════════
// VUE : RÉVISION - PHRASES (Quiz + Shadowing sur les phrases)
// ═══════════════════════════════════════════════════════════
async function renderPracticePhrases() {
  updateNavActiveState();
  const main = document.getElementById('app');
  main.innerHTML = `<div style="text-align:center; padding:2rem;">Miomana ny fanazaran-tena amin\'ny fehezanteny...</div>`;
  renderProgressHeader();

  try {
    const floatActions = document.getElementById('floating-home-actions');
    if (floatActions) floatActions.remove();

    // ✅ NOUVEAU : Validation de currentTheme
    if (!currentTheme || currentTheme === 'null') {
      // Rediriger vers les thèmes si pas de thème sélectionné
      router.navigate('/themes');
      return;
    }


    const manifest = await content.loadManifest('fr');
    const levelData = manifest.levels.find(l => l.id === currentLevel);
    const unitId = currentTheme || levelData.units[0];
    currentTheme = unitId;
    const vocabData = await content.loadSection('fr', 'vocabulary', unitId);

    const sessionQueue = [...vocabData.items].sort(() => Math.random() - 0.5);
    let currentIndex = 0;
    let themeScore = 0;
    let shadowEvalHandler = null;
    let currentCorrectAnswer = "";
    let quizAnswered = false;

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

      const questionText = `Comment dit-on en français : "<strong>${itemData.contextTranslation}</strong>" ?`;
      currentCorrectAnswer = itemData.context;

      const pool = vocabData.items
        .filter(i => i.id !== itemData.id && i.context)
        .map(i => i.context);
      let options = [currentCorrectAnswer, ...pool.sort(() => Math.random() - 0.5).slice(0, 2)];
      options = [...new Set(options)].sort(() => Math.random() - 0.5);
      while (options.length < 3) options.push("Phrase supplémentaire");

      main.innerHTML = `
        <section style="max-width: 600px; margin: 0 auto; padding: 2rem 1rem; padding-top: 1rem;">
          <div style="background:var(--ds-color-border); height:8px; border-radius:4px; margin-bottom:1rem; overflow:hidden;">
            <div style="background:var(--ds-color-primary); height:100%; width:${progressPercent}%; transition: width 0.3s ease;"></div>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:1rem; align-items:center;">
            <ds-button variant="ghost" size="sm" id="btn-back-practice">← Hiverina</ds-button>
            <span style="font-weight:600; color:var(--ds-color-text-muted);">
              Fehezanteny ${index + 1} / ${sessionQueue.length}
            </span>
          </div>
          <div style="text-align:center; margin-bottom:1rem;">
            <span style="background:var(--ds-color-primary); color:white; padding:4px 12px; border-radius:20px; font-weight:600; font-size:0.8rem;">
              📝 Fanazaran-tena amin'ny fehezanteny (Révision des phrases)
            </span>
          </div>
          <h2 style="text-align:center; margin-bottom:1.5rem; font-size:1.2rem;">${questionText}</h2>

          <div style="display:flex; flex-direction:column; gap:1rem;">
            <div id="step-listen" class="guide-active" style="text-align:center; padding:1rem; background:var(--ds-color-surface-2); border-radius:var(--ds-radius-md);">
              <div style="font-size:0.75rem; text-transform:uppercase; color:var(--ds-color-text-muted); margin-bottom:0.5rem;">
                Étape 1 : Mihainoa ny fehezanteny (Écoutez la phrase)
              </div>
              <ds-button variant="primary" size="md" id="btn-listen" class="guide-active">🔊 Mihainoa</ds-button>
            </div>

            <div id="step-quiz" style="text-align:center; padding:1rem; background:var(--ds-color-surface-2); border-radius:var(--ds-radius-md); opacity:0.5; pointer-events:none; transition:all 0.3s;">
              <div style="font-size:0.75rem; text-transform:uppercase; color:var(--ds-color-text-muted); margin-bottom:0.5rem;">
                Étape 2 : Safidio ny valiny (Choisissez la réponse)
              </div>
              <ds-quiz id="active-quiz" item-id="${itemData.id}" options="${JSON.stringify(options).replace(/"/g, '&quot;')}" correct="${currentCorrectAnswer}"></ds-quiz>
            </div>

            <div id="step-shadow" style="text-align:center; padding:1rem; background:var(--ds-color-primary-soft); border-radius:var(--ds-radius-md); border: 1px dashed var(--ds-color-primary); opacity:0.5; pointer-events:none; transition:all 0.3s;">
              <div style="font-size:0.75rem; text-transform:uppercase; color:var(--ds-color-primary); margin-bottom:0.5rem; font-weight:bold;">
                Étape 3 : Mitenena ny fehezanteny (Prononcez la phrase)
              </div>
              <ds-button variant="primary" size="lg" id="btn-shadow">🎤 Mitenena izao</ds-button>
              <div id="shadow-feedback" style="margin-top:0.75rem; font-size:0.9rem; font-weight:600; min-height:1.5em;"></div>
            </div>

            <div id="step-next" style="text-align:center; margin-top:0.5rem; opacity:0.5; pointer-events:none; transition:all 0.3s;">
              <ds-button id="btn-next" disabled variant="success" size="lg" style="width:100%;">
                Manaraka → (Suivant)
              </ds-button>
            </div>
          </div>
        </section>
      `;

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

      document.getElementById('btn-listen').addEventListener('click', () => {
        const btnListen = document.getElementById('btn-listen');
        const originalText = btnListen.textContent;
        speakWithFeedback(itemData.context, {
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

      const quizEl = document.getElementById('active-quiz');
      quizEl.addEventListener('quiz:answered', async (e) => {
        if (quizAnswered) return;
        quizAnswered = true;
        await srs.schedule(e.detail.itemId, e.detail.isCorrect ? 4 : 1);

        if (e.detail.isCorrect) {
          quizEl.classList.add('correct-answer');
          setTimeout(() => quizEl.classList.remove('correct-answer'), 500);
          themeScore += 15;
          await gamification.addXP(15, 'Quiz phrase réussi');
          if (typeof feedbackSounds !== 'undefined') feedbackSounds.playSuccess();
          setTimeout(() => window.teacherAvatar.speak("Excellent !"), 500);
        } else {
          quizEl.classList.add('wrong-answer');
          setTimeout(() => quizEl.classList.remove('wrong-answer'), 400);
          if (typeof feedbackSounds !== 'undefined') feedbackSounds.playRetry();
          setTimeout(() => {
            window.teacherAvatar.speak(`Faux. La bonne phrase est : ${currentCorrectAnswer}`);
          }, 500);
        }

        stepQuiz.classList.remove('guide-active');
        stepShadow.style.opacity = '1';
        stepShadow.style.pointerEvents = 'auto';
        document.getElementById('btn-shadow').classList.add('guide-active');
      });

      const btnShadow = document.getElementById('btn-shadow');
      const shadowFeedback = document.getElementById('shadow-feedback');
      let isRecording = false;

      btnShadow.addEventListener('click', () => {
        if (isRecording) {
          shadowing.forceStop();
          isRecording = false;
          btnShadow.textContent = '🎤 Mitenena izao';
          return;
        }
        btnShadow.setAttribute('disabled', '');
        btnShadow.textContent = '🎙️ Mandre...';
        shadowFeedback.innerHTML = '<span style="color:var(--ds-color-accent);">Mitenena izao...</span>';
        isRecording = true;
        shadowing.startRecording();
      });

      shadowEvalHandler = (data) => {
        isRecording = false;
        btnShadow.removeAttribute('disabled');
        if (data.error === 'not_supported') {
          shadowFeedback.innerHTML = '<span style="color:var(--ds-color-danger);">️ Micro non supporté</span>';
          btnShadow.textContent = '🎤 Mitenena izao';
          unlockNext();
          return;
        }
        if (data.transcript) {
          const similarity = calculateSimilarity(data.transcript.toLowerCase(), itemData.context.toLowerCase());
          if (similarity > 0.60) {
            if (typeof feedbackSounds !== 'undefined') feedbackSounds.playSuccess();
            shadowFeedback.innerHTML = `<span style="color:var(--ds-color-success);">✅ Tena tsara ! (Très bien !)</span>`;
            btnShadow.textContent = '✅ Vita';
            gamification.addXP(10, 'Shadowing phrase - excellente');
            document.getElementById('btn-shadow').classList.remove('guide-active');
            unlockNext();
          } else if (similarity > 0.40) {
            if (typeof feedbackSounds !== 'undefined') feedbackSounds.playSuccess();
            shadowFeedback.innerHTML = `<span style="color:var(--ds-color-success);">✅ Tsara ! (Bien !)</span>`;
            btnShadow.textContent = '✅ Vita';
            gamification.addXP(5, 'Shadowing phrase - bonne');
            document.getElementById('btn-shadow').classList.remove('guide-active');
            unlockNext();
          } else {
            if (typeof feedbackSounds !== 'undefined') feedbackSounds.playRetry();
            shadowFeedback.innerHTML = `<span style="color:var(--ds-color-accent);">🔄 Havereno (À répéter)</span>`;
            btnShadow.textContent = '🎤 Mitenena indray';
          }
        } else {
          shadowFeedback.innerHTML = '<span style="color:var(--ds-color-text-muted);">⚠️ Aucune voix détectée</span>';
          btnShadow.textContent = '🎤 Mitenena izao';
        }
      };
      bus.on('pronunciation:evaluated', shadowEvalHandler);

      btnNext.addEventListener('click', () => {
        if (shadowEvalHandler) {
          bus.off('pronunciation:evaluated', shadowEvalHandler);
          shadowEvalHandler = null;
        }
        currentIndex++;
        renderQuestion(currentIndex);
      });
    };

    const renderSessionComplete = async () => {
      if (shadowEvalHandler) {
        bus.off('pronunciation:evaluated', shadowEvalHandler);
        shadowEvalHandler = null;
      }
      if (typeof feedbackSounds !== 'undefined') feedbackSounds.playCelebration();
      await gamification.addXP(50, 'Révision phrases terminée');
      journeyTracker.markJourneyComplete('phrasePractices', unitId);
      saveProfile();

      setTimeout(() => {
        window.teacherAvatar.speak("Félicitations ! Vous maîtrisez les phrases. Passons maintenant au dialogue !");
      }, 800);

      main.innerHTML = `
        <section style="max-width: 600px; margin: 0 auto; padding: 2rem 1rem; text-align:center;">
          <div style="font-size:4rem; margin-bottom:1rem;">📝</div>
          <h2 style="color:var(--ds-color-success);">Fanazaran-tena amin'ny fehezanteny Vita !</h2>
          <p style="color:var(--ds-color-text-muted); margin-bottom:0.5rem;">
            Révision des phrases terminée pour "${unitId}".
          </p>
          <p style="color:var(--ds-color-accent); font-weight:bold; margin-bottom:2rem;">
            Score : ${themeScore} XP
          </p>
          <div style="background:var(--ds-color-primary-soft); padding:1.5rem; border-radius:var(--ds-radius-lg); border:1px solid var(--ds-color-primary); margin-bottom:1.5rem;">
            <h3 style="color:var(--ds-color-primary); margin-bottom:0.5rem;">Vonona ho an'ny Dialogue ?</h3>
            <p style="color:var(--ds-color-text-muted); font-size:0.9rem; margin-bottom:1rem;">
              Pratiquez maintenant avec une conversation complète !
            </p>
            <ds-button id="btn-go-dialogues" size="lg" variant="success" class="guide-active" style="width:100%;">
              💬 Manomboka ny Dialogue → (Commencer le dialogue)
            </ds-button>
          </div>
          <ds-button id="btn-back-themes" variant="ghost" size="sm" style="width:100%;">
            ← Hiverina amin'ny lohahevitra
          </ds-button>
        </section>
      `;
     // ✅ NOUVEAU CODE :
          document.getElementById('btn-go-dialogues').addEventListener('click', () => {
            goToNextJourney('practice-phrases'); // → va automatiquement vers 'dialogues'
          });
          document.getElementById('btn-back-themes').addEventListener('click', () => router.navigate('/themes'));
      };

    renderQuestion(currentIndex);
    window.teacherAvatar.show('practice');
    logger.info(`✅ Session révision phrases démarrée pour: ${unitId}`);
    } catch (e) {
    showError(main, e, {
      title: 'Erreur de pratique',
      subtitle: 'Impossible de charger les exercices',
      backRoute: '/theme-detail',
      backLabel: '← Retour aux activités',
      retry: true
    });
  }
}



// Activité Dialogue
async function renderDialogues() {

  // ✅ BARRIÈRE DE SÉCURITÉ : Les thèmes alphabet n'ont pas de dialogue
  if (currentTheme === 'alphabet1' || currentTheme === 'alphabet2') {
    console.log('[Dialogues] ⚠️ Thème alphabet détecté, redirection vers les thèmes.');
    router.navigate('/themes');
    return;
  }
  updateNavActiveState();
  const main = document.getElementById('app');
  main.innerHTML = getSkeletonThemesList();

  // ✅ Afficher le header de progression flottant (uniquement hors accueil)
renderProgressHeader();
  // ✅ Synchroniser le profil après chaque parcours terminé
syncProfileWithJourneys();

  try {

    // À ajouter au début de chaque fonction de vue (sauf renderHome)
    const floatActions = document.getElementById('floating-home-actions');
    if (floatActions) floatActions.remove();

    // ✅ NOUVEAU : Validation de currentTheme
    if (!currentTheme || currentTheme === 'null') {
      // Rediriger vers les thèmes si pas de thème sélectionné
      router.navigate('/themes');
      return;
    }


    const manifest = await content.loadManifest('fr');
    const levelData = manifest.levels.find(l => l.id === currentLevel);

    // Verrouillage sur le thème choisi
    const unitId = currentTheme || levelData.units[0];
    currentTheme = unitId;

    const dialogueId = `${unitId}_dialogue`;
    console.log(`[DEBUG] Tentative de chargement du dialogue : ${dialogueId}`);

    const dialogue = await content.loadSection('fr', 'dialogues', dialogueId);

    // ✅ NOUVEAU : Avatar SVG animé pour conversation live
      const avatarContainer = document.createElement('div');
      avatarContainer.id = 'teacher-avatar-svg-container';
      avatarContainer.style.cssText = 'text-align: center; margin: 1rem 0;';
      main.appendChild(avatarContainer);

      // Importer et initialiser le SVG avatar (dynamique pour éviter de charger sur tous les appareils)
      import('./ui/components/teacher-avatar-svg.js').then(module => {
        const TeacherAvatarSVG = module.TeacherAvatarSVG;
        const avatarSVG = new TeacherAvatarSVG('teacher-avatar-svg-container');
        avatarSVG.render();
        window.teacherAvatarSVG = avatarSVG;
        console.log('[Conversation] ✅ Avatar SVG initialisé');
      }).catch(e => console.warn('[Conversation] Avatar SVG non disponible:', e));

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

          <ds-button variant="ghost" size="sm" class="play-dialog-audio" data-text="${line.text}" data-speaker="${line.speaker}" style="margin-top:4px; min-height:28px; padding:4px 8px;">🔊 Écouter</ds-button>
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
          <ds-button id="btn-go-roleplay" size="lg" variant="primary" style="width: 100%;">
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

    // ✅ NOUVEAU CODE :
      document.getElementById('btn-go-roleplay').addEventListener('click', () => {
        goToNextJourney('dialogues'); // → va automatiquement vers 'roleplay'
      });
      document.getElementById('btn-restart-practice').addEventListener('click', () => {
        router.navigate('/practice'); // Retour à la révision (optionnel)
      });
      document.getElementById('btn-dialogue-next').addEventListener('click', () => {
        router.navigate('/themes'); // Retour aux thèmes
      });

    document.querySelectorAll('.play-dialog-audio').forEach(btn => {
      btn.addEventListener('click', () => {
        const originalText = btn.textContent;
        const speakerKey = btn.dataset.speaker;
        const speaker = dialogue.participants[speakerKey];
        const gender = speaker?.gender || 'female'; // ✅ Récupération du genre

        speakWithFeedback(btn.dataset.text, {
          gender: gender, // ✅ Transmission du genre
          onStart: () => { btn.textContent = '🔊 ...'; },
          onEnd: () => { btn.textContent = originalText; }
        });
      });
    });

    // ✅ GUIDAGE PAR ALLUMAGE — Respecte le toggle guidePulse
      const dialogSettings = getSettings();
      const shouldPulseDialog = dialogSettings.guidePulse !== false;

      if (shouldPulseDialog) {
        const btnRoleplay = document.getElementById('btn-go-roleplay');
        if (btnRoleplay) {
          btnRoleplay.classList.add('guide-active');
          btnRoleplay.style.animation = 'pulse-green 1.5s infinite';
          console.log('[Dialogues] ✅ Guidage par allumage activé sur Role Play');
        }
      }

    logger.info(`✅ Page Dialogues rendue pour le thème: ${unitId}`);

    journeyTracker.markJourneyComplete('dialogues', unitId);
    saveProfile();

    window.teacherAvatar.show('dialogues');

        // ✅ Voix du Teacher Avatar pour guider vers le Role Play
    setTimeout(() => {
      window.teacherAvatar.speak("Vous avez lu le dialogue. Maintenant, cliquez sur Role Play Guidé pour le jouer vous-même !");
    }, 1000);

    } catch (e) {
    showError(main, e, {
      title: 'Erreur de dialogues',
      subtitle: 'Impossible de charger les conversations',
      backRoute: '/theme-detail',
      backLabel: '← Retour aux activités',
      retry: true
    });
  }
}

// ═══════════════════════════════════════════════════════════
// VUE : ROLE PLAY GUIDÉ (L'utilisateur joue avec les réponses visibles)
// ═══════════════════════════════════════════════════════════
async function renderRolePlay() {
  updateNavActiveState();
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

    // ✅ NOUVEAU : Validation de currentTheme
    if (!currentTheme || currentTheme === 'null') {
      // Rediriger vers les thèmes si pas de thème sélectionné
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

      // ✅ NOUVEAU CODE :
        document.getElementById('btn-go-challenge').addEventListener('click', () => {
          goToNextJourney('roleplay'); // → va automatiquement vers 'challenge'
        });
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
              <div style="font-size:0.75rem; text-transform:uppercase; color:var(--ds-color-text-muted); margin-bottom:0.5rem;">Étape 1 : Mihainoa (Écoutez)</div>
              <ds-button variant="primary" size="md" id="btn-listen" class="${!isUserTurn ? 'guide-active' : ''}">🔊 Mihainoa (Écouter)</ds-button>
            </div>

            ${isUserTurn ? `
              <div id="step-speak" style="text-align:center; padding:1rem; background:var(--ds-color-primary-soft); border-radius:var(--ds-radius-md); border: 1px dashed var(--ds-color-primary); opacity:0.5; pointer-events:none; transition:all 0.3s;">
                <div style="font-size:0.75rem; text-transform:uppercase; color:var(--ds-color-primary); margin-bottom:0.5rem; font-weight:bold;">Étape 2 : Mitenena (Parlez à votre tour)</div>
                <ds-button variant="primary" size="lg" id="btn-speak">🎤 Mitenena izao (Parler maintenant)</ds-button>
                <div id="speech-feedback" style="margin-top:0.75rem; font-size:0.9rem; font-weight:600; min-height:1.5em;"></div>
              </div>
            ` : `
              <div style="text-align:center; padding:1rem; background:var(--ds-color-surface-2); border-radius:var(--ds-radius-md); color:var(--ds-color-text-muted);">
                👂 Mihainoa an'i ${speaker.name} (Écoutez ${speaker.name})
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

          // ✅ Récupérer le genre du personnage qui parle
          const speakerGender = speaker.gender || 'female';

          speakWithFeedback(line.text, {
            gender: speakerGender, // ✅ Transmission du genre
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
    saveProfile();

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
  updateNavActiveState();
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

    // ✅ NOUVEAU : Validation de currentTheme
    if (!currentTheme || currentTheme === 'null') {
      // Rediriger vers les thèmes si pas de thème sélectionné
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
                  👂 Mihainoa an'i ${speaker.name} (Écoutez ${speaker.name})
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
         window.teacherAvatar.speak("Félicitations ! Vous avez réussi le défi ! Vous maîtrisez ce thème.");
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

      // ✅ NOUVEAU CODE :
      document.getElementById('btn-back-themes').addEventListener('click', () => {
        goToNextJourney('challenge'); // → retourne aux thèmes (dernière étape)
      });
    };

    renderLine();

    journeyTracker.markJourneyComplete('challenges', unitId);
    saveProfile();

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
  updateNavActiveState();
  const main = document.getElementById('app');
 main.innerHTML = getSkeletonProfile();

  try {
    // ✅ 1. Charger les données personnelles (depuis l'onboarding)
    const userProfileRaw = localStorage.getItem('dagospeak:userProfile');
    const userProfile = userProfileRaw ? JSON.parse(userProfileRaw) : {
      firstName: 'Utilisateur',
      lastName: '',
      region: '',
      status: '',
      tier: 'free',
      isPremium: false
    };

    // ✅ 2. Charger les stats de progression
    const profile = getProfileData();
    const journeys = journeyTracker.getCompletedJourneys();

    // ✅ 3. Formater le nom complet
    const fullName = `${userProfile.firstName} ${userProfile.lastName}`.trim();

    // ✅ 4. Formater le statut
    const statusLabels = {
      'student': 'Étudiant (Mpianatra)',
      'worker': 'Travailleur (Mpiasa)',
      'other': 'Autre (Hafa)'
    };
    const statusLabel = statusLabels[userProfile.status] || 'Non défini';

    // ✅ 5. Déterminer le type de compte
    const accountType = userProfile.isPremium ? '⭐ Premium' : '🆓 Gratuit';
    const accountColor = userProfile.isPremium ? 'var(--ds-color-accent)' : 'var(--ds-color-text-muted)';

    main.innerHTML = `
      <section style="max-width: 600px; margin: 0 auto; padding: 2rem 1rem;">
        <ds-button variant="ghost" size="sm" id="btn-back" style="margin-bottom: 1rem;">← Miverina (Retour)</ds-button>

        <!-- ✅ SECTION 1 : INFORMATIONS PERSONNELLES -->
        <div style="background: var(--ds-color-surface); padding: 2rem; border-radius: var(--ds-radius-lg); box-shadow: var(--ds-shadow-md); text-align:center; margin-bottom: 2rem;">
               <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                 <h2 style="margin: 0;">👤 Mombamomba ahy (Mon Profil)</h2>
                 <button id="btn-gamification-guide" style="
                   background: linear-gradient(135deg, #0A8A6E 0%, #087a62 100%);
                   color: white; border: none; border-radius: 50%;
                   width: 40px; height: 40px; font-size: 1.2rem;
                   cursor: pointer; box-shadow: 0 4px 12px rgba(10, 138, 110, 0.3);
                   display: flex; align-items: center; justify-content: center;
                   transition: transform 0.2s;
                 " onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">❓</button>
               </div>
          <h3 style="color: var(--ds-color-primary); margin-bottom: 0.5rem;">${fullName}</h3>
          <div style="font-size: 1rem; color: ${accountColor}; font-weight: bold; margin-bottom: 1rem;">${accountType}</div>

          <div style="text-align: left; margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--ds-color-border);">
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--ds-color-border);">
              <span style="color: var(--ds-color-text-muted);">📍 Région</span>
              <strong>${userProfile.region || 'Non définie'}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--ds-color-border);">
              <span style="color: var(--ds-color-text-muted);">💼 Statut</span>
              <strong>${statusLabel}</strong>
            </div>
            ${userProfile.isPremium && userProfile.phone ? `
              <div style="display: flex; justify-content: space-between; padding: 0.5rem 0;">
                <span style="color: var(--ds-color-text-muted);">📱 Téléphone</span>
                <strong>${userProfile.phone}</strong>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- ✅ SECTION 2 : PROGRESSION (existante) -->
        <div style="background: var(--ds-color-surface); padding: 2rem; border-radius: var(--ds-radius-lg); box-shadow: var(--ds-shadow-md); text-align:center; margin-bottom: 2rem;">
          <div style="font-size: 3rem; margin-bottom: 0.5rem;">👤</div>

          <!-- ✅ AFFICHAGE DU VRAI NIVEAU PÉDAGOGIQUE -->
          <h3 style="color: var(--ds-color-primary); margin-bottom: 0.25rem;">Niveau CECR : ${profile.level}</h3>

          <!-- ✅ AFFICHAGE DU RANG GAMIFIÉ (basé sur les XP) -->
          <p style="color: ${profile.rankColor}; font-weight: bold; font-size: 1.1rem; margin-bottom: 0.5rem;">
            ${profile.rank} (${profile.xp} XP)
          </p>

          <div style="margin-top: 1rem; font-size: 1.5rem; color: var(--ds-color-accent); font-weight: bold;">🔥 ${profile.streak} jours</div>

          <!-- Badges -->
          <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--ds-color-border);">
            <div style="font-size: 0.9rem; color: var(--ds-color-text-muted); margin-bottom: 0.5rem;">Badges obtenus</div>
            <div style="font-size: 2rem;">
              ${profile.badges.length > 0 ? profile.badges.join(' ') : '—'}
            </div>
          </div>
        </div>

        <!-- ✅ SECTION 3 : STATISTIQUES (existante) -->
        <div style="background: var(--ds-color-primary-soft); padding: 1.5rem; border-radius: var(--ds-radius-lg); border: 1px solid var(--ds-color-primary); margin-bottom: 1.5rem;">
          <h3 style="color: var(--ds-color-primary); margin-bottom: 1rem;">📊 Fandrosoana (Progression)</h3>
          <div style="font-size: 2rem; font-weight: bold; color: var(--ds-color-primary); margin-bottom: 0.5rem;">${profile.percentage}%</div>
          <div style="color: var(--ds-color-text-muted); font-size: 0.9rem;">
            ${profile.completedJourneys} / ${profile.totalJourneys} parcours terminés
          </div>
          <div style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--ds-color-text-muted);">
            ${profile.themesCompleted} thèmes complétés sur 10
          </div>
        </div>

        <!-- ✅ SECTION CERTIFICATION A2 -->
        <div style="background: linear-gradient(135deg, var(--ds-color-surface) 0%, var(--ds-color-surface-2) 100%); padding: 2rem; border-radius: var(--ds-radius-lg); border: 2px solid var(--ds-color-accent); margin-bottom: 1.5rem; text-align: center; box-shadow: var(--ds-shadow-md);">
          <div style="font-size: 4rem; margin-bottom: 1rem;">🎓</div>
          <h3 style="color: var(--ds-color-primary); margin-bottom: 0.5rem; font-size: 1.3rem;">Certification DagoSpeak A2</h3>
          <p style="color: var(--ds-color-text-muted); font-size: 0.95rem; margin-bottom: 1.5rem; line-height: 1.5;">
            Validez officiellement votre niveau de français avec notre certification interne
          </p>
          <div style="background: var(--ds-color-surface-2); padding: 1rem; border-radius: var(--ds-radius-md); margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
              <span style="font-size: 0.9rem; color: var(--ds-color-text-muted);">Progression</span>
              <span style="font-weight: 600; color: var(--ds-color-primary);">${profile.percentage}%</span>
            </div>
            <div style="width: 100%; height: 8px; background: var(--ds-color-border); border-radius: 4px; overflow: hidden;">
              <div style="width: ${profile.percentage}%; height: 100%; background: linear-gradient(90deg, var(--ds-color-primary), var(--ds-color-accent)); border-radius: 4px; transition: width 0.4s ease;"></div>
            </div>
          </div>
          <ds-button id="btn-view-certification" variant="accent" size="lg" style="width: 100%;">
            ${profile.percentage >= 100 ? '🎉 Voir mon certificat' : '🎯 Voir ma progression'}
          </ds-button>
        </div>

        <!-- ✅ SECTION 4 : RAPPORTS DÉTAILLÉS (existante) -->
        <div style="background: var(--ds-color-surface); padding: 1.5rem; border-radius: var(--ds-radius-lg); border: 1px solid var(--ds-color-border);">
          <h3 style="color: var(--ds-color-text); margin-bottom: 1rem;">📋 Tatitra (Rapports détaillés)</h3>
          <div style="display: grid; gap: 0.75rem;">
            <div style="display: flex; justify-content: space-between; padding: 0.75rem; background: var(--ds-color-surface-2); border-radius: var(--ds-radius-md);">
              <span>📖 Leçons (Mots)</span>
              <strong>${journeys.lessons?.length || 0} / 10</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.75rem; background: var(--ds-color-surface-2); border-radius: var(--ds-radius-md);">
              <span>🎯 Révisions (Mots)</span>
              <strong>${journeys.practices?.length || 0} / 10</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.75rem; background: var(--ds-color-surface-2); border-radius: var(--ds-radius-md);">
              <span>📝 Leçons (Phrases)</span>
              <strong>${journeys.phraseLessons?.length || 0} / 10</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.75rem; background: var(--ds-color-surface-2); border-radius: var(--ds-radius-md);">
              <span>🎯 Révisions (Phrases)</span>
              <strong>${journeys.phrasePractices?.length || 0} / 10</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.75rem; background: var(--ds-color-surface-2); border-radius: var(--ds-radius-md);">
              <span>💬 Dialogues</span>
              <strong>${journeys.dialogues?.length || 0} / 10</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.75rem; background: var(--ds-color-surface-2); border-radius: var(--ds-radius-md);">
              <span>🎭 Role Play</span>
              <strong>${journeys.roleplays?.length || 0} / 10</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.75rem; background: var(--ds-color-surface-2); border-radius: var(--ds-radius-md);">
              <span>🏆 Défis</span>
              <strong>${journeys.challenges?.length || 0} / 10</strong>
            </div>
          </div>
        </div>
      </section>
    `;

    document.getElementById('btn-back').addEventListener('click', () => router.navigate('/'));

         document.getElementById('btn-gamification-guide')?.addEventListener('click', () => {
       showGamificationGuide();
     });

    // ✅ Event listener pour la certification
    document.getElementById('btn-view-certification')?.addEventListener('click', () => {
      router.navigate('/certification');
    });

    logger.info('✅ Page Profil rendue avec données personnelles');
    } catch (e) {
    showError(main, e, {
      title: 'Erreur de profil',
      subtitle: 'Impossible de charger vos données',
      backRoute: '/',
      backLabel: '← Retour à l\'accueil',
      retry: true
    });
  }
}


// ═══════════════════════════════════════════════════════════
// MODAL DE GAMIFICATION (Explication des concepts)
// ═══════════════════════════════════════════════════════════
function showGamificationGuide() {
  if (document.getElementById('gamification-modal')) {
    document.getElementById('gamification-modal').remove();
    return;
  }

  const modal = document.createElement('div');
  modal.id = 'gamification-modal';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.75); z-index: 10002;
    display: flex; align-items: center; justify-content: center;
    padding: 1rem; animation: fadeIn 0.3s ease-out;
  `;

  modal.innerHTML = `
    <div style="
      background: white; padding: 0; border-radius: 20px;
      max-width: 480px; width: 100%; max-height: 85vh;
      overflow-y: auto; position: relative;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      animation: slideUp 0.4s ease-out;
    ">
      <!-- HEADER -->
      <div style="
        background: linear-gradient(135deg, #0A8A6E 0%, #087a62 100%);
        padding: 1.5rem 2rem; border-radius: 20px 20px 0 0;
        position: relative; text-align: center;
      ">
        <button id="close-gamification-btn" style="
          position: absolute; top: 12px; right: 12px;
          background: rgba(255,255,255,0.2); border: none;
          border-radius: 50%; width: 32px; height: 32px;
          font-size: 1.2rem; cursor: pointer; color: white;
          display: flex; align-items: center; justify-content: center;
        ">×</button>
        <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🎮</div>
        <h2 style="color: white; margin: 0; font-size: 1.3rem;">
          Fomba fiasan'ny lalao
        </h2>
        <p style="color: rgba(255,255,255,0.85); margin: 0.25rem 0 0 0; font-size: 0.9rem; font-style: italic;">
          (Comment fonctionne la gamification)
        </p>
      </div>

      <!-- CONTENU -->
      <div style="padding: 1.5rem 2rem 2rem 2rem;">

        <!-- 1. XP -->
        <div style="
          background: linear-gradient(135deg, rgba(10,138,110,0.08) 0%, rgba(10,138,110,0.03) 100%);
          padding: 1.25rem; border-radius: 16px; margin-bottom: 1rem;
          border-left: 4px solid #0A8A6E;
        ">
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
            <span style="font-size: 1.8rem;">⭐</span>
            <div>
              <h3 style="margin: 0; color: #0A8A6E; font-size: 1.1rem;">XP <span style="font-size: 0.85rem; color: #64748b; font-style: italic;">(Points d'Expérience)</span></h3>
              <p style="margin: 0; font-size: 0.8rem; color: #E8A33D; font-style: italic;">(Ny isa maneho ny ezaka nataonao)</p>
            </div>
          </div>
          <p style="margin: 0; font-size: 0.9rem; color: #475569; line-height: 1.6;">
            Isaky ny mianatra ianao dia mahazo XP. Ny lesona dia <strong>+20 XP</strong>, ny fanazaran-tena <strong>+30 XP</strong>, ny dialogue <strong>+25 XP</strong>, ary ny défi <strong>+50 XP</strong>.
            <br><span style="font-size: 0.8rem; color: #94a3b8; font-style: italic;">(Chaque activité vous rapporte des XP. Plus c'est difficile, plus vous en gagnez.)</span>
          </p>
        </div>

        <!-- 2. NIVEAU CECR -->
        <div style="
          background: linear-gradient(135deg, rgba(232,163,61,0.08) 0%, rgba(232,163,61,0.03) 100%);
          padding: 1.25rem; border-radius: 16px; margin-bottom: 1rem;
          border-left: 4px solid #E8A33D;
        ">
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
            <span style="font-size: 1.8rem;">📈</span>
            <div>
              <h3 style="margin: 0; color: #E8A33D; font-size: 1.1rem;">Niveau CECR <span style="font-size: 0.85rem; color: #64748b; font-style: italic;">(A0 → A1 → A2)</span></h3>
              <p style="margin: 0; font-size: 0.8rem; color: #0A8A6E; font-style: italic;">(Ny ambaratonga ara-pianarana)</p>
            </div>
          </div>
          <p style="margin: 0; font-size: 0.9rem; color: #475569; line-height: 1.6;">
            Ny niveau dia mifandray amin'ny fandrosoanao tena izy, fa tsy ny XP. Tsy afaka mihoatra ny A0 ianao raha tsy vita ny lohahevitra A0 rehetra.
            <br><span style="font-size: 0.8rem; color: #94a3b8; font-style: italic;">(Le niveau reflète votre progression réelle, pas vos XP. Vous ne pouvez pas sauter d'étape.)</span>
          </p>
        </div>

        <!-- 3. BADGES -->
        <div style="
          background: linear-gradient(135deg, rgba(10,138,110,0.08) 0%, rgba(10,138,110,0.03) 100%);
          padding: 1.25rem; border-radius: 16px; margin-bottom: 1rem;
          border-left: 4px solid #0A8A6E;
        ">
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
            <span style="font-size: 1.8rem;">🏅</span>
            <div>
              <h3 style="margin: 0; color: #0A8A6E; font-size: 1.1rem;">Badges <span style="font-size: 0.85rem; color: #64748b; font-style: italic;">(Marika fahombiazana)</span></h3>
              <p style="margin: 0; font-size: 0.8rem; color: #E8A33D; font-style: italic;">(Ny valisoa ho an'ny fahavitan'ny lohahevitra)</p>
            </div>
          </div>
          <p style="margin: 0; font-size: 0.9rem; color: #475569; line-height: 1.6;">
            🌱 1 lohahevitra vita · ⭐ 3 lohahevitra · 🏆 5 lohahevitra · 👑 10 lohahevitra
            <br><span style="font-size: 0.8rem; color: #94a3b8; font-style: italic;">(Débloquez des badges en complétant des thèmes différents.)</span>
          </p>
        </div>

        <!-- 4. STREAK -->
        <div style="
          background: linear-gradient(135deg, rgba(232,163,61,0.08) 0%, rgba(232,163,61,0.03) 100%);
          padding: 1.25rem; border-radius: 16px; margin-bottom: 1rem;
          border-left: 4px solid #E8A33D;
        ">
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
            <span style="font-size: 1.8rem;">🔥</span>
            <div>
              <h3 style="margin: 0; color: #E8A33D; font-size: 1.1rem;">Streak <span style="font-size: 0.85rem; color: #64748b; font-style: italic;">(Andro mifanesy)</span></h3>
              <p style="margin: 0; font-size: 0.8rem; color: #0A8A6E; font-style: italic;">(Ny isan'ny andro nianaranao tsy tapaka)</p>
            </div>
          </div>
          <p style="margin: 0; font-size: 0.9rem; color: #475569; line-height: 1.6;">
            Isan'andro mianatra ianao dia mitombo ny streak. Raha tsy mianatra ianao mandritra ny 1 andro, dia miverina 0 ny streak.
            <br><span style="font-size: 0.8rem; color: #94a3b8; font-style: italic;">(Apprenez chaque jour pour garder votre série. Un jour manqué = retour à zéro !)</span>
          </p>
        </div>

        <!-- 5. POINTS DE PROGRESSION -->
        <div style="
          background: linear-gradient(135deg, rgba(10,138,110,0.08) 0%, rgba(10,138,110,0.03) 100%);
          padding: 1.25rem; border-radius: 16px; margin-bottom: 1rem;
          border-left: 4px solid #0A8A6E;
        ">
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
            <span style="font-size: 1.8rem;">📊</span>
            <div>
              <h3 style="margin: 0; color: #0A8A6E; font-size: 1.1rem;">Fandrosoana <span style="font-size: 0.85rem; color: #64748b; font-style: italic;">(Progression des thèmes)</span></h3>
              <p style="margin: 0; font-size: 0.8rem; color: #E8A33D; font-style: italic;">(Ny teboka eo amin'ny karatra lohahevitra)</p>
            </div>
          </div>
          <p style="margin: 0 0 0.75rem 0; font-size: 0.9rem; color: #475569; line-height: 1.6;">
            Ny teboka eo amin'ny karatra lohahevitra dia mampiseho ny fandrosoanao :
            <br><span style="font-size: 0.8rem; color: #94a3b8; font-style: italic;">(Les points sur les cartes de thèmes montrent votre avancement :)</span>
          </p>
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.75rem; background: white; border-radius: 10px;">
              <span style="font-size: 1.5rem;">⚪</span>
              <div>
                <strong style="color: #475569; font-size: 0.9rem;">Tsy mbola nanomboka</strong>
                <p style="margin: 0; font-size: 0.8rem; color: #94a3b8; font-style: italic;">(Pas encore commencé)</p>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.75rem; background: white; border-radius: 10px;">
              <span style="font-size: 1.5rem;">🟠</span>
              <div>
                <strong style="color: #E8A33D; font-size: 0.9rem;">Eo am-pianarana</strong>
                <p style="margin: 0; font-size: 0.8rem; color: #94a3b8; font-style: italic;">(En cours d'apprentissage)</p>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.75rem; background: white; border-radius: 10px;">
              <span style="font-size: 1.5rem;">🟢</span>
              <div>
                <strong style="color: #0A8A6E; font-size: 0.9rem;">Vita tanteraka !</strong>
                <p style="margin: 0; font-size: 0.8rem; color: #94a3b8; font-style: italic;">(Complètement terminé !)</p>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.75rem; background: white; border-radius: 10px;">
              <span style="font-size: 1.5rem;">🔒</span>
              <div>
                <strong style="color: #94a3b8; font-size: 0.9rem;">Premium ihany</strong>
                <p style="margin: 0; font-size: 0.8rem; color: #94a3b8; font-style: italic;">(Réservé aux abonnés Premium)</p>
              </div>
            </div>
          </div>
        </div>

        <!-- BOUTON FERMER -->
        <button id="btn-understand-gamification" style="
          width: 100%; padding: 14px;
          background: linear-gradient(135deg, #E8A33D 0%, #d4922e 100%);
          color: white; border: none; border-radius: 12px;
          font-weight: bold; font-size: 1rem; cursor: pointer;
          box-shadow: 0 4px 12px rgba(232, 163, 61, 0.3);
          margin-top: 0.5rem;
        ">
          Azoko tsara ! (J'ai bien compris !)
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => {
    const el = document.getElementById('gamification-modal');
    if (el) el.remove();
  };

  document.getElementById('close-gamification-btn').addEventListener('click', closeModal);
  document.getElementById('btn-understand-gamification').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
}



// --- VUE : LISTE DES THÈMES DU NIVEAU ---
async function renderThemes() {
  updateNavActiveState();
  const main = document.getElementById('app');
  main.innerHTML = getSkeletonThemesList();

  try {
    const manifest = await content.loadManifest('fr');
    const levelData = manifest.levels.find(l => l.id === currentLevel);
    const profile = await gamification.getProfile();
    currentTheme = null;

    // ✅ DICTIONNAIRE EXPLICITE AVEC TOUTES LES ICÔNES
    const themeInfo = {
      'alphabet1': { icon: '🔤', fr: 'Alphabet - Partie 1', mg: 'Alfabe - Ampahany 1' },
      'alphabet2': { icon: '🔡', fr: 'Alphabet - Partie 2', mg: 'Alfabe - Ampahany 2' },
      'survival':  { icon: '', fr: 'Mots de survie', mg: 'Teny fototra' },
      'family':    { icon: '👨‍👩‍👧', fr: 'La Famille', mg: 'Ny Fianakaviana' },
      'market':    { icon: '🛒', fr: 'Le Marché', mg: 'Ny Tsena' },
      'numbers':   { icon: '🔢', fr: 'Nombres (1-10)', mg: 'Ny Isa (1-10)' },
      'numbers2':  { icon: '🧮', fr: 'Nombres (11-20)', mg: 'Ny Isa (11-20)' },
      'colors':    { icon: '🎨', fr: 'Les Couleurs', mg: 'Ny Loko' },
      'days':      { icon: '📅', fr: 'Les Jours', mg: 'Ny Andro' },
      'months':    { icon: '🗓️', fr: 'Les Mois', mg: 'Ny Volana' },
      'greetings': { icon: '👋', fr: 'Salutations', mg: 'Fiarahabana' },
      'body':      { icon: '🧍', fr: 'Le Corps', mg: 'Ny Vatana' }
    };

   const journeys = journeyTracker.getCompletedJourneys();
    const journeyTypes = ['lessons', 'practices', 'dialogues', 'roleplays', 'challenges'];

   // ✅ AJOUTER : Mettre alphabet1 et alphabet2 en premier (sans doublons)
      const otherUnits = levelData.units.filter(u => u !== 'alphabet1' && u !== 'alphabet2');
      const orderedUnits = ['alphabet1', 'alphabet2', ...otherUnits];

      const themesHtml = orderedUnits.map(unitId => {
      const info = themeInfo[unitId] || { icon: '📁', fr: unitId, mg: unitId };
      const locked = isThemeLocked(unitId, profile);

      // ✅ Calcul de la progression (uniquement si déverrouillé)
      let doneCount = 0;
      if (!locked) {
        journeyTypes.forEach(type => {
          if (journeys[type] && journeys[type].includes(unitId)) doneCount++;
        });
      }

      // ✅ Afficher le cadenas OU le point de progression, jamais les deux
      let statusIndicator = '';
      if (locked) {
        statusIndicator = '<div style="font-size: 1.8rem;" title="Premium">🔒</div>';
      } else {
        let statusDot = '⚪';
        if (doneCount === 5) statusDot = '🟢';
        else if (doneCount > 0) statusDot = '🟠';
        statusIndicator = `<div style="font-size: 1.5rem;" title="${doneCount}/5">${statusDot}</div>`;
      }

            return `
              <div class="card-animate interactive-tap btn-select-theme" data-theme="${unitId}" style="
                background:var(--ds-color-surface); padding:1.5rem; border-radius:var(--ds-radius-lg);
                border:1px solid var(--ds-color-border); display:flex; flex-direction:column; gap:0.5rem;
                opacity: ${locked ? 0.6 : 1}; position: relative; cursor: ${locked ? 'not-allowed' : 'pointer'};">

                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <div class="icon-float" style="font-size: 2.5rem;">${info.icon}</div>
                  ${statusIndicator}
                </div>

                <h3 style="color:var(--ds-color-primary); margin:0.5rem 0 0 0; font-size: 1.1rem;">${info.fr}</h3>
                <p style="color:var(--ds-color-text-muted); font-size:0.85rem; margin:0; font-style:italic;">${info.mg}</p>

                ${locked ? '<p style="font-size:0.75rem; color:var(--ds-color-accent); margin-top:4px; font-weight:600;">⭐ Premium requis</p>' : ''}
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
        const themeId = card.dataset.theme;
        if (isThemeLocked(themeId, profile)) {
          // Rediriger vers la page Premium
          alert('Ce thème est réservé aux utilisateurs Premium. Passez à Premium pour le débloquer !');
          return;
        }
        currentTheme = themeId;
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
// ═══════════════════════════════════════════════════════════
// VUE : DÉTAIL D'UN THÈME (Corrigée et blindée)
// ═══════════════════════════════════════════════════════════
async function renderThemeDetail() {
  updateNavActiveState();
  const main = document.getElementById('app');
  if (!currentTheme) {
    router.navigate('/themes');
    return;
  }
 main.innerHTML = getSkeletonThemes();

  // ✅ FLUX SPÉCIAL POUR L'ALPHABET (Variables définies AVANT utilisation)
  if (currentTheme === 'alphabet1' || currentTheme === 'alphabet2') {
    const isPart1 = currentTheme === 'alphabet1';
    const themeName = isPart1 ? 'Alphabet - Partie 1 (A-M)' : 'Alphabet - Partie 2 (N-Z)';
    const titleMg = isPart1 ? 'Alfabe - Ampahany 1 (A-M)' : 'Alfabe - Ampahany 2 (N-Z)';

    main.innerHTML = `
      <section style="max-width: 600px; margin: 0 auto; padding: 2rem 1rem; text-align:center;">
        <ds-button variant="ghost" size="sm" id="btn-back-themes" style="margin-bottom: 1rem; float:left;">← Thèmes</ds-button>
        <div style="clear:both; padding-top:1rem;">
          <span style="background:var(--ds-color-accent); color:white; padding:4px 12px; border-radius:20px; font-weight:600; font-size:0.8rem;">Niveau A0</span>
        </div>
        <h1 style="margin-top:1rem; color:var(--ds-color-primary);">${themeName}</h1>
        <p style="color:var(--ds-color-text-muted); margin-bottom: 2rem;">${titleMg} • 13 lettres</p>
        <div style="background:var(--ds-color-primary-soft); padding:2rem; border-radius:var(--ds-radius-lg); border:2px solid var(--ds-color-primary); margin-bottom:1.5rem;">
          <div style="font-size:4rem; margin-bottom:1rem;">🔤</div>
          <h3 style="color:var(--ds-color-primary); margin-bottom:0.5rem;">Écoute et répétition uniquement</h3>
          <p style="color:var(--ds-color-text-muted); margin-bottom:1rem; font-style:italic;">
            (Mihainoa ary avereno ihany - tsy misy fanadinana na resaka)
          </p>
          <p style="color:var(--ds-color-text); font-size:0.95rem;">
            Ce thème spécial ne contient pas de révision ni de dialogue.
            Vous allez simplement écouter et répéter chaque lettre.
          </p>
        </div>
        <ds-button id="btn-start-alphabet" variant="success" size="lg" class="guide-active" style="width:100%; animation: pulse-green 1.5s infinite;">
          🎯 Commencer l'alphabet →
        </ds-button>
      </section>
    `;
    document.getElementById('btn-back-themes').addEventListener('click', () => router.navigate('/themes'));
    document.getElementById('btn-start-alphabet').addEventListener('click', () => router.navigate('/alphabet'));
    window.teacherAvatar.show('theme-detail');
    return; // ⚠️ IMPORTANT : sortir de la fonction ici
  }

  try {
    // ✅ Les variables sont maintenant définies AVANT d'être utilisées plus bas
    const unitData = await content.loadSection('fr', 'vocabulary', currentTheme);
    const profile = await gamification.getProfile();

    const themeNames = {
      'alphabet1': 'Alphabet - Partie 1', 'alphabet2': 'Alphabet - Partie 2',
      'survival': 'Mots de survie', 'numbers': 'Les Nombres', 'family': 'La Famille',
      'market': 'Au Marché', 'colors': 'Les Couleurs', 'numbers2': 'Nombres (11-20)',
      'days': 'Les Jours', 'months': 'Les Mois', 'greetings': 'Salutations', 'body': 'Le Corps'
    };

    const themeName = themeNames[currentTheme] || currentTheme;
    const locked = isThemeLocked(currentTheme, profile);

    main.innerHTML = `
      <section style="max-width: 600px; margin: 0 auto; padding: 2rem 1rem; text-align:center;">
        <ds-button variant="ghost" size="sm" id="btn-back-themes" style="margin-bottom: 1rem; float:left;">← Thèmes</ds-button>
        <div style="clear:both; padding-top:1rem;">
          <span style="background:var(--ds-color-accent); color:white; padding:4px 12px; border-radius:20px; font-weight:600; font-size:0.8rem;">Niveau ${currentLevel}</span>
        </div>
        <h1 style="margin-top:1rem; color:var(--ds-color-primary);">${themeName}</h1>
        <p style="color:var(--ds-color-text-muted); margin-bottom: 2rem;">${unitData.themeMg || ''} • ${unitData.items.length} mots</p>
        ${locked ? `
          <div style="background:var(--ds-color-primary-soft); padding:2rem; border-radius:var(--ds-radius-lg); border:2px solid var(--ds-color-primary); margin-bottom:2rem;">
            <div style="font-size:3rem; margin-bottom:1rem;">🔒</div>
            <h3 style="color:var(--ds-color-primary); margin-bottom:0.5rem;">Thème Premium</h3>
            <p style="color:var(--ds-color-text-muted); margin-bottom:1rem;">
              Passez à Premium pour débloquer ce thème et tous les autres.
            </p>
            <ds-button id="btn-unlock-theme" variant="primary" size="lg" style="width:100%;">
              Débloquer (15 000 Ar / mois)
            </ds-button>
          </div>
        ` : `
          <div style="display:flex; flex-direction:column; gap:1rem; text-align:left;">
            <div style="background:var(--ds-color-surface); padding:1rem; border-radius:var(--ds-radius-md); border:1px solid var(--ds-color-border);">
              <h3 style="margin:0 0 0.5rem 0; color:var(--ds-color-text); font-size:1rem;">📖 Étape 1 : Les Mots</h3>
              <p style="margin:0 0 0.25rem 0; font-size:0.85rem; color:var(--ds-color-text-muted); font-style:italic;">Écoutez et répétez chaque mot</p>
              <ds-button id="btn-lesson-words" variant="primary" size="md" style="width:100%;">1. Apprendre les mots</ds-button>
            </div>
            <div style="background:var(--ds-color-surface); padding:1rem; border-radius:var(--ds-radius-md); border:1px solid var(--ds-color-border);">
              <h3 style="margin:0 0 0.5rem 0; color:var(--ds-color-text); font-size:1rem;">🎯 Étape 2 : Révision des Mots</h3>
              <p style="margin:0 0 0.25rem 0; font-size:0.85rem; color:var(--ds-color-text-muted); font-style:italic;">Quiz + Shadowing sur les mots</p>
              <ds-button id="btn-practice-words" variant="success" size="md" style="width:100%;">2. Réviser les mots</ds-button>
            </div>
            <div style="background:var(--ds-color-surface); padding:1rem; border-radius:var(--ds-radius-md); border:1px solid var(--ds-color-border);">
              <h3 style="margin:0 0 0.5rem 0; color:var(--ds-color-text); font-size:1rem;">📝 Étape 3 : Les Phrases de contexte</h3>
              <p style="margin:0 0 0.25rem 0; font-size:0.85rem; color:var(--ds-color-text-muted); font-style:italic;">Écoutez et répétez les phrases complètes</p>
              <ds-button id="btn-lesson-phrases" variant="primary" size="md" style="width:100%;">3. Apprendre les phrases</ds-button>
            </div>
            <div style="background:var(--ds-color-surface); padding:1rem; border-radius:var(--ds-radius-md); border:1px solid var(--ds-color-border);">
              <h3 style="margin:0 0 0.5rem 0; color:var(--ds-color-text); font-size:1rem;">🎯 Étape 4 : Révision des Phrases</h3>
              <p style="margin:0 0 0.25rem 0; font-size:0.85rem; color:var(--ds-color-text-muted); font-style:italic;">Quiz + Shadowing sur les phrases</p>
              <ds-button id="btn-practice-phrases" variant="success" size="md" style="width:100%;">4. Réviser les phrases</ds-button>
            </div>
            <div style="background:var(--ds-color-surface); padding:1rem; border-radius:var(--ds-radius-md); border:1px solid var(--ds-color-border);">
              <h3 style="margin:0 0 0.5rem 0; color:var(--ds-color-text); font-size:1rem;">💬 Étape 5 : Dialogue</h3>
              <p style="margin:0 0 0.25rem 0; font-size:0.85rem; color:var(--ds-color-text-muted); font-style:italic;">Conversation complète avec Role Play</p>
              <ds-button id="btn-dialogues" variant="accent" size="md" style="width:100%;">5. Faire le dialogue</ds-button>
            </div>
          </div>
        `}
      </section>
    `;

    document.getElementById('btn-back-themes').addEventListener('click', () => router.navigate('/themes'));

    if (locked) {
      document.getElementById('btn-unlock-theme')?.addEventListener('click', () => {
        handleUpgrade(document.getElementById('btn-unlock-theme'), profile);
      });
    } else {
      // ✅ Utilisation de ?. pour éviter les erreurs si l'élément n'est pas trouvé
      document.getElementById('btn-lesson-words')?.addEventListener('click', () => router.navigate('/lesson'));
      document.getElementById('btn-practice-words')?.addEventListener('click', () => router.navigate('/practice'));
      document.getElementById('btn-lesson-phrases')?.addEventListener('click', () => router.navigate('/lesson-phrases'));
      document.getElementById('btn-practice-phrases')?.addEventListener('click', () => router.navigate('/practice-phrases'));
      document.getElementById('btn-dialogues')?.addEventListener('click', () => router.navigate('/dialogues'));
    }

    window.teacherAvatar.show('theme-detail');
  } catch (e) {
    console.error(' Erreur renderThemeDetail:', e);
    main.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--ds-color-danger);"> <p>Erreur : ${e.message}</p> <ds-button onclick="window.location.hash='/themes'">Retour</ds-button> </div>`;
  }
}

// ✅ HEADER DE PROGRESSION FLOTTANT (Utilise getProfileData)
function renderProgressHeader() {
  if (window.location.hash === '#' || window.location.hash === '#/' || window.location.hash === '') return;

  const oldHeader = document.getElementById('floating-progress-header');
  if (oldHeader) oldHeader.remove();

  const header = document.createElement('div');
  header.id = 'floating-progress-header';
  header.style.cssText = `position: fixed; top: 65px; left: 50%; transform: translateX(-50%); background: transparent; padding: 8px 16px; z-index: 999; display: flex; gap: 16px; align-items: center; font-size: 0.95rem; font-weight: 700; animation: slideDown 0.4s ease-out;`;

  // ✅ Utilise la fonction centralisée
  const data = getProfileData();

  header.innerHTML = `
    <div style="display:flex; align-items:center; gap:4px; color: var(--ds-color-accent); text-shadow: 0 1px 2px rgba(255,255,255,0.8);">
      <span style="font-size:1.3rem;"></span>
      <span>${data.streak}</span>
    </div>
    <div style="display:flex; align-items:center; gap:4px; color: var(--ds-color-primary); text-shadow: 0 1px 2px rgba(255,255,255,0.8);">
      <span style="font-size:1.3rem;">⭐</span>
      <span>${data.xp} XP</span>
    </div>
    <div style="display:flex; align-items:center; gap:4px; color: var(--ds-color-success); text-shadow: 0 1px 2px rgba(255,255,255,0.8);">
      <span style="font-size:1.3rem;">🏆</span>
      <span>Niv. ${data.level}</span>
    </div>
    <div style="display:flex; align-items:center; gap:4px; color: var(--ds-color-text); text-shadow: 0 1px 2px rgba(255,255,255,0.8);">
      <span style="font-size:1.3rem;">📊</span>
      <span>${data.percentage}%</span>
    </div>
    ${data.badges.length > 0 ? `
    <div style="display:flex; align-items:center; gap:4px; color: var(--ds-color-accent); text-shadow: 0 1px 2px rgba(255,255,255,0.8);">
      <span style="font-size:1.3rem;">🎖️</span>
      <span>${data.badges.length}</span>
    </div>
    ` : ''}
  `;

  document.body.appendChild(header);

  // Rafraîchissement toutes les 2 secondes
  // ✅ Pas de refresh toutes les 2s sur appareils modestes (économie CPU/batterie)
  if (!window._progressHeaderInterval && !window.deviceCheck?.isLowEnd()) {
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
          <span style="font-size:1.3rem;"></span>
          <span>${newData.streak}</span>
        </div>
        <div style="display:flex; align-items:center; gap:4px; color: var(--ds-color-primary); text-shadow: 0 1px 2px rgba(255,255,255,0.8);">
          <span style="font-size:1.3rem;">⭐</span>
          <span>${newData.xp} XP</span>
        </div>
        <div style="display:flex; align-items:center; gap:4px; color: var(--ds-color-success); text-shadow: 0 1px 2px rgba(255,255,255,0.8);">
          <span style="font-size:1.3rem;">🏆</span>
          <span>Niv. ${newData.level}</span>
        </div>
        <div style="display:flex; align-items:center; gap:4px; color: var(--ds-color-text); text-shadow: 0 1px 2px rgba(255,255,255,0.8);">
          <span style="font-size:1.3rem;">📊</span>
          <span>${newData.percentage}%</span>
        </div>
        ${newData.badges.length > 0 ? `
        <div style="display:flex; align-items:center; gap:4px; color: var(--ds-color-accent); text-shadow: 0 1px 2px rgba(255,255,255,0.8);">
          <span style="font-size:1.3rem;">🎖️</span>
          <span>${newData.badges.length}</span>
        </div>
        ` : ''}
      `;
    }, 2000);
  }
}

// ✅ CSS pour l'animation
if (!document.getElementById('progress-header-style')) {
  const style = document.createElement('style');
  style.id = 'progress-header-style';
  style.innerHTML = `@keyframes slideDown { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`;
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
        <button id="btn-float-dict" style="
      background: var(--ds-color-accent, #E8A33D); color: white; border: none;
      padding: 12px 20px; border-radius: 50px; font-weight: bold;
      font-size: 0.95rem; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      display: flex; align-items: center; gap: 8px; min-width: 150px; justify-content: center;
    ">📖 Dictionnaire</button>
  `;

  document.body.appendChild(container);

  // Action du bouton Commencer
  document.getElementById('btn-float-start').addEventListener('click', () => {
    // ✅ PLUS DE REDIRECTION AUTOMATIQUE - Juste un message vocal
    window.teacherAvatar.speak("Bienvenue ! Choisissez un niveau pour commencer votre apprentissage du français. Cliquez sur une carte de niveau.");
    // Pas de setTimeout avec router.navigate()
  });

  // Action du bouton Guide
  document.getElementById('btn-float-guide').addEventListener('click', () => {
    showAppGuide();
  });

  // Dictionnaire intélligent
  document.getElementById('btn-float-dict')?.addEventListener('click', () => {
  router.navigate('/dictionary');
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


// ═══════════════════════════════════════════════════════════
// SKELETON SCREENS
// ═══════════════════════════════════════════════════════════

function getSkeletonLesson() {
  return `
    <div class="skeleton-page">
      <!-- Barre de progression -->
      <div class="skeleton skeleton-progress"></div>

      <!-- Titre de la leçon -->
      <div class="skeleton skeleton-title" style="width: 50%; margin: 0 auto 2rem;"></div>

      <!-- Liste de mots -->
      <div class="skeleton-word-list">
       ${Array.from({length: window.deviceCheck?.isLowEnd() ? 3 : 5}).map(() => `
          <div class="skeleton-word-item">
            <div class="skeleton skeleton-word-icon"></div>
            <div class="skeleton-word-text">
              <div class="skeleton skeleton-text long"></div>
              <div class="skeleton skeleton-text short"></div>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Bouton -->
      <div style="text-align: center; margin-top: 2rem;">
        <div class="skeleton skeleton-button"></div>
      </div>
    </div>
  `;
}

function getSkeletonThemes() {
  return `
    <div class="skeleton-page">
      <!-- Titre -->
      <div class="skeleton skeleton-title" style="width: 40%; margin: 0 auto 2rem;"></div>

      <!-- Grille de thèmes -->
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1rem;">
       ${Array.from({length: window.deviceCheck?.isLowEnd() ? 4 : 6}).map(() => `
          <div class="skeleton-card">
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
              <div class="skeleton skeleton-avatar" style="width: 50px; height: 50px; margin: 0;"></div>
              <div style="flex: 1;">
                <div class="skeleton skeleton-text medium"></div>
                <div class="skeleton skeleton-text short"></div>
              </div>
            </div>
            <div class="skeleton skeleton-text long"></div>
            <div class="skeleton skeleton-button" style="width: 100%;"></div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function getSkeletonProfile() {
  return `
    <div class="skeleton-page">
      <!-- Avatar -->
      <div class="skeleton skeleton-avatar" style="width: 100px; height: 100px;"></div>

      <!-- Nom -->
      <div class="skeleton skeleton-title" style="width: 50%; margin: 0 auto 1.5rem;"></div>

      <!-- Stats -->
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 2rem;">
       ${Array.from({length: window.deviceCheck?.isLowEnd() ? 2 : 4}).map(() => `
          <div class="skeleton-card" style="text-align: center;">
            <div class="skeleton skeleton-text short" style="margin: 0 auto;"></div>
            <div class="skeleton skeleton-title" style="width: 60%; margin: 0.5rem auto 0;"></div>
          </div>
        `).join('')}
      </div>

      <!-- Badges -->
      <div class="skeleton-card">
        <div class="skeleton skeleton-text medium" style="margin-bottom: 1rem;"></div>
        <div style="display: flex; gap: 0.5rem;">
         ${Array.from({length: window.deviceCheck?.isLowEnd() ? 2 : 3}).map(() => `
            <div class="skeleton" style="width: 40px; height: 40px; border-radius: 50%;"></div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function getSkeletonThemesList() {
  return `
    <div class="skeleton-page">
      <!-- Bouton retour -->
      <div class="skeleton skeleton-text short" style="margin-bottom: 1.5rem;"></div>

      <!-- Titre du niveau -->
      <div class="skeleton skeleton-title" style="width: 60%; margin-bottom: 2rem;"></div>

      <!-- Liste de thèmes -->
      <div style="display: flex; flex-direction: column; gap: 1rem;">
       ${Array.from({length: window.deviceCheck?.isLowEnd() ? 3 : 5}).map(() => `
          <div class="skeleton-card">
            <div style="display: flex; align-items: center; gap: 1rem;">
              <div class="skeleton" style="width: 60px; height: 60px; border-radius: var(--ds-radius-md); flex-shrink: 0;"></div>
              <div style="flex: 1;">
                <div class="skeleton skeleton-text medium"></div>
                <div class="skeleton skeleton-text short" style="margin-top: 0.5rem;"></div>
              </div>
              <div class="skeleton" style="width: 80px; height: 40px; border-radius: var(--ds-radius-md);"></div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════
// VUE : CONVERSATION LIVE (sélection par niveau)
// ═══════════════════════════════════════════════════════════
async function renderConversationLive() {
  console.log('[ConversationLive] 🚀 Fonction appelée');
  updateNavActiveState();
  const main = document.getElementById('app');

  if (!main) {
    console.error('[ConversationLive] ❌ #app introuvable');
    return;
  }

  main.innerHTML = '<div style="text-align:center; padding:2rem;">Chargement Conversation Live...</div>';
  console.log('[ConversationLive] ✅ Skeleton affiché');

  try {
    // Supprimer les actions flottantes de l'accueil
    const floatActions = document.getElementById('floating-home-actions');
    if (floatActions) floatActions.remove();

    const levels = [
      {
        id: 'A0',
        name: 'Niveau A0',
        subtitle: 'Débutant absolu',
        description: 'Dialogues simples pour survivre au quotidien',
        available: true,
        example: 'market_01',
        color: 'var(--ds-color-success)',
        icon: '🌱'
      },
      {
        id: 'A1',
        name: 'Niveau A1',
        subtitle: 'Élémentaire',
        description: 'Conversations de la vie courante',
        available: false,
        example: null,
        color: 'var(--ds-color-primary)',
        icon: '📚'
      },
      {
        id: 'A2',
        name: 'Niveau A2',
        subtitle: 'Intermédiaire',
        description: 'Discussions complexes et professionnelles',
        available: false,
        example: null,
        color: 'var(--ds-color-accent)',
        icon: '🎓'
      },
      {
        id: 'B1',
        name: 'Niveau B1',
        subtitle: 'Seuil',
        description: 'Débats et opinions argumentées',
        available: false,
        example: null,
        color: 'var(--ds-color-text-muted)',
        icon: '🔒'
      }
    ];

    main.innerHTML = `
      <section style="max-width: 600px; margin: 0 auto; padding: 2rem 1rem;">
        <ds-button variant="ghost" size="sm" id="btn-back" style="margin-bottom: 1rem;">← Retour</ds-button>

        <div style="text-align: center; margin-bottom: 2rem;">
          <div style="font-size: 4rem; margin-bottom: 1rem;">💬</div>
          <h2 style="color: var(--ds-color-primary); margin-bottom: 0.5rem;">Conversation Live avec Teacher AI</h2>
          <p style="color: var(--ds-color-text-muted);">Pratiquez le français en conversation réelle avec votre professeur virtuel</p>
        </div>

        <!-- ✅ Avatar SVG animé en haut -->
       <div id="teacher-avatar-svg-container" style="display: flex; justify-content: center; align-items: center; margin: 1.5rem 0;"></div>
          <!-- Le SVG sera injecté par JavaScript -->
        </div>

        <div style="display: flex; flex-direction: column; gap: 1rem;">
          ${levels.map(level => `
            <div class="conversation-level-card ${level.available ? 'available' : 'locked'}"
                 data-level="${level.id}"
                 data-example="${level.example || ''}"
                 style="
                   background: var(--ds-color-surface);
                   padding: 1.5rem;
                   border-radius: var(--ds-radius-lg);
                   border: 2px solid ${level.available ? level.color : 'var(--ds-color-border)'};
                   cursor: ${level.available ? 'pointer' : 'default'};
                   transition: all 0.3s ease;
                   opacity: ${level.available ? '1' : '0.6'};
                 ">
              <div style="display: flex; align-items: center; gap: 1rem;">
                <div style="font-size: 2.5rem;">${level.icon}</div>
                <div style="flex: 1;">
                  <h3 style="margin: 0 0 0.25rem 0; color: var(--ds-color-text);">${level.name}</h3>
                  <p style="margin: 0 0 0.5rem 0; color: ${level.color}; font-weight: 600; font-size: 0.9rem;">${level.subtitle}</p>
                  <p style="margin: 0; color: var(--ds-color-text-muted); font-size: 0.85rem;">${level.description}</p>
                </div>
                <div style="font-size: 1.5rem; color: ${level.available ? level.color : 'var(--ds-color-text-muted)'};">
                  ${level.available ? '→' : '🔒'}
                </div>
              </div>
            </div>
          `).join('')}
        </div>

        <div style="margin-top: 2rem; padding: 1rem; background: var(--ds-color-surface-2); border-radius: var(--ds-radius-md); text-align: center;">
          <p style="margin: 0; color: var(--ds-color-text-muted); font-size: 0.85rem;">
            💡 Plus de niveaux seront ajoutés prochainement. A0 est disponible maintenant avec un exemple de dialogue au marché.
          </p>
        </div>
      </section>
    `;

    // Initialiser le SVG avatar
    import('./ui/components/teacher-avatar-svg.js').then(module => {
      const TeacherAvatarSVG = module.TeacherAvatarSVG;
      const avatarSVG = new TeacherAvatarSVG('teacher-avatar-svg-container');
      avatarSVG.render();
      avatarSVG.setExpression('happy');
      window.teacherAvatarSVG = avatarSVG;
      console.log('[ConversationLive] ✅ Avatar SVG initialisé');
    }).catch(e => console.warn('[ConversationLive] Avatar SVG non disponible:', e));

    // Event listeners
    document.getElementById('btn-back').addEventListener('click', () => {
      router.navigate('/');
    });

    // Clic sur les cartes de niveau
    document.querySelectorAll('.conversation-level-card').forEach(card => {
      card.addEventListener('click', () => {
        const level = card.dataset.level;
        const example = card.dataset.example;
        const isAvailable = card.classList.contains('available');

        if (!isAvailable) {
          // Feedback visuel pour les niveaux non disponibles
          card.style.transform = 'translateX(-5px)';
          setTimeout(() => { card.style.transform = 'translateX(5px)'; }, 100);
          setTimeout(() => { card.style.transform = ''; }, 200);
          if (window.teacherAvatarSVG) {
            window.teacherAvatarSVG.setExpression('thinking');
          }
          return;
        }

        // Niveau disponible → lancer la conversation
        if (example) {
          console.log(`[ConversationLive] 🚀 Niveau ${level}, dialogue ${example}`);
          // ✅ Stocker l'ID puis naviguer sans query string (le routeur hash ne gère pas ?)
          window.currentConversationId = example;
          router.navigate('/conversation');
        } else {
          console.log(`[ConversationLive] ⚠️ Niveau ${level} disponible mais pas d'exemple`);
        }
      });
    });

    logger.info('✅ Page Conversation Live rendue');
  } catch (e) {
    showError(main, e, {
      title: 'Erreur de conversation',
      subtitle: 'Impossible de charger les conversations',
      backRoute: '/',
      backLabel: '← Retour à l\'accueil',
      retry: true
    });
  }
}

// ✅ Monte l'avatar SVG dans le header live (après chaque rendu)
async function mountLiveAvatar() {
  try {
    if (!window.TeacherAvatarSVGClass) {
      const module = await import('./ui/components/teacher-avatar-svg.js');
      window.TeacherAvatarSVGClass = module.TeacherAvatarSVG;
    }
    const avatar = new window.TeacherAvatarSVGClass('live-teacher-avatar');
    avatar.render();
    window.teacherAvatarSVG = avatar;
  } catch (e) {
    console.warn('[Live] Avatar non disponible:', e);
  }
}

// ═══════════════════════════════════════════════════════════
// VUE : CONVERSATION SEMI-LIBRE (Teacher Avatar IA)
// ═══════════════════════════════════════════════════════════

async function renderConversation() {
  const main = document.getElementById('app');
  main.innerHTML = getSkeletonThemesList();

  // Récupérer l'ID du dialogue depuis l'URL
  const urlParams = new URLSearchParams(window.location.search);
  // ✅ Lire depuis query OU variable globale OU défaut
  const dialogueId = urlParams.get('dialogue') || window.currentConversationId || 'market_01';

  try {
    const response = await fetch(`/content/fr/conversations/${dialogueId}.json`);
    if (!response.ok) throw new Error(`Dialogue introuvable : ${dialogueId}`);
    const dialogue = await response.json();

    console.log(`[Conversation] ✅ Dialogue chargé : ${dialogue.titleFr}`);

    // Afficher le premier nœud
    let currentNodeId = dialogue.nodes[0].id;
    let attempts = {};

    const renderNode = () => {
      const node = dialogue.nodes.find(n => n.id === currentNodeId);
      if (!node) {
        main.innerHTML = `<p style="color:red; text-align:center;">Nœud introuvable : ${currentNodeId}</p>`;
        return;
      }

      if (node.isEnd) {
        main.innerHTML = `
          <section style="max-width: 600px; margin: 0 auto; padding: 2rem 1rem; text-align: center;">
            <div style="font-size: 5rem; margin-bottom: 1rem;">🎉</div>
            <h2 style="color: var(--ds-color-success);">Conversation terminée !</h2>
            <p style="color: var(--ds-color-text); font-size: 1.1rem; margin-bottom: 0.5rem;">${node.textFr}</p>
            <p style="color: var(--ds-color-text-muted); font-style: italic;">(${node.textMg})</p>
            <button onclick="location.hash='/themes'" style="
              margin-top: 2rem; background: var(--ds-color-primary); color: white;
              border: none; padding: 14px 28px; border-radius: 12px;
              font-weight: 600; cursor: pointer; font-size: 1rem; width: 100%;
            ">← Retour aux thèmes</button>
          </section>
        `;
        return;
      }

      if (node.speaker === 'teacher') {
        main.innerHTML = `
          <section class="live-container">
            <div class="live-header">
              <div class="live-teacher-wrap" id="live-teacher-avatar"></div>
              <div class="live-teacher-info">
                <div class="live-teacher-name">Teacher AI <span class="live-badge">● LIVE</span></div>
                <div class="live-dialogue-title">💬 ${dialogue.titleFr}</div>
              </div>
              <button id="btn-quit" class="live-quit" aria-label="Quitter">✕</button>
            </div>
            <div class="live-chat">
              <div class="live-bubble teacher">
                <div class="live-bubble-text">"${node.textFr}"</div>
                <div class="live-bubble-sub">(${node.textMg})</div>
              </div>
              <div class="live-actions">
                <button id="btn-play" class="live-btn primary">🔊 Mihainoa</button>
                <button id="btn-next" class="live-btn success" disabled>Manaraka →</button>
              </div>
            </div>
          </section>
        `;
        mountLiveAvatar();

  // ... (garde les addEventListener existants pour btn-play, btn-next, btn-quit)

        let hasPlayed = false;
               document.getElementById('btn-play').addEventListener('click', () => {
          const btn = document.getElementById('btn-play');
          btn.textContent = '🔊 ...';

          speakWithFeedback(node.audio.ttsTextFr, {
            rate: node.audio.ttsRate || 0.9,
            gender: 'female', // ou 'male' selon le personnage
            onStart: () => {
              btn.textContent = '🔊 ...';
              // ✅ Activer la bouche du SVG avatar
              if (window.teacherAvatarSVG) {
                window.teacherAvatarSVG.startSpeaking();
                window.teacherAvatarSVG.setExpression('happy');
              }
            },
            onEnd: () => {
              btn.textContent = '🔊 Écouter';
              // Débloquer le bouton suivant ou passer à l'étape suivante
              const btnNext = document.getElementById('btn-next');
              if (btnNext) {
                btnNext.classList.add('guide-active');
                btnNext.style.animation = 'pulse-green 1.5s infinite';
              }
            }
          });
        }); // ✅ AJOUTEZ CE `});` POUR FERMER addEventListener

        document.getElementById('btn-next').addEventListener('click', () => {
          currentNodeId = node.nextNode;
          // ✅ NOUVEAU : Mettre à jour la barre de progression
            if (window.updateLessonProgress) {
              window.updateLessonProgress(currentWordIndex);
            }
          renderNode();
        });

        document.getElementById('btn-quit').addEventListener('click', () => {
          if (confirm('Quitter la conversation ?')) location.hash = '/themes';
        });

      } else if (node.speaker === 'user') {
        if (!attempts[node.id]) attempts[node.id] = 0;

        main.innerHTML = `
          <section class="live-container">
            <div class="live-header">
              <div class="live-teacher-wrap" id="live-teacher-avatar"></div>
              <div class="live-teacher-info">
                <div class="live-teacher-name">Teacher AI <span class="live-badge">● LIVE</span></div>
                <div class="live-dialogue-title">💬 ${dialogue.titleFr}</div>
              </div>
              <button id="btn-quit" class="live-quit" aria-label="Quitter">✕</button>
            </div>
            <div class="live-chat">
              <div class="live-bubble user">
                <div class="live-bubble-text">🎯 À votre tour !</div>
                ${attempts[node.id] > 0 ? `<div class="live-bubble-sub">Tentative ${attempts[node.id]} / ${node.maxAttempts}</div>` : ''}
              </div>
              <div class="live-options">
                ${node.responseOptions.map((opt, idx) => `
                  <button class="live-option-btn btn-option" data-idx="${idx}">
                    <div style="font-weight: 600;">${idx === 0 ? '🅰️' : '🅱️'} ${opt.textFr}</div>
                    <div style="font-size: 0.85rem; opacity: 0.7; font-style: italic;">(${opt.textMg})</div>
                  </button>
                `).join('')}
              </div>
              <div id="feedback" style="min-height: 60px;"></div>
            </div>
          </section>
        `;
        mountLiveAvatar();

  // ... (garde les addEventListener existants pour .btn-option et btn-quit)

        document.querySelectorAll('.btn-option').forEach(btn => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            const selected = node.responseOptions[idx];
            attempts[node.id]++;

            document.querySelectorAll('.btn-option').forEach(b => b.disabled = true);
            const feedback = document.getElementById('feedback');

            if (selected.isCorrect) {
                btn.style.borderColor = 'var(--ds-color-success)';

                // ✅ HTML de feedback succès complet
                feedback.innerHTML = `
                  <div style="background: var(--ds-color-success-soft, #d1fae5); padding: 1rem; border-radius: 12px; border-left: 4px solid var(--ds-color-success);">
                    <div style="font-size: 2rem;">✅</div>
                    <p style="color: var(--ds-color-success); font-weight: 600;">${node.feedbackOnSuccess.textFr}</p>
                    <p style="color: var(--ds-color-text-muted); font-style: italic; font-size: 0.9rem;">(${node.feedbackOnSuccess.textMg})</p>
                  </div>
                  <button id="btn-continue" style="margin-top: 1rem; background: var(--ds-color-success); color: white; border: none; padding: 12px 24px; border-radius: 12px; font-weight: 600; cursor: pointer; width: 100%;">Manaraka →</button>
                `;

                // ✅ Feedback succès avec SVG avatar sync
                const u = new SpeechSynthesisUtterance(node.feedbackOnSuccess.audio.ttsTextFr);
                u.lang = 'fr-FR';
                u.rate = 0.9;
                u.onstart = () => {
                  if (window.teacherAvatarSVG) {
                    window.teacherAvatarSVG.startSpeaking();
                    window.teacherAvatarSVG.setExpression('happy');
                  }
                };
                u.onend = () => {
                  if (window.teacherAvatarSVG) {
                    window.teacherAvatarSVG.stopSpeaking();
                    window.teacherAvatarSVG.setExpression('neutral');
                  }
                };
                speechSynthesis.speak(u);

                document.getElementById('btn-continue').addEventListener('click', () => {
                currentNodeId = node.nextNodeOnSuccess;
                renderNode();
              });
            } else {
              btn.style.borderColor = 'var(--ds-color-danger, #ef4444)';
              if (attempts[node.id] >= node.maxAttempts) {
                const correct = node.responseOptions.find(o => o.isCorrect);
                feedback.innerHTML = `
                  <div style="background: #fef3c7; padding: 1rem; border-radius: 12px; border-left: 4px solid var(--ds-color-accent);">
                    <div style="font-size: 2rem;">💡</div>
                    <p>La bonne réponse était : <strong>${correct.textFr}</strong></p>
                  </div>
                  <button id="btn-continue" style="margin-top: 1rem; background: var(--ds-color-accent); color: white; border: none; padding: 12px 24px; border-radius: 12px; font-weight: 600; cursor: pointer; width: 100%;">Manaraka →</button>
                `;
                document.getElementById('btn-continue').addEventListener('click', () => {
                  currentNodeId = node.nextNodeOnMaxAttemptsReached;
                  renderNode();
                });
              } else {
                feedback.innerHTML = `
                  <div style="background: #fee2e2; padding: 1rem; border-radius: 12px; border-left: 4px solid var(--ds-color-danger, #ef4444);">
                    <div style="font-size: 2rem;">🔄</div>
                    <p style="color: var(--ds-color-danger); font-weight: 600;">${node.feedbackOnFail.textFr}</p>
                    <p style="color: var(--ds-color-text-muted); font-style: italic; font-size: 0.9rem;">(${node.feedbackOnFail.textMg})</p>
                  </div>
                  <button id="btn-retry" style="margin-top: 1rem; background: var(--ds-color-accent); color: white; border: none; padding: 12px 24px; border-radius: 12px; font-weight: 600; cursor: pointer; width: 100%;">🔁 Réessayer</button>
                `;

                // ✅ Expression "encouraging" quand l'utilisateur se trompe
                if (window.teacherAvatarSVG) {
                  window.teacherAvatarSVG.setExpression('encouraging');
                }
                document.getElementById('btn-retry').addEventListener('click', renderNode);
              }
            }
          });
        });

        document.getElementById('btn-quit').addEventListener('click', () => {
          if (confirm('Quitter la conversation ?')) location.hash = '/themes';
        });
      }
    };

    renderNode();

  } catch (e) {
    console.error('[Conversation] ❌ Erreur:', e);
    main.innerHTML = `<p style="color:red; text-align:center;">Erreur : ${e.message}</p>`;
  }
}

  // ═══════════════════════════════════════════════════════════
// SYSTÈME D'ERREURS ÉLÉGANT
// ═══════════════════════════════════════════════════════════

function showError(main, error, options = {}) {
  const {
    title = 'Hadisoana (Erreur)',
    subtitle = 'Une erreur s\'est produite',
    icon = '⚠️',
    showBackButton = true,
    backRoute = '/themes',
    backLabel = '← Hiverina amin\'ny lohahevitra',
    retry = false
  } = options;

  // Déterminer le type d'erreur pour afficher un message adapté
  let errorMessage = error.message || 'Erreur inconnue';
  let userFriendlyMessage = '';

  if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
    userFriendlyMessage = 'Vérifiez votre connexion internet. Certaines données n\'ont pas pu être chargées.';
    icon = '📶';
  } else if (errorMessage.includes('introuvable') || errorMessage.includes('not found')) {
    userFriendlyMessage = 'Le contenu demandé n\'a pas pu être trouvé. Essayez un autre thème.';
    icon = '🔍';
  } else if (errorMessage.includes('permission') || errorMessage.includes('denied')) {
    userFriendlyMessage = 'L\'application n\'a pas les permissions nécessaires. Vérifiez les paramètres de votre navigateur.';
    icon = '🔒';
  } else if (errorMessage.includes('audio') || errorMessage.includes('speech')) {
    userFriendlyMessage = 'Le moteur vocal n\'est pas disponible sur cet appareil.';
    icon = '🔊';
  } else {
    userFriendlyMessage = 'Quelque chose ne s\'est pas passé comme prévu. Essayez de recharger la page.';
  }

  main.innerHTML = `
    <div style="
      max-width: 500px;
      margin: 0 auto;
      padding: 3rem 1.5rem;
      text-align: center;
      animation: fadeInUp 0.4s ease-out;
    ">
      <div style="font-size: 4rem; margin-bottom: 1.5rem; animation: float 3s ease-in-out infinite;">${icon}</div>

      <h2 style="
        color: var(--ds-color-danger);
        font-size: 1.5rem;
        margin-bottom: 0.5rem;
        font-weight: 700;
      ">${title}</h2>

      <p style="
        color: var(--ds-color-text-muted);
        font-size: 1rem;
        margin-bottom: 1.5rem;
      ">${subtitle}</p>

      <div style="
        background: var(--ds-color-danger-soft, #fee2e2);
        border-left: 4px solid var(--ds-color-danger);
        padding: 1rem 1.5rem;
        border-radius: var(--ds-radius-md);
        margin-bottom: 2rem;
        text-align: left;
      ">
        <p style="
          color: var(--ds-color-text);
          font-size: 0.95rem;
          margin: 0;
          line-height: 1.6;
        ">${userFriendlyMessage}</p>

        <details style="margin-top: 1rem; cursor: pointer;">
          <summary style="
            font-size: 0.85rem;
            color: var(--ds-color-text-muted);
            font-weight: 600;
          ">Détails techniques (Mombamomba)</summary>
          <code style="
            display: block;
            margin-top: 0.5rem;
            font-size: 0.8rem;
            color: var(--ds-color-text-muted);
            background: var(--ds-color-surface-2);
            padding: 0.75rem;
            border-radius: var(--ds-radius-sm);
            word-break: break-all;
            text-align: left;
          ">${errorMessage}</code>
        </details>
      </div>

      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        ${retry ? `
          <button onclick="location.reload()" style="
            background: var(--ds-color-primary);
            color: white;
            border: none;
            padding: 14px 24px;
            border-radius: var(--ds-radius-md);
            font-weight: 600;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.2s;
          ">🔄 Réessayer (Averina)</button>
        ` : ''}

        ${showBackButton ? `
          <button onclick="router.navigate('${backRoute}')" style="
            background: var(--ds-color-surface);
            color: var(--ds-color-text);
            border: 2px solid var(--ds-color-border);
            padding: 14px 24px;
            border-radius: var(--ds-radius-md);
            font-weight: 600;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.2s;
          ">${backLabel}</button>
        ` : ''}
      </div>
    </div>
  `;

  // Annonce pour les lecteurs d'écran
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'alert');
  announcement.setAttribute('aria-live', 'assertive');
  announcement.style.cssText = 'position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0;';
  announcement.textContent = `${title}. ${userFriendlyMessage}`;
  document.body.appendChild(announcement);

  setTimeout(() => announcement.remove(), 5000);

  // Log pour debug
  console.error(`[Erreur ${title}]`, error);
}

  // ═══════════════════════════════════════════════════════════
// VUE : DICTIONNAIRE INTELLIGENT FR↔MG
// ═══════════════════════════════════════════════════════════
async function renderDictionary() {
  updateNavActiveState();
  const dict = new DictionarySearch('app');
  await dict.init();
}


// ═══════════════════════════════════════════════════════════
// ROUTEUR & DÉMARRAGE (Onboarding temporairement désactivé)
// ═══════════════════════════════════════════════════════════
router.addRoute('/', renderHome);
router.addRoute('/themes', renderThemes);
router.addRoute('/theme-detail', renderThemeDetail);
router.addRoute('/lesson', renderLesson);
router.addRoute('/lesson-phrases', renderLessonPhrases);      // ✅ AJOUTER
router.addRoute('/practice', renderPractice);
router.addRoute('/practice-phrases', renderPracticePhrases);  // ✅ AJOUTER
router.addRoute('/dialogues', renderDialogues);
router.addRoute('/profile', renderProfile);
router.addRoute('/roleplay', renderRolePlay);
router.addRoute('/challenge', renderChallenge);
router.addRoute('/about', renderAbout);
router.addRoute('/alphabet', renderAlphabet);  // ✅ AJOUTER
router.addRoute('/conversation-live', renderConversationLive);
router.addRoute('/conversation', renderConversation);
router.addRoute('/dictionary', renderDictionary);
router.addRoute('/certification', renderCertification);

initTheme();
updateLevelUI();


// ═══════════════════════════════════════════════════════════
// ÉCOUTEURS GLOBAUX DU HEADER (fonctionnent sur toutes les pages)
// ═══════════════════════════════════════════════════════════
document.getElementById('header-logo')?.addEventListener('click', () => {
  router.navigate('/');
});

document.getElementById('btn-languages')?.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  showLanguageSelector();
});

document.getElementById('btn-about')?.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  router.navigate('/about');
});

document.getElementById('btn-settings')?.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  showSettingsModal();
});

// ═══════════════════════════════════════════════════════════
// MISE À JOUR DE L'ÉTAT ACTIF DE LA NAVIGATION
// ═══════════════════════════════════════════════════════════
function updateNavActiveState() {
  const currentHash = window.location.hash.slice(1) || '/';
  const navLinks = document.querySelectorAll('.ds-mobile-nav a[data-route]');

  navLinks.forEach(link => {
    const route = link.getAttribute('data-route');
    const isActive = currentHash === route ||
                     (route === '/themes' && currentHash.startsWith('/theme')) ||
                     (route === '/themes' && currentHash.startsWith('/lesson')) ||
                     (route === '/themes' && currentHash.startsWith('/practice')) ||
                     (route === '/themes' && currentHash.startsWith('/dialogues'));

    // Supprimer l'ancien indicateur
    const existingIndicator = link.querySelector('.nav-active-indicator');
    if (existingIndicator) existingIndicator.remove();

    if (isActive) {
      link.style.color = 'var(--ds-color-primary)';
      link.style.fontWeight = '700';
      link.querySelector('span').style.color = 'var(--ds-color-primary)';

      // Ajouter un petit point indicateur
      const indicator = document.createElement('div');
      indicator.className = 'nav-active-indicator';
      indicator.style.cssText = `
        position: absolute;
        bottom: -2px;
        left: 50%;
        transform: translateX(-50%);
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: var(--ds-color-primary);
      `;
      link.style.position = 'relative';
      link.appendChild(indicator);
    } else {
      link.style.color = 'var(--ds-color-text-muted)';
      link.style.fontWeight = '600';
      link.querySelector('span').style.color = 'var(--ds-color-text-muted)';
    }
  });
}

// Écouter les changements de hash
window.addEventListener('hashchange', updateNavActiveState);

// ═══════════════════════════════════════════════════════════
// MODAL DE RÉGLAGES
// ═══════════════════════════════════════════════════════════
function showSettingsModal() {
  // Fermer s'il existe déjà
  const existing = document.getElementById('settings-modal');
  if (existing) {
    existing.remove();
    return;
  }

  // Lire les préférences sauvegardées
  const settings = JSON.parse(localStorage.getItem('dagospeak:settings') || '{}');
  const autoSpeak = settings.autoSpeak !== false;
  const guidePulse = settings.guidePulse !== false;
  const sounds = settings.sounds !== false;
  const haptics = settings.haptics !== false;
  const fontSize = settings.fontSize || 'normal';

  // ✅ Helper pour générer un toggle
  const createToggle = (id, label, mgLabel, checked) => `
    <label style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: var(--ds-color-surface-2); border-radius: 12px; cursor: pointer; gap: 1rem;">
      <div style="flex: 1;">
        <div style="font-weight: 600;">${label}</div>
        <div style="font-size: 0.85rem; color: var(--ds-color-text-muted); font-style: italic;">${mgLabel}</div>
      </div>
      <div class="ds-toggle">
        <input type="checkbox" id="${id}" ${checked ? 'checked' : ''}>
        <span class="ds-toggle-slider"></span>
      </div>
    </label>
  `;

  const modal = document.createElement('div');
  modal.id = 'settings-modal';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.7); z-index: 10001;
    display: flex; align-items: center; justify-content: center;
    padding: 1rem; animation: fadeIn 0.3s ease-out;
  `;

  modal.innerHTML = `
    <div style="background: var(--ds-color-surface); padding: 2rem; border-radius: 16px; max-width: 500px; width: 100%; max-height: 85vh; overflow-y: auto; position: relative; animation: fadeInUp 0.3s ease-out;">
      <button id="close-settings-btn" aria-label="Fermer les réglages" style="position: absolute; top: 15px; right: 15px; background: none; border: none; font-size: 1.8rem; cursor: pointer; color: var(--ds-color-text-muted); line-height: 1; padding: 4px 8px;">×</button>

      <h2 style="color: var(--ds-color-primary); margin-bottom: 1.5rem; text-align: center;">⚙️ Réglages (Fandrindrana)</h2>

      <div style="display: flex; flex-direction: column; gap: 1rem;">
        ${createToggle('setting-autoSpeak', '🔊 Auto-parole Teacher Avatar', "Ny feon'ny mpampianatra (Voix automatique)", autoSpeak)}

        ${createToggle('setting-guidePulse', '💡 Guidage par allumage', 'Ny fitarihana (Pulse sur les boutons)', guidePulse)}

        ${createToggle('setting-sounds', '🎵 Sons de feedback', 'Ny feo (Succès/Erreur)', sounds)}

        ${createToggle('setting-haptics', '📳 Retour tactile au clic', 'Fibration au toucher (Android)', haptics)}

        <div style="padding: 1rem; background: var(--ds-color-surface-2); border-radius: 12px;">
          <div style="font-weight: 600; margin-bottom: 0.5rem;">🔤 Taille de police</div>
          <div style="font-size: 0.85rem; color: var(--ds-color-text-muted); font-style: italic; margin-bottom: 0.75rem;">Ny haben'ny soratra</div>
          <select id="setting-fontSize" style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid var(--ds-color-border); background: var(--ds-color-surface); color: var(--ds-color-text);">
            <option value="small" ${fontSize === 'small' ? 'selected' : ''}>Petite (Kely)</option>
            <option value="normal" ${fontSize === 'normal' ? 'selected' : ''}>Normale (Antonony)</option>
            <option value="large" ${fontSize === 'large' ? 'selected' : ''}>Grande (Lehibe)</option>
          </select>
        </div>
      </div>

      <button id="btn-save-settings" style="width: 100%; background: var(--ds-color-primary); color: white; border: none; padding: 14px; border-radius: 12px; font-weight: bold; font-size: 1rem; cursor: pointer; margin-top: 1.5rem; transition: transform 0.2s;">
        Enregistrer (Tehirizo)
      </button>
    </div>
  `;

  document.body.appendChild(modal);

  // ✅ NOUVEAU : Écouteurs attachés UNE SEULE FOIS après l'insertion
  const closeModal = () => {
    const el = document.getElementById('settings-modal');
    if (el) el.remove();
  };

  // Fermeture
  document.getElementById('close-settings-btn').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // ✅ NOUVEAU : Écouteur haptics avec debounce (évite le spam)
  let hapticsTimeout = null;
  const hapticsToggle = document.getElementById('setting-haptics');
  if (hapticsToggle) {
    hapticsToggle.addEventListener('change', (e) => {
      if (hapticsTimeout) clearTimeout(hapticsTimeout);
      hapticsTimeout = setTimeout(() => {
        if (window.haptics) {
          window.haptics.setEnabled(e.target.checked);
          // Feedback tactile immédiat si activé
          if (e.target.checked) {
            window.haptics.medium();
          }
        }
      }, 100); // Debounce 100ms
    });
  }

  // Bouton Enregistrer
  document.getElementById('btn-save-settings').addEventListener('click', () => {
    const newSettings = {
      autoSpeak: document.getElementById('setting-autoSpeak').checked,
      guidePulse: document.getElementById('setting-guidePulse').checked,
      sounds: document.getElementById('setting-sounds').checked,
      haptics: document.getElementById('setting-haptics')?.checked ?? true,
      fontSize: document.getElementById('setting-fontSize').value
    };

    localStorage.setItem('dagospeak:settings', JSON.stringify(newSettings));

    // Appliquer immédiatement
    if (window.teacherAvatar) {
      window.teacherAvatar.setAutoSpeak(newSettings.autoSpeak);
    }
    if (window.haptics) {
      window.haptics.setEnabled(newSettings.haptics);
    }

    // Appliquer la taille de police
    document.documentElement.style.fontSize =
      newSettings.fontSize === 'small' ? '14px' :
      newSettings.fontSize === 'large' ? '18px' : '16px';

    // Feedback visuel de sauvegarde
    const btn = document.getElementById('btn-save-settings');
    btn.textContent = '✅ Enregistré !';
    btn.style.background = 'var(--ds-color-success)';

    if (window.haptics) window.haptics.medium();

    setTimeout(() => closeModal(), 800);
  });
}



// ═══════════════════════════════════════════════════════════
// GESTION SÉCURISÉE DU DÉMARRAGE ET ONBOARDING (FINAL)
// ═══════════════════════════════════════════════════════════
function startAppAndShowHome() {
  console.log("[App] 🚀 Démarrage de l'application...");

  // Charger levels.json au démarrage
  if (!levelsConfig) {
    fetch('/content/fr/levels.json')
      .then(r => r.json())
      .then(data => {
        levelsConfig = data;
        console.log('[App] ✅ levels.json chargé au démarrage');
      })
      .catch(e => {
        console.warn('[App] ⚠️ Impossible de charger levels.json:', e);
        levelsConfig = {
          levels: {
            A0: { published: true, freeThemes: ['survival', 'family', 'market', 'numbers', 'colors'] }
          }
        };
      });
  }

  // ✅ CORRECTION : Toujours repartir sur l'accueil, sans condition
  window.location.hash = '/';

  // ✅ Laisser le routeur gérer le rendu (pas de renderHome() direct)
  router.start();

  setTimeout(() => {
    updateMobileNavActiveState();
  }, 100);
}

function updateMobileNavActiveState() {
  const currentHash = window.location.hash.slice(1) || '/';
  document.querySelectorAll('.ds-mobile-nav a').forEach(link => {
    link.classList.toggle('active', link.dataset.route === currentHash || (currentHash === '/' && link.dataset.route === '/'));
  });
}
window.addEventListener('hashchange', updateMobileNavActiveState);

document.addEventListener('click', (e) => {
  const homeLink = e.target.closest('a[href="#/"], a[href="#"]');
  if (homeLink) {
    e.preventDefault();
    e.stopPropagation();
    router.navigate('/');
  }
});

// Vérifier si l'utilisateur a déjà un profil enregistré
const userProfile = localStorage.getItem('dagospeak:userProfile');
const onboardingSeen = localStorage.getItem('dagospeak:onboardingComplete');

if (userProfile && onboardingSeen === 'true') {
  console.log('[App] ✅ Utilisateur reconnu, démarrage direct...');
  const parsedProfile = JSON.parse(userProfile);
  if (parsedProfile.isPremium) {
    localStorage.setItem('dagospeak:isPremium', 'true');
  }
  startAppAndShowHome();
} else {
  // ✅ DÉTECTION DU MODE : Si un profil existe mais que l'onboarding n'est pas vu, c'est une MAJ
  const isUpdate = !!userProfile;
  const onboardingMode = isUpdate ? 'update' : 'first-launch';
  console.log(`[App] 📍 Mode onboarding détecté : ${onboardingMode}`);

  // ✅ On passe le mode au constructeur pour avoir le bon onboarding (2 slides pour update)
  const onboarding = new OnboardingScreen(onboardingMode);
  onboarding.show(() => {
    console.log('[App] ✅ Onboarding terminé, démarrage...');
    startAppAndShowHome();
  });
}

// ═══════════════════════════════════════════════════════════
// GESTION DES MISES À JOUR PWA (VERSION PRODUCTION FINALE)
// ═══════════════════════════════════════════════════════════
if ('serviceWorker' in navigator) {
  // ✅ NOUVEAU : Écouter le changement de contrôleur pour recharger la page
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('[App] 🔄 Nouveau Service Worker actif, rechargement...');
    window.location.reload();
  });

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('[App] ✅ SW enregistré');

      // Vérifier si une mise à jour est DÉJÀ en attente au chargement de la page
      if (registration.waiting) {
        console.log('[App] ⏳ Mise à jour déjà en attente, affichage du bandeau...');
        showUpdateBannerInline(registration);
      }

      // Écouter les nouvelles mises à jour futures
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[App] ✨ Nouvelle version prête !');
            showUpdateBannerInline(registration);
          }
        });
      });
    } catch (error) {
      console.warn('[App] ⚠️ SW error:', error);
    }
  });
}
// ✅ Fonction unique et propre pour afficher le bandeau (évite la duplication)
function showUpdateBannerInline(registration) {
  if (document.getElementById('update-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'update-banner';
  banner.style.cssText = `
    position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%);
    background: #0A8A6E; color: white; padding: 14px 28px; border-radius: 50px;
    box-shadow: 0 8px 24px rgba(10, 138, 110, 0.5); z-index: 99999;
    font-size: 1rem; font-weight: 600; display: flex; align-items: center; gap: 14px;
    border: 2px solid #E8A33D; animation: slideUp 0.4s ease-out;
  `;
  banner.innerHTML = `
    <span>🚀 Fanavaozana misy ! (Mise à jour prête)</span>
    <button id="btn-update-now" style="
      background: white; color: #0A8A6E; border: none;
      padding: 8px 18px; border-radius: 20px; font-weight: 800;
      cursor: pointer; font-size: 0.9rem;
    ">Averina (Actualiser)</button>
  `;
  document.body.appendChild(banner);

      document.getElementById('btn-update-now').addEventListener('click', () => {
      console.log('[App] 🔄 Installation de la mise à jour...');
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      localStorage.removeItem('dagospeak:onboardingComplete');
      // ✅ NOUVEAU : Ne plus recharger immédiatement, attendre controllerchange
      // window.location.reload(); // COMMENTÉ ou SUPPRIMÉ
    });
  }