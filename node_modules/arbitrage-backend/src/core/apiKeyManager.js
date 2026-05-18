/**
 * Gestionnaire de clés API multi-clés avec rotation automatique.
 *
 * Stratégie de sélection :
 *   - Choisit la clé `enabled=true` et `status != LIMITED` avec le plus de
 *     requêtes restantes (requests_remaining DESC), puis le moins utilisée
 *     globalement (requests_used_total ASC).
 *
 * Statuts :
 *   - ACTIVE    : requests_remaining > 20% du quota
 *   - NEAR_LIMIT: requests_remaining entre 5% et 20%
 *   - LIMITED   : requests_remaining < 5% ou 0, ou réponse 429
 */
import { EventEmitter } from 'events';
import ApiKey from '../models/ApiKey.js';
import config from '../config.js';
import logger from '../utils/logger.js';

// Singleton exporté
export const apiKeyManager = new ApiKeyManagerClass();

/**
 * Calcule le statut d'une clé selon le nombre de requêtes restantes.
 * @param {number|null} remaining - Requêtes restantes
 * @param {number|null} limit     - Quota total
 * @returns {string} 'ACTIVE' | 'NEAR_LIMIT' | 'LIMITED'
 */
function computeStatus(remaining, limit) {
  if (remaining === null || remaining === undefined || limit === null || !limit) {
    return 'ACTIVE'; // Sans info de quota, on considère ACTIVE
  }

  const pct = remaining / limit;
  const { nearLimit, limited } = config.keyStatusThresholds;

  if (pct <= limited) return 'LIMITED';
  if (pct <= nearLimit) return 'NEAR_LIMIT';
  return 'ACTIVE';
}

/**
 * Parse les headers de quota selon le fournisseur.
 * @param {string} provider - 'theOddsApi' | 'oddsApiIo'
 * @param {Object} headers  - Headers HTTP de la réponse
 * @returns {Object} {remaining, limit, reset?}
 */
export function parseQuotaHeaders(provider, headers) {
  if (!headers) return {};

  if (provider === 'theOddsApi') {
    return {
      remaining: headers['x-requests-remaining'] != null
        ? parseInt(headers['x-requests-remaining'], 10) : null,
      used: headers['x-requests-used'] != null
        ? parseInt(headers['x-requests-used'], 10) : null,
      limit: null, // TheOddsAPI ne fournit pas le total dans les headers
    };
  }

  if (provider === 'oddsApiIo') {
    const limit = headers['x-ratelimit-limit'] != null
      ? parseInt(headers['x-ratelimit-limit'], 10) : null;
    const remaining = headers['x-ratelimit-remaining'] != null
      ? parseInt(headers['x-ratelimit-remaining'], 10) : null;
    const reset = headers['x-ratelimit-reset'] || null;

    return { remaining, limit, reset };
  }

  return {};
}

function ApiKeyManagerClass() {
  // Étend EventEmitter pour les notifications
  EventEmitter.call(this);

  /**
   * Retourne la meilleure clé disponible pour un fournisseur.
   * @param {string} provider - 'theOddsApi' | 'oddsApiIo'
   * @returns {Object|null} Clé API ou null si aucune disponible
   */
  this.getKeyForRequest = function(provider) {
    const keys = ApiKey.findActiveByProvider(provider);
    if (!keys || keys.length === 0) {
      logger.warn(`Aucune clé API disponible pour ${provider}`);
      return null;
    }
    return keys[0]; // Déjà triées par remaining DESC, used ASC
  };

  /**
   * Met à jour les informations de quota d'une clé après une requête réussie.
   * @param {string} provider  - Fournisseur de données
   * @param {string} keyValue  - Valeur de la clé API
   * @param {Object} headers   - Headers HTTP de la réponse
   */
  this.updateKeyUsage = function(provider, keyValue, headers) {
    const key = ApiKey.findByValue(keyValue);
    if (!key) return;

    const quota = parseQuotaHeaders(provider, headers);
    const updates = { updated_at: new Date().toISOString() };

    if (quota.remaining !== null && quota.remaining !== undefined) {
      updates.requests_remaining = quota.remaining;
    }
    if (quota.limit !== null && quota.limit !== undefined) {
      updates.requests_limit = quota.limit;
    }
    if (quota.used !== null && quota.used !== undefined) {
      updates.requests_used_total = quota.used;
    }
    if (quota.reset) {
      updates.last_reset_at = quota.reset;
    }

    // Incrémente le compteur total si pas fourni par l'API
    if (!quota.used) {
      updates.requests_used_total = (key.requests_used_total || 0) + 1;
    }

    // Calcule le nouveau statut
    const remaining = quota.remaining ?? key.requests_remaining;
    const limit = quota.limit ?? key.requests_limit;
    updates.status = computeStatus(remaining, limit);

    ApiKey.update(key.id, updates);

    if (updates.status !== key.status) {
      const msg = `Clé ${provider} [${key.label}] : statut → ${updates.status}`;
      logger.info(msg);
      this.emit('keyStatusChange', { provider, keyValue, status: updates.status, key });
    }
  };

  /**
   * Marque une clé comme LIMITED suite à une erreur 429 ou un épuisement.
   * @param {string} provider  - Fournisseur
   * @param {string} keyValue  - Valeur de la clé
   * @param {string} [reason]  - Raison optionnelle
   */
  this.markLimited = function(provider, keyValue, reason = '429 Too Many Requests') {
    const key = ApiKey.findByValue(keyValue);
    if (!key) return;

    ApiKey.update(key.id, { status: 'LIMITED', requests_remaining: 0 });

    const msg = `Clé ${provider} [${key.label}] LIMITÉE : ${reason}`;
    logger.warn(msg);
    this.emit('keyLimited', { provider, keyValue, reason, key });
  };

  /**
   * Recharge les clés depuis la base de données.
   * Utile après une modification via l'API REST.
   */
  this.reload = function() {
    // Les modèles lisent directement la DB à chaque appel → pas de cache à vider
    logger.debug('ApiKeyManager: rechargement des clés');
  };
}

// Héritage d'EventEmitter
ApiKeyManagerClass.prototype = Object.create(EventEmitter.prototype);
ApiKeyManagerClass.prototype.constructor = ApiKeyManagerClass;

export default apiKeyManager;
