/**
 * ContentLoader — Charge les données pédagogiques dynamiquement.
 */
export class ContentLoader {
  #cache = new Map();

  /** Charge le manifeste de la langue (ex: 'fr') */
  async loadManifest(lang) {
    if (this.#cache.has(`manifest_${lang}`)) {
      return this.#cache.get(`manifest_${lang}`);
    }
    const response = await fetch(`/content/${lang}/manifest.json`);
    if (!response.ok) throw new Error(`Impossible de charger la langue : ${lang}`);
    const manifest = await response.json();
    this.#cache.set(`manifest_${lang}`, manifest);
    return manifest;
  }

  /** Charge une section spécifique (ex: vocabulary, dialogues) */
  async loadSection(lang, section, id) {
    const cacheKey = `${lang}_${section}_${id}`;
    if (this.#cache.has(cacheKey)) return this.#cache.get(cacheKey);

    const response = await fetch(`/content/${lang}/${section}/${id}.json`);
    if (!response.ok) throw new Error(`Section introuvable : ${section}/${id}`);
    const data = await response.json();
    this.#cache.set(cacheKey, data);
    return data;
  }

  /** Liste tous les niveaux d'une langue */
  async getLevels(lang) {
    const manifest = await this.loadManifest(lang);
    return manifest.levels;
  }

  /**
 * Charge les données de leçon enrichies (vocabulary + dictionary fusionnés)
 * @param {string} lang - Langue (ex: 'fr')
 * @param {string} themeId - ID du thème (ex: 'family')
 * @returns {Promise<Object>} - Données enrichies avec audio, exam, visual depuis dictionary
 */
  async loadLessonData(lang, themeId) {
    const cacheKey = `lesson_${lang}_${themeId}`;
    if (this.#cache.has(cacheKey)) return this.#cache.get(cacheKey);

    try {
      // Charger vocabulary (données pédagogiques)
      const vocab = await this.loadSection(lang, 'vocabulary', themeId);

      // Charger dictionary (données lexicales riches)
      let dict = [];
      try {
        const dictData = await this.loadSection(lang, 'dictionary', themeId);
        dict = Array.isArray(dictData) ? dictData : [];
      } catch (e) {
        console.warn(`[ContentLoader] Dictionary ${themeId} non trouvé, utilisation vocabulary uniquement`);
      }

      // Fusionner : vocabulary + dictionary via lexicalId
      const enrichedItems = vocab.items.map(vocabItem => {
        // Trouver l'entrée correspondante dans dictionary
        const dictItem = vocabItem.lexicalId
          ? dict.find(d => d.id === vocabItem.lexicalId)
          : null;

        // Fusionner les données
        return {
          ...vocabItem,
          // Ajouter les données riches depuis dictionary si disponibles
          audio: dictItem?.audio || vocabItem.audio,
          exam: dictItem?.exam || null,
          visual: dictItem?.visual || { icon: vocabItem.icon || '📝' },
          phonetic: dictItem?.phonetic || vocabItem.phonetic,
          pos: dictItem?.pos || null
        };
      });

      const result = {
        ...vocab,
        items: enrichedItems,
        dictionaryEntries: dict // Garder accès aux entrées dictionary brutes
      };

      this.#cache.set(cacheKey, result);
      return result;

    } catch (e) {
      console.error(`[ContentLoader] Erreur chargement leçon ${themeId}:`, e);
      throw e;
    }
  }
}