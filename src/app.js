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
const roleManager  = new RoleManager(db);

const paymentGateway = new PaymentGateway();
paymentGateway.register('mobile_money', new MobileMoneyProvider());

container.register('bus', () => bus);
container.register('logger', () => logger);
container.register('db', () => db);
container.register('content', () => content);
container.register('srs', () => srs);
container.register('gamification', () => gamification);
container.register('roles', () => roleManager);
container.register('payments', () => paymentGateway);

window.DagoSpeak = { bus, container, logger, db, content, router, srs, gamification, shadowing, roleManager, paymentGateway };

// ═══════════════════════════════════════════════════════════
// ÉTAT & THÈME
// ═══════════════════════════════════════════════════════════
let currentLevel = localStorage.getItem('dagospeak:level') || 'A0';

function updateLevelUI() {
  document.querySelectorAll('.ds-level-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.level === currentLevel);
  });
}

document.getElementById('level-selector')?.addEventListener('click', (e) => {
  const btn = e.target.closest('.ds-level-btn');
  if (btn) {
    currentLevel = btn.dataset.level;
    localStorage.setItem('dagospeak:level', currentLevel);
    updateLevelUI();
    logger.info(`Niveau changé vers : ${currentLevel}`);

    // ✅ ASTUCE : Forcer le re-rendu immédiat de la vue actuelle,
    // même si le hash de l'URL n'a pas changé.
    const currentHash = window.location.hash.slice(1) || '/';

    // Petit délai pour laisser le temps à l'UI de se mettre à jour
    setTimeout(() => {
      if (currentHash === '/lesson') renderLesson();
      else if (currentHash === '/practice') renderPractice();
      else if (currentHash === '/dialogues') renderDialogues();
      else if (currentHash === '/') renderHome();
      else router.navigate(currentHash);
    }, 50);
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
  main.innerHTML = '<div style="text-align:center; padding:2rem;">Chargement...</div>';

  try {
    await roleManager.init();
    const profile = await gamification.getProfile();
    const manifest = await content.loadManifest('fr');

    // Génération dynamique des cartes de niveaux
    const levelsHtml = manifest.levels.map(level => {
      const isFree = level.id === 'A0';
      const isUnlocked = isFree || profile.isPremium;

      return `
        <div style="background: ${isUnlocked ? 'var(--ds-color-surface)' : 'var(--ds-color-surface-2)'};
                    padding: 1.5rem; border-radius: var(--ds-radius-lg);
                    border: 1px solid ${isUnlocked ? 'var(--ds-color-border)' : 'var(--ds-color-text-disabled)'};
                    opacity: ${isUnlocked ? 1 : 0.7};
                    display: flex; flex-direction: column; gap: 1rem;">

          <div style="display:flex; justify-content:space-between; align-items:center;">
            <h3 style="margin:0; color: ${isUnlocked ? 'var(--ds-color-primary)' : 'var(--ds-color-text-muted)'};">
              Niveau ${level.id} : ${level.title}
            </h3>
            ${!isUnlocked ? '<span style="font-size:1.5rem;" title="Contenu Premium">🔒</span>' : '<span style="font-size:1.5rem;">🔓</span>'}
          </div>

          <p style="margin:0; font-size: 0.9rem; color: var(--ds-color-text-muted);">${level.description}</p>

          ${isUnlocked ? `
            <ds-button variant="${level.id === 'A0' ? 'success' : 'primary'}" size="sm"
                       onclick="window.location.hash='/lesson'; localStorage.setItem('dagospeak:level', '${level.id}'); window.location.reload();">
              Commencer ce niveau
            </ds-button>
          ` : `
            <ds-button variant="accent" size="sm" id="btn-upgrade-${level.id}">
              Débloquer avec Premium
            </ds-button>
          `}
        </div>
      `;
    }).join('');

    main.innerHTML = `
      <section class="ds-hero">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
          <h1>Manahoana ! 👋</h1>
          <div style="text-align:right;">
            <div style="font-size: var(--ds-font-size-lg); font-weight: bold; color: var(--ds-color-accent);">🔥 ${profile.streak} jour${profile.streak > 1 ? 's' : ''}</div>
            <div style="color: var(--ds-color-text-muted);">Niveau ${profile.level} • ${profile.xp} XP ${profile.isPremium ? '• 👑 Premium' : ''}</div>
          </div>
        </div>

        <p class="ds-hero__subtitle">Choisissez votre parcours d'apprentissage :</p>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
          ${levelsHtml}
        </div>

        ${!profile.isPremium ? `
        <div style="padding: 1.5rem; background: var(--ds-color-primary-soft); border-radius: var(--ds-radius-lg); border: 1px solid var(--ds-color-primary); text-align:center;">
          <h3 style="color: var(--ds-color-primary); margin-bottom: 0.5rem;">🚀 Passez à DagoSpeak Premium</h3>
          <p style="color: var(--ds-color-text-muted); margin-bottom: 1rem;">Débloquez tous les niveaux (A1, A2, B1...), les dialogues avancés et l'IA de correction.</p>
          <ds-button id="btn-upgrade-main" size="md">Devenir Premium (15 000 Ar / mois)</ds-button>
        </div>
        ` : ''}
      </section>
    `;

    // Gestion des boutons d'upgrade
    document.querySelectorAll('[id^="btn-upgrade"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.setAttribute('loading', '');
        const result = await paymentGateway.checkout('premium_monthly', 'mobile_money');
        alert(result.message + `\nID: ${result.transactionId}`);
        profile.isPremium = true;
        await db.put('progress', profile);
        renderHome(); // Rafraîchir pour enlever les cadenas
      });
    });

    logger.info('✅ Page d\'accueil rendue (Modèle Freemium)');
  } catch (e) {
    main.innerHTML = `<p style="color:red; text-align:center;">Erreur: ${e.message}</p>`;
  }
}

