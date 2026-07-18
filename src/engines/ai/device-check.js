/**
 * DeviceCheck - Évalue les capacités de l'appareil pour activer/désactiver les fonctionnalités lourdes.
 */
export class DeviceCheck {
  constructor() {
    this.capabilities = this.#evaluate();
  }

  #evaluate() {
    // navigator.deviceMemory est en Go (ex: 2, 4, 8). Peut être undefined sur certains navigateurs.
    const memory = navigator.deviceMemory || 4;
    // navigator.hardwareConcurrency est le nombre de cœurs CPU logiques.
    const cores = navigator.hardwareConcurrency || 4;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // Logique de décision : un appareil est considéré "low-end" si < 4 Go de RAM ou < 4 cœurs
    const isLowEnd = memory < 4 || cores < 4;

    return {
      isLowEnd,
      memory,
      cores,
      isMobile,
      // Feature Flags
      enableHeavyAI: !isLowEnd, // WebLLM / Gros modèles ONNX désactivés sur les petits appareils
      enableLocalShadowing: true, // Le shadowing léger reste activé partout
      enableOfflineMode: true,
      maxConcurrentTasks: isLowEnd ? 1 : 3
    };
  }

  getCapabilities() {
    return this.capabilities;
  }

  canRunHeavyAI() {
    return this.capabilities.enableHeavyAI;
  }
}