// ═══════════════════════════════════════════════════════════
// IMPORTS
// ═══════════════════════════════════════════════════════════
import './ui/components/ds-button.js';
import './core/device-check.js';  // ✅ Détection appareil modeste (doit charger tôt)
import './core/share-manager.js';  // ✅ Partage natif (app + certificat)
import './ui/components/ds-quiz.js';
import { sttManager } from './core/stt-manager.js';
// Exposer sttManager globalement pour RolePlayUI
window.sttManager = sttManager;
import { EventBus }            from './core/event-bus.js';
import { Container }           from './core/container.js';
import { Logger }              from './core/logger.js';
import { DagoDB }              from './storage/dago-db.js';
import { ContentLoader }       from './data/content-loader.js';
import { ConversationContext } from './core/conversation-context.js';  // ✅ V5: Mémoire de conversation
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

// Charger RolePlayView V2 globalement
import('./ui/views/roleplay-view.js').then(module => {
  window.rolePlayView = module.rolePlayView;
});

// ═══════════════════════════════════════════════════════════
// PWA INSTALL PROMPT — Capturer pour déclencher manuellement
// ═══════════════════════════════════════════════════════════
let deferredPrompt = null;

// ✅ Détecter si l'app est déjà installée
function isAppInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true;
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // Empêche le prompt automatique
  deferredPrompt = e;
  console.log('[PWA] ✅ beforeinstallprompt capturé');

  // Afficher le bouton d'installation si on est sur l'accueil
  const installBtn = document.getElementById('btn-install-app');
  if (installBtn) {
    installBtn.style.display = 'flex';
  }
});

// Masquer le bouton si l'app est déjà installée
window.addEventListener('appinstalled', () => {
  console.log('[PWA] ✅ Application installée');
  const installSection = document.getElementById('install-app-section');
  if (installSection) {
    // Remplacer le bouton par le badge
    installSection.innerHTML = `
      <div class="install-app-badge">
        <span class="install-app-icon">✓</span>
        <div class="install-app-content">
          <div class="install-app-title">Application installée</div>
          <div class="install-app-subtitle">DagoSpeak est sur votre appareil</div>
        </div>
      </div>
    `;
    installSection.classList.add('installed');
  }
});

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