async function renderLesson() {
  const main = document.getElementById('app');
  main.innerHTML = '<div style="text-align:center; padding:2rem;">Chargement de la leçon...</div>';
  try {
    const manifest = await content.loadManifest('fr');
    const levelData = manifest.levels.find(l => l.id === currentLevel);
    let allItems = [];
    for (const unit of levelData.units) {
      const data = await content.loadSection('fr', 'vocabulary', unit);
      allItems = allItems.concat(data.items);
    }

    main.innerHTML = `
      <section style="max-width: 700px; margin: 0 auto; padding: 2rem 1rem;">
        <ds-button variant="ghost" size="sm" id="btn-back" style="margin-bottom: 1rem;">← Retour</ds-button>
        <h2>📖 Leçon : ${levelData.title} (${currentLevel})</h2>
        <p style="color:var(--ds-color-text-muted); margin-bottom: 2rem;">${levelData.description}</p>
        <div style="display:grid; gap:1rem;">
          ${allItems.map(item => `
            <div style="background:var(--ds-color-surface); padding:1rem; border-radius:var(--ds-radius-md); display:flex; justify-content:space-between; align-items:center; box-shadow:var(--ds-shadow-sm);">
              <div>
                <strong style="font-size:1.1rem; color:var(--ds-color-primary);">${item.target}</strong>
                <span style="color:var(--ds-color-text-muted); font-size:0.9em;"> → ${item.source}</span>
              </div>
              <ds-button variant="ghost" size="sm" class="play-audio" data-target="${item.target}">🔊</ds-button>
            </div>
          `).join('')}
        </div>
        <div style="margin-top:2rem; text-align:center;">
          <ds-button id="btn-start-practice" size="lg" variant="success">🎯 Commencer la pratique</ds-button>
        </div>
      </section>
    `;
    document.getElementById('btn-back').addEventListener('click', () => router.navigate('/'));
    document.querySelectorAll('.play-audio').forEach(btn => {
      btn.addEventListener('click', () => {
        const u = new SpeechSynthesisUtterance(btn.dataset.target); u.lang = 'fr-FR'; speechSynthesis.speak(u);
      });
    });
    document.getElementById('btn-start-practice')?.addEventListener('click', () => router.navigate('/practice'));
    logger.info('✅ Page Leçon rendue');
  } catch (e) {
    main.innerHTML = `<p style="color:red; text-align:center;">Erreur leçon: ${e.message}</p>`;
  }
}

