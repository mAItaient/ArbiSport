/**
 * Module d'analytics : hotspots d'arbitrage.
 *
 * Agrège les opportunités historiques pour identifier :
 *   - Les paires de marchés/bookmakers les plus fréquentes
 *   - Les ROI moyens par combinaison
 */
import ArbitrageOpportunity from '../models/ArbitrageOpportunity.js';
import logger from '../utils/logger.js';

/**
 * Calcule les hotspots d'arbitrage sur une période donnée.
 * @param {Object} params - {days, groupBy, minOccurrences}
 * @returns {Array<Object>} Tableau trié par occurrences DESC
 */
export function hotspots({ days = 7, groupBy = 'market', minOccurrences = 1 } = {}) {
  logger.debug(`Calcul hotspots: ${days} jours, groupBy=${groupBy}, minOcc=${minOccurrences}`);
  return ArbitrageOpportunity.getHotspots({ days, groupBy, minOccurrences });
}

/**
 * Retourne les statistiques globales (nombre d'opps, ROI moyen, etc.).
 * @param {number} days - Nombre de jours d'historique
 * @returns {Object} Statistiques globales
 */
export function getGlobalStats(days = 7) {
  const { items } = ArbitrageOpportunity.findAll({
    since: new Date(Date.now() - days * 24 * 3600 * 1000).toISOString(),
  });

  if (!items || items.length === 0) {
    return { count: 0, avgRoi: 0, maxRoi: 0, avgGainMin: 0 };
  }

  const count = items.length;
  const avgRoi = items.reduce((s, o) => s + (o.roi || 0), 0) / count;
  const maxRoi = Math.max(...items.map(o => o.roi || 0));
  const avgGainMin = items.reduce((s, o) => s + (o.gain_min || 0), 0) / count;

  return {
    count,
    avgRoi: parseFloat(avgRoi.toFixed(4)),
    maxRoi: parseFloat(maxRoi.toFixed(4)),
    avgGainMin: parseFloat(avgGainMin.toFixed(4)),
  };
}

export default { hotspots, getGlobalStats };
