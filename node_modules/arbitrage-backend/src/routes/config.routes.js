/**
 * Routes de configuration applicative.
 * GET  /api/config     → retourne toute la config
 * PUT  /api/config     → met à jour un ou plusieurs paramètres
 */
import { Router } from 'express';
import AppConfig from '../models/AppConfig.js';

const router = Router();

// GET /api/config
router.get('/', (req, res) => {
  const cfg = AppConfig.getAll();
  res.json(cfg);
});

// PUT /api/config
router.put('/', (req, res) => {
  const data = req.body;
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'Corps de requête JSON requis' });
  }

  AppConfig.setMany(data);
  res.json({ ok: true, config: AppConfig.getAll() });
});

export default router;
