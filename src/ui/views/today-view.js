// V5.109: Fonction globale pour demarrer une etape
window.startStep = function(themeId, route) {
  if (themeId) {
    localStorage.setItem('dagospeak:theme', themeId);
    console.log('[Today] Theme defini:', themeId);
  }
  console.log('[Today] Navigation vers:', route);
  router.navigate(route);
};

/**
 * DagoSpeak V5.109 - Ecran "Aujourd'hui"
 */

export function renderToday() {
  const main = document.getElementById('app');
  const todayData = calculateTodayActions();

  main.innerHTML = `
    <div style="max-width: 700px; margin: 0 auto; padding: 1rem;">
      <div style="background: linear-gradient(135deg, var(--ds-color-primary) 0%, var(--ds-color-accent) 100%); color: white; padding: 1.5rem; border-radius: var(--ds-radius-lg); margin-bottom: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h1 style="margin: 0; font-size: 1.8rem;">Jour ${todayData.dayNumber}</h1>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <span style="font-size: 1.5rem;">🔥</span>
            <span style="font-size: 1.5rem; font-weight: bold;">${todayData.streak}</span>
          </div>
        </div>
        <div style="margin-top: 1rem;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.9rem;">
            <span>Progression A0 - A1</span>
            <span>${todayData.themesCompleted}/25 themes</span>
          </div>
          <div style="background: rgba(255,255,255,0.3); height: 8px; border-radius: 4px; overflow: hidden;">
            <div style="background: white; height: 100%; width: ${todayData.progressionPercent}%; transition: width 0.5s ease;"></div>
          </div>
        </div>
        ${todayData.examEligible ? '<div style="margin-top: 1rem; padding: 0.75rem; background: rgba(255,255,255,0.2); border-radius: var(--ds-radius-md); text-align: center; cursor: pointer;" onclick="router.navigate(\'/exam\')">🎓 Examen A0 - A1 disponible !</div>' : ''}
      </div>
      <div>${todayData.actions.map(function(action) { return '<div style="background: var(--ds-color-surface); border: 2px solid ' + (action.isPriority ? 'var(--ds-color-accent)' : 'var(--ds-color-border)') + '; border-radius: var(--ds-radius-lg); padding: 1.5rem; margin-bottom: 1rem; cursor: pointer; position: relative;" onclick="' + action.onclick + '">' + (action.isPriority ? '<div style="position: absolute; top: -10px; right: 1rem; background: var(--ds-color-accent); color: white; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem; font-weight: bold;">Priorite</div>' : '') + '<div style="display: flex; align-items: flex-start; gap: 1rem;"><div style="font-size: 2.5rem;">' + action.icon + '</div><div style="flex: 1;"><div style="font-size: 0.85rem; color: var(--ds-color-text-muted); margin-bottom: 0.25rem;">' + action.step + '</div><h3 style="margin: 0 0 0.5rem 0; font-size: 1.2rem;">' + action.title + '</h3><p style="margin: 0 0 1rem 0; font-size: 0.9rem; color: var(--ds-color-text-muted);">' + action.description + '</p><button style="background: ' + (action.isPriority ? 'var(--ds-color-accent)' : 'var(--ds-color-primary)') + '; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: var(--ds-radius-md); font-weight: bold; cursor: pointer; width: 100%;">' + action.buttonText + '</button></div></div></div>'; }).join('')}</div>
      <div style="margin-top: 2rem; padding: 1rem; background: var(--ds-color-surface-2); border-radius: var(--ds-radius-md);">
        <h4 style="margin: 0 0 1rem 0; font-size: 0.9rem; color: var(--ds-color-text-muted);">Outils disponibles</h4>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button onclick="router.navigate('/dictionary')" style="background: var(--ds-color-surface); border: 1px solid var(--ds-color-border); padding: 0.5rem 1rem; border-radius: var(--ds-radius-md); cursor: pointer;">📖 Dictionnaire</button>
          <button onclick="router.navigate('/profile')" style="background: var(--ds-color-surface); border: 1px solid var(--ds-color-border); padding: 0.5rem 1rem; border-radius: var(--ds-radius-md); cursor: pointer;">📊 Mon profil</button>
          <button onclick="router.navigate('/themes')" style="background: var(--ds-color-surface); border: 1px solid var(--ds-color-border); padding: 0.5rem 1rem; border-radius: var(--ds-radius-md); cursor: pointer;">🎯 Tous les themes</button>
        </div>
      </div>
    </div>
  `;

  if (typeof logger !== 'undefined') {
    logger.info('[Today] Ecran affiche - Jour ' + todayData.dayNumber);
  }
}

