/**
 * GamificationEngine — Gère l'XP, les niveaux et les séries (streaks).
 */
export class GamificationEngine {
  #db;
  #bus;

  constructor(db, bus) {
    this.#db = db;
    this.#bus = bus;
  }

    async getProfile() {
    let profile = await this.#db.get('progress', 'user_profile');
    if (!profile) {
      // ⬇️ AJOUTEZ `id: 'user_profile'` ICI ⬇️
      profile = { id: 'user_profile', xp: 0, level: 1, streak: 0, lastActiveDate: null };
      await this.#db.put('progress', profile);
    }
    return profile;
  }

  async addXP(amount, reason = 'Leçon complétée') {
    const profile = await this.getProfile();
    const oldLevel = profile.level;
    
    profile.xp += amount;
    // Formule de niveau : chaque niveau nécessite 100 XP * niveau actuel
    profile.level = Math.floor(profile.xp / 100) + 1;

    await this.#db.put('progress', profile);

    if (profile.level > oldLevel) {
      this.#bus.emit('gamification:levelUp', { level: profile.level });
    }
    this.#bus.emit('gamification:xpAdded', { amount, reason, totalXP: profile.xp });
    
    return profile;
  }

  async updateStreak() {
    const profile = await this.getProfile();
    const today = new Date().toDateString();
    
    if (profile.lastActiveDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      
      if (profile.lastActiveDate === yesterday) {
        profile.streak = (profile.streak || 0) + 1;
      } else {
        profile.streak = 1; // Reset ou premier jour
      }
      
      profile.lastActiveDate = today;
      await this.#db.put('progress', profile);
      this.#bus.emit('gamification:streakUpdated', { streak: profile.streak });
    }
    
    return profile.streak;
  }
}