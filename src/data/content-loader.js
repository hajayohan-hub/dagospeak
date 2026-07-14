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
}