async function renderPractice() {
  console.log(`🔍 [DEBUG] renderPractice démarré (Niveau: ${currentLevel})`);
  const main = document.getElementById('app');
  main.innerHTML = '<div style="text-align:center; padding:2rem;">Préparation de la session...</div>';

  try {
    const manifest = await content.loadManifest('fr');
    const levelData = manifest.levels.find(l => l.id === currentLevel);
    if (!levelData || !levelData.units || levelData.units.length === 0) throw new Error(`Aucune unité pour ${currentLevel}`);

    const unitId = levelData.units[0];
    const vocabData = await content.loadSection('fr', 'vocabulary', unitId);
    const sessionQueue = [...vocabData.items].sort(() => Math.random() - 0.5);
    let currentIndex = 0;

    // Variable pour stocker la référence de l'écouteur et pouvoir le supprimer
    let shadowEvalHandler = null;

    const renderQuestion = (index) => {
      // ✅ 1. NETTOYAGE COMPLET AVANT CHAQUE QUESTION (Tue les écouteurs fantômes)
      shadowing.forceStop();
      speechSynthesis.cancel(); // Arrête toute parole en cours
      if (shadowEvalHandler) {
        bus.off('pronunciation:evaluated', shadowEvalHandler);
        shadowEvalHandler = null;
      }

      const itemData = sessionQueue[index];
      const progressPercent = ((index) / sessionQueue.length) * 100;

            // --- LOGIQUE DE QUIZ BLINDÉE (Plus de réponses vides) ---
      let questionText = "";
      let correctAnswer = "";
      let options = [];

      if (itemData.quizType === "mg_to_fr") {
        questionText = `Comment dit-on "<strong>${itemData.source}</strong>" en français ?`;
        correctAnswer = itemData.target;

        // On filtre pour s'assurer qu'on ne prend que des réponses valides et non vides
        const pool = vocabData.items
          .filter(i => i.id !== itemData.id && i.target && i.target.trim() !== "")
          .map(i => i.target);

        const distractors = pool.sort(() => Math.random() - 0.5).slice(0, 2);
        options = [correctAnswer, ...distractors];

      } else {
        questionText = `Que signifie "<strong>${itemData.target}</strong>" en malgache ?`;
        correctAnswer = itemData.source;

        const pool = vocabData.items
          .filter(i => i.id !== itemData.id && i.source && i.source.trim() !== "")
          .map(i => i.source);

        const distractors = pool.sort(() => Math.random() - 0.5).slice(0, 2);
        options = [correctAnswer, ...distractors];
      }

      // Sécurité ultime : s'assurer qu'il y a toujours 3 options valides et uniques
      options = [...new Set(options.filter(opt => opt && opt.trim() !== ""))];
      while (options.length < 3) {
        options.push("Réponse de secours"); // Fallback si le tableau est trop petit
      }

      // Mélanger les options finales
      options = options.sort(() => Math.random() - 0.5);

        main.innerHTML = `
        <section style="max-width: 600px; margin: 0 auto; padding: 2rem 1rem;">
          <!-- Barre de progression -->
          <div style="background:var(--ds-color-border); height:8px; border-radius:4px; margin-bottom:1rem; overflow:hidden;">
            <div style="background:var(--ds-color-primary); height:100%; width:${progressPercent}%; transition: width 0.3s ease;"></div>
          </div>

          <div style="display:flex; justify-content:space-between; margin-bottom:1rem;">
            <ds-button variant="ghost" size="sm" id="btn-back">← Quitter</ds-button>
            <span style="font-weight:600; color:var(--ds-color-text-muted);">Question ${index + 1} / ${sessionQueue.length}</span>
          </div>

          <!-- ZONE DE LA QUESTION (Bien séparée des réponses) -->
          <div style="text-align:center; margin-bottom: 2rem; background: var(--ds-color-surface); padding: 1.5rem; border-radius: var(--ds-radius-lg); box-shadow: var(--ds-shadow-sm);">
            <h2 style="margin-bottom: 0.5rem;">${questionText}</h2>
            <p style="color: var(--ds-color-text-muted); font-style: italic; font-size: 0.95rem;">"${itemData.context}"</p>

            <div style="margin-top: 1rem; display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap;">
              <ds-button variant="ghost" size="sm" id="btn-listen">🔊 Écouter</ds-button>
              <ds-button variant="ghost" size="sm" id="btn-shadow">🎙️ Shadowing (5s)</ds-button>
            </div>
            <div id="shadow-feedback" style="margin-top: 1rem; font-weight: bold; color: var(--ds-color-primary); min-height: 1.5em;"></div>
          </div>

          <!-- ZONE DES RÉPONSES (Le composant quiz est isolé ici) -->
          <div style="margin-top: 1.5rem; text-align: left;">
            <p style="font-weight: 600; color: var(--ds-color-text-muted); margin-bottom: 0.5rem; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.5px;">
              Choisissez la bonne réponse :
            </p>
            <ds-quiz id="active-quiz" item-id="${itemData.id}" options='${JSON.stringify(options)}' correct="${correctAnswer}"></ds-quiz>
          </div>

          <div style="margin-top: 2rem; text-align: center;">
            <ds-button id="btn-next" disabled variant="primary" style="width: 100%; transition: all 0.3s ease;">Question suivante →</ds-button>
          </div>
        </section>
      `;

      // --- ÉVÉNEMENTS ---
      document.getElementById('btn-back').addEventListener('click', () => {
        shadowing.forceStop();
        speechSynthesis.cancel();
        router.navigate('/lesson');
      });

      document.getElementById('btn-listen').addEventListener('click', () => {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(itemData.target);
        u.lang = 'fr-FR'; u.rate = 0.9;
        speechSynthesis.speak(u);
      });

      const btnShadow = document.getElementById('btn-shadow');
      const shadowFeedback = document.getElementById('shadow-feedback');
      const btnNext = document.getElementById('btn-next');

      // ✅ 2. GESTION D'ÉTAT FIABLE (Boolean au lieu de lire le texte)
      let isRecording = false;

      btnShadow.addEventListener('click', () => {
        if (isRecording) {
          // L'utilisateur clique pour arrêter manuellement
          shadowing.forceStop();
          isRecording = false;
          btnShadow.textContent = '🎙️ Shadowing (5s)';
        } else {
          // L'utilisateur clique pour démarrer
          speechSynthesis.cancel(); // ✅ Empêche la voix de parler pendant l'enregistrement
          shadowing.startRecording();
          isRecording = true;
          btnShadow.textContent = '⏹️ Arrêt en cours...';
          shadowFeedback.textContent = 'Parlez maintenant...';
        }
      });

      // ✅ 3. ÉCOUTEUR EXPLICITE ET NETTOYABLE
      shadowEvalHandler = (data) => {
        console.log('🎤 [DEBUG] Shadowing évalué:', data);
        if (shadowFeedback) shadowFeedback.textContent = `${data.feedback} (${(data.score * 100).toFixed(0)}%)`;
        if (btnShadow) {
          btnShadow.textContent = '🎙️ Shadowing (5s)';
          isRecording = false; // ✅ Remet l'état à faux pour permettre une 2ème tentative
        }
        unlockNext();
      };

      // On s'abonne proprement
      bus.on('pronunciation:evaluated', shadowEvalHandler);

      const quizEl = document.getElementById('active-quiz');
      quizEl.addEventListener('quiz:answered', async (e) => {
        console.log('📝 [DEBUG] Quiz répondu:', e.detail);
        await srs.schedule(e.detail.itemId, e.detail.isCorrect ? 4 : 1);
        if (e.detail.isCorrect) {
          await gamification.addXP(10, 'Quiz réussi');
          await gamification.updateStreak();
        }
        unlockNext();
      });

      const unlockNext = () => {
        if (btnNext) {
          btnNext.disabled = false;
          btnNext.removeAttribute('disabled');
          btnNext.setAttribute('variant', 'success');
          btnNext.style.boxShadow = "0 0 0 0 rgba(47, 158, 68, 0.7)";
          btnNext.style.animation = "pulse-green 1.5s infinite";
          console.log('🔓 [DEBUG] Bouton Suivant ACTIVÉ et animé');
        }
      };

      // Injection du style d'animation (une seule fois)
      if (!document.getElementById('pulse-style')) {
        const style = document.createElement('style');
        style.id = 'pulse-style';
        style.innerHTML = `
          @keyframes pulse-green {
            0% { transform: scale(0.98); box-shadow: 0 0 0 0 rgba(47, 158, 68, 0.7); }
            70% { transform: scale(1.02); box-shadow: 0 0 0 10px rgba(47, 158, 68, 0); }
            100% { transform: scale(0.98); box-shadow: 0 0 0 0 rgba(47, 158, 68, 0); }
          }
        `;
        document.head.appendChild(style);
      }

      btnNext.addEventListener('click', () => {
        if (currentIndex < sessionQueue.length - 1) {
          currentIndex++;
          renderQuestion(currentIndex);
        } else {
          renderSessionComplete();
        }
      });
    };

    const renderSessionComplete = async () => {
      shadowing.forceStop();
      speechSynthesis.cancel();
      await gamification.addXP(50, 'Session terminée');
      main.innerHTML = `
        <section style="max-width: 600px; margin: 0 auto; padding: 2rem 1rem; text-align:center;">
          <div style="font-size: 4rem; margin-bottom: 1rem;">🎉</div>
          <h2>Session Terminée !</h2>
          <p style="color: var(--ds-color-text-muted); margin-bottom: 2rem;">Misaotra ! Vous avez révisé cette unité.</p>
          <ds-button id="btn-finish" size="lg" variant="success" style="width: 100%;">Retour aux Leçons</ds-button>
        </section>
      `;
      document.getElementById('btn-finish').addEventListener('click', () => router.navigate('/lesson'));
    };

    renderQuestion(currentIndex);
    console.log(`✅ [DEBUG] Session initialisée avec ${sessionQueue.length} questions`);

  } catch (error) {
    console.error('❌ Erreur renderPractice:', error);
    main.innerHTML = `<div style="text-align:center; padding:2rem; color:red;"><p>Erreur: ${error.message}</p><ds-button onclick="location.hash='/lesson'">Retour</ds-button></div>`;
  }
}