// ✅ V5.13: Verrou d'instance pour Conversation Live (anti-recréation)
let conversationLiveInstanceId = 0;

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

    // ✅ Calcul du streak avec historique détaillé
    const lastActivity = localStorage.getItem('dagospeak:lastActivity');
    let streak = parseInt(localStorage.getItem('dagospeak:streak') || '0');
    let bestStreak = parseInt(localStorage.getItem('dagospeak:bestStreak') || '0');
    
    // Charger l'historique d'activités
    let activityHistory = {};
    try {
      const historyRaw = localStorage.getItem('dagospeak:activityHistory');
      if (historyRaw) activityHistory = JSON.parse(historyRaw);
    } catch (e) {
      console.warn('[Profile] Erreur lecture activityHistory:', e);
    }
    
    if (lastActivity) {
      const lastDate = new Date(lastActivity);
      const today = new Date();
      const diffDays = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
      if (diffDays > 1) {
        streak = 0;
        localStorage.setItem('dagospeak:streak', '0');
      }
    }
    
    // ✅ Calculer les 30 derniers jours
    const last30Days = [];
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(todayDate);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const count = activityHistory[dateStr] || 0;
      
      let intensity = 0;
      if (count >= 7) intensity = 4;
      else if (count >= 5) intensity = 3;
      else if (count >= 3) intensity = 2;
      else if (count >= 1) intensity = 1;
      
      last30Days.push({ date: dateStr, count, intensity });
    }
    
    // ✅ Activités de cette semaine
    const weekActivities = last30Days.slice(-7).reduce((sum, day) => sum + day.count, 0);
    
    // ✅ OBJECTIFS MENSUELS
    const monthlyGoal = 20; // Objectif : 20 jours d'apprentissage par mois
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    // Compter les jours actifs ce mois-ci
    let activeDaysThisMonth = 0;
    last30Days.forEach(day => {
      const dayDate = new Date(day.date);
      if (dayDate.getMonth() === currentMonth && dayDate.getFullYear() === currentYear && day.count > 0) {
        activeDaysThisMonth++;
      }
    });
    
    const monthlyProgress = Math.round((activeDaysThisMonth / monthlyGoal) * 100);
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysRemaining = daysInMonth - new Date().getDate();
    
    // ✅ STATISTIQUES PRÉDICTIVES
    const avgActivitiesPerDay = last30Days.reduce((sum, day) => sum + day.count, 0) / 30;
    const predictedMonthlyDays = Math.min(daysInMonth, Math.round(avgActivitiesPerDay * daysInMonth));
    
    // Comparaison semaine actuelle vs précédente
    const thisWeek = last30Days.slice(-7).reduce((sum, day) => sum + day.count, 0);
    const lastWeek = last30Days.slice(-14, -7).reduce((sum, day) => sum + day.count, 0);
    const weekComparison = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : 0;
    
    // ✅ RECOMMANDATIONS INTELLIGENTES
    let recommendation = '';
    
    // Vérifier si l'utilisateur n'a pas fait de conversation récemment
    let daysSinceConversation = 0;
    let daysSinceLive = 0;
    
    // Charger l'historique détaillé pour vérifier les types d'activités
    let detailedHistory = {};
    try {
      const detailedRaw = localStorage.getItem('dagospeak:detailedActivityHistory');
      if (detailedRaw) detailedHistory = JSON.parse(detailedRaw);
    } catch (e) {
      console.warn('[Profile] Erreur lecture detailedActivityHistory:', e);
    }
    
    // Compter les jours depuis la dernière conversation/dialogue
    for (let i = last30Days.length - 1; i >= 0; i--) {
      const day = last30Days[i];
      const dayDetailed = detailedHistory[day.date] || { activities: [] };
      
      // Vérifier s'il y a eu des dialogues ou conversations live
      const hasDialogue = dayDetailed.activities.some(act => 
        act.type === 'dialogues' || act.type === 'live-conversation'
      );
      
      const hasLive = dayDetailed.activities.some(act => act.type === 'live-conversation');
      
      if (hasDialogue) break;
      daysSinceConversation++;
    }
    
    // Compter les jours depuis la dernière conversation LIVE spécifiquement
    for (let i = last30Days.length - 1; i >= 0; i--) {
      const day = last30Days[i];
      const dayDetailed = detailedHistory[day.date] || { activities: [] };
      const hasLive = dayDetailed.activities.some(act => act.type === 'live-conversation');
      if (hasLive) break;
      daysSinceLive++;
    }
    
    // Compter le total de conversations live
    let totalLiveSessions = 0;
    Object.values(detailedHistory).forEach(day => {
      if (day.activities) {
        totalLiveSessions += day.activities.filter(act => act.type === 'live-conversation').length;
      }
    });
    
    if (daysSinceLive >= 2 && activeDaysThisMonth > 0) {
      recommendation = "Tsy nanao resaka mivantana (Live) ianao nandritra ny " + daysSinceLive + " andro lasa. Andramo ny Conversation Live amin'ny Teacher AI hanatsarana ny fiteninao !";
    } else if (daysSinceConversation >= 3 && activeDaysThisMonth > 0) {
      recommendation = "Tsy nanao resaka ianao nandritra ny " + daysSinceConversation + " andro lasa. Andramo ny dialogues !";
    } else if (thisWeek > lastWeek && weekComparison > 20) {
      recommendation = "Tsara be! Nitranga " + weekComparison + "% bebe kokoa ny herinandro ity noho ny teo aloha.";
    } else if (activeDaysThisMonth < monthlyGoal && daysRemaining <= 7) {
      recommendation = "Mila manao asa " + (monthlyGoal - activeDaysThisMonth) + " andro hafa ianao amin'ity volana ity. Maika !";
    } else if (activeDaysThisMonth >= monthlyGoal) {
      recommendation = "Arahaba! Nahatratra ny tanjonao ianao amin'ity volana ity!";
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
        bestStreak: bestStreak,
        weekActivities: weekActivities,
        last30Days: last30Days,
        monthlyGoal: monthlyGoal,
        activeDaysThisMonth: activeDaysThisMonth,
        monthlyProgress: monthlyProgress,
        daysRemaining: daysRemaining,
        avgActivitiesPerDay: avgActivitiesPerDay.toFixed(1),
        weekComparison: weekComparison,
        recommendation: recommendation,
        totalLiveSessions: totalLiveSessions,
        daysSinceLive: daysSinceLive,
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

// ✅ SYSTÈME DE CATÉGORISATION DES ACTIVITÉS
const ACTIVITY_TYPES = {
  // Activités actuelles (A0)
  'lesson-words': { name: 'Leçon de mots', icon: '📖', category: 'vocabulary', level: 'A0' },
  'practice-words': { name: 'Pratique de mots', icon: '🎯', category: 'vocabulary', level: 'A0' },
  'lesson-phrases': { name: 'Leçon de phrases', icon: '📝', category: 'grammar', level: 'A0' },
  'practice-phrases': { name: 'Pratique de phrases', icon: '🎯', category: 'grammar', level: 'A0' },
  'dialogues': { name: 'Dialogue', icon: '💬', category: 'conversation', level: 'A0' },
  
  // Activités futures
  'challenge': { name: 'Défi', icon: '🏆', category: 'challenge', level: 'A0' },
  'live-conversation': { name: 'Conversation Live', icon: '🎙️', category: 'conversation', level: 'A0' },
  
  // Examens de niveau
  'pre-test': { name: 'Pre-test', icon: '📝', category: 'exam', level: 'all' },
  'final-test': { name: 'Test final', icon: '🎯', category: 'exam', level: 'all' },
  
  // Niveaux futurs
  'level-a1': { name: 'Niveau A1', icon: '📚', category: 'level', level: 'A1' },
  'level-a2': { name: 'Niveau A2', icon: '📚', category: 'level', level: 'A2' },
  'level-b1': { name: 'Niveau B1', icon: '📚', category: 'level', level: 'B1' },
  'level-b2': { name: 'Niveau B2', icon: '📚', category: 'level', level: 'B2' }

  
  // ✅ NOTE : Pour ajouter une nouvelle activité (ex: Conversation Live, niveaux futurs)
  // 1. Ajouter le type dans ACTIVITY_TYPES ci-dessus
  // 2. Appeler recordActivity('type-activite', theme, details) quand l'activité est complétée
  // 3. Le calendrier se mettra à jour automatiquement
  
  // Exemple pour Conversation Live (future) :
  // recordActivity('live-conversation', theme, { duration: 300, score: 85 });
  
  // Exemple pour Test final (future) :
  // recordActivity('final-test', level, { score: 78, passed: true });
};

// Fonction pour enregistrer une activité spécifique
function recordActivity(activityType, theme = null, details = {}) {
  const todayStr = new Date().toISOString().split('T')[0];
  
  let detailedHistory = {};
  try {
    const historyRaw = localStorage.getItem('dagospeak:detailedActivityHistory');
    if (historyRaw) detailedHistory = JSON.parse(historyRaw);
  } catch (e) {
    console.warn('[Activity] Erreur lecture detailedActivityHistory:', e);
  }
  
  // Initialiser la journée si nécessaire
  if (!detailedHistory[todayStr]) {
    detailedHistory[todayStr] = { total: 0, activities: [] };
  }
  
  // Ajouter l'activité
  detailedHistory[todayStr].activities.push({
    type: activityType,
    theme: theme,
    timestamp: new Date().toISOString(),
    ...details
  });
  
  detailedHistory[todayStr].total = detailedHistory[todayStr].activities.length;
  
  // Sauvegarder
  localStorage.setItem('dagospeak:detailedActivityHistory', JSON.stringify(detailedHistory));
  
  // Mettre à jour aussi l'historique simple pour le calendrier
  let simpleHistory = {};
  try {
    const simpleRaw = localStorage.getItem('dagospeak:activityHistory');
    if (simpleRaw) simpleHistory = JSON.parse(simpleRaw);
  } catch (e) {
    console.warn('[Activity] Erreur lecture activityHistory:', e);
  }
  
  simpleHistory[todayStr] = detailedHistory[todayStr].total;
  localStorage.setItem('dagospeak:activityHistory', JSON.stringify(simpleHistory));
  
  console.log(`[Activity] ✅ ${activityType} enregistré pour le thème ${theme}`);
}

function saveProfile() {
  const profile = getProfileData();
  localStorage.setItem('dagospeak:profile', JSON.stringify(profile));
  localStorage.setItem('dagospeak:lastActivity', new Date().toISOString());

    // ✅ Enregistrer l'activité dans l'historique
    const todayStr = new Date().toISOString().split('T')[0];
    let activityHistory = {};
    try {
      const historyRaw = localStorage.getItem('dagospeak:activityHistory');
      if (historyRaw) activityHistory = JSON.parse(historyRaw);
    } catch (e) {
      console.warn('[Profile] Erreur lecture activityHistory:', e);
    }
    
    // Incrémenter le compteur pour aujourd'hui
    activityHistory[todayStr] = (activityHistory[todayStr] || 0) + 1;
    localStorage.setItem('dagospeak:activityHistory', JSON.stringify(activityHistory));

  // Incrémenter le streak si pas déjà fait aujourd'hui
  const lastActivity = localStorage.getItem('dagospeak:lastActivity');
  const today = new Date().toDateString();
  if (lastActivity && new Date(lastActivity).toDateString() !== today) {
    const streak = parseInt(localStorage.getItem('dagospeak:streak') || '0');
    localStorage.setItem('dagospeak:streak', String(streak + 1));
      
      // Mettre à jour le meilleur streak
      const bestStreak = parseInt(localStorage.getItem('dagospeak:bestStreak') || '0');
      const newStreak = streak + 1;
      if (newStreak > bestStreak) {
        localStorage.setItem('dagospeak:bestStreak', String(newStreak));
      }
  } else if (!lastActivity) {
    localStorage.setItem('dagospeak:streak', '1');
      localStorage.setItem('dagospeak:bestStreak', '1');
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

    // ═══════════════════════════════════════════════════════════
// ÉCRAN D'INTRODUCTION (OVERLAY)
// ═══════════════════════════════════════════════════════════

function showIntroOverlay(activityType, title, subtitle, stats, onStart) {
  const introKey = `intro_${activityType}_${currentTheme || 'global'}`;
  
  // Vérifier si déjà montré dans cette session
  if (sessionStorage.getItem(introKey) === 'shown') {
    return false;
  }
  
  const main = document.getElementById('app');
  
  // Créer l'overlay
  const overlay = document.createElement('div');
  overlay.id = 'intro-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.3s ease-out;
  `;
  
  // Contenu de l'overlay
  overlay.innerHTML = `
    <div style="
      background: var(--ds-color-surface);
      max-width: 500px;
      width: 90%;
      border-radius: var(--ds-radius-lg);
      padding: 2rem;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      animation: successPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
    ">
      <div style="font-size: 4rem; margin-bottom: 1rem;">
        ${activityType === 'lesson' ? '📚' : activityType === 'practice' ? '🎯' : '💬'}
      </div>
      
      <h2 style="margin: 0 0 0.5rem 0; color: var(--ds-color-text); font-size: 1.5rem;">
        ${title}
      </h2>
      
      <p style="color: var(--ds-color-text-muted); margin: 0 0 1.5rem 0; font-size: 0.95rem;">
        ${subtitle}
      </p>
      
      ${stats ? `
      <div style="
        background: var(--ds-color-surface-2);
        padding: 1rem;
        border-radius: var(--ds-radius-md);
        margin-bottom: 1.5rem;
        border: 1px solid var(--ds-color-border);
      ">
        <div style="display: flex; justify-content: space-around; gap: 1rem;">
          ${stats.map(stat => `
            <div style="text-align: center;">
              <div style="font-size: 1.5rem; margin-bottom: 0.25rem;">${stat.icon}</div>
              <div style="font-weight: 700; font-size: 1.25rem; color: var(--ds-color-primary);">
                ${stat.value}
              </div>
              <div style="font-size: 0.75rem; color: var(--ds-color-text-muted); text-transform: uppercase;">
                ${stat.label}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}
      
      <ds-button id="btn-start-overlay" variant="primary" size="lg" style="width: 100%;" class="guide-active">
        🚀 Commencer
      </ds-button>
    </div>
  `;
  
  // Ajouter au DOM
  main.appendChild(overlay);
  
  // Écouteur du bouton
  document.getElementById('btn-start-overlay').addEventListener('click', () => {
    // Marquer comme montré
    sessionStorage.setItem(introKey, 'shown');
    
    // Animation de sortie
    overlay.style.animation = 'fadeIn 0.3s ease-out reverse';
    setTimeout(() => {
      overlay.remove();
      if (onStart) onStart();
    }, 300);
  });
  
  return true;
}

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
window.router = router;  // ✅ Exposer router globalement pour les vues

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
  }, 1500);

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



// ✅ Helper : Détecter si on est en mode hors-ligne (PWA offline)
function isOfflineMode() {
  return !navigator.onLine || (window.matchMedia && window.matchMedia('(offline)').matches);
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

      <!-- ✅ CALENDRIER DE STREAK -->
      <div style="background:var(--ds-color-surface); padding:1.5rem; border-radius:var(--ds-radius-lg); margin:2rem 0; border:1px solid var(--ds-color-border);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
          <h3 style="margin:0; color:var(--ds-color-text); font-size:1.2rem;">📅 Calendrier d'apprentissage</h3>
          <button id="btn-calendar-help" style="background:var(--ds-color-primary-soft); border:none; width:28px; height:28px; border-radius:50%; cursor:pointer; font-size:1rem; display:flex; align-items:center; justify-content:center;" title="Aide">❓</button>
        </div>
        
        <!-- Statistiques -->
        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:1rem; margin-bottom:1.5rem;">
          <div style="text-align:center;">
            <div style="font-size:2rem; font-weight:700; color:var(--ds-color-primary);">🔥 ${profileData.streak}</div>
            <div style="font-size:0.85rem; color:var(--ds-color-text-muted);">Jours consécutifs</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:2rem; font-weight:700; color:var(--ds-color-success);">🏆 ${profileData.bestStreak}</div>
            <div style="font-size:0.85rem; color:var(--ds-color-text-muted);">Meilleur streak</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:2rem; font-weight:700; color:var(--ds-color-accent);">⚡ ${profileData.weekActivities}</div>
            <div style="font-size:0.85rem; color:var(--ds-color-text-muted);">Cette semaine</div>
          </div>

        <!-- ✅ OBJECTIFS MENSUELS -->
        <div style="margin-top:1.5rem; padding:1rem; background:var(--ds-color-surface-2); border-radius:var(--ds-radius-md);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
            <span style="font-weight:600; color:var(--ds-color-text);">🎯 Objectif du mois</span>
            <span style="font-weight:700; color:var(--ds-color-primary);">${profileData.monthlyGoal} jours</span>
          </div>
          <div style="background:var(--ds-color-border); border-radius:10px; height:12px; overflow:hidden; margin-bottom:0.5rem;">
            <div style="height:100%; background:linear-gradient(90deg, var(--ds-color-primary), var(--ds-color-success)); width:${profileData.monthlyProgress}%; border-radius:10px; transition:width 0.5s ease;"></div>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:var(--ds-color-text-muted);">
            <span>${profileData.monthlyProgress}% complété</span>
            <span>${profileData.daysRemaining} jours restants</span>
          </div>
          ${profileData.monthlyGoal - profileData.activeDaysThisMonth <= 5 && profileData.activeDaysThisMonth < profileData.monthlyGoal ? `
          <div style="margin-top:0.75rem; padding:0.5rem; background:var(--ds-color-warning-soft); border-radius:var(--ds-radius-sm); text-align:center;">
            <p style="margin:0; font-size:0.9rem; color:var(--ds-color-warning); font-weight:600;">💪 Encore ${profileData.monthlyGoal - profileData.activeDaysThisMonth} jours pour ton badge mensuel !</p>
          </div>
          ` : ''}
        </div>
        </div>
        
        <!-- Grille du calendrier -->
        <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:4px; margin-bottom:1rem;">
          ${profileData.last30Days.map((day, idx) => {
            const date = new Date(day.date);
            const dayNames = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
            const dayName = dayNames[date.getDay()];
            const intensityColors = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];
            const bgColor = intensityColors[day.intensity];
            const isToday = day.date === new Date().toISOString().split('T')[0];
            const border = isToday ? '2px solid var(--ds-color-primary)' : '1px solid transparent';
            return `<div style="aspect-ratio:1; background:${bgColor}; border-radius:3px; border:${border}; display:flex; align-items:center; justify-content:center; font-size:0.65rem; color:${day.intensity > 0 ? 'white' : 'var(--ds-color-text-muted)'};" title="${day.date}: ${day.count} activités">${day.count > 0 ? day.count : ''}</div>`;
          }).join('')}
        </div>
        
        <!-- Légende -->
        <div style="display:flex; align-items:center; justify-content:center; gap:8px; font-size:0.75rem; color:var(--ds-color-text-muted);">
          <span>Moins</span>
          <div style="width:12px; height:12px; background:#ebedf0; border-radius:2px;"></div>
          <div style="width:12px; height:12px; background:#9be9a8; border-radius:2px;"></div>
          <div style="width:12px; height:12px; background:#40c463; border-radius:2px;"></div>
          <div style="width:12px; height:12px; background:#30a14e; border-radius:2px;"></div>
          <div style="width:12px; height:12px; background:#216e39; border-radius:2px;"></div>
          <span>Plus</span>
        </div>

        <!-- ✅ RECOMMANDATIONS INTELLIGENTES -->
        ${profileData.recommendation ? `
        <div style="margin-top:1.5rem; padding:1rem; background:var(--ds-color-accent-soft); border-radius:var(--ds-radius-md); border-left:4px solid var(--ds-color-accent);">
          <p style="margin:0; font-weight:600; color:var(--ds-color-accent); display:flex; align-items:center; gap:8px;">
            💡 Recommandation :
          </p>
          <p style="margin:0.5rem 0 0 0; font-size:0.9rem; color:var(--ds-color-text);">
            ${profileData.recommendation}
          </p>
        </div>
        ` : ''}
        
        <!-- Message de motivation -->
        ${profileData.streak > 0 ? `
        <div style="margin-top:1rem; padding:0.75rem; background:var(--ds-color-primary-soft); border-radius:var(--ds-radius-md); text-align:center;">
          <p style="margin:0; color:var(--ds-color-primary); font-weight:600;">
            ${profileData.streak >= 7 ? '🔥 Incroyable ! Tu es en feu !' : profileData.streak >= 3 ? '💪 Continue comme ça !' : '🌱 Bon début, ne lâche rien !'}
          </p>
          <p style="margin:0.25rem 0 0 0; font-size:0.85rem; color:var(--ds-color-text-muted);">
            Ne brise pas ta série de ${profileData.streak} jour${profileData.streak > 1 ? 's' : ''} !
          </p>
        </div>
        ` : ''}
      </div>
    `;

    // ✅ 4. 

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

        // ✅ BOUTON INSTALLATION FLOTTANT (injecté séparément)
    const isInstalled = typeof isAppInstalled === 'function' && isAppInstalled();
    const displayStyle = deferredPrompt ? 'flex' : 'none';

    const existingInstall = document.getElementById('install-app-floating');
    if (existingInstall) existingInstall.remove();

    const installFloating = document.createElement('div');
    installFloating.id = 'install-app-floating';
    installFloating.className = 'install-app-floating';
      installFloating.style.display = 'flex';

      installFloating.innerHTML = `
        <div class="floating-controls">
          <!-- Toggle Micro -->
          <label class="toggle-switch" title="Activer/Désactiver le micro">
            <input type="checkbox" id="toggle-micro" checked>
            <span class="toggle-slider"></span>
            <span class="toggle-icon">🎤</span>
          </label>

          <!-- Toggle Web Speech API -->
          <label class="toggle-switch" title="Activer/Désactiver Web Speech API">
            <input type="checkbox" id="toggle-web-speech" checked>
            <span class="toggle-slider"></span>
            <span class="toggle-icon">🗣️</span>
          </label>

          <!-- ✅ Cette partie seule dépend de l'état d'installation -->
          ${isInstalled ? `
            <div class="install-app-badge-fixed">
              <span class="install-app-icon-fixed">✓</span>
              <span class="install-app-text-fixed">Application installée</span>
            </div>
          ` : deferredPrompt ? `
            <button id="btn-install-app" class="install-app-btn-fixed" aria-label="Installer DagoSpeak sur votre appareil">
              <span class="install-app-icon-fixed">📲</span>
              <span class="install-app-text-fixed">Installer</span>
              <span class="install-app-arrow-fixed">→</span>
            </button>
          ` : ''}
        </div>
      `;

      document.body.appendChild(installFloating);

      // ✅ Logique des toggles (Micro & Web Speech API)
      const toggleMicro = document.getElementById('toggle-micro');
      const toggleWebSpeech = document.getElementById('toggle-web-speech');

      // Restaurer l'état depuis localStorage
      if (toggleMicro) {
        toggleMicro.checked = localStorage.getItem('toggleMicro') !== 'false';
      }
      if (toggleWebSpeech) {
        toggleWebSpeech.checked = localStorage.getItem('toggleWebSpeech') !== 'false';
      }

      
        // Fonction pour mettre à jour sttAvailable
        // Fonction pour mettre à jour sttAvailable
                // Fonction pour mettre à jour sttAvailable
        function updateSTTAvailability(trigger) {
          const microEnabled = toggleMicro ? toggleMicro.checked : true;
          const webSpeechEnabled = toggleWebSpeech ? toggleWebSpeech.checked : true;

          // Sauvegarder dans localStorage
          localStorage.setItem('toggleMicro', microEnabled);
          localStorage.setItem('toggleWebSpeech', webSpeechEnabled);
          
          // ✅ FIX : Écrire aussi dans dagospeak:settings (clé lue par STTManager)
          const settings = JSON.parse(localStorage.getItem('dagospeak:settings') || '{}');
          settings.sttEnabled = webSpeechEnabled;
          localStorage.setItem('dagospeak:settings', JSON.stringify(settings));
          console.log('[STT] 💾 Settings synchronisées:', settings);

          // Mettre à jour sttAvailable globalement
          if (!microEnabled) {
            window.sttAvailable = false;
            console.log('[STT] Micro désactivé par l\'utilisateur');
          } else if (!webSpeechEnabled) {
            // Force la simulation pédagogique
            window.sttAvailable = true;
            window.sttManager = window.sttManager || {};
            // ✅ FIX : Appeler refreshSettings() au lieu du monkey-patch
            if (window.sttManager && window.sttManager.refreshSettings) {
              window.sttManager.refreshSettings();
            }
            console.log('[STT] Mode simulation pédagogique activé');
            
            // ✅ Notification pédagogique UNIQUEMENT si c'est le toggle Web Speech
            if (trigger === 'web-speech') {
              showSTTNotification('offline');
            }
          } else {
            // Comportement normal
            window.sttAvailable = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
            console.log('[STT] Web Speech API:', window.sttAvailable ? 'disponible' : 'indisponible');
            
            // ✅ Notification mode en ligne UNIQUEMENT si c'est le toggle Web Speech
            if (trigger === 'web-speech') {
              showSTTNotification('online');
            }
          }
        }

              // Écouter les changements
        if (toggleMicro) {
          toggleMicro.addEventListener('change', () => updateSTTAvailability('micro'));
        }
        if (toggleWebSpeech) {
          toggleWebSpeech.addEventListener('change', () => updateSTTAvailability('web-speech'));
        }

      // Appliquer l'état initial
      updateSTTAvailability();


                // ✅ Fonction pour afficher les notifications STT
        function showSTTNotification(mode) {
          const existing = document.getElementById('stt-notification');
          if (existing) existing.remove();

          const notification = document.createElement('div');
          notification.id = 'stt-notification';
          
          const message = mode === 'online' 
            ? '🎤 Reconnaissance vocale activée ! Nécessite une connexion Internet pour de meilleures performances.'
            : '📶 Mode hors-ligne activé ! Simulation pédagogique pour pratiquer sans Internet.';
          
          const bgColor = mode === 'online' 
            ? 'var(--ds-color-primary, #0A8A6E)' 
            : 'var(--ds-color-accent, #E8A33D)';

          notification.style.cssText = `
            position: fixed;
            top: 90px;
            left: 50%;
            transform: translateX(-50%);
            background: ${bgColor};
            color: white;
            padding: 12px 20px;
            border-radius: 12px;
            font-size: 0.85rem;
            font-weight: 600;
            z-index: 9999;
            box-shadow: 0 4px 16px rgba(0,0,0,0.2);
            display: flex;
            align-items: center;
            gap: 12px;
            max-width: 90%;
            animation: slideDown 0.3s ease-out;
          `;

          notification.innerHTML = `
            <span style="flex: 1;">${message}</span>
            <button style="
              background: rgba(255,255,255,0.2);
              border: none;
              color: white;
              width: 28px;
              height: 28px;
              border-radius: 50%;
              cursor: pointer;
              font-size: 1.2rem;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
            " aria-label="Fermer">×</button>
          `;

          document.body.appendChild(notification);

          // Fermer au clic
          notification.querySelector('button').addEventListener('click', () => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.3s';
            setTimeout(() => notification.remove(), 300);
          });

          // Auto-fermeture après 6 secondes
          setTimeout(() => {
            if (notification.parentNode) {
              notification.style.opacity = '0';
              notification.style.transition = 'opacity 0.5s';
              setTimeout(() => notification.remove(), 500);
            }
          }, 6000);
        }




    // Event listener (éviter les doublons)
      const installBtn = document.getElementById('btn-install-app');
      if (installBtn) {
        // Retirer l'ancien listener s'il existe
        if (installBtn._installListener) {
          installBtn.removeEventListener('click', installBtn._installListener);
        }

        // Créer le nouveau listener
        installBtn._installListener = async (e) => {
          e.preventDefault();

          if (!deferredPrompt) {
            console.warn('[PWA] ⚠️ Installation non disponible');
            return;
          }

          const btn = document.getElementById('btn-install-app');
          if (!btn) return;

          btn.innerHTML = '<span class="install-app-icon-fixed">⏳</span><span class="install-app-text-fixed">Installation...</span>';

          try {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;

            if (outcome === 'accepted') {
              installFloating.innerHTML = `
                <div class="install-app-badge-fixed">
                  <span class="install-app-icon-fixed">✓</span>
                  <span class="install-app-text-fixed">Application installée</span>
                </div>
              `;
            } else {
              btn.innerHTML = '<span class="install-app-icon-fixed">📲</span><span class="install-app-text-fixed">Installer DagoSpeak</span><span class="install-app-arrow-fixed">→</span>';
            }
          } catch (err) {
            console.warn('[PWA] Erreur prompt:', err);
            btn.innerHTML = '<span class="install-app-icon-fixed">📲</span><span class="install-app-text-fixed">Installer DagoSpeak</span><span class="install-app-arrow-fixed">→</span>';
          }

          deferredPrompt = null;
        };

        installBtn.addEventListener('click', installBtn._installListener);
      }

    // ✅ 8. ÉCOUTEURS D'ÉVÉNEMENTS
    // Bouton "Reprendre l'apprentissage"
    document.getElementById('btn-resume-learning')?.addEventListener('click', () => {
      const lastTheme = localStorage.getItem('dagospeak:theme') || 'survival';
      currentTheme = lastTheme;
      router.navigate('/theme-detail');
    });

    /// ✅ Bouton Installer l'app (position fixe)
        document.getElementById('btn-install-app')?.addEventListener('click', async () => {
          if (!deferredPrompt) {
            console.warn('[PWA] ⚠️ Installation non disponible');
            return;
          }

          const btn = document.getElementById('btn-install-app');
          btn.innerHTML = '<span class="install-app-icon-fixed">⏳</span><span class="install-app-text-fixed">Installation...</span>';

          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;

          if (outcome === 'accepted') {
            console.log('[PWA] ✅ Utilisateur a accepté l\'installation');
            // Remplacer par le badge installé
            const installFloating = document.getElementById('install-app-floating');
            if (installFloating) {
              installFloating.innerHTML = `
                <div class="install-app-badge-fixed">
                  <span class="install-app-icon-fixed">✓</span>
                  <span class="install-app-text-fixed">Application installée</span>
                </div>
              `;
              installFloating.classList.add('installed');
            }
          } else {
            console.log('[PWA] ❌ Utilisateur a refusé l\'installation');
            btn.innerHTML = '<span class="install-app-icon-fixed">📲</span><span class="install-app-text-fixed">Installer DagoSpeak</span><span class="install-app-arrow-fixed">→</span>';
          }

          deferredPrompt = null;
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

    // ✅ MODAL D'AIDE EN MALGACHE
    const helpModalHtml = `
      <div id="calendar-help-modal" style="display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:10000; align-items:center; justify-content:center;">
        <div style="background:var(--ds-color-surface); padding:2rem; border-radius:var(--ds-radius-lg); max-width:500px; max-height:80vh; overflow-y:auto; box-shadow:0 10px 40px rgba(0,0,0,0.2);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
            <h3 style="margin:0; color:var(--ds-color-text); font-size:1.3rem;">📅 Ahoana ny fiasan'ny kalandrie ?</h3>
            <button id="btn-close-help" style="background:none; border:none; font-size:1.5rem; cursor:pointer; color:var(--ds-color-text-muted);">✕</button>
          </div>
          
          <div>
            <div style="margin-bottom:1rem;">
              <h4 style="margin:0 0 0.5rem 0; color:var(--ds-color-primary);">✅ Fanangonana ny asa</h4>
              <p style="margin:0; font-size:0.9rem; color:var(--ds-color-text);">Isaky ny mianatra ianao (leçons, pratiques, dialogues), dia voarakitra avy hatrany ny asanao.</p>
            </div>
            
            <div style="margin-bottom:1rem;">
              <h4 style="margin:0 0 0.5rem 0; color:var(--ds-color-success);">🟢 Famantarana ny loko</h4>
              <p style="margin:0; font-size:0.9rem; color:var(--ds-color-text);">
                ⚪ Fotsy = Tsy nianatra<br>
                🟢 Maitso maivana = 1-2 asa<br>
                🟢 Maitso = 3-4 asa<br>
                🟢 Maitso matroka = 5-6 asa<br>
                🟢 Maitso matroka be = 7+ asa
              </p>
            </div>
            
            <div style="margin-bottom:1rem;">
              <h4 style="margin:0 0 0.5rem 0; color:var(--ds-color-warning);">🔥 Streak</h4>
              <p style="margin:0; font-size:0.9rem; color:var(--ds-color-text);">Ny streak dia ny isa n'andro mifanesy nianaranao. Mianara isan'andro mba hitazona azy !</p>
            </div>
            
            <div style="margin-bottom:1rem;">
              <h4 style="margin:0 0 0.5rem 0; color:var(--ds-color-accent);">🎯 Tanjona</h4>
              <p style="margin:0; font-size:0.9rem; color:var(--ds-color-text);">Ny tanjona dia ny hahatratra ny isan'andro voafaritra isam-bolana mba hahazoana badge manokana.</p>
            </div>
            
            <div>
              <h4 style="margin:0 0 0.5rem 0; color:var(--ds-color-primary);">💡 Torohevitra</h4>
              <p style="margin:0; font-size:0.9rem; color:var(--ds-color-text);">
                • Mianara isan'andro na dia fohy aza<br>
                • Ampiasao ny fotoana malalaka<br>
                • Araho ny toromarika eo amin'ny kalandrie
              </p>
            </div>
          </div>
          
          <button id="btn-close-help-footer" style="width:100%; margin-top:1.5rem; padding:0.75rem; background:var(--ds-color-primary); color:white; border:none; border-radius:var(--ds-radius-md); font-weight:600; cursor:pointer;">
            Azo !
          </button>
        </div>
      </div>
    `;
    
    // Ajouter le modal au DOM
    const helpModalContainer = document.createElement('div');
    helpModalContainer.innerHTML = helpModalHtml;
    document.body.appendChild(helpModalContainer.firstElementChild);
    
    // Gestionnaires d'événements
    document.getElementById('btn-calendar-help')?.addEventListener('click', () => {
      document.getElementById('calendar-help-modal').style.display = 'flex';
    });
    
    document.getElementById('btn-close-help')?.addEventListener('click', () => {
      document.getElementById('calendar-help-modal').style.display = 'none';
    });
    
    document.getElementById('btn-close-help-footer')?.addEventListener('click', () => {
      document.getElementById('calendar-help-modal').style.display = 'none';
    });

    // ✅ Nettoyer le bouton d'installation quand on quitte l'accueil
      window.addEventListener('hashchange', () => {
        const installFloating = document.getElementById('install-app-floating');
        if (installFloating && window.location.hash !== '#/' && window.location.hash !== '#') {
          installFloating.style.display = 'none';
        } else if (installFloating && (window.location.hash === '#/' || window.location.hash === '#')) {
          installFloating.style.display = isInstalled ? 'flex' : (deferredPrompt ? 'flex' : 'none');
        }
      }, { once: false });

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



// ═══════════════════════════════════════════════════════════
// VUE : LEÇON - Apprentissage du vocabulaire
// ═══════════════════════════════════════════════════════════
async function renderLesson() {
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

    if (!levelData) {
      throw new Error(`Niveau ${currentLevel} introuvable dans le manifest`);
    }

    const unitId = currentTheme || levelData.units[0];
    currentTheme = unitId;

    console.log(`[renderLesson] Chargement vocabulaire pour: ${unitId}`);
   // ✅ NOUVEAU : Utiliser le helper de fusion vocabulary + dictionary
    const vocabData = await content.loadLessonData('fr', unitId);

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
        // ✅ Afficher l'écran d'introduction (une fois par session)
    showIntroOverlay('lesson', themeName, 'Apprenez le vocabulaire essentiel', [
      { icon: '📝', value: vocabData.items.length, label: 'Mots' },
      { icon: '⏱️', value: Math.ceil((vocabData.items.length * 20) / 60) + ' min', label: 'Durée' }
    ]);

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
  
    // ✅ Enregistrer l'activité
    recordActivity('lesson-words', currentTheme);
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
    // ✅ NOUVEAU : Utiliser le helper de fusion vocabulary + dictionary
    const vocabData = await content.loadLessonData('fr', unitId);

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

    // ✅ Enregistrer l'activité
    recordActivity('lesson-phrases', currentTheme);
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
    
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    // ═══════════════════════════════════════════════════════
    // STRATÉGIE MOBILE : UNE SEULE utterance (évite mots sautés)
    // ═══════════════════════════════════════════════════════
    if (isMobile) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'fr-FR';
      utterance.rate = options.rate || 0.85;
      utterance.pitch = options.pitch || 1.0;
      
      // Sélection de la voix
      const voices = speechSynthesis.getVoices();
      const frenchVoice = voices.find(v =>
        v.lang.startsWith('fr') &&
        (options.gender === 'male' ?
          v.name.toLowerCase().includes('male') || v.name.includes('Thomas') :
          v.name.toLowerCase().includes('female') || v.name.includes('Amélie') || v.name.includes('Marie'))
      ) || voices.find(v => v.lang.startsWith('fr'));
      
      if (frenchVoice) utterance.voice = frenchVoice;
      
      console.log(`[TTS] 📱 Mobile: 1 utterance complète (${text.length} caractères)`);
      console.log(`[TTS] 🎙️ gender=${options.gender || 'female'}, voice=${frenchVoice?.name || 'default'}`);
      
      if (options.onStart) options.onStart();
      
      utterance.onend = () => {
        console.log('[TTS] ✅ Utterance mobile terminée');
        if (options.onEnd) options.onEnd();
      };
      
      utterance.onerror = (error) => {
        console.warn('[TTS] ⚠️ Erreur utterance mobile:', error);
        if (options.onEnd) options.onEnd();
      };
      
      // ✅ Délai de 300ms + resume() avant speak() (évite mots coupés au début)
      setTimeout(() => {
        try {
          if ('speechSynthesis' in window) {
            speechSynthesis.resume(); // Débloquer le moteur TTS mobile
          }
          speechSynthesis.speak(utterance);
        } catch (error) {
          console.warn('[TTS] ⚠️ Erreur speak() mobile:', error);
          if (options.onEnd) options.onEnd();
        }
      }, 300);
      return;
    }
    
    // ═══════════════════════════════════════════════════════
    // STRATÉGIE PC : Découpage séquentiel (comportement actuel)
    // ═══════════════════════════════════════════════════════
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    console.log(`[TTS] 📝 Texte découpé en ${sentences.length} phrase(s)`);
    
    let currentSentenceIndex = 0;
    
    const speakNextSentence = () => {
      if (currentSentenceIndex >= sentences.length) {
        console.log('[TTS] ✅ Toutes les phrases terminées');
        if (options.onEnd) options.onEnd();
        return;
      }
    
      const sentence = sentences[currentSentenceIndex].trim();
      console.log(`[TTS] 🎙️ Phrase ${currentSentenceIndex + 1}/${sentences.length}: ${sentence}`);
      console.log(`[TTS] 📏 Longueur: ${sentence.length} caractères`);
    
      const utterance = new SpeechSynthesisUtterance(sentence);
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
    
      if (currentSentenceIndex === 0 && options.onStart) {
        console.log(`[TTS] 🎙️ gender=${options.gender || 'female'}, voice=${frenchVoice?.name || 'default'}`);
        options.onStart();
      }
    
      utterance.onend = () => {
        console.log(`[TTS] ✅ Phrase ${currentSentenceIndex + 1} terminée`);
        currentSentenceIndex++;
        
        const delay = 150;
        
        setTimeout(() => {
          speakNextSentence();
        }, delay);
      };
    
      utterance.onerror = (error) => {
        console.warn(`[TTS] ⚠️ Erreur phrase ${currentSentenceIndex + 1}:`, error);
        currentSentenceIndex++;
        speakNextSentence();
      };
    
      speechSynthesis.speak(utterance);
    };
    
    // ✅ Démarrer la séquence
    speakNextSentence();
}

// ═══════════════════════════════════════════════════════════
// PRÉCHAUFFAGE TTS : Élimine la latence au premier clic
// ═══════════════════════════════════════════════════════════
function warmUpTTS() {
  if ('speechSynthesis' in window) {
    const warmup = new SpeechSynthesisUtterance('');
    warmup.volume = 0;
    warmup.lang = 'fr-FR';
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
      // ✅ Masquer le score de progression flottant sur l'accueil
      const existingHeader = document.getElementById('floating-progress-header');
      if (existingHeader) existingHeader.style.display = 'none';
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
    // ✅ NOUVEAU : Utiliser le helper de fusion vocabulary + dictionary
    const vocabData = await content.loadLessonData('fr', unitId);

    // ✅ DEBUG : Vérifier que la fusion fonctionne
    console.log('[LessonPhrases] Données chargées:', vocabData.items.length, 'items');
    console.log('[LessonPhrases] Premier item enrichi:', vocabData.items[0]);
    if (vocabData.items[0].audio?.fallbackMp3) {
      console.log('[LessonPhrases] ✅ Audio fallback présent');
    }
    if (vocabData.items[0].exam?.distractors) {
      console.log('[LessonPhrases] ✅ Exam distractors présents');
    }

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
            shadowFeedback.innerHTML = `<div class="feedback-success" style="padding:0.75rem; font-size:0.9rem;">✅ Tena tsara ! (Très bien !)</div>`;
            btnShadow.textContent = '✅ Vita';
            gamification.addXP(5, 'Shadowing - excellente prononciation');
            document.getElementById('btn-shadow').classList.remove('guide-active');
            unlockNext();
          } else if (similarity > 0.40) {
            if (typeof feedbackSounds !== 'undefined') feedbackSounds.playSuccess();
           shadowFeedback.innerHTML = `<div class="feedback-success" style="padding:0.75rem; font-size:0.9rem;">✅ Tsara ! (Bien !)</div>`;
            btnShadow.textContent = '✅ Vita';
            gamification.addXP(3, 'Shadowing - bonne prononciation');
            document.getElementById('btn-shadow').classList.remove('guide-active');
            unlockNext();
          } else {
            if (typeof feedbackSounds !== 'undefined') feedbackSounds.playRetry();
           shadowFeedback.innerHTML = `<div class="feedback-fail" style="padding:0.75rem; font-size:0.9rem;">🔄 Havereno (À répéter)</div>`;
            btnShadow.textContent = ' Mitenena indray (Réessayer)';
          }
                  shadowFeedback.innerHTML += getEngineIndicator(data.engine);
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

    // ✅ Enregistrer l'activité
    recordActivity('practice-words', currentTheme);
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
    // ✅ NOUVEAU : Utiliser le helper de fusion vocabulary + dictionary
    const vocabData = await content.loadLessonData('fr', unitId);

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
             <div id="shadow-feedback" style="margin-top:0.75rem; font-size:0.9rem; font-weight:600;"></div>
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

                      shadowFeedback.innerHTML += getEngineIndicator(data.engine);
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

    // ✅ Enregistrer l'activité
    recordActivity('practice-phrases', currentTheme);
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
        router.navigate('/roleplay-v2'); // ✅ Test V2 temporairement
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

    // ✅ Enregistrer l'activité
    recordActivity('dialogues', currentTheme);
}

    // ═══════════════════════════════════════════════════════════
  // VUE : ROLE PLAY V2 (Nouvelle architecture propre)
  // ═══════════════════════════════════════════════════════════
  async function renderRolePlayV2() {
    console.log('[RolePlayV2] === DÉBUT renderRolePlayV2 ===');
    
    const main = document.getElementById('app');
    const themeId = currentTheme;
    
    console.log('[RolePlayV2] themeId:', themeId);
    
    if (!themeId || themeId === 'null') {
      console.error('[RolePlayV2] Pas de thème, redirection vers /themes');
      router.navigate('/themes');
      return;
    }

    // Vérifier si rolePlayView est disponible
    console.log('[RolePlayV2] window.rolePlayView:', window.rolePlayView);
    
    if (!window.rolePlayView) {
      console.error('[RolePlayV2] ❌ rolePlayView non disponible !');
      console.log('[RolePlayV2] Tentative de rechargement...');
      
      // Essayer de recharger le module
      try {
        const module = await import('./ui/views/roleplay-view.js');
        window.rolePlayView = module.rolePlayView;
        console.log('[RolePlayV2] ✅ rolePlayView rechargé');
      } catch (e) {
        console.error('[RolePlayV2] Erreur de rechargement:', e);
        main.innerHTML = `
          <div style="text-align:center; padding:2rem; color:var(--ds-color-danger);">
            <p>Erreur de chargement de RolePlayV2</p>
            <p>${e.message}</p>
          </div>
        `;
        return;
      }
    }

    console.log('[RolePlayV2] Appel de rolePlayView.render()...');
    
    try {
      await window.rolePlayView.render(main, themeId, 'guided');
      console.log('[RolePlayV2] ✅ render() terminé avec succès');
        
        // ✅ Guider l utilisateur avec le Teacher Avatar (message de mémorisation)
        if (window.teacherAvatar) {
          setTimeout(() => {
            window.teacherAvatar.show('roleplay');
          }, 800);
        }
    } catch (e) {
      console.error('[RolePlayV2] ❌ Erreur dans render():', e);
      main.innerHTML = `
        <div style="text-align:center; padding:2rem; color:var(--ds-color-danger);">
          <p>Erreur RolePlayV2: ${e.message}</p>
          <pre style="text-align:left; font-size:0.8rem;">${e.stack}</pre>
        </div>
      `;
    }
    
    console.log('[RolePlayV2] === FIN renderRolePlayV2 ===');
  }
// ═══════════════════════════════════════════════════════════
// VUE : ROLE PLAY GUIDÉ (L'utilisateur joue avec les réponses visibles)
// ═══════════════════════════════════════════════════════════
async function renderRolePlay() {
  // ✅ Cleanup : annuler tout TTS/STT précédent
  speechSynthesis.cancel();
  if (window.shadowing) {
    window.shadowing.forceStop();
  }

  updateNavActiveState();
  const main = document.getElementById('app');
  main.innerHTML = '<div style="text-align:center; padding:2rem;">Famakiana ny Role Play...</div>';

  renderProgressHeader();

        // ✅ Désactiver le guide automatique pendant le Role Play
    if (window.teacherAvatar) {
      window.teacherAvatar.setSessionActive(true);
    }

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
    let ttsLaunchedForIndex = -1;
    let rolePlayCompleted = false;
    let unlockNextTimer = null;  // ✅ Pour annuler le timeout précédent

    // ✅ FONCTION SÉPARÉE (pas à l'intérieur de renderLine)
    const renderRolePlayComplete = async () => {

        // ✅ Réactiver le guide automatique à la fin du Role Play
        if (window.teacherAvatar) {
          window.teacherAvatar.setSessionActive(false);
        }


      if (shadowEvalHandler) {
        bus.off('pronunciation:evaluated', shadowEvalHandler);
        shadowEvalHandler = null;
      }

      await gamification.addXP(30, 'Role Play Guidé terminé');

       // ✅ Marquer le parcours comme terminé seulement maintenant
        journeyTracker.markJourneyComplete('roleplays', unitId);
        saveProfile();

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
        console.log(`[RolePlay] renderLine() appelé pour l'index ${currentLineIndex}`);

        // ✅ Annuler tout timer en cours pour éviter les doublons
        if (unlockNextTimer) {
          clearTimeout(unlockNextTimer);
          unlockNextTimer = null;
          unlockNextPending = false;
        }
        
        if (currentLineIndex >= dialogue.lines.length) {
          console.log('[RolePlay] Fin du dialogue atteinte');
          renderRolePlayComplete();
          return;
        }
        if (currentLineIndex >= dialogue.lines.length) {
          renderRolePlayComplete();
          return;
        }

        const line = dialogue.lines[currentLineIndex];
        const speaker = dialogue.participants[line.speaker];
        const isUserTurn = line.speaker === 'B';
        const progressPercent = (currentLineIndex / dialogue.lines.length) * 100;

        // ✅ Mettre à jour la barre de progression
        const progressBar = document.getElementById('progress-bar');
        if (progressBar) progressBar.style.width = `${progressPercent}%`;
        
        // ✅ Mettre à jour le texte de progression
        const progressText = document.getElementById('progress-text');
        if (progressText) progressText.textContent = `Andiany ${currentLineIndex + 1} / ${dialogue.lines.length}`;
        
        // ✅ Afficher tous les échanges précédents
        const previousContainer = document.getElementById('previous-exchanges');
        if (previousContainer) {
          previousContainer.innerHTML = previousExchangesHtml.join('');
        }

        // ✅ Construire le HTML de l'échange actuel
        const currentHtml = `
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
            ${isUserTurn ? `
              <!-- ✅ Tour utilisateur : bouton micro direct -->
              <div id="step-speak" style="text-align:center; padding:1rem; background:var(--ds-color-primary-soft); border-radius:var(--ds-radius-md); border: 1px dashed var(--ds-color-primary);">
                <div style="font-size:0.75rem; text-transform:uppercase; color:var(--ds-color-primary); margin-bottom:0.5rem; font-weight:bold;">Mitenena izao (Parlez maintenant)</div>
                <ds-button variant="primary" size="lg" id="btn-speak" class="guide-active">🎤 Mitenena izao (Parler maintenant)</ds-button>
                <div id="speech-feedback" style="margin-top:0.75rem; font-size:0.9rem; font-weight:600; min-height:1.5em;"></div>
              </div>
            ` : `
              <!-- ✅ Tour partenaire : indicateur d'écoute auto -->
              <div style="text-align:center; padding:1rem; background:var(--ds-color-surface-2); border-radius:var(--ds-radius-md); color:var(--ds-color-text-muted);">
                <div id="partner-speaking-indicator" style="font-size:2rem; margin:0.5rem 0;">🔊</div>
                <div style="font-size:0.9rem;">👂 Mihainoa an'i ${speaker.name} (Écoutez ${speaker.name})</div>
              </div>
            `}
          </div>
        `;
        
        // ✅ Afficher l'échange actuel
        const currentContainer = document.getElementById('current-exchange');
        if (currentContainer) {
          currentContainer.innerHTML = currentHtml;
        }

        // ✅ NOUVELLE LOGIQUE : Auto-déclenchement selon le type de tour
                if (!isUserTurn) {
          // ✅ TOUR PARTENAIRE : TTS automatique
          const speakerGender = speaker.gender || 'female';
          
          // ✅ VÉRIFIER qu'on n'a pas déjà lancé le TTS pour cet index
            if (ttsLaunchedForIndex === currentLineIndex) {
              console.log(`[RolePlay] TTS déjà lancé pour l'index ${currentLineIndex}, skip`);
              return;
            }
            
            console.log(`[RolePlay] Lancement du TTS pour l'index ${currentLineIndex} (tour ${!isUserTurn ? 'partenaire' : 'utilisateur'})`);
            
            
            // ✅ Marquer que le TTS a été lancé pour cet index
            ttsLaunchedForIndex = currentLineIndex;
          
          // Attendre 500ms avant de démarrer le TTS
          setTimeout(() => {
            speakWithFeedback(line.text, {
              gender: speakerGender,
              onStart: () => {
                const indicator = document.getElementById('partner-speaking-indicator');
                if (indicator) {
                  indicator.textContent = '🗣️';
                  indicator.style.animation = 'pulse-guide 1s infinite';
                }
              },
              onEnd: () => {
                const indicator = document.getElementById('partner-speaking-indicator');
                if (indicator) {
                  indicator.textContent = '✅';
                  indicator.style.animation = 'none';
                }
                // ✅ Auto-progression après la fin du TTS
                unlockNext();
              }
            });
          }, 500);
        

        } else {
          // ✅ TOUR UTILISATEUR : micro direct
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
                if (typeof feedbackSounds !== 'undefined') feedbackSounds.playSuccess();
                speechFeedback.innerHTML = `<span style="color:var(--ds-color-success);">✅ Tena tsara ! (Très bien !)</span>`;
                btnSpeak.textContent = '✅ Vita';
                gamification.addXP(5, 'Role Play - excellente prononciation');
                document.getElementById('btn-speak').classList.remove('guide-active');
                unlockNext();
              } else if (similarity > 0.40) {
                if (typeof feedbackSounds !== 'undefined') feedbackSounds.playSuccess();
                speechFeedback.innerHTML = `<span style="color:var(--ds-color-success);">✅ Tsara ! (Bien !)</span>`;
                btnSpeak.textContent = '✅ Vita';
                gamification.addXP(3, 'Role Play - bonne prononciation');
                document.getElementById('btn-speak').classList.remove('guide-active');
                unlockNext();
              } else {
                if (typeof feedbackSounds !== 'undefined') feedbackSounds.playRetry();
                speechFeedback.innerHTML = `<span style="color:var(--ds-color-accent);">🔄 Havereno (À répéter)</span>`;
                btnSpeak.textContent = '🎤 Mitenena indray (Réessayer)';
              }
              
              // ✅ Indicateur STT
              speechFeedback.innerHTML += getEngineIndicator(data.engine);
            } else {
              speechFeedback.innerHTML = '<span style="color:var(--ds-color-text-muted);">⚠️ Tsy re ny feo</span>';
              btnSpeak.textContent = '🎤 Mitenena izao';
            }
          };

          // ✅ Enregistrer le handler STT
          bus.on('pronunciation:evaluated', shadowEvalHandler);
        }

        // ✅ Fonction unlockNext avec auto-progression
                     const unlockNext = () => {
            console.log(`[RolePlay] unlockNext() appelé pour l'index ${currentLineIndex}`);
            
            setTimeout(() => {
              console.log(`[RolePlay] unlockNext() timeout terminé, progression...`);
              
                            if (currentLineIndex < dialogue.lines.length - 1) {
                console.log(`[RolePlay] Passage à l'index ${currentLineIndex + 1}`);
                
                try {
                  // Sauvegarder l'échange actuel comme "fait"
                  const currentExchangeHtml = `
                    <div style="opacity:0.6; background:var(--ds-color-surface); padding:1rem; border-radius:var(--ds-radius-lg); border:1px solid var(--ds-color-border);">
                      <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem;">
                        <span style="font-size:1.2rem;">${speaker.avatar}</span>
                        <strong>${speaker.name}</strong>
                      </div>
                      <div style="font-size:1rem; font-weight:500;">${line.text}</div>
                      <div style="font-size:0.85rem; color:var(--ds-color-text-muted); font-style:italic;">${line.translation}</div>
                    </div>
                  `;
                  previousExchangesHtml.push(currentExchangeHtml);
                  console.log('[RolePlay] Échange sauvegardé');
                } catch (err) {
                  console.error('[RolePlay] Erreur lors de la sauvegarde:', err);
                }
                
                try {
                  // Nettoyer le handler STT avant de passer à la suite
                  if (shadowEvalHandler) {
                    bus.off('pronunciation:evaluated', shadowEvalHandler);
                    shadowEvalHandler = null;
                  }
                  console.log('[RolePlay] Handler STT nettoyé');
                } catch (err) {
                  console.error('[RolePlay] Erreur lors du nettoyage STT:', err);
                }
                
                try {
                  ttsLaunchedForIndex = -1;
                  currentLineIndex++;
                  console.log(`[RolePlay] Index incrémenté à ${currentLineIndex}, appel de renderLine()`);
                  renderLine();
                  console.log('[RolePlay] renderLine() terminé');
                } catch (err) {
                  console.error('[RolePlay] Erreur lors de renderLine():', err);
                }
                
                // Auto-scroll
                setTimeout(() => {
                  const newExchange = document.getElementById('current-exchange');
                  if (newExchange) {
                    newExchange.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }, 100);
              } else {
                renderRolePlayComplete();
              }
            }, 1500);
          };

       };

            // ✅ NOUVEAU : Stockage des échanges précédents pour affichage complet
      const previousExchangesHtml = [];
      
      // ✅ NOUVEAU : Afficher la structure de base
      main.innerHTML = `
        <section style="max-width: 600px; margin: 0 auto; padding: 2rem 1rem;">
          <div style="background:var(--ds-color-border); height:8px; border-radius:4px; margin-bottom:1rem; overflow:hidden;">
            <div id="progress-bar" style="background:var(--ds-color-accent, #f59e0b); height:100%; width:0%; transition: width 0.3s ease;"></div>
          </div>

          <div style="display:flex; justify-content:space-between; margin-bottom:1rem; align-items:center;">
            <ds-button variant="ghost" size="sm" id="btn-back-dialogues">← Hiverina (Retour)</ds-button>
            <span id="progress-text" style="font-weight:600; color:var(--ds-color-text-muted);">
              Andiany 1 / ${dialogue.lines.length}
            </span>
          </div>

          <div style="text-align:center; margin-bottom:1rem;">
            <span style="background:var(--ds-color-accent, #f59e0b); color:white; padding:4px 12px; border-radius:20px; font-weight:600; font-size:0.8rem;">
              🎭 Role Play Guidé • ${themeName}
            </span>
          </div>

          <h2 style="text-align:center; margin-bottom:1.5rem;">💬 ${dialogue.title}</h2>

          <div id="previous-exchanges" style="display:flex; flex-direction:column; gap:1.5rem; margin-bottom:1.5rem;"></div>
          
          <div id="current-exchange"></div>
        </section>
      `;


    renderLine();

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
    let ttsLaunchedForIndex = -1;  // ✅ Verrou TTS au niveau de la session

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
          router.navigate('/roleplay-v2'); // ✅ Test V2 temporairement
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

        speechFeedback.innerHTML += getEngineIndicator(data.engine);
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

        // ✅ Réactiver le guide automatique à la fin du Role Play
        if (window.teacherAvatar) {
          window.teacherAvatar.setSessionActive(false);
        }


      if (shadowEvalHandler) {
        bus.off('pronunciation:evaluated', shadowEvalHandler);
        shadowEvalHandler = null;
      }
      speechSynthesis.cancel();
      feedbackSounds.playCelebration();
      await gamification.addXP(100, 'Défi terminé !');

      // ✅ Marquer le parcours comme terminé seulement maintenant
        journeyTracker.markJourneyComplete('challenges', unitId);
        saveProfile();

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


  // ═══════════════════════════════════════════════════════════
// UTILITAIRE : Indicateur visuel du moteur STT utilisé
// ═══════════════════════════════════════════════════════════
function getEngineIndicator(engine) {
  if (engine === 'offline-fallback') {
    return '<div style="font-size: 0.75rem; color: var(--ds-color-text-muted); margin-top: 0.5rem; text-align: center;">📶 Auto-évaluation (mode hors-ligne)</div>';
  }
  return '<div style="font-size: 0.75rem; color: var(--ds-color-text-muted); margin-top: 0.5rem; text-align: center;">🎤 Évaluation vocale</div>';
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

        // ✅ Guide contextuel Teacher AI selon le statut du compte
        if (window.teacherAvatar) {
          if (!profile.isPremium) {
            // Utilisateur gratuit → guide vers Premium
            window.teacherAvatar.show('profile');
            setTimeout(() => {
              window.teacherAvatar.speakGuide("Vous êtes en compte gratuit. Passez à Premium pour débloquer tous les niveaux et la certification !");
            }, 800);
          } else {
            // Utilisateur Premium → guide vers progression certification
            window.teacherAvatar.show('profile');
            const certProgress = profile.percentage || 0;
            setTimeout(() => {
              if (certProgress >= 100) {
                window.teacherAvatar.speakGuide("Bravo ! Vous êtes éligible à la certification A2. Consultez votre certificat !");
              } else {
                window.teacherAvatar.speakGuide(`Progression : ${certProgress}%. Continuez pour débloquer la certification A2 !`);
              }
            }, 800);
          }
        }

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


      // ✅ Calculer la progression pour cette page
      const journeys = journeyTracker.getCompletedJourneys();
      const activityTypes = ['lessons', 'practices', 'phraseLessons', 'phrasePractices', 'dialogues'];
      const completedActivities = activityTypes.filter(type => journeys[type]?.includes(currentTheme)).length;
      const progressPercent = (completedActivities / activityTypes.length) * 100;

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

      // ✅ Calculer la progression pour cette page
      const journeys = journeyTracker.getCompletedJourneys();
      const activityTypes = ['lessons', 'practices', 'phraseLessons', 'phrasePractices', 'dialogues'];
      const completedActivities = activityTypes.filter(type => journeys[type]?.includes(currentTheme)).length;
      const progressPercent = (completedActivities / activityTypes.length) * 100;

    main.innerHTML = `
      <section style="max-width: 600px; margin: 0 auto; padding: 2rem 1rem; text-align:center;">
        <ds-button variant="ghost" size="sm" id="btn-back-themes" style="margin-bottom: 1rem; float:left;">← Thèmes</ds-button>
        <div style="clear:both; padding-top:1rem;">
          <span style="background:var(--ds-color-accent); color:white; padding:4px 12px; border-radius:20px; font-weight:600; font-size:0.8rem;">Niveau ${currentLevel}</span>
        </div>
        <h1 style="margin-top:1rem; color:var(--ds-color-primary);">${themeName}</h1>
        <p style="color:var(--ds-color-text-muted); margin-bottom: 1rem;">${unitData.themeMg || ''} • ${unitData.items.length} mots</p>
          <!-- Barre de progression globale -->
          <div style="background:var(--ds-color-surface-2); padding:1rem; border-radius:var(--ds-radius-md); margin-bottom:1.5rem; text-align:left;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
              <span style="font-weight:600; color:var(--ds-color-text);">📊 Progression</span>
              <span style="color:var(--ds-color-primary); font-weight:700;">${completedActivities}/${activityTypes.length} étapes</span>
            </div>
            <div id="progress-bar-container" style="background:var(--ds-color-border); border-radius:20px; height:8px; overflow:hidden;">
              <div id="progress-bar-fill" style="height:100%; background:linear-gradient(90deg, var(--ds-color-success), var(--ds-color-primary)); width:${progressPercent}%; border-radius:20px;"></div>
            </div>
          </div>
            <!-- Bannière de succès et confettis (cachés par défaut) -->
            <div id="success-banner" style="display:none;" class="success-banner">
              <span class="trophy">🏆</span>
              <div>
                <div>Thème complété ! +50 XP bonus</div>
                <div style="font-size:0.85rem; opacity:0.9;">Arahaba ! Vita tamin'ny fahombiazana io lohahevitra io !</div>
              </div>
            </div>
            <div id="confetti-container"></div>
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
            <style>
              @keyframes staggerIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
              @keyframes pulse-soft { 0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.5); } 50% { box-shadow: 0 0 0 8px rgba(59, 130, 246, 0); } }
              @keyframes pulse-focus { 0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7), 0 0 20px rgba(59, 130, 246, 0.3); } 50% { box-shadow: 0 0 0 12px rgba(59, 130, 246, 0), 0 0 30px rgba(59, 130, 246, 0.5); } }
              .activity-card { transition: all 0.3s ease; cursor: pointer; position: relative; }
              .activity-card:hover { transform: translateY(-2px) scale(1.02); box-shadow: 0 8px 20px rgba(0,0,0,0.1); border-color: var(--ds-color-primary); }
              .activity-card.completed { background: linear-gradient(135deg, var(--ds-color-surface) 0%, rgba(16, 185, 129, 0.05) 100%); border-color: var(--ds-color-success); opacity: 0.85; }
              .activity-card.current { background: linear-gradient(135deg, var(--ds-color-surface) 0%, rgba(59, 130, 246, 0.08) 100%); border: 3px solid var(--ds-color-primary); animation: pulse-focus 2s infinite; transform: scale(1.03); box-shadow: 0 8px 25px rgba(59, 130, 246, 0.2); }
              .activity-card.current:hover { transform: scale(1.05); }
              .activity-card.pending { opacity: 0.6; }
              .activity-card.pending:hover { opacity: 0.9; }
              .status-badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; margin-left: 8px; }
              .time-estimate { display: inline-flex; align-items: center; gap: 4px; font-size: 0.75rem; color: var(--ds-color-text-muted); background: var(--ds-color-surface-2); padding: 2px 8px; border-radius: 10px; margin-top: 0.5rem; }
              .chain-connector { display: flex; justify-content: center; height: 20px; position: relative; }
              .chain-connector::before { content: ''; position: absolute; left: 50%; top: 0; bottom: 0; width: 2px; background: var(--ds-color-border); transform: translateX(-50%); }
              .chain-connector.completed::before { background: var(--ds-color-success); }
              .chain-icon { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; z-index: 1; }
              .chain-icon.completed { background: var(--ds-color-success); color: white; }
              .chain-icon.pending { background: var(--ds-color-surface-2); color: var(--ds-color-text-muted); border: 1px solid var(--ds-color-border); }
              .chain-icon.current { background: var(--ds-color-primary); color: white; animation: pulse-focus 2s infinite; }
                .activity-card.locked { opacity: 0.4; cursor: not-allowed; pointer-events: none; }
                .activity-card.locked:hover { transform: none; box-shadow: none; }
                .chain-connector.locked::before { border-left: 2px dashed var(--ds-color-border); background: none; width: 0; }
                @keyframes confetti-fall { 0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) rotate(720deg); opacity: 0; } }
                @keyframes banner-slide { 0% { transform: translateY(-100%); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
                @keyframes glow-gold { 0%, 100% { box-shadow: 0 0 10px rgba(255, 215, 0, 0.5); } 50% { box-shadow: 0 0 25px rgba(255, 215, 0, 0.9), 0 0 35px rgba(255, 215, 0, 0.6); } }
                @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
                .success-banner { position: fixed; top: 70px; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, var(--ds-color-success), #059669); color: white; padding: 1rem 2rem; border-radius: var(--ds-radius-lg); box-shadow: 0 8px 25px rgba(16, 185, 129, 0.3); z-index: 10000; animation: banner-slide 0.5s ease-out; display: flex; align-items: center; gap: 12px; font-weight: 600; }
                .success-banner .trophy { font-size: 2rem; animation: bounce 1s infinite; }
                .progress-bar-glow { animation: glow-gold 2s infinite; }
                .confetti-piece { position: fixed; width: 10px; height: 10px; top: -10px; z-index: 9999; animation: confetti-fall linear forwards; }
            </style>
            <div style="display:flex; flex-direction:column; gap:1rem; text-align:left;">
              <div class="activity-card" id="card-lessons" style="background:var(--ds-color-surface); padding:1rem; border-radius:var(--ds-radius-md); border:2px solid var(--ds-color-border); animation: staggerIn 0.5s ease-out 0.1s backwards;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                  <h3 style="margin:0; color:var(--ds-color-text); font-size:1rem;">📖 Étape 1 : Les Mots</h3>
                  <span id="badge-lessons" class="status-badge"></span>
                </div>
                <p style="margin:0 0 0.5rem 0; font-size:0.85rem; color:var(--ds-color-text-muted); font-style:italic;">Écoutez et répétez chaque mot</p>
                <div class="time-estimate">⏱️ ≈ 5 min</div>
                <ds-button id="btn-lesson-words" variant="primary" size="md" style="width:100%; margin-top:0.75rem;">Apprendre les mots</ds-button>
              </div>
              <div class="chain-connector" id="chain-1"></div>
              <div class="activity-card" id="card-practices" style="background:var(--ds-color-surface); padding:1rem; border-radius:var(--ds-radius-md); border:2px solid var(--ds-color-border); animation: staggerIn 0.5s ease-out 0.2s backwards;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                  <h3 style="margin:0; color:var(--ds-color-text); font-size:1rem;">🎯 Étape 2 : Révision des Mots</h3>
                  <span id="badge-practices" class="status-badge"></span>
                </div>
                <p style="margin:0 0 0.5rem 0; font-size:0.85rem; color:var(--ds-color-text-muted); font-style:italic;">Quiz + Shadowing sur les mots</p>
                <div class="time-estimate">⏱️ ≈ 8 min</div>
                <ds-button id="btn-practice-words" variant="success" size="md" style="width:100%; margin-top:0.75rem;">Réviser les mots</ds-button>
              </div>
              <div class="chain-connector" id="chain-2"></div>
              <div class="activity-card" id="card-phraseLessons" style="background:var(--ds-color-surface); padding:1rem; border-radius:var(--ds-radius-md); border:2px solid var(--ds-color-border); animation: staggerIn 0.5s ease-out 0.3s backwards;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                  <h3 style="margin:0; color:var(--ds-color-text); font-size:1rem;">📝 Étape 3 : Les Phrases de contexte</h3>
                  <span id="badge-phraseLessons" class="status-badge"></span>
                </div>
                <p style="margin:0 0 0.5rem 0; font-size:0.85rem; color:var(--ds-color-text-muted); font-style:italic;">Écoutez et répétez les phrases complètes</p>
                <div class="time-estimate">⏱️ ≈ 7 min</div>
                <ds-button id="btn-lesson-phrases" variant="primary" size="md" style="width:100%; margin-top:0.75rem;">Apprendre les phrases</ds-button>
              </div>
              <div class="chain-connector" id="chain-3"></div>
              <div class="activity-card" id="card-phrasePractices" style="background:var(--ds-color-surface); padding:1rem; border-radius:var(--ds-radius-md); border:2px solid var(--ds-color-border); animation: staggerIn 0.5s ease-out 0.4s backwards;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                  <h3 style="margin:0; color:var(--ds-color-text); font-size:1rem;">🎯 Étape 4 : Révision des Phrases</h3>
                  <span id="badge-phrasePractices" class="status-badge"></span>
                </div>
                <p style="margin:0 0 0.5rem 0; font-size:0.85rem; color:var(--ds-color-text-muted); font-style:italic;">Quiz + Shadowing sur les phrases</p>
                <div class="time-estimate">⏱️ ≈ 8 min</div>
                <ds-button id="btn-practice-phrases" variant="success" size="md" style="width:100%; margin-top:0.75rem;">Réviser les phrases</ds-button>
              </div>
              <div class="chain-connector" id="chain-4"></div>
              <div class="activity-card" id="card-dialogues" style="background:var(--ds-color-surface); padding:1rem; border-radius:var(--ds-radius-md); border:2px solid var(--ds-color-border); animation: staggerIn 0.5s ease-out 0.5s backwards;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                  <h3 style="margin:0; color:var(--ds-color-text); font-size:1rem;">💬 Étape 5 : Dialogue</h3>
                  <span id="badge-dialogues" class="status-badge"></span>
                </div>
                <p style="margin:0 0 0.5rem 0; font-size:0.85rem; color:var(--ds-color-text-muted); font-style:italic;">Conversation complète avec Role Play</p>
                <div class="time-estimate">⏱️ ≈ 10 min</div>
                <ds-button id="btn-dialogues" variant="accent" size="md" style="width:100%; margin-top:0.75rem;">Faire le dialogue</ds-button>
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
      // 🔒 Fonction pour vérifier si une activité est débloquée
      const isActivityUnlocked = (activityType) => {
        const journeys = journeyTracker.getCompletedJourneys();
        const activityOrder = ['lessons', 'practices', 'phraseLessons', 'phrasePractices', 'dialogues'];
        const targetIndex = activityOrder.indexOf(activityType);
        if (targetIndex === 0) return true;
        const previousType = activityOrder[targetIndex - 1];
        return journeys[previousType]?.includes(currentTheme);
      };
      
      // 🔒 Message toast pour les activités verrouillées
      const showLockedMessage = () => {
        const toast = document.createElement('div');
        toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#F59E0B;color:white;padding:1rem 2rem;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:10001;font-weight:600;';
        toast.innerHTML = "🔒 Complétez l'étape précédente pour débloquer";
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
      };
      
      document.getElementById('btn-lesson-words')?.addEventListener('click', () => {
        if (isActivityUnlocked('lessons')) router.navigate('/lesson'); else showLockedMessage();
      });
      document.getElementById('btn-practice-words')?.addEventListener('click', () => {
        if (isActivityUnlocked('practices')) router.navigate('/practice'); else showLockedMessage();
      });
      document.getElementById('btn-lesson-phrases')?.addEventListener('click', () => {
        if (isActivityUnlocked('phraseLessons')) router.navigate('/lesson-phrases'); else showLockedMessage();
      });
      document.getElementById('btn-practice-phrases')?.addEventListener('click', () => {
        if (isActivityUnlocked('phrasePractices')) router.navigate('/practice-phrases'); else showLockedMessage();
      });
      document.getElementById('btn-dialogues')?.addEventListener('click', () => {
        if (isActivityUnlocked('dialogues')) router.navigate('/dialogues'); else showLockedMessage();
      });
        
        // ✅ Event listener pour Conversation Live
        document.getElementById('btn-live-conversation')?.addEventListener('click', () => {
          // Conversation Live est accessible après les dialogues
          const journeys = journeyTracker.getCompletedJourneys();
          const hasCompletedDialogues = journeys.dialogues?.includes(currentTheme);
          
          if (hasCompletedDialogues) {
            // Construire l'ID du dialogue basé sur le thème actuel
            const dialogueId = currentTheme + '_01';
            router.navigate('/conversation?dialogue=' + dialogueId);
          } else {
            showLockedMessage();
          }
        });
    }


      // ✅ Appliquer les badges et le mode focus
      if (!locked) {
        setTimeout(() => {
          const journeys = journeyTracker.getCompletedJourneys();
          const activityOrder = ['lessons', 'practices', 'phraseLessons', 'phrasePractices', 'dialogues'];
          let nextActivity = null;
          let focusApplied = false;
          activityOrder.forEach((type, index) => {
            const card = document.getElementById(`card-${type}`);
            const badge = document.getElementById(`badge-${type}`);
            if (!card || !badge) return;
            const isCompleted = journeys[type]?.includes(currentTheme);
            if (isCompleted) {
              card.classList.add('completed');
              badge.textContent = '✓ Terminé';
              badge.style.background = 'var(--ds-color-success)';
              badge.style.color = 'white';
              // Mettre à jour le connecteur
              if (index > 0) {
                const connector = document.getElementById(`chain-${index}`);
                if (connector) {
                  connector.classList.add('completed');
                  connector.innerHTML = '<span class="chain-icon completed">✓</span>';
                }
              }
            } else if (!nextActivity) {
              card.classList.add('current');
              badge.textContent = '👉 Continuez ici';
              badge.style.background = 'var(--ds-color-primary)';
              badge.style.color = 'white';
              nextActivity = type;
              focusApplied = true;
              // Mettre à jour le connecteur vers l'activité courante
          
          // ✅ Déclencher la célébration si le thème est complété
          if (completedActivities === activityTypes.length) {
            console.log('[ThemeDetail] 🎉 Thème complété, déclenchement célébration');
            
            // 1. Afficher la bannière de succès
            const banner = document.getElementById('success-banner');
            if (banner) {
              banner.style.display = 'flex';
              setTimeout(() => { banner.style.display = 'none'; }, 5000);
            }
            
            // 2. Ajouter l'effet de glow doré à la barre de progression
            const progressBar = document.getElementById('progress-bar-fill');
            if (progressBar) {
              progressBar.classList.add('progress-bar-glow');
            }
            
            // 3. Créer les confettis
            const container = document.getElementById('confetti-container');
            if (container) {
              const colors = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];
              for (let i = 0; i < 50; i++) {
                const confetti = document.createElement('div');
                confetti.className = 'confetti-piece';
                confetti.style.left = Math.random() * 100 + 'vw';
                confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
                confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
                confetti.style.animationDelay = Math.random() * 0.5 + 's';
                container.appendChild(confetti);
              }
              // Nettoyer après 4 secondes
              setTimeout(() => { container.innerHTML = ''; }, 4000);
            }
            
            // 4. Message vocal du Teacher Avatar
            if (window.teacherAvatar && window.teacherAvatar.speak) {
              setTimeout(() => {
                window.teacherAvatar.speak("Félicitations ! Tu as complété ce thème ! Tu es prêt pour le suivant.");
              }, 1000);
            }
          }
              if (index > 0) {
                const connector = document.getElementById(`chain-${index}`);
                if (connector) {
                  connector.innerHTML = '<span class="chain-icon current">🎯</span>';
                }
              }
            } else {
              card.classList.add('pending');
              // Connecteur pour les activités futures
              if (index > 0) {
                const connector = document.getElementById(`chain-${index}`);
                if (connector) {
                  connector.innerHTML = '<span class="chain-icon pending">○</span>';
                }
              }
              // 🔒 Verrouiller les activités après la première non complétée
              if (nextActivity && type !== nextActivity) {
                card.classList.add('locked');
                if (index > 0) {
                  const connector = document.getElementById(`chain-${index}`);
                  if (connector) {
                    connector.classList.add('locked');
                    connector.innerHTML = '<span class="chain-icon pending">🔒</span>';
                  }
                }
              }
            }
          });
        }, 100);
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
// ═══════════════════════════════════════════════════════════
// VUE : CONVERSATION LIVE (sélection par niveau + dialogues)
// ═══════════════════════════════════════════════════════════
async function renderConversationLive() {
  console.log('[ConversationLive] 🚀 Fonction appelée');

  // ✅ V5.13: Incrémenter l'ID d'instance pour invalider les anciens callbacks
  conversationLiveInstanceId++;
  const instanceId = conversationLiveInstanceId;
  window.currentConversationInstanceId = instanceId; // ✅ V5.13: Rendre accessible globalement
  console.log(`[ConversationLive] 🔒 Instance ${instanceId} démarrée`);
  updateNavActiveState();
  const main = document.getElementById('app');

  if (!main) {
    console.error('[ConversationLive] ❌ #app introuvable');
    return;
  }

  main.innerHTML = '<div style="text-align:center; padding:2rem;">Chargement Conversation Live...</div>';
  console.log('[ConversationLive] ✅ Skeleton affiché');

  try {
    const floatActions = document.getElementById('floating-home-actions');
    if (floatActions) floatActions.remove();

    // ✅ Données des conversations par niveau
                    const conversationsData = {
        A0: [
          { id: 'greetings_01', title: 'Se présenter', icon: '👋', description: 'Dire son nom et demander comment ça va' },
          { id: 'alphabet_01', title: 'Épeler son nom', icon: '🔤', description: 'Épeler son nom et prénom lettre par lettre' },
          { id: 'alphabet_02', title: 'Épeler des mots du quotidien', icon: '🔤', description: 'Épeler des mots avec les lettres N à Z' },
          { id: 'numbers_01', title: 'Compter de 1 à 10', icon: '🔢', description: 'Compter et demander des prix simples' },
          { id: 'numbers2_01', title: 'Acheter plusieurs articles', icon: '🔢', description: 'Compter de 11 à 100 et payer au marché' },
          { id: 'market_01', title: 'Au marché', icon: '🏪', description: 'Acheter du riz et des légumes' },
          { id: 'family_01', title: 'Parler de sa famille', icon: '👨‍👩‍👧', description: 'Présenter ses parents et frères/sœurs' },
          { id: 'family_02', title: 'Parler de sa famille (avec mémoire)', icon: '🧠', description: 'Conversation qui se souvient de ce que tu dis' },
          { id: 'colors_01', title: 'Décrire des couleurs', icon: '🎨', description: 'Identifier les couleurs du ciel et de la nature' },
          { id: 'survival_01', title: 'Demander de l\'aide', icon: '🆘', description: 'Demander son chemin et remercier' },
          { id: 'body_01', title: 'Parler de son corps', icon: '🏥', description: 'Décrire une douleur chez le médecin' },
          { id: 'days_01', title: 'Les jours de la semaine', icon: '📅', description: 'Dire quel jour on est et parler de sa routine' },
          { id: 'months_01', title: 'Les mois de l\'année', icon: '🗓️', description: 'Parler des mois, des saisons et de son anniversaire' },
          { id: 'pronouns_basic_01', title: 'Les pronoms de base', icon: '🙋', description: 'Utiliser Je, Tu, Vous, Nous pour se présenter' }
        ],
        A1: [], // À venir
        A2: [], // À venir
        B1: []  // À venir
      };

    const levels = [
      { id: 'A0', name: 'Niveau A0', subtitle: 'Débutant absolu', available: true, color: 'var(--ds-color-success)', icon: '🌱', conversations: conversationsData.A0 },
      { id: 'A1', name: 'Niveau A1', subtitle: 'Élémentaire', available: false, color: 'var(--ds-color-primary)', icon: '📚', conversations: conversationsData.A1 },
      { id: 'A2', name: 'Niveau A2', subtitle: 'Intermédiaire', available: false, color: 'var(--ds-color-accent)', icon: '🎓', conversations: conversationsData.A2 },
      { id: 'B1', name: 'Niveau B1', subtitle: 'Seuil', available: false, color: 'var(--ds-color-text-muted)', icon: '🔒', conversations: conversationsData.B1 }
    ];

    main.innerHTML = `
      <section style="max-width: 600px; margin: 0 auto; padding: 2rem 1rem;">
        <ds-button variant="ghost" size="sm" id="btn-back-conv" style="margin-bottom: 1rem;">← Retour</ds-button>

          <!-- ✅ Notification du mode Microphone (TTS) -->
          <div id="stt-mode-notification" style="text-align:center; padding:0.75rem 1rem; margin-bottom:1rem; border-radius:var(--ds-radius-md); background:var(--ds-color-primary-soft); border:1px solid var(--ds-color-primary); font-size:0.9rem;">
            <span style="color:var(--ds-color-primary); font-weight:600;">🎙️ Mode microphone actif</span>
          </div>

          <!-- ✅ Notification du mode STT -->
          <div id="stt-status-notification" style="text-align:center; padding:0.75rem 1rem; margin-bottom:1rem; border-radius:var(--ds-radius-md); background:var(--ds-color-surface-2); border:1px solid var(--ds-color-border); font-size:0.9rem;">
            <span style="color:var(--ds-color-text-muted); font-weight:600;">Reconnaissance vocale : chargement...</span>
          </div>
          <p style="color: var(--ds-color-text-muted);">Pratiquez le français en conversation réelle</p>
        </div>

        <!-- Avatar SVG -->

        <!-- Sélection des niveaux -->
        <div style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 2rem;">
          ${levels.map(level => `
            <div class="conversation-level-card ${level.available ? 'available' : 'locked'}"
                 data-level="${level.id}"
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
                  <p style="margin: 0; color: ${level.color}; font-weight: 600; font-size: 0.9rem;">${level.subtitle}</p>
                  ${level.available && level.conversations.length > 0 ? `<p style="margin: 0.25rem 0 0 0; color: var(--ds-color-text-muted); font-size: 0.8rem;">${level.conversations.length} dialogues disponibles</p>` : ''}
                </div>
                <div style="font-size: 1.5rem; color: ${level.available ? level.color : 'var(--ds-color-text-muted)'};">
                  ${level.available ? '→' : '🔒'}
                </div>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Liste des dialogues A0 (cachée au départ) -->
        <div id="dialogues-list" style="display: none;">
          <h3 style="color: var(--ds-color-text); margin-bottom: 1rem;">📋 Choisissez un thème de conversation :</h3>
          <div id="dialogues-container" style="display: flex; flex-direction: column; gap: 0.75rem;"></div>
          <ds-button variant="ghost" size="sm" id="btn-back-levels" style="margin-top: 1rem;">← Retour aux niveaux</ds-button>
        </div>

        <div style="margin-top: 2rem; padding: 1rem; background: var(--ds-color-surface-2); border-radius: var(--ds-radius-md); text-align: center;">
          <p style="margin: 0; color: var(--ds-color-text-muted); font-size: 0.85rem;">
            💡 A0 disponible maintenant. Plus de niveaux prochainement.
          </p>
        </div>
      </section>
    `;

    // Initialiser le SVG avatar
     // Initialiser l'avatar avec cascade de fallback (3D → SVG → emoji)
      try {
        const module = await import('/src/ui/components/teacher-avatar-renderer.js');
        const TeacherAvatarRenderer = module.TeacherAvatarRenderer;


                    // ✅ Vérifier si un niveau est demandé (via variable globale)
      if (window.pendingConversationLevel) {
        const requestedLevel = window.pendingConversationLevel;
        window.pendingConversationLevel = null; // Nettoyer
        
        // ✅ Mettre à jour la notification STT
        const sttStatusNotification = document.getElementById("stt-status-notification");
        if (sttStatusNotification && window.sttManager) {
          const isSimulation = window.sttManager.isSimulationMode();
          if (isSimulation) {
            sttStatusNotification.innerHTML = '<span style="color:var(--ds-color-accent); font-weight:600;">🎭 Reconnaissance vocale : Mode simulation hors-ligne (évaluation simplifiée)</span>';
            sttStatusNotification.style.background = "var(--ds-color-accent-soft, #fef3c7)";
            sttStatusNotification.style.borderColor = "var(--ds-color-accent)";
          } else {
            sttStatusNotification.innerHTML = '<span style="color:var(--ds-color-primary); font-weight:600;">🌐 Reconnaissance vocale : Mode Web API (temps réel)</span>';
            sttStatusNotification.style.background = "var(--ds-color-primary-soft)";
            sttStatusNotification.style.borderColor = "var(--ds-color-primary)";
          }
        }
        
        const levelData = levels.find(l => l.id === requestedLevel);
        if (levelData && levelData.available) {
          // Afficher directement les dialogues après le rendu
          setTimeout(() => {
            showDialoguesList(levelData.conversations, levelData.name);
          }, 100);
        }
      }




        const avatarRenderer = new TeacherAvatarRenderer('teacher-avatar-svg-container');
        await avatarRenderer.render();
        avatarRenderer.setExpression('happy');
        window.teacherAvatarSVG = avatarRenderer;
        console.log(`[ConversationLive] ✅ Avatar initialisé en mode: ${avatarRenderer.getMode()}`);
      } catch (e) {
        console.warn('[ConversationLive] Avatar non disponible:', e);
      }

    // ✅ Afficher le Teacher Avatar flottant
    if (window.teacherAvatar) {
      window.teacherAvatar.show('conversation-live');
    }

    // Event listener retour
    document.getElementById('btn-back-conv').addEventListener('click', () => {
      router.navigate('/');
    });

    // ✅ Clic sur les niveaux
    document.querySelectorAll('.conversation-level-card').forEach(card => {
      card.addEventListener('click', () => {
        const level = card.dataset.level;
        const levelData = levels.find(l => l.id === level);

        if (!levelData || !levelData.available) {
          // Animation de secousse pour les niveaux verrouillés
          card.style.transform = 'translateX(-5px)';
          setTimeout(() => { card.style.transform = 'translateX(5px)'; }, 100);
          setTimeout(() => { card.style.transform = ''; }, 200);
          if (window.teacherAvatarSVG) {
            window.teacherAvatarSVG.setExpression('thinking');
          }
          return;
        }

        // Afficher la liste des dialogues
        showDialoguesList(levelData.conversations, levelData.name);
      });
    });

    // ✅ Fonction pour afficher les dialogues
    function showDialoguesList(conversations, levelName) {
      const dialoguesContainer = document.getElementById('dialogues-container');
      const dialoguesList = document.getElementById('dialogues-list');
      const levelsSection = document.querySelector('.conversation-level-card').parentElement;

      // Cacher les niveaux, afficher les dialogues
      levelsSection.style.display = 'none';
      dialoguesList.style.display = 'block';

      // Remplir la liste des dialogues
      dialoguesContainer.innerHTML = conversations.map(conv => `
        <div class="dialogue-card" data-dialogue-id="${conv.id}" style="
          background: var(--ds-color-surface);
          padding: 1rem 1.25rem;
          border-radius: var(--ds-radius-md);
          border: 2px solid var(--ds-color-border);
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 1rem;
        ">
          <div class="float-animation" style="font-size: 2rem;">${conv.icon}</div>
          <div style="flex: 1;">
            <h4 style="margin: 0 0 0.25rem 0; color: var(--ds-color-text); font-size: 1rem;">${conv.title}</h4>
            <p style="margin: 0; color: var(--ds-color-text-muted); font-size: 0.85rem;">${conv.description}</p>
          </div>
          <div style="font-size: 1.2rem; color: var(--ds-color-primary);">→</div>
        </div>
      `).join('');

      // Event listener pour chaque dialogue
      dialoguesContainer.querySelectorAll('.dialogue-card').forEach(card => {
        card.addEventListener('click', () => {
          const dialogueId = card.dataset.dialogueId;
          console.log(`[ConversationLive] 🚀 Lancement dialogue: ${dialogueId}`);
          
          // ✅ V5: Initialiser le contexte de conversation
          window.conversationContext = new ConversationContext();
          console.log(`[ConversationLive] 🧠 Contexte V5 initialisé pour ${dialogueId}`);
          window.currentConversationId = dialogueId;
          router.navigate('/conversation');
        });

        // Effet hover
        card.addEventListener('mouseenter', () => {
          card.style.borderColor = 'var(--ds-color-primary)';
          card.style.transform = 'translateX(4px)';
        });
        card.addEventListener('mouseleave', () => {
          card.style.borderColor = 'var(--ds-color-border)';
          card.style.transform = '';
        });
      });

      // Bouton retour aux niveaux
      document.getElementById('btn-back-levels').addEventListener('click', () => {
        levelsSection.style.display = 'flex';
        dialoguesList.style.display = 'none';
      });

      // Guide Teacher AI
      if (window.teacherAvatarSVG) {
        window.teacherAvatarSVG.setExpression('happy');
      }
    }

    logger.info('✅ Page Conversation Live rendue');
  } catch (e) {
    console.error('[ConversationLive] Erreur:', e);
    main.innerHTML = `<p style="color:red; text-align:center;">Erreur: ${e.message}</p>`;
  }
}

// ✅ Monte l'avatar SVG dans le header live (après chaque rendu)
// ✅ Monte l'avatar dans le header live avec cascade de fallback
async function mountLiveAvatar() {
  try {
    if (!window.TeacherAvatarRendererClass) {
      const module = await import('/src/ui/components/teacher-avatar-renderer.js');
      window.TeacherAvatarRendererClass = module.TeacherAvatarRenderer;
    }
    const avatar = new window.TeacherAvatarRendererClass('live-teacher-avatar');
    await avatar.render();
    window.teacherAvatarSVG = avatar;
    console.log(`[Live] ✅ Avatar monté en mode: ${avatar.getMode()}`);
  } catch (e) {
    console.warn('[Live] Avatar non disponible:', e);
  }
}

// ═══════════════════════════════════════════════════════════
// HELPER : Remplacer {firstName} par le vrai prénom
// ═══════════════════════════════════════════════════════════
function personalizeText(text) {
  if (!text) return text;

  const profile = getProfileData();
  const firstName = profile.firstName || 'ami';
  
  // ✅ V5.3 : Récupérer les données du contexte de conversation
  const context = window.conversationContext;
  
  // Construire le dictionnaire de remplacements
  const replacements = {
    '{firstName}': firstName,
    '{origin}': context?.getSlot('origin')?.value || '',
    '{fatherName}': context?.getSlot('fatherName')?.value || '',
    '{motherName}': context?.getSlot('motherName')?.value || '',
    '{feeling}': context?.getSlot('feeling')?.value || '',
    '{siblings}': context?.getSlot('siblings')?.value || '',
    '{age}': context?.getSlot('age')?.value || '',
    '{profession}': context?.getSlot('profession')?.value || ''
  };
  
  // Appliquer tous les remplacements
  let result = text;
  for (const [placeholder, value] of Object.entries(replacements)) {
    // Remplacer seulement si la valeur n'est pas vide
    if (value) {
      result = result.split(placeholder).join(value);
    }
  }
  
  return result;
}

// ═══════════════════════════════════════════════════════════
// HELPER : Auto-scroll vers le dernier message
// ═══════════════════════════════════════════════════════════
function scrollConversationToBottom() {
  requestAnimationFrame(() => {
    const chat = document.querySelector('.live-chat');
    if (!chat) return;

    chat.scrollTo({
      top: chat.scrollHeight,
      behavior: 'smooth'
    });
  });
}

// ═══════════════════════════════════════════════════════════
// VUE : CONVERSATION SEMI-LIBRE (Teacher Avatar IA)
// ═══════════════════════════════════════════════════════════

async function renderConversation() {
  const main = document.getElementById('app');
  main.innerHTML = getSkeletonThemesList();
  // ✅ Afficher le Teacher Avatar flottant pour guider l'utilisateur
    if (window.teacherAvatar) {
      window.teacherAvatar.show('conversation');
    }

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
      let turnProcessed = false; // ✅ Verrou contre les doubles progressions

    const renderNode = () => {
        turnProcessed = false; // ✅ Reset du verrou pour ce nouveau nœud
      const node = dialogue.nodes.find(n => n.id === currentNodeId);
      if (!node) {
        main.innerHTML = `<p style="color:red; text-align:center;">Nœud introuvable : ${currentNodeId}</p>`;
        return;
      }

              if (node.isEnd) {
          main.innerHTML = `
            <section class="live-container">
              <div class="live-header">
                <button
                  id="btn-back-dialogue"
                  class="live-quit"
                  aria-label="Retour aux dialogues"
                  style="background: transparent; font-size: 1.2rem;"
                >←</button>

                <div class="live-teacher-wrap" id="live-teacher-avatar"></div>

                <div class="live-teacher-info">
                  <div class="live-teacher-name">
                    Teacher AI <span class="live-badge">● LIVE</span>
                  </div>
                  <div class="live-dialogue-title">
                    💬 ${dialogue.titleFr}
                  </div>
                </div>
              </div>

              <div class="live-chat" style="text-align: center;">
                <div style="font-size: 5rem; margin-bottom: 1rem;">🎉</div>

                <h2 style="color: var(--ds-color-success); margin-bottom: 0.5rem;">
                  Conversation terminée !
                </h2>

                <p style="color: var(--ds-color-text); font-size: 1.1rem; margin-bottom: 0.5rem;">
                  ${personalizeText(node.textFr)}
                </p>

                <p style="color: var(--ds-color-text-muted); font-style: italic;">
                  (${personalizeText(node.textMg)})
                </p>

                <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-top: 2rem;">

                    <button
                      id="btn-back-to-themes"
                      class="live-btn primary"
                      style="width: 100%; padding: 14px;"
                    >
                      ← Retour aux thèmes de conversation
                    </button>

                  <button
                    id="btn-back-to-dialogues"
                    class="live-btn primary"
                    style="width: 100%; padding: 14px;"
                  >
                    ← Retour aux dialogues
                  </button>

                  <button
                    id="btn-retry-dialogue"
                    class="live-btn success"
                    style="width: 100%; padding: 14px;"
                  >
                    🔄 Recommencer ce dialogue
                  </button>

                  <button
                    id="btn-home"
                    class="live-btn"
                    style="width: 100%; padding: 14px; background: var(--ds-color-surface-2); color: var(--ds-color-text);"
                  >
                    🏠 Retour à l'accueil
                  </button>

                </div>
              </div>
            </section>
          `;

          // Auto-scroll
          setTimeout(() => {
            const chatContainer = document.querySelector('.live-chat');

            if (chatContainer) {
              chatContainer.scrollTop = chatContainer.scrollHeight;
            }
          }, 200);

          // Avatar
          mountLiveAvatar();
          scrollConversationToBottom();

          // Retour aux thèmes de conversation
            document
              .getElementById('btn-back-to-themes')
              .addEventListener('click', () => {
                window.pendingConversationLevel = dialogue.level || 'A0';
                router.navigate('/conversation-live');
              });


          // Retour aux dialogues
          document
            .getElementById('btn-back-to-dialogues')
            .addEventListener('click', () => {
              router.navigate('/conversation-live');
            });

          // Recommencer
          document
            .getElementById('btn-retry-dialogue')
            .addEventListener('click', () => {
              currentNodeId = dialogue.nodes[0].id;
              attempts = {};
              renderNode();
            });

          // Retour accueil
          document
            .getElementById('btn-home')
            .addEventListener('click', () => {
              router.navigate('/');
            });

          // Retour flèche
          document
            .getElementById('btn-back-dialogue')
            .addEventListener('click', () => {
              router.navigate('/conversation-live');
            });

          // Feedback avatar
          if (window.teacherAvatarSVG) {
            window.teacherAvatarSVG.setExpression('happy');
          }

          if (window.teacherAvatar) {
            window.teacherAvatar.speakFeedback(
              'Bravo ! Conversation terminée avec succès !',
              'success'
            );
          }

          return;
        }

        // =====================================================
        // NŒUD TEACHER
        // =====================================================
           if (node.speaker === 'teacher') {

        // ✅ Personnaliser les textes avec le prénom
        const personalizedTextFr = personalizeText(node.textFr);
        const personalizedTextMg = personalizeText(node.textMg);
        const personalizedTtsText = personalizeText(node.audio.ttsTextFr);

        main.innerHTML = `
          <section class="live-container">
            <div class="live-header">
              <button id="btn-back-dialogue" class="live-quit" aria-label="Retour aux dialogues" style="background: transparent; font-size: 1.2rem;">←</button>
              <div class="live-teacher-wrap" id="live-teacher-avatar"></div>
              <div class="live-teacher-info">
                <div class="live-teacher-name">Teacher AI <span class="live-badge">● LIVE</span></div>
                <div class="live-dialogue-title">💬 ${dialogue.titleFr}</div>
              </div>
              <button id="btn-quit" class="live-quit" aria-label="Quitter">✕</button>
            </div>
            <div class="live-chat">
              <div class="live-bubble teacher">
                <div class="live-bubble-text">"${personalizedTextFr}"</div>
                <div class="live-bubble-sub">(${personalizedTextMg})</div>
              </div>
              <div class="live-actions">
                <button id="btn-play" class="live-btn primary">🔊 Mihainoa</button>
              </div>
            </div>
          </section>
        `;

        mountLiveAvatar();
        scrollConversationToBottom();

        // ✅ TTS automatique au chargement du nœud
        const btn = document.getElementById('btn-play');

          // ✅ Protection contre les doubles callbacks TTS (téléphones modestes)
          let nodeTtsCompleted = false;
          // ✅ Timeout de sécurité : désactivé en mode hors-ligne (PWA gère déjà le cache)
          let safetyTimeout = null;
          if (!isOfflineMode()) {
            safetyTimeout = setTimeout(() => {
              if (!nodeTtsCompleted) {
                console.warn('[Conversation] ⚠️ TTS timeout (15s), progression forcée vers', node.nextNode);
                nodeTtsCompleted = true;
                currentNodeId = node.nextNode;
                renderNode();
              }
            }, 15000);
          } else {
            console.log('[Conversation] ℹ️ Mode hors-ligne détecté, timeout de sécurité désactivé');
          }
        btn.textContent = '🔊 ...';

        speakWithFeedback(personalizedTtsText, {
          rate: node.audio.ttsRate || 0.9,
          gender: 'female',
          onStart: () => {
            if (window.teacherAvatarSVG) {
              window.teacherAvatarSVG.startSpeaking();
            }
          },
          onEnd: () => {
            if (nodeTtsCompleted) {
              console.warn('[Conversation] ⚠️ onEnd teacher déjà appelé, ignoré');
              return;
            }
            nodeTtsCompleted = true;
            if (safetyTimeout) clearTimeout(safetyTimeout);
            console.log('[Conversation] ✅ TTS teacher terminé, progression dans 800ms vers', node.nextNode);
            btn.textContent = '🔊 Mihainoa';
            if (window.teacherAvatarSVG) {
              window.teacherAvatarSVG.stopSpeaking();
            }
            // ✅ Auto-progression après délai pédagogique
            setTimeout(() => {
              currentNodeId = node.nextNode;
              renderNode();
            }, 800);
          },
          onError: () => {
            if (nodeTtsCompleted) {
              console.warn('[Conversation] ⚠️ onError teacher déjà appelé (onEnd a gagné), ignoré');
              return;
            }
            nodeTtsCompleted = true;
            if (safetyTimeout) clearTimeout(safetyTimeout);
            console.warn('[Conversation] ⚠️ Erreur TTS teacher, progression forcée vers', node.nextNode);
            btn.textContent = '🔊 Mihainoa';
            if (window.teacherAvatarSVG) {
              window.teacherAvatarSVG.stopSpeaking();
            }
            // ✅ Auto-progression même en cas d'erreur
            setTimeout(() => {
              currentNodeId = node.nextNode;
              renderNode();
            }, 800);
          }
        });

        // ✅ Bouton Quitter
        document.getElementById('btn-quit').addEventListener('click', () => {
          if (confirm('Quitter la conversation ?')) {
            // ✅ Enregistrer l'activité Conversation Live
            try {
              recordActivity('live-conversation', dialogue.theme || 'unknown', {
                dialogue: dialogue.id,
                title: dialogue.titleFr
              });
              console.log('[Conversation] ✅ Activité enregistrée pour le thème', dialogue.theme);
            } catch (e) {
              console.warn('[Conversation] ⚠️ Erreur enregistrement activité:', e);
            }
            
            router.navigate('/conversation-live');
          }
        });

        // ✅ Bouton Retour aux dialogues
        document.getElementById('btn-back-dialogue').addEventListener('click', () => {
        // ✅ Enregistrer l'activité Conversation Live
        try {
          recordActivity('live-conversation', dialogue.theme || 'unknown', {
            dialogue: dialogue.id,
            title: dialogue.titleFr
          });
          console.log('[Conversation] ✅ Activité enregistrée (retour) pour le thème', dialogue.theme);
        } catch (e) {
          console.warn('[Conversation] ⚠️ Erreur enregistrement activité:', e);
        }
        
          router.navigate('/conversation-live');
        });



      } else if (node.speaker === 'user') {
  if (!attempts[node.id]) attempts[node.id] = 0;

  // ✅ Personnaliser les feedbacks
  const successFeedbackFr = personalizeText(node.feedbackOnSuccess?.textFr || '');
  const successFeedbackMg = personalizeText(node.feedbackOnSuccess?.textMg || '');
  const successTtsText = personalizeText(node.feedbackOnSuccess?.audio?.ttsTextFr || '');

  const failFeedbackFr = personalizeText(node.feedbackOnFail?.textFr || '');
  const failFeedbackMg = personalizeText(node.feedbackOnFail?.textMg || '');
  const failTtsText = personalizeText(node.feedbackOnFail?.audio?.ttsTextFr || '');

  // ✅ Personnaliser les options de réponse
  const personalizedOptions = node.responseOptions.map(opt => ({
    ...opt,
    textFr: personalizeText(opt.textFr),
    textMg: personalizeText(opt.textMg)
  }));

  main.innerHTML = `
    <section class="live-container">
      <!-- ... header ... -->
      <div class="live-chat">
          <div class="live-options">
            ${personalizedOptions.map((opt, idx) => `
              <div style="display: flex; gap: 0.5rem; align-items: stretch; margin-bottom: 0.5rem;">
                <button class="live-option-btn btn-option" data-idx="${idx}" style="flex: 1;">
                  <div style="font-weight: 600;">${idx === 0 ? '🅰️' : idx === 1 ? '🅱️' : '🅲'} ${opt.textFr}</div>
                  <div style="font-size: 0.85rem; opacity: 0.7; font-style: italic;">(${opt.textMg})</div>
                </button>
                ${window.sttAvailable ? `
                  <button class="btn-microphone" data-idx="${idx}" data-expected="${opt.textFr}" style="background: var(--ds-color-primary); color: white; border: none; padding: 0.75rem 1rem; border-radius: 12px; font-size: 1.5rem; cursor: pointer; transition: transform 0.2s;">🎤</button>
                ` : `
                  <button class="btn-auto-eval" data-idx="${idx}" style="background: var(--ds-color-accent); color: white; border: none; padding: 0.75rem 1rem; border-radius: 12px; font-size: 1.5rem; cursor: pointer; transition: transform 0.2s;">✓</button>
                `}
              </div>
            `).join('')}
                      </div>
            <div id="feedback" style="margin-top: 0.5rem;"></div>
        </div>
      </section>
  `;
                mountLiveAvatar();

        // ✅ AJOUTER CETTE LIGNE
        const feedback = document.getElementById('feedback');

        // ✅ Event listeners pour les boutons de réponse (clic)
        document.querySelectorAll('.btn-option').forEach(btn => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            handleUserResponse(idx, node, attempts, feedback);
          });
        });

        // ✅ Event listeners pour les boutons microphone (STT)
        if (sttAvailable) {
          document.querySelectorAll('.btn-microphone').forEach(btn => {
            btn.addEventListener('click', () => {
              const idx = parseInt(btn.dataset.idx);
              const expected = btn.dataset.expected;
              handleSTTResponse(btn, idx, expected, node, attempts, feedback);
            });
          });
        } else {
          // ✅ Event listeners pour auto-évaluation (appareils low-end)
          document.querySelectorAll('.btn-auto-eval').forEach(btn => {
            btn.addEventListener('click', () => {
              const idx = parseInt(btn.dataset.idx);
              // Auto-évaluation : considérer comme correct si l'utilisateur confirme
              handleUserResponse(idx, node, attempts, feedback, true);
            });
          });
        }

        // ✅ Fonction pour gérer la réponse utilisateur (clic ou STT)
        function handleUserResponse(idx, node, attempts, feedback, isAutoEval = false) {
            // ✅ Protection contre les doubles progressions (clic + micro)
            if (turnProcessed) {
              console.warn('[Conversation] ⚠️ handleUserResponse ignoré (tour déjà traité)');
              return;
            }
            turnProcessed = true;
            
            let ttsCompleted = false; // ✅ Protection contre les doubles callbacks
            const currentFeedback = document.getElementById('feedback');
            const selected = node.responseOptions[idx];
            attempts[node.id]++;

            // ✅ Récupérer le bouton correspondant
            const clickedBtn = document.querySelector(`.btn-option[data-idx="${idx}"]`);

            // Désactiver tous les boutons
            document.querySelectorAll('.btn-option, .btn-microphone, .btn-auto-eval').forEach(b => b.disabled = true);

            // ✅ Dans la gestion du succès, utiliser les textes personnalisés
                      if (selected.isCorrect) {
          if (clickedBtn) clickedBtn.style.borderColor = 'var(--ds-color-success)';

          currentFeedback.innerHTML = `
           <div class="feedback-success" style="background: var(--ds-color-success-soft, #d1fae5); padding: 1rem; border-radius: 12px; border-left: 4px solid var(--ds-color-success);">
              <div style="font-size: 2rem;">✅</div>
              <p style="color: var(--ds-color-success); font-weight: 600;">${successFeedbackFr}</p>
              ${isAutoEval ? '<p style="color: var(--ds-color-text-muted); font-size: 0.85rem;">(Auto-évaluation)</p>' : ''}
              <p style="color: var(--ds-color-text-muted); font-style: italic; font-size: 0.9rem;">(${successFeedbackMg})</p>
            </div>
          `;

            // ✅ TTS du feedback (utilise speakWithFeedback pour respecter le genre)
            // ✅ Timeout de sécurité pour le feedback succès (désactivé en offline)
            let successSafetyTimeout = null;
            if (!isOfflineMode()) {
              successSafetyTimeout = setTimeout(() => {
                if (!ttsCompleted) {
                  console.warn('[Conversation] ⚠️ TTS success timeout (15s), progression forcée');
                  ttsCompleted = true;
                  currentNodeId = node.nextNodeOnSuccess;
                  renderNode();
                }
              }, 15000);
            }

            speakWithFeedback(successTtsText, {
              rate: 0.9,
              gender: 'female', // Teacher Avatar
              onStart: () => {
                if (window.teacherAvatarSVG) {
                  window.teacherAvatarSVG.startSpeaking();
                  window.teacherAvatarSVG.setExpression('happy');
                }
              },
              onEnd: () => {
                if (ttsCompleted) {
                  console.warn('[Conversation] ⚠️ onEnd déjà appelé, ignoré');
                  return;
                }
                ttsCompleted = true;
                if (successSafetyTimeout) clearTimeout(successSafetyTimeout);
                console.log('[Conversation] ✅ Feedback TTS terminé, progression dans 800ms');
                if (window.teacherAvatarSVG) {
                  window.teacherAvatarSVG.stopSpeaking();
                  window.teacherAvatarSVG.setExpression('neutral');
                }
                // ✅ Auto-progression après délai pédagogique
                setTimeout(() => {
                  currentNodeId = node.nextNodeOnSuccess;
                  renderNode();
                }, 800);
              },
              onError: (error) => {
                if (ttsCompleted) {
                  console.warn('[Conversation] ⚠️ onError success ignoré (onEnd a gagné)');
                  return;
                }
                ttsCompleted = true;
                if (successSafetyTimeout) clearTimeout(successSafetyTimeout);
                console.error('[Conversation] ❌ Erreur TTS feedback succès:', error?.message || 'unknown');
                if (window.teacherAvatarSVG) {
                  window.teacherAvatarSVG.stopSpeaking();
                  window.teacherAvatarSVG.setExpression('neutral');
                }
                // ✅ Progression même en cas d'erreur (ne pas bloquer l'utilisateur)
                setTimeout(() => {
                  currentNodeId = node.nextNodeOnSuccess;
                  renderNode();
                }, 500);
              }
            });

          scrollConversationToBottom();

            } else {
              if (clickedBtn) clickedBtn.style.borderColor = 'var(--ds-color-danger, #ef4444)';

              if (attempts[node.id] >= node.maxAttempts) {
                const correct = node.responseOptions.find(o => o.isCorrect);
                currentFeedback.innerHTML = `
                  <div style="background: #fef3c7; padding: 1rem; border-radius: 12px; border-left: 4px solid var(--ds-color-accent);">
                    <div style="font-size: 2rem;">💡</div>
                    <p>La bonne réponse était : <strong>${correct.textFr}</strong></p>
                  </div>
                  <button id="btn-continue" class="pulse-animation" style="margin-top: 1rem; background: var(--ds-color-accent); color: white; border: none; padding: 12px 24px; border-radius: 12px; font-weight: 600; cursor: pointer; width: 100%;">Manaraka →</button>
                `;
                document.getElementById('btn-continue').addEventListener('click', () => {
                  turnProcessed = false; // ✅ Reset du verrou
                  currentNodeId = node.nextNodeOnMaxAttemptsReached;
                  renderNode();
                });

              } else {
                currentFeedback.innerHTML = `
                 <div class="feedback-fail" style="background: #fee2e2; padding: 1rem; border-radius: 12px; border-left: 4px solid var(--ds-color-danger, #ef4444);">
                    <div style="font-size: 2rem;">🔄</div>

                    <p style="color: var(--ds-color-danger); font-weight: 600;">${failFeedbackFr}</p>
                    <p style="color: var(--ds-color-text-muted); font-style: italic; font-size: 0.9rem;">(${failFeedbackMg})</p>
                  </div>
                  <button id="btn-retry" class="pulse-animation" style="margin-top: 1rem; background: var(--ds-color-accent); color: white; border: none; padding: 12px 24px; border-radius: 12px; font-weight: 600; cursor: pointer; width: 100%;" disabled>🔁 Réessayer</button>
                `;
                  // ✅ TTS du feedback d'échec
                    // ✅ TTS du feedback d'échec (utilise speakWithFeedback pour respecter le genre)
                    speakWithFeedback(failTtsText, {
                      rate: node.feedbackOnFail?.audio?.ttsRate || 0.9,
                      gender: 'female', // Teacher Avatar
                      onStart: () => {
                        if (window.teacherAvatarSVG) {
                          window.teacherAvatarSVG.startSpeaking();
                        }
                      },
                      onEnd: () => {
                        console.log('[Conversation] ✅ TTS feedback échec terminé');
                        if (window.teacherAvatarSVG) {
                          window.teacherAvatarSVG.stopSpeaking();
                          // ✅ Réactiver le bouton Réessayer après TTS
                          const retryBtn = document.getElementById('btn-retry');
                          if (retryBtn) {
                            retryBtn.disabled = false;
                            console.log('[Conversation] 🔓 Bouton Réessayer activé');
                          }
                        }
                      },
                      onError: (error) => {
                        console.warn('[Conversation] ⚠️ Erreur TTS feedback échec:', error?.message || 'unknown');
                        if (window.teacherAvatarSVG) {
                          window.teacherAvatarSVG.stopSpeaking();
                          // ✅ Réactiver le bouton Réessayer même en cas d'erreur
                          const retryBtn = document.getElementById('btn-retry');
                          if (retryBtn) {
                            retryBtn.disabled = false;
                            console.log('[Conversation] 🔓 Bouton Réessayer activé (après erreur)');
                          }
                        }
                      }
                    });

                if (window.teacherAvatarSVG) {
                  window.teacherAvatarSVG.setExpression('encouraging');
                }
                document.getElementById('btn-retry').addEventListener('click', () => {
                    turnProcessed = false; // ✅ Reset du verrou pour réessayer
                    renderNode();
                  });
              }
            }
          }

          // Ajout messge pédagogique

// ═══════════════════════════════════════════════════════════
// V5.2 : Capturer les réponses utilisateur dans le contexte
// ═══════════════════════════════════════════════════════════
function captureUserResponse(nodeId, selectedOption) {
  if (!window.conversationContext || !selectedOption) return;
  
  // Mapping nodeId → {slot, extractor}
  const captureRules = {
    'user_origin': {
      slot: 'origin',
      extract: (text) => {
        const match = text.match(/(?:de|d'|à|en)\s+([A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][a-zà-ü]+)*)/);
        return match ? match[1] : text.replace(/^(?:je viens|j'habite|j'habite à|je suis de)\s+/i, '').trim();
      }
    },
    'user_feeling': {
      slot: 'feeling',
      extract: (text) => text.replace(/\s*(?:merci|et vous\s*\?)\.?$/i, '').trim()
    },
    'user_father': {
      slot: 'fatherName',
      extract: (text) => {
        const match = text.match(/(?:s'appelle|est|c'est)\s+([A-ZÀ-Ü][a-zà-ü]+)/);
        return match ? match[1] : null;
      }
    },
    'user_mother': {
      slot: 'motherName',
      extract: (text) => {
        const match = text.match(/(?:s'appelle|est|c'est)\s+([A-ZÀ-Ü][a-zà-ü]+)/);
        return match ? match[1] : null;
      }
    },
    'user_siblings': {
      slot: 'siblings',
      extract: (text) => text.replace(/^(?:oui|non|j'ai)\s*/i, '').trim()
    },
    'user_name': {
      slot: 'firstName',
      extract: (text) => {
        const match = text.match(/(?:je suis|je m'appelle|m'appelle)\s+([A-ZÀ-Ü][a-zà-ü]+)/);
        return match ? match[1] : null;
      }
    },
    'user_age': {
      slot: 'age',
      extract: (text) => {
        const match = text.match(/(\d+)\s*(?:ans?|années?)/);
        return match ? match[1] : null;
      }
    },
    'user_profession': {
      slot: 'profession',
      extract: (text) => {
        const match = text.match(/(?:je suis|suis)\s+(?:un|une)?\s*([a-zà-ü]+(?:\s+[a-zà-ü]+)*)/i);
        return match ? match[1] : null;
      }
    }
  };
  
  const rule = captureRules[nodeId];
  if (!rule) return;
  
  const text = selectedOption.textFr || '';
  const value = rule.extract(text);
  
  if (value) {
    window.conversationContext.setUserSlot(rule.slot, value);
    console.log(`[V5.2] 💾 Capturé: ${rule.slot} = "${value}" (depuis ${nodeId})`);
  }
}

                function handleSTTResponse(btn, idx, expected, node, attempts, feedback) {
    // ✅ V4 : Variations de feedback pour éviter la répétition
    const successVariations = [
      "Très bien !",
      "Exact !",
      "Parfait !",
      "Bravo !",
      "Oui, c'est ça !"
    ];
    
    const failVariations = [
      "Pas tout à fait.",
      "Presque !",
      "Essayez encore.",
      "Ce n'est pas exactement ça."
    ];
              const currentFeedback = document.getElementById('feedback');
              
              // ✅ Toujours récupérer le bouton frais depuis le DOM
              const freshBtn = document.querySelector(`.btn-microphone[data-idx="${idx}"]`) || btn;
              
              freshBtn.textContent = '🎤 Écoute...';
              freshBtn.disabled = true;

              const expectedFrench = expected;
              const isSimulation = sttManager.isSimulationMode();
              
              // ✅ TIMEOUT DE RÉCUPÉRATION UX (6 secondes)
              let sttTimeoutId = null;
              const STT_TIMEOUT_MS = 12000; // ✅ 12s pour apprenants débutants
              
              const activateTimeout = () => {
                sttTimeoutId = setTimeout(() => {
                  console.log('[STT] ⏰ Timeout UX - utilisateur n\'a pas répondu');
                  
                  // Annuler l'écoute en cours si possible
                  if (sttManager.stopListening) {
                    sttManager.stopListening();
                  }
                  
                  // Réactiver le bouton
                  const timeoutBtn = document.querySelector(`.btn-microphone[data-idx="${idx}"]`);
                  if (timeoutBtn) {
                    timeoutBtn.textContent = '🎤 Parler maintenant';
                    timeoutBtn.disabled = false;
                    timeoutBtn.style.opacity = '1';
                    timeoutBtn.style.cursor = 'pointer';
                  }
                  
                  // Afficher le message de récupération
                  if (currentFeedback) {
                    currentFeedback.innerHTML = `
                      <div style="background: var(--ds-color-primary-soft, #e0f2fe); padding: 1rem; border-radius: 12px; border-left: 4px solid var(--ds-color-primary);">
                        <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">💡</div>
                        <p style="color: var(--ds-color-primary); font-weight: 600;">Prenez votre temps</p>
                        <p style="color: var(--ds-color-text-muted); font-size: 0.9rem;">
                          Cliquez sur le bouton pour réessayer, ou choisissez une autre option.
                        </p>
                      </div>
                    `;
                  }
                }, STT_TIMEOUT_MS);
              };
              
              const cancelTimeout = () => {
                if (sttTimeoutId) {
                  clearTimeout(sttTimeoutId);
                  sttTimeoutId = null;
                }
              };
              
              // ✅ Timeout maintenant démarré dans onStart (après acquisition micro)
              // activateTimeout(); // Retiré d'ici

                  // ✅ MODE SIMULATION PÉDAGOGIQUE (hors-ligne)
                                        // ✅ MODE SIMULATION PÉDAGOGIQUE (hors-ligne)
                    if (isSimulation) {
                      btn.textContent = '🎙️ Écoute en cours...';
                      
                      sttManager.startListening('fr-FR', {
                        onStart: () => {
                          console.log('[STT] 🎭 Écoute simulation démarrée');
                          // ✅ Démarrer le timeout APRÈS acquisition du micro
                          activateTimeout();
                        },
                          onSpeechStart: () => {
                            console.log('[STT] 🎤 Parole détectée, annulation du timeout UX');
                            cancelTimeout(); // ✅ Annuler le timeout dès que l'utilisateur commence à parler
                          },
                                                  onResult: (result) => {
                            cancelTimeout(); // ✅ Annuler le timeout
                            console.log('[STT] 🎭 Résultat simulation:', result);
                            
                            if (currentFeedback) {
                              currentFeedback.innerHTML = `
                                <div style="background: var(--ds-color-primary-soft, #e0f2fe); padding: 1rem; border-radius: 12px; border-left: 4px solid var(--ds-color-primary);">
                                  <div style="font-size: 2rem;">✅</div>
                                  <p style="color: var(--ds-color-primary); font-weight: 600;">📶 Réponse reçue</p>
                                  <p style="color: var(--ds-color-text-muted); font-style: italic; font-size: 0.9rem;">Tsara be ! Mitohy ny fianarana.</p>
                                </div>
                              `;
                            }
                            
                            const freshBtn = document.querySelector(`.btn-microphone[data-idx="${idx}"]`) || btn;
                            freshBtn.textContent = '✅ Terminé';
                            freshBtn.disabled = true;
                            
                            // ✅ Progression UNIQUE : feedback → TTS → nextNode
                            // (supprime le double traitement setTimeout 1500 + handleUserResponse)
                              // ✅ LOGIQUE PÉDAGOGIQUE : déterminer bonne/mauvaise réponse
                              // Simulation : 1ère tentative = incorrecte (pédagogique), 2ème = correcte
                              if (!attempts[node.id]) attempts[node.id] = 0;
                              attempts[node.id]++;
                              
                              // ✅ VRAIE détection : basée sur la réponse sélectionnée (pas simulation forcée)
                              const selected = node.responseOptions?.[idx];
                              const isIncorrect = selected?.isCorrect !== true;
                              
                              if (isIncorrect) {
                                // ❌ MAUVAISE RÉPONSE : feedbackOnFail + rester sur même node
                                // ✅ V5.5: Vérifier si réponse conversationnellement acceptable
                                const selectedOption = node.responseOptions?.[idx];
                                const continueConversation = selectedOption?.continueConversation || false;
                                const responseType = selectedOption?.responseType || 'unknown';
                                const conversationReaction = selectedOption?.conversationReaction || 'correction';
                                
                                if (continueConversation && !selectedOption?.isCorrect) {
                                  // Réponse conversationnellement cohérente (isCorrect = false mais acceptable)
                                  console.log(`[STT] 💬 Réponse conversationnelle: type=${responseType}, reaction=${conversationReaction}`);
                                  
                                  const convFeedback = node.conversationFeedback?.[conversationReaction];
                                  const feedbackFr = convFeedback?.textFr || 'Je comprends.';
                                  const feedbackMg = convFeedback?.textMg || '';
                                  
                                  if (currentFeedback) {
                                    currentFeedback.innerHTML = `
                                      <div style="background: #dbeafe; padding: 1rem; border-radius: 12px; border-left: 4px solid #3b82f6;">
                                        <div style="font-size: 2rem;">💬</div>
                                        <p style="color: #1e40af; font-weight: 600;">${feedbackFr}</p>
                                        ${feedbackMg ? `<p style="color: var(--ds-color-text-muted); font-style: italic; font-size: 0.9rem;">(${feedbackMg})</p>` : ''}
                                      </div>
                                    `;
                                  }
                                  
                                  speakWithFeedback(feedbackFr, {
                                    rate: 0.9,
                                    gender: 'female',
                                    onStart: () => {
                                      if (window.teacherAvatarSVG) {
                                        window.teacherAvatarSVG.startSpeaking();
                                      }
                                    },
                                    onEnd: () => {
                                      console.log('[STT] ✅ Feedback conversationnel terminé');
                                      if (window.teacherAvatarSVG) {
                                        window.teacherAvatarSVG.stopSpeaking();
                                      }
                                      // Progresser vers le prochain nœud (comme une bonne réponse)
                                      // ✅ V5.8: Utiliser nextNodeOnConversation si défini
                                      currentNodeId = selectedOption?.nextNodeOnConversation || node.nextNodeOnSuccess || node.nextNode;
                                      setTimeout(() => {
                                        if (conversationLiveInstanceId !== conversationLiveInstanceId) {
                                          console.log('[ConversationLive] ⏭️ Callback obsolète ignoré');
                                          return;
                                        }
                                        renderNode();
                                      }, 800);
                                    }
                                  });
                                  
                                  return;
                                }
                                
                                console.log('[STT] ❌ Mauvaise réponse, tentative', attempts[node.id]);
                                
                                const defaultFailFeedback = failVariations[Math.floor(Math.random() * failVariations.length)];
                                const failFeedbackFr = personalizeText(node.feedbackOnFail?.textFr || defaultFailFeedback);
                                const failFeedbackMg = personalizeText(node.feedbackOnFail?.textMg || '');
                                const failTtsText = personalizeText(node.feedbackOnFail?.audio?.ttsTextFr || failFeedbackFr);
                                
                                if (currentFeedback) {
                                  currentFeedback.innerHTML = `
                                    <div class="feedback-fail" style="background: #fee2e2; padding: 1rem; border-radius: 12px; border-left: 4px solid var(--ds-color-danger);">
                                      <div style="font-size: 2rem;">🔄</div>
                                      <p style="color: var(--ds-color-danger); font-weight: 600;">${failFeedbackFr}</p>
                                      <p style="color: var(--ds-color-text-muted); font-style: italic; font-size: 0.9rem;">(${failFeedbackMg})</p>
                                    </div>
                                    <button id="btn-retry" class="pulse-animation" style="margin-top: 1rem; background: var(--ds-color-accent); color: white; border: none; padding: 12px 24px; border-radius: 12px; font-weight: 600; cursor: pointer; width: 100%;" disabled>🔁 Réessayer</button>
                                  `;
                                  // ✅ Désactiver les boutons de réponse pour forcer l'utilisation de Réessayer
                                  document.querySelectorAll('.btn-option, .btn-microphone, .btn-auto-eval').forEach(b => b.disabled = true);
                                }
                                
                                // TTS du feedback d'échec
                                speakWithFeedback(failTtsText, {
                                  rate: node.feedbackOnFail?.audio?.ttsRate || 0.9,
                                  gender: 'female',
                                  onStart: () => {
                                    if (window.teacherAvatarSVG) window.teacherAvatarSVG.startSpeaking();
                                  },
                                  onEnd: () => {
                                    console.log('[STT] ✅ TTS feedback échec terminé');
                                    if (window.teacherAvatarSVG) window.teacherAvatarSVG.stopSpeaking();
                                    // Réactiver le bouton Réessayer
                                    const retryBtn = document.getElementById('btn-retry');
                                    if (retryBtn) {
                                      retryBtn.disabled = false;
                                      console.log('[STT] 🔓 Bouton Réessayer activé');
                                    }
                                    // NE PAS progresser : rester sur même node
                                    turnProcessed = false; // Permettre nouvelle tentative
                                  },
                                  onError: () => {
                                    if (window.teacherAvatarSVG) window.teacherAvatarSVG.stopSpeaking();
                                    const retryBtn = document.getElementById('btn-retry');
                                    if (retryBtn) retryBtn.disabled = false;
                                    turnProcessed = false;
                                  }
                                });
                                
                                // Ajouter event listener au bouton Réessayer
                                setTimeout(() => {
                                  const retryBtn = document.getElementById('btn-retry');
                                  if (retryBtn) {
                                    retryBtn.addEventListener('click', () => {
                                      turnProcessed = false;
                                      renderNode(); // Reste sur même node
                                    });
                                  }
                                }, 100);
                                
                              } else {
                                // ✅ BONNE RÉPONSE : feedbackOnSuccess + progression
                                console.log('[STT] ✅ Bonne réponse, tentative', attempts[node.id]);
                                
                                // ✅ V5.2 : Capturer la réponse dans le contexte
                                const selectedOption = node.responseOptions?.[idx];
                                captureUserResponse(node.id, selectedOption);
                                
                                const defaultSuccessFeedback = successVariations[Math.floor(Math.random() * successVariations.length)];
                                const successFeedbackFr = personalizeText(node.feedbackOnSuccess?.textFr || defaultSuccessFeedback);
                                const successTtsText = personalizeText(node.feedbackOnSuccess?.audio?.ttsTextFr || successFeedbackFr);
                                const successFeedbackMg = personalizeText(node.feedbackOnSuccess?.textMg || '');
                                
                                if (currentFeedback) {
                                  currentFeedback.innerHTML = `
                                    <div style="background: #d1fae5; padding: 1rem; border-radius: 12px; border-left: 4px solid var(--ds-color-success);">
                                      <div style="font-size: 2rem;">✅</div>
                                      <p style="color: var(--ds-color-success); font-weight: 600;">${successFeedbackFr}</p>
                                        ${successFeedbackMg ? `<p style="color: var(--ds-color-text-muted); font-style: italic; font-size: 0.9rem;">(${successFeedbackMg})</p>` : ''}
                                    </div>
                                  `;
                                }
                                
                                speakWithFeedback(successTtsText, {
                                  rate: node.feedbackOnSuccess?.audio?.ttsRate || 0.9,
                                  gender: 'female',
                                  onStart: () => {
                                    if (window.teacherAvatarSVG) {
                                      window.teacherAvatarSVG.startSpeaking();
                                      window.teacherAvatarSVG.setExpression('happy');
                                    }
                                  },
                                  onEnd: () => {
                                    if (window.teacherAvatarSVG) window.teacherAvatarSVG.stopSpeaking();
                                    console.log('[STT] ✅ TTS feedback succès terminé, progression vers', node.nextNodeOnSuccess);
                                    currentNodeId = node.nextNodeOnSuccess;
                                    setTimeout(() => {
                                      if (conversationLiveInstanceId !== conversationLiveInstanceId) {
                                        console.log('[ConversationLive] ⏭️ Callback obsolète ignoré');
                                        return;
                                      }
                                      renderNode();
                                    }, 300);
                                  },
                                  onError: () => {
                                    if (window.teacherAvatarSVG) window.teacherAvatarSVG.stopSpeaking();
                                    console.warn('[STT] ⚠️ Erreur TTS, progression quand même vers', node.nextNodeOnSuccess);
                                    currentNodeId = node.nextNodeOnSuccess;
                                    setTimeout(() => {
                                      if (conversationLiveInstanceId !== conversationLiveInstanceId) {
                                        console.log('[ConversationLive] ⏭️ Callback obsolète ignoré');
                                        return;
                                      }
                                      renderNode();
                                    }, 300);
                                  }
                                });
                              }


                          },

                                                  onError: (error) => {
                          cancelTimeout(); // ✅ Annuler le timeout
                          console.error('[STT] 🎭 Erreur simulation:', error);
                          
                          // ✅ Réactiver le bouton
                          const micBtn = document.querySelector(`.btn-microphone[data-idx="${idx}"]`);
                          if (micBtn) {
                            micBtn.textContent = '🎤 Parler maintenant';
                            micBtn.disabled = false;
                            micBtn.style.opacity = '1';
                            micBtn.style.cursor = 'pointer';
                          }
                          
                          if (error === 'no-speech') {
                            if (currentFeedback) {
                              currentFeedback.innerHTML = `
                                <div style="background: #fef3c7; padding: 1rem; border-radius: 12px; border-left: 4px solid var(--ds-color-accent);">
                                  <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">🎤</div>
                                  <p style="color: var(--ds-color-accent); font-weight: 600;">Aucune parole détectée</p>
                                  <p style="color: var(--ds-color-text-muted); font-size: 0.9rem;">
                                    Cliquez sur le bouton pour réessayer, ou choisissez une autre option.
                                  </p>
                                </div>
                              `;
                            }
                          } else {
                            if (currentFeedback) {
                              currentFeedback.innerHTML = `
                                <div style="background: #fef3c7; padding: 1rem; border-radius: 12px; border-left: 4px solid var(--ds-color-accent);">
                                  <p>⚠️ Erreur : ${error}</p>
                                </div>
                              `;
                            }
                          }
                        }
                      });
                      
                      return;
                    }
              sttManager.startListening('fr-FR', {
                onStart: () => {
                  console.log('[STT] Écoute démarrée');
                },
                onResult: (result) => {
                  const recognized = result?.transcript || result?.text || '';
                  console.log('[STT DEBUG] Objet brut reçu:', result);
                  console.log('[STT DEBUG] Transcript extrait:', recognized);
                  console.log('[STT] Reconnu:', recognized);

                  const comparison = sttManager.compareTexts(recognized, expectedFrench);
                  console.log('[STT] Comparaison:', comparison);

                  if (comparison.isCorrect) {
                    // ✅ Message pédagogique si simulation
                    if (comparison.isSimulation) {
                      currentFeedback.innerHTML = `
                        <div style="background: linear-gradient(135deg, #e0f2fe, #dbeafe); padding: 1rem; border-radius: 12px; border-left: 4px solid var(--ds-color-primary);">
                          <div style="font-size: 2rem;">📶</div>
                          <p style="color: var(--ds-color-primary); font-weight: 600; margin-bottom: 0.5rem;">
                            Mode hors-ligne - Continuez à pratiquer !
                          </p>
                          <p style="color: var(--ds-color-text-muted); font-size: 0.85rem; margin-bottom: 1rem;">
                            💡 Connectez-vous pour une évaluation précise de votre prononciation.
                          </p>
                          <button id="btn-continue" style="background: var(--ds-color-primary); color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; width: 100%;">
                            Manaraka →
                          </button>
                        </div>
                      `;

                      document.getElementById('btn-continue').addEventListener('click', () => {
                        currentNodeId = node.nextNodeOnSuccess;
                        renderNode();
                      });
                    } else {
                      // Mode réel : feedback normal
                      handleUserResponse(idx, node, attempts, feedback);
                    }
                  } else {
                    currentFeedback.innerHTML = `
                      <div style="background: #fef3c7; padding: 1rem; border-radius: 12px; border-left: 4px solid var(--ds-color-accent);">
                        <div style="font-size: 2rem;">🎤</div>
                        <p>J'ai entendu : <strong>${recognized}</strong></p>
                        <p>Score : ${comparison.score}% - ${comparison.feedback}</p>
                      </div>
                      <button id="btn-retry-stt" style="margin-top: 1rem; background: var(--ds-color-accent); color: white; border: none; padding: 12px 24px; border-radius: 12px; font-weight: 600; cursor: pointer; width: 100%;">🔁 Réessayer</button>
                    `;

                    document.getElementById('btn-retry-stt').addEventListener('click', () => {
                      renderNode();
                    });
                  }
                },
                onEnd: () => {
                  console.log('[STT] Écoute terminée');
                },
                onError: (error) => {
                  console.error('[STT] Erreur:', error);
                                              // ✅ Réactiver le bouton frais pour que l'utilisateur puisse réessayer
                            const freshBtn = document.querySelector(`.btn-microphone[data-idx="${idx}"]`);
                            if (freshBtn) {
                              freshBtn.textContent = '🎤 Prononcer cette réponse';
                              freshBtn.disabled = false;
                              freshBtn.style.opacity = '1';
                              freshBtn.style.pointerEvents = 'auto';
                              freshBtn.style.cursor = 'pointer';
                              console.log('[STT] ✅ Bouton frais réactivé pour idx:', idx);
                            } else {
                              console.error('[STT] ❌ Bouton non trouvé pour idx:', idx);
                            }

                  currentFeedback.innerHTML = `
                    <div style="background: #fee2e2; padding: 1rem; border-radius: 12px; border-left: 4px solid var(--ds-color-danger);">
                      <div style="font-size: 2rem;">⚠️</div>
                      <p>Erreur de reconnaissance vocale. Utilisez le bouton ci-dessus.</p>
                    </div>
                  `;
                }
              });
          }
      }
          }


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
router.addRoute('/roleplay-v2', renderRolePlayV2);  // ✅ Test V2 en parallèle
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

    // ✅ V5.13: Ne plus forcer '/' - laisser le routeur utiliser le hash actuel

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