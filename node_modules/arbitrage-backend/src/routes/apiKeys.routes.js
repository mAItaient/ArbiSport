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

const router = Router();

// Schéma de validation pour la création d'une clé
const createSchema = z.object({
  provider: z.enum(['theOddsApi', 'oddsApiIo']),
  label: z.string().min(1, 'Le label est requis').max(100),
  api_key_value: z.string().min(1, 'La valeur de la clé est requise'),
  plan_info: z.string().optional(),
});

// Schéma de validation pour la mise à jour
const updateSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  plan_info: z.string().optional(),
  enabled: z.number().int().min(0).max(1).optional(),
});

// GET /api/api-keys — liste toutes les clés (masque la valeur pour la sécurité)
router.get('/', (req, res) => {
  const keys = ApiKey.findAll().map(maskKey);
  res.json(keys);
});

// POST /api/api-keys — crée une nouvelle clé
router.post('/', (req, res) => {
  const result = createSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.errors[0].message });
  }

  try {
    const key = ApiKey.create(result.data);
    res.status(201).json(maskKey(key));
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Cette clé API existe déjà' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/api-keys/:id — mise à jour d'une clé
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

// DELETE /api/api-keys/:id — supprime une clé
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'ID invalide' });

  const deleted = ApiKey.delete(id);
  if (!deleted) return res.status(404).json({ error: 'Clé introuvable' });

  res.json({ ok: true });
});

// POST /api/api-keys/:id/toggle — active ou désactive une clé
router.post('/:id/toggle', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'ID invalide' });

  const key = ApiKey.toggle(id);
  if (!key) return res.status(404).json({ error: 'Clé introuvable' });

  res.json(maskKey(key));
});

/**
 * Masque les 8 derniers caractères de la clé API pour la sécurité.
 * Affiche uniquement les 4 premiers et 4 derniers caractères.
 * @param {Object} key - Clé API depuis la DB
 * @returns {Object} Clé avec valeur masquée
 */
function maskKey(key) {
  if (!key) return key;
  const val = key.api_key_value || '';
  const masked = val.length > 8
    ? `${val.slice(0, 4)}${'*'.repeat(val.length - 8)}${val.slice(-4)}`
    : '****';

  return {
    ...key,
    api_key_value: masked,
  };
}

export default router;