async function renderDialogues() {
  const main = document.getElementById('app');
  main.innerHTML = '<div style="text-align:center; padding:2rem;">Chargement des dialogues...</div>';

  try {
    const dialogueId = currentLevel === 'A0' ? 'greetings' : 'market_bargain';
    const dialogue = await content.loadSection('fr', 'dialogues', dialogueId);

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
        <ds-button variant="ghost" size="sm" id="btn-back" style="margin-bottom: 1rem;">← Retour</ds-button>
        <div style="text-align:center; margin-bottom:1.5rem;">
          <span style="background:var(--ds-color-accent); color:white; padding:4px 10px; border-radius:20px; font-weight:600; font-size:0.8rem;">Niveau ${currentLevel}</span>
        </div>
        <h2 style="text-align:center; margin-bottom:0.5rem;">💬 ${dialogue.title}</h2>
        <p style="text-align:center; color:var(--ds-color-text-muted); margin-bottom:2rem;">${dialogue.titleMg}</p>
        <div style="background:var(--ds-color-bg); padding:1.5rem; border-radius:var(--ds-radius-lg); border:1px solid var(--ds-color-border);">
          ${chatHtml}
        </div>
        <!-- ✅ BOUTON DE FIN DE DIALOGUE AJOUTÉ -->
        <div style="margin-top: 2rem; text-align: center;">
          <ds-button id="btn-dialogue-next" size="lg" variant="success" style="width: 100%;">Dialogue terminé, continuer →</ds-button>
        </div>
      </section>
    `;

    document.getElementById('btn-back').addEventListener('click', () => router.navigate('/'));
    document.getElementById('btn-dialogue-next').addEventListener('click', () => router.navigate('/lesson'));

    document.querySelectorAll('.play-dialog-audio').forEach(btn => {
      btn.addEventListener('click', () => {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(btn.dataset.text);
        u.lang = 'fr-FR'; u.rate = 0.9;
        speechSynthesis.speak(u);
      });
    });

    logger.info(`✅ Page Dialogues rendue (Niveau ${currentLevel})`);
  } catch (e) {
    main.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--ds-color-danger);">Aucun dialogue disponible.</div>`;
  }
}

