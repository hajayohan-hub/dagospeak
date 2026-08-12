/**
 * DeviceCheck — Détection d'appareils modestes
 * Optimise automatiquement l'UI pour les téléphones bas de gamme
 * (critique pour Madagascar : appareils modestes + connexion lente)
 */
export class DeviceCheck {
  #info = null;

  constructor() {
    this.#info = this.#detect();
    this.#applyToDOM();

    console.log('[DeviceCheck] 📱 Résultat de la détection:', this.#info);
  }

  #detect() {
    // Détection mémoire et CPU (valeurs par défaut si non supporté)
    const memory = navigator.deviceMemory || 4;
    const cores = navigator.hardwareConcurrency || 4;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    // Détection de la qualité du réseau
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection || {};
    const effectiveType = connection.effectiveType || '4g';
    const isSlowNetwork = effectiveType === '2g' || effectiveType === 'slow-2g';
    const isSaveData = connection.saveData === true;

    // ✅ Appareil modeste : moins de 4 Go RAM OU moins de 4 cœurs
    const isLowEnd = memory < 4 || cores < 4;

    // ✅ Appareil très modeste : 2 Go ou moins ET mobile
    const isVeryLowEnd = memory <= 2 && isMobile;

    return {
      isLowEnd,
      isVeryLowEnd,
      isMobile,
      isSlowNetwork,
      isSaveData,
      memory,
      cores,
      effectiveType,
      enableHeavyAI: !isLowEnd,
      enableAnimations: !isLowEnd,
      enableSkeletonShimmer: !isVeryLowEnd,
      maxConcurrentTasks: isLowEnd ? 1 : 3
    };
  }

  #applyToDOM() {
    const html = document.documentElement;

    // ✅ Classes CSS pour désactiver les animations coûteuses via CSS pur
    if (this.#info.isLowEnd) {
      html.classList.add('low-end-mode');
    }
    if (this.#info.isVeryLowEnd) {
      html.classList.add('very-low-end-mode');
    }
    if (this.#info.isSlowNetwork || this.#info.isSaveData) {
      html.classList.add('slow-network-mode');
    }
  }

  // ─── API publique ───
  isLowEnd() { return this.#info.isLowEnd; }
  isVeryLowEnd() { return this.#info.isVeryLowEnd; }
  isMobile() { return this.#info.isMobile; }
  isSlowNetwork() { return this.#info.isSlowNetwork; }
  enableAnimations() { return this.#info.enableAnimations; }
  getInfo() { return { ...this.#info }; }
}

// ✅ Instance globale accessible partout
window.deviceCheck = new DeviceCheck();