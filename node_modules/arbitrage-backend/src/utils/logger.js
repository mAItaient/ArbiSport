/**
 * Module de journalisation simple avec niveaux de log.
 * Utilise console avec horodatage ISO.
 */

const levels = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = process.env.LOG_LEVEL || 'info';

/**
 * Formate et affiche un message de log.
 * @param {string} level - Niveau de log
 * @param {string} message - Message à journaliser
 * @param {any} [data] - Données supplémentaires optionnelles
 */
function log(level, message, data) {
  if (levels[level] > levels[currentLevel]) return;

  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

  if (data !== undefined) {
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
      `${prefix} ${message}`,
      data
    );
  } else {
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
      `${prefix} ${message}`
    );
  }
}

export const logger = {
  error: (msg, data) => log('error', msg, data),
  warn: (msg, data) => log('warn', msg, data),
  info: (msg, data) => log('info', msg, data),
  debug: (msg, data) => log('debug', msg, data),
};

export default logger;
