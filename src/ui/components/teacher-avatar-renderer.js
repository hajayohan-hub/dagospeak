/**
 * TeacherAvatarRenderer — Cascade de rendu intelligent
 * Ordre : 3D → SVG → Emoji (fallback)
 */
export class TeacherAvatarRenderer {
  #containerId;
  #currentMode = 'none'; // '3d', 'svg', 'emoji', 'none'
  #svgInstance = null;
  #currentExpression = 'neutral';
  #isSpeaking = false;

  constructor(containerId) {
    this.#containerId = containerId;
  }

  /**
   * Détecte les capacités disponibles et choisit le meilleur mode
   */
     #detectBestMode() {
      const isOffline = !navigator.onLine;

      // ✅ En offline : préférer SVG (pas de chargement réseau)
      if (isOffline) {
        console.log('[TeacherAvatarRenderer] Mode offline, utilisation SVG local');
        return 'svg';
      }

      // Détection WebGL pour 3D
      const canvas = document.createElement('canvas');
      const hasWebGL = !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));

      // Détection tier appareil
      let deviceTier = 'high';
      if (window.deviceCheck) {
        if (window.deviceCheck.isVeryLowEnd()) deviceTier = 'low';
        else if (window.deviceCheck.isLowEnd()) deviceTier = 'mid';
      } else {
        const ram = navigator.deviceMemory || 4;
        if (ram < 2) deviceTier = 'low';
        else if (ram < 4) deviceTier = 'mid';
      }

      console.log(`[TeacherAvatarRenderer] WebGL: ${hasWebGL}, Tier: ${deviceTier}, Offline: ${isOffline}`);

      // Cascade : 3D (seulement si high-end + WebGL) → SVG → emoji
      if (hasWebGL && deviceTier === 'high') {
        return '3d';
      } else if (deviceTier !== 'low') {
        return 'svg';
      } else {
        return 'emoji';
      }
    }
  /**
   * Rend l'avatar dans le conteneur
   */
  async render() {
    const container = document.getElementById(this.#containerId);
    if (!container) return;

    const mode = this.#detectBestMode();
    this.#currentMode = mode;

    console.log(`[TeacherAvatarRenderer] Mode sélectionné: ${mode}`);

    switch (mode) {
      case '3d':
        await this.#render3D(container);
        break;
      case 'svg':
        await this.#renderSVG(container);
        break;
      case 'emoji':
      default:
        this.#renderEmoji(container);
        break;
    }
  }

  /**
   * Rendu 3D (à implémenter plus tard avec Three.js ou modèle GLB)
   */
  async #render3D(container) {
    // TODO: Implémenter le rendu 3D avec Three.js
    // Pour l'instant, fallback sur SVG
    console.warn('[TeacherAvatarRenderer] 3D pas encore implémenté, fallback SVG');
    await this.#renderSVG(container);
  }

  /**
   * Rendu SVG animé (actuel)
   */
  async #renderSVG(container) {
    try {
      const module = await import('./teacher-avatar-svg.js');
      this.#svgInstance = new module.TeacherAvatarSVG(this.#containerId);
      this.#svgInstance.render();
      this.#svgInstance.setExpression(this.#currentExpression);
      console.log('[TeacherAvatarRenderer] ✅ SVG rendu');
    } catch (e) {
      console.warn('[TeacherAvatarRenderer] Échec SVG, fallback emoji:', e);
      this.#renderEmoji(container);
    }
  }

  /**
   * Rendu emoji (fallback ultime)
   */
  #renderEmoji(container) {
    container.innerHTML = `
      <div class="teacher-avatar-emoji" style="
        width: 80px;
        height: 80px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 4rem;
        background: linear-gradient(135deg, var(--ds-color-primary-soft), var(--ds-color-accent-soft));
        border-radius: 50%;
        box-shadow: var(--ds-shadow-md);
        transition: transform 0.3s ease;
      ">
        <span id="emoji-face">👩‍🏫</span>
      </div>
    `;
    console.log('[TeacherAvatarRenderer] ✅ Emoji rendu');
  }

  /**
   * Change l'expression (compatibilité avec l'API existante)
   */
  setExpression(expression) {
    this.#currentExpression = expression;

    if (this.#svgInstance) {
      this.#svgInstance.setExpression(expression);
    } else if (this.#currentMode === 'emoji') {
      const emojiMap = {
        'happy': '😊',
        'encouraging': '🤗',
        'thinking': '🤔',
        'neutral': '👩‍🏫',
        'surprised': '😮',
        'sad': '😔'
      };
      const emoji = document.getElementById('emoji-face');
      if (emoji) {
        emoji.textContent = emojiMap[expression] || '👩‍🏫';
      }
    }
  }

  /**
   * Démarre l'animation de parole
   */
  startSpeaking() {
    this.#isSpeaking = true;
    if (this.#svgInstance) {
      this.#svgInstance.startSpeaking();
    } else if (this.#currentMode === 'emoji') {
      const container = document.querySelector('.teacher-avatar-emoji');
      if (container) {
        container.style.animation = 'emoji-speaking 0.5s ease-in-out infinite';
      }
    }
  }

  /**
   * Arrête l'animation de parole
   */
  stopSpeaking() {
    this.#isSpeaking = false;
    if (this.#svgInstance) {
      this.#svgInstance.stopSpeaking();
    } else if (this.#currentMode === 'emoji') {
      const container = document.querySelector('.teacher-avatar-emoji');
      if (container) {
        container.style.animation = '';
      }
    }
  }

  /**
   * Retourne le mode actuel
   */
  getMode() {
    return this.#currentMode;
  }
}