/**
 * DownloadProgress - Barre de progression non bloquante pour les téléchargements lourds.
 */
export class DownloadProgress {
  #container = null;
  #bar = null;
  #text = null;
  #percentage = null;
  #isVisible = false;

  constructor() {
    this.#createContainer();
  }

  #createContainer() {
    if (document.getElementById('download-progress-container')) {
      this.#container = document.getElementById('download-progress-container');
    } else {
      this.#container = document.createElement('div');
      this.#container.id = 'download-progress-container';
      this.#container.innerHTML = `
        <style>
          @keyframes slideInUp {
            from { transform: translateY(100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
          @keyframes pulse-soft {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }
        </style>
        <div id="download-progress-box" style="
          position: fixed;
          bottom: 80px;
          left: 50%;
          transform: translateX(-50%);
          width: min(90%, 400px);
          background: var(--ds-color-surface);
          border: 2px solid var(--ds-color-primary);
          border-radius: var(--ds-radius-lg);
          padding: 1rem;
          box-shadow: 0 8px 24px rgba(0,0,0,0.2);
          z-index: 9997;
          animation: slideInUp 0.3s ease-out;
          display: none;
        ">
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
            <span style="font-size: 1.5rem; animation: pulse-soft 2s infinite;">📥</span>
            <div style="flex: 1;">
              <div style="font-weight: 600; font-size: 0.9rem; color: var(--ds-color-text);">
                Téléchargement du moteur vocal
              </div>
              <div style="font-size: 0.75rem; color: var(--ds-color-text-muted);">
                Pour une reconnaissance vocale 100% hors-ligne
              </div>
            </div>
            <div id="download-percentage" style="font-weight: bold; color: var(--ds-color-primary); font-size: 0.9rem;">
              0%
            </div>
          </div>
          <div style="
            width: 100%;
            height: 8px;
            background: var(--ds-color-border);
            border-radius: 4px;
            overflow: hidden;
            position: relative;
          ">
            <div id="download-bar" style="
              height: 100%;
              background: linear-gradient(90deg, var(--ds-color-primary), var(--ds-color-accent), var(--ds-color-primary));
              background-size: 200% 100%;
              animation: shimmer 2s linear infinite;
              width: 0%;
              transition: width 0.3s ease;
              border-radius: 4px;
            "></div>
          </div>
          <div id="download-text" style="
            font-size: 0.75rem;
            color: var(--ds-color-text-muted);
            margin-top: 0.5rem;
            text-align: center;
          ">
            Préparation...
          </div>
        </div>
      `;
      document.body.appendChild(this.#container);
    }

    this.#bar = document.getElementById('download-bar');
    this.#text = document.getElementById('download-text');
    this.#percentage = document.getElementById('download-percentage');
  }

  show() {
    const box = document.getElementById('download-progress-box');
    if (box) {
      box.style.display = 'block';
      this.#isVisible = true;
    }
  }

  hide() {
    const box = document.getElementById('download-progress-box');
    if (box) {
      box.style.display = 'none';
      this.#isVisible = false;
    }
  }

  update(percent, message = '') {
    if (!this.#isVisible) this.show();

    const clampedPercent = Math.max(0, Math.min(100, percent));

    if (this.#bar) {
      this.#bar.style.width = `${clampedPercent}%`;
    }
    if (this.#percentage) {
      this.#percentage.textContent = `${Math.round(clampedPercent)}%`;
    }
    if (this.#text && message) {
      this.#text.textContent = message;
    }
  }

  success(message = 'Téléchargement terminé !') {
    this.update(100, message);
    if (this.#bar) {
      this.#bar.style.background = 'var(--ds-color-success)';
      this.#bar.style.animation = 'none';
    }
    if (this.#percentage) {
      this.#percentage.textContent = '✅';
      this.#percentage.style.color = 'var(--ds-color-success)';
    }
    setTimeout(() => this.hide(), 3000);
  }

  error(message = 'Erreur de téléchargement') {
    this.update(0, message);
    if (this.#bar) {
      this.#bar.style.background = 'var(--ds-color-danger)';
      this.#bar.style.animation = 'none';
    }
    if (this.#percentage) {
      this.#percentage.textContent = '❌';
      this.#percentage.style.color = 'var(--ds-color-danger)';
    }
    setTimeout(() => this.hide(), 4000);
  }
}