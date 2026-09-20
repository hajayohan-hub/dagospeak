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
  var manifest = window.currentManifest || {};
  var levels = manifest.levels || [];
  var a0 = null;
  for (var i = 0; i < levels.length; i++) {
    if (levels[i].id === 'A0') { a0 = levels[i]; break; }
  }

  if (!a0 || !a0.units) {
    return {
      icon: '📚', step: 'Etape suivante',
      title: 'Commencer un nouveau theme',
      description: 'Choisissez un theme pour continuer',
      onclick: "router.navigate('/themes')"
    };
  }

  var steps = ['lessons', 'practices', 'phraseLessons', 'phrasePractices', 'dialogues'];
  var routes = ['/lesson', '/practice', '/lesson-phrases', '/practice-phrases', '/dialogues'];
  var icons = ['📖', '🎯', '📝', '🎯', '💬'];
  var stepNames = ['Lecon de mots', 'Revision des mots', 'Phrases de contexte', 'Revision des phrases', 'Dialogue'];

  for (var u = 0; u < a0.units.length; u++) {
    var unit = a0.units[u];
    var unitId = typeof unit === 'string' ? unit : unit.id;

    if (typeof isThemeUnlocked === 'function') {
      try { if (!isThemeUnlocked(unitId, a0, journeys)) continue; } catch(e) {}
    }

    for (var s = 0; s < steps.length; s++) {
      var done = journeys[steps[s]] || [];
      if (done.indexOf(unitId) === -1) {
        return {
          icon: icons[s],
          step: getThemeName(unitId) + ' - Etape ' + (s + 1) + '/5',
          title: stepNames[s],
          description: 'Theme: ' + getThemeName(unitId),
          onclick: "router.navigate('" + routes[s] + "?theme=" + unitId + "')"
        };
      }
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
