/**
 * Route de déclenchement de scan d'arbitrage.
 * POST /api/scan → exécute un scan synchrone
 */
import { Router } from 'express';
import { z } from 'zod';
import { runScan } from '../core/scanner.js';
import ApiKey from '../models/ApiKey.js';
import logger from '../utils/logger.js';

const router = Router();

// Schéma de validation du body de scan
const scanSchema = z.object({
  mode: z.enum(['full', 'optimized']).default('full'),
  providers: z.array(z.string()).optional().default(['theOddsApi']),
  timeWindow: z.object({
    kind: z.enum(['live', 'next24', 'next48', 'custom']).default('next24'),
    hours: z.number().positive().optional(),
  }).default({ kind: 'next24' }),
  sports: z.array(z.string()).min(1, 'Au moins un sport est requis'),
  leagues: z.array(z.string()).optional(),
  bookmakers: z.array(z.string()).optional(),
  marketKeys: z.array(z.string()).default(['h2h']),
  stakeTotal: z.number().positive().default(100),
  filters: z.object({
    minRoiPct: z.number().default(0),
    minGuaranteedPct: z.number().default(0),
    minProfitAbs: z.number().default(0),
    minMinutesBeforeStart: z.number().default(0),
  }).optional().default({}),
  topN: z.number().int().positive().optional().default(5),
});

// POST /api/scan
router.post('/', async (req, res) => {
  // Vérifie qu'il y a au moins une clé API active
  const keys = ApiKey.findAll().filter(k => k.enabled && k.status !== 'LIMITED');
  if (keys.length === 0) {
    return res.status(400).json({
      error: 'Aucune clé API active disponible. Ajoutez une clé API dans les Paramètres.',
      code: 'NO_API_KEYS',
    });
  }

  const result = scanSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.errors[0].message });
  }

  const params = result.data;
  logger.info(`Démarrage scan: mode=${params.mode}, sports=${params.sports.join(', ')}`);

  try {
    const scanResult = await runScan(params);
    res.json({
      ok: true,
      runId: scanResult.runId,
      opportunitiesFound: scanResult.opportunitiesFound,
      requestsEstimated: scanResult.requestsEstimated,
      opportunities: scanResult.opportunities,
    });
  } catch (err) {
    logger.error(`Erreur scan: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

export default router;
