/**
 * RoleManager — Gère les permissions basées sur les rôles.
 */
export const ROLES = {
  learner: ['learn', 'review', 'practice', 'view_own_stats'],
  teacher: ['learn', 'review', 'practice', 'view_own_stats', 'manage_class', 'view_class_stats'],
  school:  ['manage_school', 'manage_teachers', 'view_school_stats'],
  admin:   ['manage_users', 'manage_content', 'manage_subscriptions', 'view_analytics'],
  superadmin: ['*'] // Accès total
};

export class RoleManager {
  #db;        // ✅ Déclaration obligatoire du champ privé
  #user = null;

  constructor(db) {
    this.#db = db;
  }

  async init() {
    // Récupère le rôle depuis le profil utilisateur (défaut: 'learner')
    const profile = await this.#db.get('progress', 'user_profile') || {};
    this.#user = { role: profile.role || 'learner' };
  }

  setUserRole(role) {
    if (this.#user) {
      this.#user.role = role;
    }
  }

  can(permission) {
    if (!this.#user) return false;
    const perms = ROLES[this.#user.role] || [];
    return perms.includes('*') || perms.includes(permission);
  }

  getRole() {
    return this.#user?.role || 'learner';
  }
}