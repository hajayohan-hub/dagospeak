/**
 * TeacherAvatar - Assistant virtuel qui guide l'utilisateur sur chaque page.
 */
export class TeacherAvatar {
  constructor() {
    this.currentTip = '';
    this.isVisible = true;
  }

  show(tipKey) {
    const tips = {
      'home': {
        fr: "Bienvenue ! Choisissez un niveau (A0 ou A1) pour commencer votre apprentissage du malgache.",
        mg: "Tongasoa ! Safidio ambaratonga (A0 na A1) mba hanombohana ny fianarana teny malagasy."
      },
      'themes': {
        fr: "Cliquez sur un thème pour voir les leçons, révisions et dialogues disponibles.",
        mg: "Tsindrio lohahevitra iray mba hahitana ny lesona, fanadiniana ary resaka azo atao."
      },
      'theme-detail': {
        fr: "Choisissez une activité : Leçon (apprendre), Révisions (quiz), ou Dialogues (conversation).",
        mg: "Safidio hetsika iray : Lesona (mianatra), Fanadiniana (quiz), na Resaka (fifampiresahana)."
      },
      'lesson': {
        fr: "Écoutez chaque mot, regardez la prononciation et l'exemple. Cliquez sur 🔊 pour entendre.",
        mg: "Hihainoa ny teny tsirairay, jereo ny fomba fanononana ary ny ohatra. Tsindrio 🔊 mba hihainoana."
      },
      'practice': {
        fr: "Suivez les étapes : 1) Écoutez, 2) Répondez au quiz, 3) Prononcez. Le bouton vert vous guide !",
        mg: "Araho ny dingana : 1) Hihainoa, 2) Valiako ny quiz, 3) Mitenena. Ny bokotra maitso dia mitarika anao !"
      },
      'dialogues': {
        fr: "Lisez la conversation et écoutez chaque ligne. Vous êtes prêt pour le Role Play !",
        mg: "Vakio ny resaka ary hihainoa ny andalana tsirairay. Vonona ianao ho an'ny Role Play !"
      },
      'roleplay': {
        fr: "Jouez les deux rôles. Écoutez, puis parlez à votre tour. Les réponses sont affichées pour vous aider.",
        mg: "Milalao anjara asa roa. Hihainoa, ary mitenena ianao. Ny valiny dia aseho mba hanampiana anao."
      },
      'challenge': {
        fr: "Défi ! Parlez sans voir les réponses. Si vous bloquez, retournez au Role Play Guidé.",
        mg: "Fanamby ! Mitenena tsy mijery ny valiny. Raha very ianao, miverina amin'ny Role Play Guidé."
      }
    };

    const tip = tips[tipKey] || { fr: "Continuez, vous faites du bon travail !", mg: "Tohizo, tsara ny ataonao !" };
    this.currentTip = tip;
    this.render();
  }

  render() {
    // Supprimer l'ancien avatar s'il existe
    const oldAvatar = document.getElementById('teacher-avatar-container');
    if (oldAvatar) oldAvatar.remove();

    const container = document.createElement('div');
    container.id = 'teacher-avatar-container';
    container.innerHTML = `
      <div id="teacher-avatar" style="
        position: fixed;
        bottom: 100px;
        right: 20px;
        width: 60px;
        height: 60px;
        background: var(--ds-color-primary);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2rem;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 9998;
        transition: transform 0.2s;
        border: 3px solid white;
      " title="Cliquez pour de l'aide">
        👨‍🏫
      </div>
      <div id="teacher-tooltip" style="
        position: fixed;
        bottom: 170px;
        right: 20px;
        max-width: 300px;
        background: var(--ds-color-surface);
        color: var(--ds-color-text);
        padding: 1rem;
        border-radius: var(--ds-radius-lg);
        box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        z-index: 9999;
        display: none;
        border: 2px solid var(--ds-color-primary);
        animation: fadeIn 0.3s ease-out;
      ">
        <div style="font-weight:600; margin-bottom:0.5rem; color:var(--ds-color-primary);">
          💡 Torohevitra (Conseil)
        </div>
        <div style="font-size:0.9rem; margin-bottom:0.5rem;">
          ${this.currentTip.fr}
        </div>
        <div style="font-size:0.85rem; color:var(--ds-color-text-muted); font-style:italic; border-top:1px solid var(--ds-color-border); padding-top:0.5rem;">
          ${this.currentTip.mg}
        </div>
        <button id="close-teacher-tooltip" style="
          position: absolute;
          top: 8px;
          right: 8px;
          background: transparent;
          border: none;
          font-size: 1.2rem;
          cursor: pointer;
          color: var(--ds-color-text-muted);
        ">×</button>
      </div>
    `;

    document.body.appendChild(container);

    // Animation CSS
    if (!document.getElementById('fade-in-style')) {
      const style = document.createElement('style');
      style.id = 'fade-in-style';
      style.innerHTML = `@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`;
      document.head.appendChild(style);
    }

    // Événements
    const avatar = document.getElementById('teacher-avatar');
    const tooltip = document.getElementById('teacher-tooltip');
    const closeBtn = document.getElementById('close-teacher-tooltip');

    avatar.addEventListener('click', () => {
      tooltip.style.display = tooltip.style.display === 'none' ? 'block' : 'none';
    });

    closeBtn.addEventListener('click', () => {
      tooltip.style.display = 'none';
    });

    // Hover effect
    avatar.addEventListener('mouseenter', () => {
      avatar.style.transform = 'scale(1.1)';
    });
    avatar.addEventListener('mouseleave', () => {
      avatar.style.transform = 'scale(1)';
    });
  }

  hide() {
    const container = document.getElementById('teacher-avatar-container');
    if (container) container.remove();
  }
}

// Instance globale
window.teacherAvatar = new TeacherAvatar();