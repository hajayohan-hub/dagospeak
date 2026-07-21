/**
 * TeacherAvatar - Assistant virtuel animé avec voix masculine qui guide l'utilisateur.
 */
export class TeacherAvatar {
  constructor() {
    this.currentTip = '';
    this.isVisible = true;
    this.isSpeaking = false;
    this.maleVoice = null;
    this.masteredThemes = new Set(); // ✅ Compteur de thèmes maîtrisés
    this.autoSpeakEnabled = true;
    this.#loadMasteredThemes();
    this.#loadVoices();
  }

  #loadMasteredThemes() {
    const saved = localStorage.getItem('dagospeak:masteredThemes');
    if (saved) {
      this.masteredThemes = new Set(JSON.parse(saved));
    }
  }

  #saveMasteredThemes() {
    localStorage.setItem('dagospeak:masteredThemes', JSON.stringify([...this.masteredThemes]));
  }

  markThemeMastered(themeId) {
    this.masteredThemes.add(themeId);
    this.#saveMasteredThemes();

    // ✅ Après 3 thèmes maîtrisés, désactiver l'auto-parole
    if (this.masteredThemes.size >= 3) {
      this.autoSpeakEnabled = false;
      console.log('[TeacherAvatar] Auto-parole désactivée (3 thèmes maîtrisés)');
    }
  }

  #loadVoices() {
    const loadVoices = () => {
      const voices = speechSynthesis.getVoices();
      // ✅ Chercher une voix féminine française
      this.maleVoice = voices.find(v => v.lang.startsWith('fr') && (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('femme'))) ||
                       voices.find(v => v.lang.startsWith('fr')) ||
                       voices[0];
      console.log('[TeacherAvatar] Voix chargée:', this.maleVoice?.name || 'Par défaut');
    };

    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
  }

  speak(text) {

    utterance.onstart = () => {
      this.isSpeaking = true;
      this.#animateSpeaking(true);
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this.#animateSpeaking(false);
    };

    speechSynthesis.speak(utterance);
  }

  #animateSpeaking(isSpeaking) {
    const avatar = document.getElementById('teacher-avatar');
    if (!avatar) return;

    if (isSpeaking) {
      avatar.style.animation = 'speaking-pulse 0.5s infinite alternate';
    } else {
      avatar.style.animation = 'idle-float 3s ease-in-out infinite';
    }
  }

  show(tipKey) {
    const tips = {
      'home': {
        fr: "Bienvenue ! Choisissez un niveau pour commencer votre apprentissage du malgache.",
        mg: "Tongasoa ! Safidio ambaratonga mba hanombohana ny fianarana teny malagasy."
      },
      'themes': {
        fr: "Cliquez sur un thème pour voir les leçons, révisions et dialogues disponibles.",
        mg: "Tsindrio lohahevitra iray mba hahitana ny lesona, fanadiniana ary resaka azo atao."
      },
      'theme-detail': {
        fr: "Choisissez une activité : Leçon, Révisions, ou Dialogues.",
        mg: "Safidio hetsika iray : Lesona, Fanadiniana, na Resaka."
      },
      'lesson': {
        fr: "Écoutez chaque mot en cliquant sur le bouton audio. Regardez la prononciation et l'exemple.",
        mg: "Hihainoa ny teny tsirairay amin'ny alalan'ny bokotra audio. Jereo ny fomba fanononana ary ny ohatra."
      },
      'practice': {
        fr: "Suivez les étapes guidées : Écoutez, Répondez, Prononcez. Le bouton vert vous guide !",
        mg: "Araho ny dingana voatarika : Mihainoa, Valiako, Mitenena. Ny bokotra maitso dia mitarika anao !"
      },
      'dialogues': {
        fr: "Lisez la conversation et écoutez chaque ligne. Vous êtes prêt pour le Role Play !",
        mg: "Vakio ny resaka ary mihainoa ny andalana tsirairay. Vonona ianao ho an'ny Role Play !"
      },
      'roleplay': {
        fr: "Jouez les deux rôles. Écoutez, puis parlez à votre tour. Les réponses sont affichées pour vous aider.",
        mg: "Milalao anjara asa roa. Mihainoa, ary mitenena ianao. Ny valiny dia aseho mba hanampiana anao."
      },
      'challenge': {
        fr: "Défi ! Parlez sans voir les réponses. Si vous bloquez, retournez au Role Play Guidé.",
        mg: "Fanamby ! Mitenena tsy mijery ny valiny. Raha very ianao, miverina amin'ny Role Play Guidé."
      }
    };

    const tip = tips[tipKey] || { fr: "Continuez, vous faites du bon travail !", mg: "Tohizo, tsara ny ataonao !" };
    this.currentTip = tip;
    this.render();

    // ✅ Parler automatiquement SEULEMENT si l'utilisateur n'a pas encore maîtrisé 3 thèmes
    if (this.autoSpeakEnabled) {
      setTimeout(() => {
        this.speak(tip.fr);
      }, 500);
    }
  }

}


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
          0% { transform: scale(1); box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3); }
          100% { transform: scale(1.15); box-shadow: 0 8px 24px rgba(37, 99, 235, 0.6); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      </style>
      <div id="teacher-avatar" style="
        position: fixed;
        bottom: 100px;
        right: 20px;
        width: 80px;
        height: 80px;
        background: linear-gradient(135deg, var(--ds-color-primary), var(--ds-color-accent));
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2.5rem;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 9998;
        border: 4px solid white;
        animation: idle-float 3s ease-in-out infinite;
        transition: all 0.3s;
      " title="Cliquez pour de l'aide">
      👩‍🏫

      </div>
      <div id="teacher-tooltip" style="
        position: fixed;
        bottom: 190px;
        right: 20px;
        max-width: 320px;
        background: var(--ds-color-surface);
        color: var(--ds-color-text);
        padding: 1.2rem;
        border-radius: var(--ds-radius-lg);
        box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        z-index: 9999;
        display: none;
        border: 2px solid var(--ds-color-primary);
        animation: fadeIn 0.3s ease-out;
      ">
        <div style="font-weight:600; margin-bottom:0.5rem; color:var(--ds-color-primary); font-size:1rem;">
          💡 Torohevitra (Conseil)
        </div>
        <div style="font-size:0.95rem; margin-bottom:0.5rem; line-height:1.5;">
          ${this.currentTip.fr}
        </div>
        <div style="font-size:0.85rem; color:var(--ds-color-text-muted); font-style:italic; border-top:1px solid var(--ds-color-border); padding-top:0.5rem; line-height:1.4;">
          ${this.currentTip.mg}
        </div>
        <button id="close-teacher-tooltip" style="
          position: absolute;
          top: 8px;
          right: 8px;
          background: transparent;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: var(--ds-color-text-muted);
          line-height: 1;
        ">×</button>
      </div>
    `;

    document.body.appendChild(container);

    const avatar = document.getElementById('teacher-avatar');
    const tooltip = document.getElementById('teacher-tooltip');
    const closeBtn = document.getElementById('close-teacher-tooltip');

    avatar.addEventListener('click', () => {
      tooltip.style.display = tooltip.style.display === 'none' ? 'block' : 'none';
      if (tooltip.style.display === 'block') {
        this.speak(this.currentTip.fr);
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