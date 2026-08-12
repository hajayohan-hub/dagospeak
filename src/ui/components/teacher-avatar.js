/**
 * TeacherAvatar — Assistant pédagogique flottant
 * Gère les 3 types de parole : feedback (toujours), guide (selon toggle), clic manuel (toujours)
 */
export class TeacherAvatar {
  #isSpeaking = false;
  #femaleVoice = null;
  #masteredThemes = new Set();
  #autoSpeakEnabled = false;
  #isFirstUser = true;
  #currentTip = null;
  #signAnimationTimeout = null;
  #lastTipShown = {};  // ✅ NOUVEAU : Anti-spam
   #lastGlobalSpeak = 0;  // ✅ NOUVEAU : Délai global

  constructor() {
    this.#loadMasteredThemes();
    this.#loadVoices();

    // ✅ NOUVEAU : Charger la préférence auto-speak depuis localStorage
    const savedAutoSpeak = localStorage.getItem('dagospeak:autoSpeakEnabled');
    if (savedAutoSpeak !== null) {
      this.#autoSpeakEnabled = savedAutoSpeak === 'true';
    } else {
      // Par défaut : auto-speak activé pour les débutants
      this.#autoSpeakEnabled = true;
    }
  }

  // ─────────── GESTION DES THÈMES MAÎTRISÉS ───────────
  #loadMasteredThemes() {
    try {
      const saved = localStorage.getItem('dagospeak:masteredThemes');
      if (saved) this.#masteredThemes = new Set(JSON.parse(saved));
    } catch (e) {
      this.#masteredThemes = new Set();
    }
  }

  #saveMasteredThemes() {
    localStorage.setItem('dagospeak:masteredThemes', JSON.stringify([...this.#masteredThemes]));
  }

  markThemeMastered(themeId) {
    this.#masteredThemes.add(themeId);
    this.#saveMasteredThemes();
    console.log(`[TeacherAvatar] Thème maîtrisé: ${themeId} (${this.#masteredThemes.size} total)`);
  }

  // ─────────── GESTION DES VOIX ───────────
  #loadVoices() {
    if (!('speechSynthesis' in window)) return;

    const setVoice = () => {
      const voices = speechSynthesis.getVoices();
      this.#femaleVoice = voices.find(v =>
        v.lang.startsWith('fr') &&
        (v.name.toLowerCase().includes('female') ||
         v.name.toLowerCase().includes('femme') ||
         v.name.includes('Amélie') ||
         v.name.includes('Marie') ||
         v.name.includes('Audrey'))
      ) || voices.find(v => v.lang.startsWith('fr'));
    };

    setVoice();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = setVoice;
    }
  }

  // ─────────── MÉTHODES DE PAROLE (3 TYPES) ───────────

  /**
   * ✅ MÉTHODE PUBLIQUE PRINCIPALE (appelée par clic manuel)
   * Parle TOUJOURS, car l'utilisateur a explicitement cliqué sur l'avatar.
   */
  speak(text) {
    if (!('speechSynthesis' in window) || !text) return;
    try {
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'fr-FR';
      utterance.rate = 0.95;
      utterance.pitch = 1.1;
      if (this.#femaleVoice) utterance.voice = this.#femaleVoice;

      utterance.onstart = () => {
        this.#isSpeaking = true;
        this.#animateSpeaking(true);
      };
      utterance.onend = () => {
        this.#isSpeaking = false;
        this.#animateSpeaking(false);
      };
      utterance.onerror = () => {
        this.#isSpeaking = false;
        this.#animateSpeaking(false);
      };

      speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('[TeacherAvatar] Erreur speak:', e);
    }
  }

  /**
   * ✅ NOUVEAU : FEEDBACK COURT (parle TOUJOURS, même si auto-speak désactivé)
   * Utilisé pour : "Excellent !", "Essaie encore", "Leçon terminée !", "Niveau débloqué !"
   * @param {string} text - Texte court à prononcer
   * @param {'success'|'error'|'info'} type - Type de feedback pour l'animation visuelle
   */
  speakFeedback(text, type = 'success') {
    if (!text) return;

    // Animation visuelle avant la parole (plus réactive)
    this.#animateFeedback(type);

    // Parle toujours, sans attendre le toggle
    this.speak(text);

    console.log(`[TeacherAvatar] Feedback [${type}]: ${text}`);
  }

  /**
   * ✅ NOUVEAU : GUIDE CONTEXTUEL (respecte le toggle auto-speak)
   * Utilisé pour les conseils affichés au changement de page.
   * Ne parle QUE si l'utilisateur a activé l'auto-parole.
   */
        speakGuide(text) {
        if (!text) return;

        // ✅ NOUVEAU : Délai global anti-spam (5 secondes entre n'importe quel guide)
        const now = Date.now();
        if (this.#lastGlobalSpeak && now - this.#lastGlobalSpeak < 5000) {
          console.log('[TeacherAvatar] Guide ignoré (délai global)');
          return;
        }

        if (this.#autoSpeakEnabled) {
          this.#lastGlobalSpeak = now;
          setTimeout(() => this.speak(text), 600);
          console.log(`[TeacherAvatar] Guide (auto): ${text}`);
        } else {
          console.log(`[TeacherAvatar] Guide (silencieux): ${text}`);
        }
      }



  // ─────────── CONTRÔLE DU TOGGLE ───────────

  setAutoSpeak(enabled) {
    this.#autoSpeakEnabled = enabled;
    // ✅ NOUVEAU : Sauvegarde persistante de la préférence
    localStorage.setItem('dagospeak:autoSpeakEnabled', enabled.toString());
    console.log(`[TeacherAvatar] Auto-parole: ${enabled ? '✅ activée' : '❌ désactivée'}`);

    if (!enabled) {
      speechSynthesis.cancel(); // Coupe toute parole en cours
    }
  }

  getAutoSpeak() {
    return this.#autoSpeakEnabled;
  }



  // ─────────── ANIMATIONS VISUELLES ───────────

  #animateSpeaking(isSpeaking) {
    const avatar = document.getElementById('teacher-avatar');
    if (!avatar) return;

    if (isSpeaking) {
      avatar.style.animation = 'speaking-pulse 0.6s ease-in-out infinite';
      avatar.style.background = 'linear-gradient(135deg, var(--ds-color-primary), var(--ds-color-accent))';
    } else {
      avatar.style.animation = 'idle-float 3s ease-in-out infinite';
    }
  }

  /**
   * ✅ NOUVEAU : Animation spécifique pour les feedbacks courts
   * Vert pour succès, rouge pour erreur, bleu pour info
   */
  #animateFeedback(type) {
    const avatar = document.getElementById('teacher-avatar');
    if (!avatar) return;

    const colors = {
      success: { bg: 'linear-gradient(135deg, #2F9E44, #51cf66)', glow: '0 0 30px rgba(47, 158, 68, 0.8)' },
      error:   { bg: 'linear-gradient(135deg, #D64545, #ff6b6b)', glow: '0 0 30px rgba(214, 69, 69, 0.8)' },
      info:    { bg: 'linear-gradient(135deg, #1971C2, #4dabf7)', glow: '0 0 30px rgba(25, 113, 194, 0.8)' }
    };

    const color = colors[type] || colors.info;

    // Animation de feedback (bounce + glow coloré)
    avatar.style.animation = 'feedback-bounce 0.6s ease';
    avatar.style.background = color.bg;
    avatar.style.boxShadow = color.glow;

    // Retour au style normal après l'animation
    setTimeout(() => {
      if (!this.#isSpeaking) {
        avatar.style.animation = 'idle-float 3s ease-in-out infinite';
        avatar.style.background = 'linear-gradient(135deg, var(--ds-color-primary), var(--ds-color-accent))';
        avatar.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
      }
    }, 1500);
  }

  #startSignAnimation() {
    const avatar = document.getElementById('teacher-avatar');
    if (!avatar) return;
    avatar.style.animation = 'sign-bounce 1s ease-in-out 3';
    this.#signAnimationTimeout = setTimeout(() => {
      if (!this.#isSpeaking) {
        avatar.style.animation = 'idle-float 3s ease-in-out infinite';
      }
    }, 3000);
  }

  #stopSignAnimation() {
    if (this.#signAnimationTimeout) {
      clearTimeout(this.#signAnimationTimeout);
    }
    const avatar = document.getElementById('teacher-avatar');
    if (avatar && !this.#isSpeaking) {
      avatar.style.animation = 'idle-float 3s ease-in-out infinite';
    }
  }

  // ─────────── AFFICHAGE DES CONSEILS PAR PAGE ───────────
  show(tipKey) {
  const tips = {
    'home':             { fr: "Bienvenue ! Choisissez un niveau pour commencer.", mg: "Tongasoa ! Safidio ny ambaratonga." },
    'themes':           { fr: "Choisissez un thème pour voir les leçons.", mg: "Safidio lohahevitra iray." },
    'theme-detail':     { fr: "Choisissez une activité : Leçon, Révisions, Phrases ou Dialogues.", mg: "Safidio hetsika iray." },
    'lesson':           { fr: "Écoutez et répétez chaque mot à voix haute.", mg: "Hihainoa ary avereno ny teny tsirairay." },
    'lesson-phrases':   { fr: "Écoutez et répétez chaque phrase à voix haute.", mg: "Hihainoa ary avereno ny fehezanteny." },
    'practice':         { fr: "Suivez les étapes : Écoutez, Répondez, puis Prononcez.", mg: "Araho ny dingana : Mihainoa, Valio, Mitenena." },
    'practice-phrases': { fr: "Écoutez, traduisez, puis prononcez la phrase complète.", mg: "Mihainoa, adino, ary mitenena." },
    'dialogues':        { fr: "Lisez et écoutez la conversation.", mg: "Vakio ary mihainoa ny resaka." },
    'roleplay':         { fr: "Jouez les deux rôles de la conversation.", mg: "Milalao anjara asa roa." },
    'challenge':        { fr: "Défi ! Parlez sans voir les réponses.", mg: "Fanamby ! Mitenena tsy mijery." }
  };

      this.#currentTip = tips[tipKey] || {
        fr: "Continuez, vous faites du bon travail !",
        mg: "Tohizo, tsara ny ataonao !"
      };

      this.render();

      // ✅ NOUVEAU : Anti-spam - Ne pas répéter le même conseil trop souvent
      const now = Date.now();
      const lastShown = this.#lastTipShown?.[tipKey] || 0;
      const SPAM_DELAY = 30000; // 30 secondes entre deux affichages du même conseil

      if (now - lastShown < SPAM_DELAY) {
        console.log(`[TeacherAvatar] Conseil "${tipKey}" ignoré (anti-spam)`);
        return;
      }

      // Enregistrer le moment de l'affichage
      if (!this.#lastTipShown) this.#lastTipShown = {};
      this.#lastTipShown[tipKey] = now;

      // Sur la page d'accueil : signe visuel pour les nouveaux, PAS de parole auto
      if (tipKey === 'home') {
        if (this.#isFirstUser) {
          setTimeout(() => this.#startSignAnimation(), 1000);
          this.#isFirstUser = false;
        }
        return;
      }

      // ✅ Sur les autres pages : utilise speakGuide() qui respecte le toggle
      this.speakGuide(this.#currentTip.fr);
    }

  // ─────────── RENDU DU COMPOSANT ───────────
  render() {
    const oldAvatar = document.getElementById('teacher-avatar-container');
    if (oldAvatar) oldAvatar.remove();

    const container = document.createElement('div');
    container.id = 'teacher-avatar-container';
    container.innerHTML = `
      <style>
        @keyframes idle-float {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-10px) scale(1.05); }
        }
        @keyframes speaking-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 4px 12px rgba(10, 138, 110, 0.3); }
          50% { transform: scale(1.15); box-shadow: 0 8px 24px rgba(10, 138, 110, 0.6); }
        }
        @keyframes feedback-bounce {
          0% { transform: scale(1); }
          25% { transform: scale(1.2); }
          50% { transform: scale(0.95); }
          75% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes sign-bounce {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-15px) rotate(-10deg); }
          75% { transform: translateY(-15px) rotate(10deg); }
        }
      </style>

      <!-- ✅ CORRECTION ACCESSIBILITÉ : role, aria-label, tabindex -->
      <div id="teacher-avatar"
           role="button"
           tabindex="0"
           aria-label="Afficher l'aide du professeur. Cliquez pour entendre le conseil."
           title="Cliquez pour de l'aide"
           style="
             position: fixed; bottom: 100px; right: 20px;
             width: 80px; height: 80px;
             background: linear-gradient(135deg, var(--ds-color-primary), var(--ds-color-accent));
             border-radius: 50%;
             display: flex; align-items: center; justify-content: center;
             font-size: 2.5rem;
             cursor: pointer;
             box-shadow: 0 4px 12px rgba(0,0,0,0.2);
             z-index: 9999;
             border: 4px solid white;
             animation: idle-float 3s ease-in-out infinite;
             transition: all 0.3s ease;
           ">👩‍🏫</div>

      <div id="teacher-tooltip" role="dialog" aria-label="Conseil du professeur"
           style="
             position: fixed; bottom: 190px; right: 20px;
             max-width: 320px;
             background: var(--ds-color-surface);
             color: var(--ds-color-text);
             padding: 1.2rem;
             border-radius: var(--ds-radius-lg);
             box-shadow: 0 8px 24px rgba(0,0,0,0.3);
             z-index: 10000;
             display: none;
             border: 2px solid var(--ds-color-primary);
             animation: fadeIn 0.3s ease-out;
           ">
        <div style="font-weight:600; margin-bottom:0.5rem; color:var(--ds-color-primary); font-size:1rem;">💡 Torohevitra (Conseil)</div>
        <div style="font-size:0.95rem; margin-bottom:0.5rem; line-height:1.5;">${this.#currentTip?.fr || ''}</div>
        <div style="font-size:0.85rem; color:var(--ds-color-text-muted); font-style:italic; border-top:1px solid var(--ds-color-border); padding-top:0.5rem; line-height:1.4;">${this.#currentTip?.mg || ''}</div>
        <button id="close-teacher-tooltip"
                aria-label="Fermer le conseil"
                style="
                  position: absolute; top: 8px; right: 8px;
                  background: transparent; border: none;
                  font-size: 1.5rem; cursor: pointer;
                  color: var(--ds-color-text-muted); line-height: 1;
                  padding: 4px 8px;
                ">×</button>
      </div>
    `;
    document.body.appendChild(container);

    const avatar = document.getElementById('teacher-avatar');
    const tooltip = document.getElementById('teacher-tooltip');
    const closeBtn = document.getElementById('close-teacher-tooltip');

    const toggleTooltip = () => {
      this.#stopSignAnimation();
      const isVisible = tooltip.style.display === 'block';
      tooltip.style.display = isVisible ? 'none' : 'block';

      // Parle au clic manuel (toujours, car demande explicite)
      if (!isVisible && this.#currentTip) {
        this.speak(this.#currentTip.fr);
      }
    };

    // ✅ Support clic + clavier (Enter et Space)
    avatar.addEventListener('click', toggleTooltip);
    avatar.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleTooltip();
      }
    });

    closeBtn.addEventListener('click', () => {
      tooltip.style.display = 'none';
      speechSynthesis.cancel();
    });

    // Fermer au clic extérieur
    document.addEventListener('click', (e) => {
      if (tooltip.style.display === 'block' &&
          !avatar.contains(e.target) &&
          !tooltip.contains(e.target)) {
        tooltip.style.display = 'none';
      }
    });
  }
}