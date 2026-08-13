/**
 * TeacherAvatarSVG — Avatar SVG animé pour conversation live
 * Expressions faciales complètes + synchronisation bouche/TTS
 */
export class TeacherAvatarSVG {
  #container = null;
  #isSpeaking = false;

  constructor(containerId) {
    this.#container = document.getElementById(containerId);
  }

  render() {
    if (!this.#container) return;

    this.#container.innerHTML = `
      <svg id="teacher-svg-avatar" width="120" height="120" viewBox="0 0 120 120">
        <!-- Visage -->
        <circle cx="60" cy="60" r="55" fill="#f4c2a1" stroke="#d4a574" stroke-width="2"/>

        <!-- Yeux -->
        <g id="teacher-eyes">
          <circle cx="40" cy="50" r="6" fill="#2c3e50">
            <animate attributeName="r" values="6;1;6" dur="3s" repeatCount="indefinite"/>
          </circle>
          <circle cx="80" cy="50" r="6" fill="#2c3e50">
            <animate attributeName="r" values="6;1;6" dur="3s" repeatCount="indefinite"/>
          </circle>
        </g>

        <!-- Sourcils -->
        <g id="teacher-eyebrows">
          <path d="M 30 40 Q 40 35 50 40" stroke="#2c3e50" stroke-width="3" fill="none"/>
          <path d="M 70 40 Q 80 35 90 40" stroke="#2c3e50" stroke-width="3" fill="none"/>
        </g>

        <!-- Bouche -->
        <ellipse id="teacher-mouth" cx="60" cy="75" rx="15" ry="8" fill="#c0392b">
          <animate attributeName="ry" values="8;12;8" dur="0.3s" repeatCount="indefinite" begin="indefinite"/>
        </ellipse>

        <!-- Joues (rougeurs) -->
        <circle cx="35" cy="65" r="8" fill="#ffb3ba" opacity="0.6"/>
        <circle cx="85" cy="65" r="8" fill="#ffb3ba" opacity="0.6"/>
      </svg>
    `;
  }

  startSpeaking() {
    if (this.#isSpeaking) return;
    this.#isSpeaking = true;

    const mouth = document.getElementById('teacher-mouth');
    if (mouth) {
      const anim = mouth.querySelector('animate');
      if (anim) anim.beginElement();
    }
  }

  stopSpeaking() {
    if (!this.#isSpeaking) return;
    this.#isSpeaking = false;

    const mouth = document.getElementById('teacher-mouth');
    if (mouth) {
      const anim = mouth.querySelector('animate');
      if (anim) anim.endElement();
      mouth.setAttribute('ry', '8');
    }
  }

  setExpression(expression) {
    const eyebrows = document.getElementById('teacher-eyebrows');
    if (!eyebrows) return;

    const paths = eyebrows.querySelectorAll('path');

    switch(expression) {
      case 'happy':
        paths[0].setAttribute('d', 'M 30 38 Q 40 33 50 38');
        paths[1].setAttribute('d', 'M 70 38 Q 80 33 90 38');
        break;
      case 'thinking':
        paths[0].setAttribute('d', 'M 30 42 Q 40 45 50 42');
        paths[1].setAttribute('d', 'M 70 38 Q 80 33 90 38');
        break;
      case 'encouraging':
        paths[0].setAttribute('d', 'M 30 36 Q 40 31 50 36');
        paths[1].setAttribute('d', 'M 70 36 Q 80 31 90 36');
        break;
      default: // neutral
        paths[0].setAttribute('d', 'M 30 40 Q 40 35 50 40');
        paths[1].setAttribute('d', 'M 70 40 Q 80 35 90 40');
    }
  }
}