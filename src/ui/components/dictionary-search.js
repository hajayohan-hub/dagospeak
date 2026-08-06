/**
 * DictionarySearch - Dictionnaire intelligent FR↔MG (VERSION CORRIGÉE)
 * - Gère les 404 silencieusement (thèmes pas encore créés)
 * - Ne re-rend que la liste lors de la recherche (pas de perte de focus clavier)
 */
export class DictionarySearch {
  #container = null;
  #entries = [];
  #filteredEntries = [];
  #currentLang = 'fr';
  #currentPage = 0;
  #pageSize = 20;
  #activeTheme = 'all';
  #searchQuery = '';

  constructor(containerId = 'app') {
    this.#container = document.getElementById(containerId);
  }

  async init() {
    this.#container.innerHTML = `
      <div style="text-align:center; padding:2rem;">
        <div style="font-size:2rem; margin-bottom:1rem;">📖</div>
        <p style="color:var(--ds-color-text-muted);">Chargement du dictionnaire...</p>
      </div>
    `;

    try {
      await this.#loadAllDictionaries();
      this.#filteredEntries = this.#entries;
      this.#renderLayout();
      this.#renderList();
      console.log(`[DictionarySearch] ✅ ${this.#entries.length} entrées chargées avec succès`);
    } catch (e) {
      console.error('[DictionarySearch] ❌ Erreur:', e);
      this.#container.innerHTML = `
        <div style="text-align:center; padding:2rem; color:var(--ds-color-danger);">
          <p>Erreur de chargement : ${e.message}</p>
          <button onclick="location.hash='/'" style="margin-top:1rem; padding:10px 20px; background:var(--ds-color-primary); color:white; border:none; border-radius:8px; cursor:pointer;">Retour</button>
        </div>
      `;
    }
  }

  async #loadAllDictionaries() {
    const themes = ['market', 'family', 'survival', 'numbers', 'colors', 'days', 'months', 'greetings', 'body', 'alphabet1', 'alphabet2', 'numbers2'];

    for (const theme of themes) {
      try {
        const response = await fetch(`/content/fr/dictionary/${theme}.json`);
        // ✅ CORRECTION CRITIQUE : On ne traite que si la réponse est OK (200)
        // Les 404 sont ignorés silencieusement, ce qui est le comportement attendu
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data)) {
            this.#entries = this.#entries.concat(data);
          }
        }
      } catch (e) {
        // Ignorer les erreurs de fetch (fichier non trouvé)
        console.log(`[DictionarySearch] ℹ️ ${theme}.json non trouvé (sera ajouté plus tard)`);
      }
    }

    if (this.#entries.length === 0) {
      throw new Error('Aucun dictionnaire trouvé. Le fichier market.json est-il bien dans content/fr/dictionary/ ?');
    }
  }

  #renderLayout() {
    // ✅ SÉCURITÉ : On filtre pour être sûr qu'aucun 'undefined' ne passe
    const validEntries = this.#entries.filter(e => e && e.category);
    const themes = [...new Set(validEntries.map(e => e.category))];

    this.#container.innerHTML = `
      <section style="max-width: 700px; margin: 0 auto; padding: 1rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
          <ds-button variant="ghost" size="sm" id="btn-back-dict">← Miverina</ds-button>
          <span id="dict-count" style="font-size:0.85rem; color:var(--ds-color-text-muted);">
            ${this.#filteredEntries.length} / ${this.#entries.length} teny
          </span>
        </div>

        <h2 style="text-align:center; color:var(--ds-color-primary); margin-bottom:0.25rem;">📖 Rakibolana (Dictionnaire)</h2>
        <p style="text-align:center; color:var(--ds-color-text-muted); font-size:0.9rem; margin-bottom:1.5rem; font-style:italic;">Dikanteny FR ↔ MG • Tsindrio ny teny hihainoana</p>

        <!-- BARRE DE RECHERCHE (Ne sera JAMAIS recréée à la frappe) -->
        <div style="position:relative; margin-bottom:1rem;">
          <input type="text" id="dict-search-input" placeholder="Tadiavo... (Rechercher un mot)"
            style="width:100%; padding:14px 16px 14px 44px; border:2px solid var(--ds-color-border); border-radius:14px; font-size:1rem; outline:none; box-sizing:border-box; background:var(--ds-color-surface); color:var(--ds-color-text); transition: border-color 0.3s;"
          >
          <span style="position:absolute; left:14px; top:50%; transform:translateY(-50%); font-size:1.2rem;">🔍</span>
        </div>

        <div style="display:flex; gap:0.5rem; margin-bottom:1.5rem; justify-content:center;">
          <button class="dict-lang-btn ${this.#currentLang === 'fr' ? 'active' : ''}" data-lang="fr" style="padding:8px 20px; border-radius:20px; font-weight:600; cursor:pointer; font-size:0.9rem; border:2px solid ${this.#currentLang === 'fr' ? 'var(--ds-color-primary)' : 'var(--ds-color-border)'}; background:${this.#currentLang === 'fr' ? 'var(--ds-color-primary)' : 'var(--ds-color-surface)'}; color:${this.#currentLang === 'fr' ? 'white' : 'var(--ds-color-text)'}; transition: all 0.2s;">🇫🇷 Français</button>
          <button class="dict-lang-btn ${this.#currentLang === 'mg' ? 'active' : ''}" data-lang="mg" style="padding:8px 20px; border-radius:20px; font-weight:600; cursor:pointer; font-size:0.9rem; border:2px solid ${this.#currentLang === 'mg' ? 'var(--ds-color-accent)' : 'var(--ds-color-border)'}; background:${this.#currentLang === 'mg' ? 'var(--ds-color-accent)' : 'var(--ds-color-surface)'}; color:${this.#currentLang === 'mg' ? 'white' : 'var(--ds-color-text)'}; transition: all 0.2s;">🇲🇬 Malagasy</button>
        </div>

        <div id="dict-theme-filters" style="display:flex; gap:0.5rem; margin-bottom:1.5rem; overflow-x:auto; padding-bottom:0.5rem;">
          <button class="dict-theme-btn ${this.#activeTheme === 'all' ? 'active' : ''}" data-theme="all" style="padding:6px 14px; border-radius:16px; font-size:0.8rem; font-weight:600; cursor:pointer; white-space:nowrap; border:1px solid ${this.#activeTheme === 'all' ? 'var(--ds-color-primary)' : 'var(--ds-color-border)'}; background:${this.#activeTheme === 'all' ? 'var(--ds-color-primary)' : 'var(--ds-color-surface)'}; color:${this.#activeTheme === 'all' ? 'white' : 'var(--ds-color-text)'};">Tous</button>
          ${themes.map(cat => `
            <button class="dict-theme-btn ${this.#activeTheme === cat ? 'active' : ''}" data-theme="${cat}" style="padding:6px 14px; border-radius:16px; font-size:0.8rem; font-weight:600; cursor:pointer; white-space:nowrap; border:1px solid ${this.#activeTheme === cat ? 'var(--ds-color-primary)' : 'var(--ds-color-border)'}; background:${this.#activeTheme === cat ? 'var(--ds-color-primary)' : 'var(--ds-color-surface)'}; color:${this.#activeTheme === cat ? 'white' : 'var(--ds-color-text)'};">${this.#getThemeIcon(cat)} ${cat}</button>
          `).join('')}
        </div>

        <!-- LISTE DES MOTS (mise à jour dynamiquement SANS toucher au reste) -->
        <div id="dict-entries-list" style="display:flex; flex-direction:column; gap:0.75rem; margin-bottom:1.5rem;"></div>
        <div id="dict-pagination" style="display:flex; justify-content:center; gap:0.5rem; margin-bottom:1rem;"></div>
      </section>
    `;

    this.#attachEventListeners();
  }

  #renderList() {
    const paginatedEntries = this.#filteredEntries.slice(this.#currentPage * this.#pageSize, (this.#currentPage + 1) * this.#pageSize);
    const totalPages = Math.ceil(this.#filteredEntries.length / this.#pageSize);

    const countEl = document.getElementById('dict-count');
    if (countEl) countEl.textContent = `${this.#filteredEntries.length} / ${this.#entries.length} teny`;

    const listEl = document.getElementById('dict-entries-list');
    if (listEl) {
      if (paginatedEntries.length > 0) {
        listEl.innerHTML = paginatedEntries.map(entry => this.#renderEntryCard(entry)).join('');
      } else {
        listEl.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--ds-color-text-muted);"><div style="font-size:3rem; margin-bottom:1rem;">🔍</div><p>Aucun mot trouvé</p><p style="font-size:0.85rem; font-style:italic;">(Tsy misy teny hita)</p></div>`;
      }
    }

    const pagEl = document.getElementById('dict-pagination');
    if (pagEl) {
      if (totalPages > 1) {
        pagEl.innerHTML = `
          <button id="dict-prev-page" ${this.#currentPage === 0 ? 'disabled' : ''} style="padding:8px 16px; border-radius:8px; border:1px solid var(--ds-color-border); background:var(--ds-color-surface); cursor:${this.#currentPage === 0 ? 'not-allowed' : 'pointer'}; opacity:${this.#currentPage === 0 ? '0.5' : '1'};">←</button>
          <span style="padding:8px 16px; font-weight:600; color:var(--ds-color-text);">${this.#currentPage + 1} / ${totalPages}</span>
          <button id="dict-next-page" ${this.#currentPage >= totalPages - 1 ? 'disabled' : ''} style="padding:8px 16px; border-radius:8px; border:1px solid var(--ds-color-border); background:var(--ds-color-surface); cursor:${this.#currentPage >= totalPages - 1 ? 'not-allowed' : 'pointer'}; opacity:${this.#currentPage >= totalPages - 1 ? '0.5' : '1'};">→</button>
        `;
        document.getElementById('dict-prev-page')?.addEventListener('click', () => {
          if (this.#currentPage > 0) { this.#currentPage--; this.#renderList(); document.getElementById('dict-entries-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        });
        document.getElementById('dict-next-page')?.addEventListener('click', () => {
          if (this.#currentPage < totalPages - 1) { this.#currentPage++; this.#renderList(); document.getElementById('dict-entries-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        });
      } else {
        pagEl.innerHTML = '';
      }
    }
    this.#attachCardListeners();
  }

  #renderEntryCard(entry) {
    const isFr = this.#currentLang === 'fr';
    const mainWord = isFr ? entry.wordFr : entry.wordMg;
    const translation = isFr ? entry.wordMg : entry.wordFr;
    const posLabel = this.#getPosLabel(entry.pos);

    return `
      <div class="dict-entry-card" data-id="${entry.id}" style="background:var(--ds-color-surface); padding:1rem 1.25rem; border-radius:12px; border:1px solid var(--ds-color-border); cursor:pointer; transition: all 0.2s; display:flex; justify-content:space-between; align-items:center;">
        <div style="flex:1;">
          <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:0.25rem;">
            <span style="font-size:1.5rem;">${entry.visual?.icon || '📝'}</span>
            <div>
              <strong style="font-size:1.1rem; color:var(--ds-color-primary);">${mainWord}</strong>
              <span style="font-size:0.75rem; color:var(--ds-color-accent); margin-left:0.5rem; background:var(--ds-color-accent-soft, #fef3c7); padding:2px 8px; border-radius:10px;">${posLabel}</span>
            </div>
          </div>
          <div style="font-size:0.9rem; color:var(--ds-color-text-muted); margin-left:2.25rem;">→ ${translation}</div>
        </div>
        <button class="dict-play-btn" data-tts="${entry.audio?.ttsTextFr || entry.wordFr}" style="background:var(--ds-color-primary-soft, #d1fae5); border:none; border-radius:50%; width:40px; height:40px; font-size:1.2rem; cursor:pointer; display:flex; align-items:center; justify-content:center; transition: all 0.2s; flex-shrink:0;">🔊</button>
      </div>
    `;
  }

  #attachEventListeners() {
    document.getElementById('btn-back-dict')?.addEventListener('click', () => { location.hash = '/'; });

    // ✅ RECHERCHE SANS PERTE DE FOCUS : appelle #applyFilters (qui ne touche pas à l'input)
    const searchInput = document.getElementById('dict-search-input');
    let searchTimeout;
    searchInput?.addEventListener('input', (e) => {
      this.#searchQuery = e.target.value.trim();
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => { this.#applyFilters(); }, 200);
    });

    document.querySelectorAll('.dict-lang-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.#currentLang = btn.dataset.lang;
        document.querySelectorAll('.dict-lang-btn').forEach(b => {
          const isActive = b.dataset.lang === this.#currentLang;
          const color = isActive ? (this.#currentLang === 'fr' ? 'var(--ds-color-primary)' : 'var(--ds-color-accent)') : 'var(--ds-color-border)';
          const bg = isActive ? (this.#currentLang === 'fr' ? 'var(--ds-color-primary)' : 'var(--ds-color-accent)') : 'var(--ds-color-surface)';
          b.style.borderColor = color; b.style.background = bg; b.style.color = isActive ? 'white' : 'var(--ds-color-text)';
        });
        this.#applyFilters();
      });
    });

    document.querySelectorAll('.dict-theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.#activeTheme = btn.dataset.theme;
        document.querySelectorAll('.dict-theme-btn').forEach(b => {
          const isActive = b.dataset.theme === this.#activeTheme;
          b.style.borderColor = isActive ? 'var(--ds-color-primary)' : 'var(--ds-color-border)';
          b.style.background = isActive ? 'var(--ds-color-primary)' : 'var(--ds-color-surface)';
          b.style.color = isActive ? 'white' : 'var(--ds-color-text)';
        });
        this.#applyFilters();
      });
    });
  }

  #attachCardListeners() {
    document.querySelectorAll('.dict-entry-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.dict-play-btn')) return;
        const entry = this.#entries.find(en => en.id === card.dataset.id);
        if (entry) this.#renderEntryDetail(entry);
      });
    });

    document.querySelectorAll('.dict-play-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#speakFrench(btn.dataset.tts, 0.9);
        btn.textContent = '🔊 ...';
        setTimeout(() => { btn.textContent = '🔊'; }, 1500);
      });
    });
  }

  #applyFilters() {
    this.#filteredEntries = this.#entries.filter(entry => {
      if (this.#activeTheme !== 'all' && entry.category !== this.#activeTheme) return false;
      if (!this.#searchQuery) return true;
      const q = this.#searchQuery.toLowerCase();
      return (
        entry.wordFr?.toLowerCase().includes(q) ||
        entry.wordMg?.toLowerCase().includes(q) ||
        entry.context?.exampleFr?.toLowerCase().includes(q) ||
        entry.context?.exampleMg?.toLowerCase().includes(q)
      );
    });
    this.#currentPage = 0;
    this.#renderList(); // ✅ Ne met à jour QUE la liste, l'input garde le focus
  }

  #renderEntryDetail(entry) {
    const posLabel = this.#getPosLabel(entry.pos);
    this.#container.innerHTML = `
      <section style="max-width: 700px; margin: 0 auto; padding: 1rem;">
        <ds-button variant="ghost" size="sm" id="btn-back-list">← Rakibolana (Retour)</ds-button>
        <div style="background: linear-gradient(135deg, var(--ds-color-primary) 0%, #087a62 100%); padding: 2rem; border-radius: 16px; margin: 1rem 0 1.5rem 0; text-align: center; color: white;">
          <div style="font-size: 4rem; margin-bottom: 0.5rem;">${entry.visual?.icon || '📝'}</div>
          <h2 style="margin: 0 0 0.25rem 0; font-size: 2rem;">${entry.wordFr}</h2>
          <p style="margin: 0 0 0.5rem 0; font-size: 1.3rem; opacity: 0.9;">${entry.wordMg}</p>
          <div style="display:flex; gap:0.5rem; justify-content:center; align-items:center;">
            <span style="background:rgba(255,255,255,0.2); padding:4px 12px; border-radius:12px; font-size:0.85rem;">${posLabel}</span>
            <span style="background:rgba(255,255,255,0.2); padding:4px 12px; border-radius:12px; font-size:0.85rem;">Niveau ${entry.level}</span>
          </div>
         ${entry.phonetic ? `<p style="margin:0.75rem 0 0 0; font-family:monospace; font-size:1rem; opacity:0.9; background: rgba(255,255,255,0.15); display: inline-block; padding: 4px 12px; border-radius: 8px;">🗣️ Prononciation (FR) : ${entry.phonetic}</p>` : ''}
          <button id="btn-play-detail" style="margin-top:1rem; background:white; color:var(--ds-color-primary); border:none; padding:12px 28px; border-radius:12px; font-weight:700; font-size:1rem; cursor:pointer; box-shadow:0 4px 12px rgba(0,0,0,0.2);">🔊 Mihainoa (Écouter)</button>
        </div>
        ${entry.context ? `
          <div style="background:var(--ds-color-surface); padding:1.5rem; border-radius:12px; border:1px solid var(--ds-color-border); margin-bottom:1rem;">
            <h3 style="color:var(--ds-color-primary); margin:0 0 0.75rem 0; font-size:1rem;">💬 Ohabolana (Exemples)</h3>
            <div style="background:var(--ds-color-surface-2); padding:1rem; border-radius:8px; margin-bottom:0.5rem;">
              <p style="margin:0 0 0.25rem 0; font-weight:600; color:var(--ds-color-text);">🇫🇷 ${entry.context.exampleFr || ''}</p>
              <p style="margin:0; color:var(--ds-color-text-muted); font-style:italic;">🇲🇬 ${entry.context.exampleMg || ''}</p>
            </div>
            ${entry.context.situation ? `<p style="margin:0.5rem 0 0 0; font-size:0.85rem; color:var(--ds-color-text-muted);">📍 ${entry.context.situation}</p>` : ''}
          </div>
        ` : ''}
        <div style="background:var(--ds-color-surface); padding:1.5rem; border-radius:12px; border:1px solid var(--ds-color-border); margin-bottom:1rem;">
          <h3 style="color:var(--ds-color-primary); margin:0 0 0.75rem 0; font-size:1rem;">📋 Mombamomba (Détails)</h3>
          <div style="display:grid; gap:0.5rem;">
            <div style="display:flex; justify-content:space-between; padding:0.5rem 0; border-bottom:1px solid var(--ds-color-border);"><span style="color:var(--ds-color-text-muted);">Catégorie</span><strong>${this.#getThemeIcon(entry.category)} ${entry.category}</strong></div>
            <div style="display:flex; justify-content:space-between; padding:0.5rem 0; border-bottom:1px solid var(--ds-color-border);"><span style="color:var(--ds-color-text-muted);">Niveau CECR</span><strong>${entry.level}</strong></div>
            <div style="display:flex; justify-content:space-between; padding:0.5rem 0; border-bottom:1px solid var(--ds-color-border);"><span style="color:var(--ds-color-text-muted);">Nature du mot</span><strong>${posLabel}</strong></div>
            ${entry.exam?.eligibleFor ? `<div style="display:flex; justify-content:space-between; padding:0.5rem 0;"><span style="color:var(--ds-color-text-muted);">Examens</span><strong>${entry.exam.eligibleFor.map(e => e.replace('exam_', '').toUpperCase()).join(', ')}</strong></div>` : ''}
          </div>
        </div>
        <button id="btn-back-list-bottom" style="width:100%; padding:14px; background:var(--ds-color-primary); color:white; border:none; border-radius:12px; font-weight:600; font-size:1rem; cursor:pointer;">← Hiverina amin'ny lisitra (Retour à la liste)</button>
      </section>
    `;
    document.getElementById('btn-back-list')?.addEventListener('click', () => { this.#renderLayout(); this.#renderList(); });
    document.getElementById('btn-back-list-bottom')?.addEventListener('click', () => { this.#renderLayout(); this.#renderList(); });
    document.getElementById('btn-play-detail')?.addEventListener('click', () => { this.#speakFrench(entry.audio?.ttsTextFr || entry.wordFr, entry.audio?.ttsRate || 0.9); });
  }

  #speakFrench(text, rate = 0.9) {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = rate;
    speechSynthesis.speak(utterance);
  }

  #getPosLabel(pos) {
  // ✅ SÉCURITÉ : Gérer tous les cas possibles
  if (!pos || typeof pos !== 'string') return '—';

  const labels = {
    'nom': 'Nom (Anarana)',
    'verbe': 'Verbe (Matoanteny)',
    'adjectif': 'Adj. (Mpamaritra)',
    'adverbe': 'Adv. (Mpamari-toetra)',
    'interjection': 'Interj. (Fihobiana)',
    'pronom': 'Pronom (Mpisolo)',
    'préposition': 'Prép. (Mpampiankin-teny)',
    'conjonction': 'Conj. (Mpampitohy)',
    'article': 'Article (Mpanoritra)',
    'lettre': 'Lettre (Litera)',       // ✅ AJOUTÉ pour alphabet1/2
    'locution': 'Locution (Fitarihana)' // ✅ AJOUTÉ pour greetings
  };

  return labels[pos.toLowerCase()] || pos || '—';
}

  #getThemeIcon(theme) {
    const icons = { 'market': '🛒', 'family': '👨‍👩‍👧', 'survival': '🆘', 'numbers': '🔢', 'colors': '🎨', 'days': '📅', 'months': '🗓️', 'greetings': '👋', 'body': '🧍', 'alphabet1': '🔤', 'alphabet2': '🔡', 'numbers2': '🧮' };
    return icons[theme] || '📁';
  }
}