async function renderProfile() {
  const main = document.getElementById('app');
  main.innerHTML = '<div style="text-align:center; padding:2rem;">Chargement du profil...</div>';
  try {
    const profile = await gamification.getProfile();
    main.innerHTML = `
      <section style="max-width: 600px; margin: 0 auto; padding: 2rem 1rem;">
        <ds-button variant="ghost" size="sm" id="btn-back" style="margin-bottom: 1rem;">← Retour</ds-button>
        <h2 style="text-align: center; margin-bottom: 2rem;">Mon Profil</h2>
        <div style="background: var(--ds-color-surface); padding: 2rem; border-radius: var(--ds-radius-lg); box-shadow: var(--ds-shadow-md); text-align:center;">
          <div style="font-size: 3rem; margin-bottom: 0.5rem;">🎓</div>
          <h3 style="color: var(--ds-color-primary);">Niveau ${profile.level}</h3>
          <p style="color: var(--ds-color-text-muted);">${profile.xp} XP accumulés</p>
          <div style="margin-top: 1rem; font-size: 1.5rem; color: var(--ds-color-accent); font-weight: bold;">🔥 ${profile.streak} jours</div>
        </div>
      </section>
    `;
    document.getElementById('btn-back').addEventListener('click', () => router.navigate('/'));
    logger.info('✅ Page Profil rendue');
  } catch (e) {
    main.innerHTML = `<p style="color:red; text-align:center;">Erreur profil: ${e.message}</p>`;
  }
}

// ═══════════════════════════════════════════════════════════
// ROUTEUR & DÉMARRAGE
// ═══════════════════════════════════════════════════════════
router.addRoute('/', renderHome);
router.addRoute('/lesson', renderLesson);
router.addRoute('/practice', renderPractice);
router.addRoute('/dialogues', renderDialogues);
router.addRoute('/profile', renderProfile);

initTheme();
updateLevelUI();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => logger.info('SW enregistré', reg.scope))
      .catch((err) => logger.warn('SW échec', err));
  });
}

router.start();

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

logger.info('✅ Application démarrée');