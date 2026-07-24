/**
 * TeacherAvatar - Assistant virtuel avec animations de signe et feedback intelligent
 */
export class TeacherAvatar {
  #container = null;
  #currentTip = null;
  #isSpeaking = false;
  #femaleVoice = null;
  #masteredThemes = new Set();
  #autoSpeakEnabled = false; // ✅ Désactivé par défaut
  #isFirstUser = true;
  #signAnimationInterval = null;

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
    if (this.#masteredThemes.size >= 3) {
      this.#autoSpeakEnabled = false;
    }
  }

  #loadVoices() {
    const loadVoices = () => {
      const voices = speechSynthesis.getVoices();
      this.#femaleVoice = voices.find(v => v.lang.startsWith('fr') && (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('femme'))) ||
                         voices.find(v => v.lang.startsWith('fr')) || voices[0];
    };
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
  }

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

  // ✅ NOUVELLE MÉTHODE : Animation de signe pour attirer l'attention
  #startSignAnimation() {
    const avatar = document.getElementById('teacher-avatar');
    if (!avatar) return;

    // Animation de rebond + rotation pour signaler "cliquez-moi"
    avatar.style.animation = 'sign-bounce 2s ease-in-out infinite';

    // Ajouter un badge "!" clignotant
    const badge = document.createElement('div');
    badge.id = 'teacher-sign-badge';
    badge.textContent = '💡';
    badge.style.cssText = `
      position: absolute;
      top: -10px;
      right: -10px;
      font-size: 1.5rem;
      animation: blink 1s ease-in-out infinite;
    `;
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
      'home': {
        fr: "Bienvenue ! Cliquez sur le bouton 'Commencer' pour choisir votre niveau.",
        mg: "Tongasoa ! Tsindrio ny bokotra 'Commencer' mba hifidianana ny ambaratonga."
      },
      'themes': {
        fr: "Choisissez un thème pour voir les leçons disponibles.",
        mg: "Safidio lohahevitra iray mba hahitana ny lesona."
      },
      'theme-detail': {
        fr: "Choisissez une activité : Leçon, Révisions, ou Dialogues.",
        mg: "Safidio hetsika iray : Lesona, Fanadiniana, na Resaka."
      },
      'lesson': {
        fr: "Écoutez chaque mot en cliquant sur le bouton audio.",
        mg: "Hihainoa ny teny tsirairay amin'ny bokotra audio."
      },
      'practice': {
        fr: "Suivez les étapes : Écoutez, Répondez, Prononcez.",
        mg: "Araho ny dingana : Mihainoa, Valiako, Mitenena."
      },
      'dialogues': {
        fr: "Lisez la conversation et écoutez chaque ligne.",
        mg: "Vakio ny resaka ary mihainoa ny andalana tsirairay."
      },
      'roleplay': {
        fr: "Jouez les deux rôles. Écoutez, puis parlez.",
        mg: "Milalao anjara asa roa. Mihainoa, ary mitenena."
      },
      'challenge': {
        fr: "Défi ! Parlez sans voir les réponses.",
        mg: "Fanamby ! Mitenena tsy mijery ny valiny."
      }
    };

    this.#currentTip = tips[tipKey] || { fr: "Continuez !", mg: "Tohizo !" };
    this.render();

    // ✅ CORRECTION : Sur la page d'accueil, NE PAS parler automatiquement
    // Le bouton "Commencer" s'en charge
    if (tipKey === 'home') {
      // Juste l'animation de signe pour attirer l'attention
      if (this.#isFirstUser) {
        setTimeout(() => this.#startSignAnimation(), 1000);
      }
      return; // ✅ Sortir sans parler
    }

    // Pour les autres pages, parler automatiquement si activé
    if (this.#autoSpeakEnabled) {
      setTimeout(() => this.speak(this.#currentTip.fr), 500);
    }
  }

  // ✅ NOUVELLE MÉTHODE : Feedback de fin de parcours
  showEndOfJourneyFeedback(completedJourneys, totalJourneys) {
    const percentage = (completedJourneys / totalJourneys) * 100;
    let message = '';

    if (percentage === 100) {
      message = {
        fr: "Félicitations ! Vous avez terminé tous les parcours. Vous êtes prêt pour le niveau suivant !",
        mg: "Faly be ! Vita ny parcours rehetra. Vonona ho an'ny ambaratonga manaraka ianao !"
      };
    } else if (percentage >= 50) {
      message = {
        fr: `Bon travail ! ${Math.round(percentage)}% terminé. Continuez ainsi !`,
        mg: `Tsara ! ${Math.round(percentage)}% vita. Tohizo izany !`
      };
    } else {
      message = {
        fr: `Vous avez complété ${Math.round(percentage)}% des parcours. Il reste du travail !`,
        mg: `${Math.round(percentage)}% ny parcours no vita. Mbola misy asa !`
      };
    }

    this.#currentTip = message;
    this.speak(message.fr);
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
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      </style>
      <div id="teacher-avatar" style="position: fixed; bottom: 100px; right: 20px; width: 80px; height: 80px; background: linear-gradient(135deg, var(--ds-color-primary), var(--ds-color-accent)); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 9998; border: 4px solid white; animation: idle-float 3s ease-in-out infinite; transition: all 0.3s;" title="Cliquez pour de l'aide">👩‍🏫</div>
      <div id="teacher-tooltip" style="position: fixed; bottom: 190px; right: 20px; max-width: 320px; background: var(--ds-color-surface); color: var(--ds-color-text); padding: 1.2rem; border-radius: var(--ds-radius-lg); box-shadow: 0 8px 24px rgba(0,0,0,0.3); z-index: 9999; display: none; border: 2px solid var(--ds-color-primary); animation: fadeIn 0.3s ease-out;">
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
        this.speak(this.#currentTip.fr);
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