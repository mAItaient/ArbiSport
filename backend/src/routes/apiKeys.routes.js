/**
 * Routes de gestion des clés API.
 * GET    /api/api-keys              → liste toutes les clés
 * POST   /api/api-keys              → ajoute une clé
 * PUT    /api/api-keys/:id          → met à jour une clé
 * DELETE /api/api-keys/:id          → supprime une clé
 * POST   /api/api-keys/:id/toggle   → active/désactive une clé
 */
import { Router } from 'express';
import { z } from 'zod';
import ApiKey from '../models/ApiKey.js';
import { getSelectedBookmakers, _resetSelectedCache } from '../integrations/oddsApiIoClient.js';

const router = Router();

// Quotas par défaut selon le fournisseur
const DEFAULT_QUOTAS = {
  theOddsApi:  { quota_limit: 500,  quota_period: 'monthly' },
  oddsApiIo:   { quota_limit: 100,  quota_period: 'hourly'  },
};

const createSchema = z.object({
  provider: z.enum(['theOddsApi', 'oddsApiIo']),
  api_key_value: z.string().min(1, 'La valeur de la clé est requise'),
  quota_limit: z.number().int().positive().optional(),
  quota_period: z.enum(['hourly', 'daily', 'monthly']).optional(),
});

const updateSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  plan_info: z.string().optional(),
  enabled: z.number().int().min(0).max(1).optional(),
  quota_limit: z.number().int().positive().optional(),
  quota_period: z.enum(['hourly', 'daily', 'monthly']).optional(),
});

router.get('/', (req, res) => {
  const keys = ApiKey.findAll().map(maskKey);
  res.json(keys);
});

router.post('/', (req, res) => {
  const result = createSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.errors[0].message });
  }

  // Fusionne les quotas par défaut avec ce que l'utilisateur a renseigné
  const defaults = DEFAULT_QUOTAS[result.data.provider] || {};
  const data = {
    ...defaults,
    ...result.data,
  };

  try {
    const key = ApiKey.create(data);
    res.status(201).json(maskKey(key));
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Cette clé API existe déjà' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'ID invalide' });

  const result = updateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.errors[0].message });
  }

  const key = ApiKey.findById(id);
  if (!key) return res.status(404).json({ error: 'Clé introuvable' });

  const updated = ApiKey.update(id, result.data);
  res.json(maskKey(updated));
});

router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'ID invalide' });

  const deleted = ApiKey.delete(id);
  if (!deleted) return res.status(404).json({ error: 'Clé introuvable' });

  res.json({ ok: true });
});

router.post('/:id/toggle', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'ID invalide' });

  const key = ApiKey.toggle(id);
  if (!key) return res.status(404).json({ error: 'Clé introuvable' });

  res.json(maskKey(key));
});

/**
 * GET /api/api-keys/odds-api-io/selected-bookmakers
 * Renvoie la liste des bookmakers sélectionnés côté compte Odds-API.io.
 * Permet à l'utilisateur de savoir quels bookmakers son plan autorise.
 */
router.get('/odds-api-io/selected-bookmakers', async (req, res) => {
  try {
    if (req.query.refresh === '1') _resetSelectedCache();
    const list = await getSelectedBookmakers(req.query.refresh === '1');
    if (list === null) {
      return res.status(503).json({ error: 'Impossible de joindre Odds-API.io (clé invalide ou réseau).' });
    }
    res.json({ bookmakers: list, count: list.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function maskKey(key) {
  if (!key) return key;
  const val = key.api_key_value || '';
  const masked = val.length > 8
    ? `${val.slice(0, 4)}${'*'.repeat(val.length - 8)}${val.slice(-4)}`
    : '****';
  return { ...key, api_key_value: masked };
}

export default router;
