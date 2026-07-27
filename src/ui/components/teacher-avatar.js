/**
 * TeacherAvatar - Assistant virtuel avec animations de signe et feedback intelligent
 * RÈGLE D'OR : Ne prononce JAMAIS de mots malgaches. Uniquement du français.
 */
export class TeacherAvatar {
  #container = null;
  #currentTip = null;
  #isSpeaking = false;
  #femaleVoice = null;
  #masteredThemes = new Set();
  #autoSpeakEnabled = false;
  #isFirstUser = true;
  #signAnimationInterval = null;
  #voiceLoaded = false;

  constructor() {
    this.#loadMasteredThemes();
    this.#loadVoices();
  }

  #loadMasteredThemes() {
    const saved = localStorage.getItem('dagospeak:masteredThemes');
    if (saved) {
      this.#masteredThemes = new Set(JSON.parse(saved));
      this.#isFirstUser = false;
    }
  }

  #saveMasteredThemes() {
    localStorage.setItem('dagospeak:masteredThemes', JSON.stringify([...this.#masteredThemes]));
  }

  markThemeMastered(themeId) {
    this.#masteredThemes.add(themeId);
    this.#saveMasteredThemes();
    if (this.#masteredThemes.size >= 3) this.#autoSpeakEnabled = false;
  }

  #loadVoices() {
    const loadVoices = () => {
      const voices = speechSynthesis.getVoices();
      if (voices.length === 0) return;
      this.#femaleVoice = voices.find(v => v.lang.startsWith('fr') && (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('femme'))) ||
                         voices.find(v => v.lang.startsWith('fr')) || voices[0];
      if (!this.#voiceLoaded) {
        console.log('[TeacherAvatar] ✅ Voix chargée:', this.#femaleVoice?.name || 'Par défaut');
        this.#voiceLoaded = true;
      }
    };
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
  }

  speak(text) {
    if (!('speechSynthesis' in window) || !text) return;
    try {
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'fr-FR'; // ✅ FORCÉ EN FRANÇAIS
      utterance.rate = 0.95;
      utterance.pitch = 1.1;
      if (this.#femaleVoice) utterance.voice = this.#femaleVoice;

      utterance.onstart = () => { this.#isSpeaking = true; this.#animateSpeaking(true); };
      utterance.onend = () => { this.#isSpeaking = false; this.#animateSpeaking(false); };
      utterance.onerror = () => { this.#isSpeaking = false; this.#animateSpeaking(false); };

      speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('[TeacherAvatar] Erreur speak:', e);
    }
  }

  #animateSpeaking(isSpeaking) {
    const avatar = document.getElementById('teacher-avatar');
    if (!avatar) return;
    avatar.style.animation = isSpeaking ? 'speaking-pulse 0.5s infinite alternate' : 'idle-float 3s ease-in-out infinite';
  }

  #startSignAnimation() {
    const avatar = document.getElementById('teacher-avatar');
    if (!avatar) return;
    avatar.style.animation = 'sign-bounce 2s ease-in-out infinite';
    const badge = document.createElement('div');
    badge.id = 'teacher-sign-badge';
    badge.textContent = '💡';
    badge.style.cssText = `position: absolute; top: -10px; right: -10px; font-size: 1.5rem; animation: tapBounce 1s ease-in-out infinite;`;
    avatar.appendChild(badge);
  }

  #stopSignAnimation() {
    const avatar = document.getElementById('teacher-avatar');
    if (!avatar) return;
    avatar.style.animation = 'idle-float 3s ease-in-out infinite';
    const badge = document.getElementById('teacher-sign-badge');
    if (badge) badge.remove();
  }

  show(tipKey) {
          const tips = {
        'home': { fr: "Bienvenue ! Choisissez un niveau pour commencer.", mg: "Tongasoa ! Safidio ny ambaratonga." },
        'themes': { fr: "Choisissez un thème pour voir les leçons.", mg: "Safidio lohahevitra iray." },
        'theme-detail': {
          fr: "Choisissez une activité : Leçon, Révisions, Phrases ou Dialogues.",
          mg: "Safidio hetsika iray : Lesona, Fanadiniana, Fehezanteny, na Resaka."
        },
        'lesson': {
          fr: "Écoutez et répétez chaque mot à voix haute.",
          mg: "Hihainoa ary avereno ny teny tsirairay."
        },
        'lesson-phrases': {  // ✅ NOUVEAU
          fr: "Écoutez et répétez chaque phrase de contexte à voix haute.",
          mg: "Hihainoa ary avereno ny fehezanteny tsirairay."
        },
        'practice': {
          fr: "Suivez les étapes : Écoutez, Répondez au quiz, puis Prononcez.",
          mg: "Araho ny dingana : Mihainoa, Valio, Mitenena."
        },
        'practice-phrases': {  // ✅ NOUVEAU
          fr: "Révision des phrases : écoutez, traduisez, puis prononcez la phrase complète.",
          mg: "Fanadinana ny fehezanteny : mihainoa, adino, ary mitenena."
        },
        'dialogues': {
          fr: "Lisez et écoutez la conversation. Vous êtes prêt pour le Role Play !",
          mg: "Vakio ary mihainoa ny resaka. Vonona ho an'ny Role Play !"
        },
        'roleplay': { fr: "Jouez les deux rôles.", mg: "Milalao anjara asa roa." },
        'challenge': { fr: "Défi ! Parlez sans voir les réponses.", mg: "Fanamby ! Mitenena tsy mijery." }
      };

    this.#currentTip = tips[tipKey] || { fr: "Continuez, vous faites du bon travail !", mg: "Tohizo, tsara ny ataonao !" };
    this.render();

    // ✅ Sur la page d'accueil, juste un signe visuel, pas de parole auto
    if (tipKey === 'home') {
      if (this.#isFirstUser) setTimeout(() => this.#startSignAnimation(), 1000);
      return;
    }



    // ✅ Pour les autres pages, parole automatique en FRANÇAIS UNIQUEMENT
    if (this.#autoSpeakEnabled) {
      setTimeout(() => this.speak(this.#currentTip.fr), 600);
    }
  }

  render() {
    const oldAvatar = document.getElementById('teacher-avatar-container');
    if (oldAvatar) oldAvatar.remove();

    const container = document.createElement('div');
    container.id = 'teacher-avatar-container';
    container.innerHTML = `
      <style>
        @keyframes idle-float { 0%, 100% { transform: translateY(0px) scale(1); } 50% { transform: translateY(-10px) scale(1.05); } }
        @keyframes speaking-pulse { 0% { transform: scale(1); box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3); } 100% { transform: scale(1.15); box-shadow: 0 8px 24px rgba(37, 99, 235, 0.6); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes sign-bounce { 0%, 100% { transform: translateY(0) rotate(0deg); } 25% { transform: translateY(-15px) rotate(-10deg); } 75% { transform: translateY(-15px) rotate(10deg); } }
      </style>
      <div id="teacher-avatar" style="position: fixed; bottom: 100px; right: 20px; width: 80px; height: 80px; background: linear-gradient(135deg, var(--ds-color-primary), var(--ds-color-accent)); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 9999; border: 4px solid white; animation: idle-float 3s ease-in-out infinite; transition: all 0.3s;" title="Cliquez pour de l'aide">👩‍🏫</div>
      <div id="teacher-tooltip" style="position: fixed; bottom: 190px; right: 20px; max-width: 320px; background: var(--ds-color-surface); color: var(--ds-color-text); padding: 1.2rem; border-radius: var(--ds-radius-lg); box-shadow: 0 8px 24px rgba(0,0,0,0.3); z-index: 10000; display: none; border: 2px solid var(--ds-color-primary); animation: fadeIn 0.3s ease-out;">
        <div style="font-weight:600; margin-bottom:0.5rem; color:var(--ds-color-primary); font-size:1rem;">💡 Torohevitra (Conseil)</div>
        <div style="font-size:0.95rem; margin-bottom:0.5rem; line-height:1.5;">${this.#currentTip?.fr || ''}</div>
        <div style="font-size:0.85rem; color:var(--ds-color-text-muted); font-style:italic; border-top:1px solid var(--ds-color-border); padding-top:0.5rem; line-height:1.4;">${this.#currentTip?.mg || ''}</div>
        <button id="close-teacher-tooltip" style="position: absolute; top: 8px; right: 8px; background: transparent; border: none; font-size: 1.5rem; cursor: pointer; color: var(--ds-color-text-muted); line-height: 1;">×</button>
      </div>
    `;
    document.body.appendChild(container);

    const avatar = document.getElementById('teacher-avatar');
    const tooltip = document.getElementById('teacher-tooltip');
    const closeBtn = document.getElementById('close-teacher-tooltip');

    avatar.addEventListener('click', () => {
      this.#stopSignAnimation();
      tooltip.style.display = tooltip.style.display === 'none' ? 'block' : 'none';
      if (tooltip.style.display === 'block' && this.#currentTip) {
        this.speak(this.#currentTip.fr); // ✅ Parle en français au clic
      }
    });

    closeBtn.addEventListener('click', () => {
      tooltip.style.display = 'none';
      speechSynthesis.cancel();
    });
  }

  hide() {
    const container = document.getElementById('teacher-avatar-container');
    if (container) container.remove();
    speechSynthesis.cancel();
  }
}

window.teacherAvatar = new TeacherAvatar();