/**
 * Utilitaire pour introduire un délai entre requêtes API.
 * Permet de respecter les limites de débit des fournisseurs.
 */

/**
 * Retourne une promesse résolue après `ms` millisecondes.
 * @param {number} ms - Délai en millisecondes
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Limite de débit simple : attend si le dernier appel était trop récent.
 */
export class RateLimiter {
  /**
   * @param {number} minIntervalMs - Intervalle minimum entre appels (ms)
   */
  constructor(minIntervalMs = 500) {
    this.minIntervalMs = minIntervalMs;
    this.lastCallTime = 0;
  }

  /**
   * Attend si nécessaire pour respecter l'intervalle minimum.
   * @returns {Promise<void>}
   */
  async wait() {
    const now = Date.now();
    const elapsed = now - this.lastCallTime;
    if (elapsed < this.minIntervalMs) {
      await sleep(this.minIntervalMs - elapsed);
    }
    this.lastCallTime = Date.now();
  }
}

export default { sleep, RateLimiter };