function calculateTodayActions() {
  var journeys = {};
  try { if (typeof journeyTracker !== 'undefined') journeys = journeyTracker.getCompletedJourneys() || {}; } catch(e) {}
  var profile = {};
  try { if (typeof getProfileData !== 'undefined') profile = getProfileData() || {}; } catch(e) {}

  var firstLaunch = localStorage.getItem('dagospeak:firstLaunch') || new Date().toISOString();
  var dayNumber = Math.floor((Date.now() - new Date(firstLaunch).getTime()) / 86400000) + 1;

  var srsDueCount = 0;
  try {
    if (typeof spacedRepetition !== 'undefined') {
      var due = spacedRepetition.getDueReviews();
      srsDueCount = due ? due.length : 0;
    }
  } catch(e) {}

  var allDone = new Set();
  (journeys.lessons || []).forEach(function(x) { allDone.add(x); });
  (journeys.practices || []).forEach(function(x) { allDone.add(x); });
  (journeys.phraseLessons || []).forEach(function(x) { allDone.add(x); });
  (journeys.phrasePractices || []).forEach(function(x) { allDone.add(x); });
  (journeys.dialogues || []).forEach(function(x) { allDone.add(x); });
  var completedThemes = allDone.size;
  var progressionPercent = Math.round((completedThemes / 25) * 100);
  var examEligible = completedThemes >= 25;

  var actions = [];

  if (srsDueCount > 0) {
    actions.push({
      icon: '🔄', step: 'Priorite #1',
      title: 'Reviser ' + srsDueCount + ' mot' + (srsDueCount > 1 ? 's' : ''),
      description: 'Consolidez votre memoire avec la revision espacee',
      buttonText: 'Commencer les revisions',
      onclick: "router.navigate('/review')",
      isPriority: true
    });
  }

  var nextStep = findNextStep(journeys);
  if (nextStep) {
    actions.push({
      icon: nextStep.icon, step: nextStep.step,
      title: nextStep.title, description: nextStep.description,
      buttonText: 'Continuer', onclick: nextStep.onclick,
      isPriority: srsDueCount === 0
    });
  }

  var convLive = findAvailableConversationLive(journeys);
  if (convLive) {
    actions.push({
      icon: '🎙️', step: 'Recompense',
      title: 'Conversation: ' + getThemeName(convLive),
      description: 'Pratiquez avec Teacher AI',
      buttonText: 'Parler maintenant',
      onclick: "router.navigate('/conversation-live?theme=" + convLive + "')",
      isPriority: false
    });
  }

  if (actions.length === 0) {
    actions.push({
      icon: '🎉', step: 'Felicitations',
      title: 'Tout est a jour !',
      description: 'Vous avez complete toutes vos taches.',
      buttonText: 'Voir tous les themes',
      onclick: "router.navigate('/themes')",
      isPriority: false
    });
  }

  return {
    dayNumber: dayNumber,
    streak: profile.streak || 0,
    themesCompleted: completedThemes,
    progressionPercent: progressionPercent,
    examEligible: examEligible,
    actions: actions
  };
}

