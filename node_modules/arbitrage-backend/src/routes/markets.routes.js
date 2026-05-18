/**
 * Routes du catalogue de marchés 2-way.
 * GET  /api/markets/two-way        → liste les marchés 2-way
 * POST /api/markets/init-two-way   → lance la phase d'initialisation
 */
import { Router } from 'express';
import { z } from 'zod';
import { initTwoWayMarkets, listTwoWayMarkets } from '../core/twoWayCatalog.js';
import logger from '../utils/logger.js';

const router = Router();

// GET /api/markets/two-way?provider=&sport=
router.get('/two-way', (req, res) => {
  const { provider, sport, twoWayOnly } = req.query;

  const markets = listTwoWayMarkets({
    provider: provider || undefined,
    sport: sport || undefined,
    twoWayOnly: twoWayOnly === 'true',
  });

  res.json({ markets });
});

// POST /api/markets/init-two-way
router.post('/init-two-way', async (req, res) => {
  const schema = z.object({
    providers: z.array(z.string()).min(1),
    sports: z.array(z.string()).min(1),
  });

  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.errors[0].message });
  }

  logger.info(`Init marchés 2-way demandée: ${JSON.stringify(result.data)}`);

  // Lance en arrière-plan et répond immédiatement
  res.json({ ok: true, message: 'Initialisation des marchés 2-way lancée en arrière-plan' });

  // Exécute l'init après la réponse
  initTwoWayMarkets(result.data).catch(err => {
    logger.error(`Erreur init 2-way: ${err.message}`);
  });
});

export default router;
