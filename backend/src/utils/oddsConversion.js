/**
 * Utilitaires de conversion de cotes entre formats américain et décimal.
 */

/**
 * Convertit une cote américaine (American odds) en cote décimale.
 * Formule :
 *   - Si american >= +100 : decimal = (american / 100) + 1
 *   - Si american < 0    : decimal = (100 / |american|) + 1
 *
 * @param {number} american - Cote américaine (ex: +150, -110)
 * @returns {number} Cote décimale arrondie à 6 décimales
 */
export function decimalFromAmerican(american) {
  if (typeof american !== 'number' || isNaN(american)) {
    throw new Error(`Cote américaine invalide : ${american}`);
  }

  if (american >= 100) {
    return parseFloat((american / 100 + 1).toFixed(6));
  } else if (american <= -100) {
    return parseFloat((100 / Math.abs(american) + 1).toFixed(6));
  } else {
    throw new Error(`Cote américaine invalide (doit être >= 100 ou <= -100) : ${american}`);
  }
}

/**
 * Convertit une cote décimale en cote américaine.
 * @param {number} decimal - Cote décimale (ex: 2.5)
 * @returns {number} Cote américaine arrondie
 */
export function americanFromDecimal(decimal) {
  if (typeof decimal !== 'number' || decimal <= 1) {
    throw new Error(`Cote décimale invalide (doit être > 1) : ${decimal}`);
  }

  if (decimal >= 2) {
    return Math.round((decimal - 1) * 100);
  } else {
    return Math.round(-100 / (decimal - 1));
  }
}

export default { decimalFromAmerican, americanFromDecimal };