function findNextStep(journeys) {
  // ✅ V5.109: PRIORISER le thème en cours (currentTheme)
  const currentTheme = localStorage.getItem('dagospeak:theme');
  
  const manifest = window.currentManifest || {};
  const levels = manifest.levels || [];
  const a0Level = levels.find(l => l.id === 'A0');
  
  if (!a0Level || !a0Level.units) {
    return {
      icon: '📚',
      step: 'Étape suivante',
      title: 'Commencer un nouveau thème',
      description: 'Choisissez un thème pour continuer votre apprentissage',
      onclick: "router.navigate('/themes')"
    };
  }
  
  // Helper pour trouver l'étape suivante d'un thème
  const findNextStepForTheme = (unitId) => {
    // Étape 1: Leçon de mots
    if (!journeys.lessons?.includes(unitId)) {
      return {
        icon: '📖',
        step: 'Leçon de mots',
        title: getThemeName(unitId),
        description: 'Commencez par la leçon de mots',
        onclick: `startStep('unitId', '/lesson')`
      };
    }
    
    // Étape 2: Révision des mots
    if (!journeys.practices?.includes(unitId)) {
      return {
        icon: '🎯',
        step: `${getThemeName(unitId)} - Étape 2/5`,
        title: 'Révision des mots',
        description: 'Testez votre connaissance avec des quiz',
        onclick: `startStep('unitId', '/practice')`
      };
    }
    
    // Étape 3: Phrases de contexte
    if (!journeys.phraseLessons?.includes(unitId)) {
      return {
        icon: '📝',
        step: `${getThemeName(unitId)} - Étape 3/5`,
        title: 'Phrases de contexte',
        description: 'Apprenez les phrases utiles',
        onclick: `startStep('unitId', '/lesson-phrases')`
      };
    }
    
    // Étape 4: Révision des phrases
    if (!journeys.phrasePractices?.includes(unitId)) {
      return {
        icon: '🎯',
        step: `${getThemeName(unitId)} - Étape 4/5`,
        title: 'Révision des phrases',
        description: 'Pratiquez les phrases complètes',
        onclick: `startStep('unitId', '/practice-phrases')`
      };
    }
    
    // Étape 5: Dialogue
    if (!journeys.dialogues?.includes(unitId)) {
      return {
        icon: '💬',
        step: `${getThemeName(unitId)} - Étape 5/5`,
        title: 'Dialogue',
        description: 'Conversation complète sur le thème',
        onclick: `startStep('unitId', '/dialogues')`
      };
    }
    
    return null; // Thème complètement terminé
  };
  
  // ✅ PRIORITÉ 1: Si un thème est en cours, continuer ce thème
  if (currentTheme && currentTheme !== 'null') {
    const nextStep = findNextStepForTheme(currentTheme);
    if (nextStep) {
      return nextStep;
    }
    // Si le thème en cours est terminé, on passera au suivant
  }
  
  // ✅ PRIORITÉ 2: Chercher le premier thème non terminé
  for (const unit of a0Level.units) {
    const unitId = typeof unit === 'string' ? unit : unit.id;
    
    // Vérifier si le thème est débloqué
    if (typeof isThemeUnlocked === 'function' && !isThemeUnlocked(unitId, a0Level, journeys)) {
      continue;
    }
    
    const nextStep = findNextStepForTheme(unitId);
    if (nextStep) {
      return nextStep;
    }
  }
  
  return null;
}
function findAvailableConversationLive(journeys) {
  var manifest = window.currentManifest || {};
  var levels = manifest.levels || [];
  var a0 = null;
  for (var i = 0; i < levels.length; i++) {
    if (levels[i].id === 'A0') { a0 = levels[i]; break; }
  }
  if (!a0 || !a0.units) return null;

  for (var u = 0; u < a0.units.length; u++) {
    var unit = a0.units[u];
    var unitId = typeof unit === 'string' ? unit : unit.id;
    var l = (journeys.lessons || []).indexOf(unitId) !== -1;
    var p = (journeys.practices || []).indexOf(unitId) !== -1;
    var pl = (journeys.phraseLessons || []).indexOf(unitId) !== -1;
    var pp = (journeys.phrasePractices || []).indexOf(unitId) !== -1;
    if (l && p && pl && pp) return unitId;
  }
  return null;
}

function getThemeName(themeId) {
  var names = {
    'alphabet1': 'Alphabet 1', 'alphabet2': 'Alphabet 2',
    'greetings': 'Salutations', 'survival': 'Survie',
    'family': 'Famille', 'market': 'Marche',
    'numbers': 'Nombres 1-10', 'numbers2': 'Nombres 11-20',
    'colors': 'Couleurs', 'days': 'Jours', 'months': 'Mois',
    'body': 'Corps', 'pronouns_basic': 'Pronoms',
    'articles': 'Articles', 'verbe_etre': 'Verbe etre',
    'verbe_avoir': 'Verbe avoir', 'possessifs': 'Possessifs',
    'demonstratifs': 'Demonstratifs', 'adjectifs': 'Adjectifs',
    'verbes_er': 'Verbes -er', 'negation': 'Negation',
    'questions': 'Questions', 'prepositions': 'Prepositions',
    'imperatif': 'Imperatif', 'futur_proche': 'Futur proche'
  };
  return names[themeId] || themeId;
}


// ✅ V5.109: Exposer les fonctions pour debug
window.calculateTodayActions = calculateTodayActions;
window.findNextStep = findNextStep;
window.findAvailableConversationLive = findAvailableConversationLive;
window.getThemeName = getThemeName;
console.log('[Today] ✅ Fonctions exposées globalement pour debug');
