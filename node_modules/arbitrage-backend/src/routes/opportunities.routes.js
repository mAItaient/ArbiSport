/**
 * Routes des opportunités d'arbitrage.
 * GET /api/opportunities → liste paginée avec filtres
 */
import { Router } from 'express';
import ArbitrageOpportunity from '../models/ArbitrageOpportunity.js';

const router = Router();

// GET /api/opportunities?limit=&offset=&since=&minRoiPct=
router.get('/', (req, res) => {
  const {
    limit = '50',
    offset = '0',
    since,
    minRoiPct,
  } = req.query;

  const parsedLimit = Math.min(parseInt(limit, 10) || 50, 200);
  const parsedOffset = parseInt(offset, 10) || 0;
  const parsedMinRoi = minRoiPct !== undefined ? parseFloat(minRoiPct) : undefined;

  const { items, total } = ArbitrageOpportunity.findAll({
    limit: parsedLimit,
    offset: parsedOffset,
    since,
    minRoiPct: parsedMinRoi,
  });

  res.json({
    items,
    total,
    limit: parsedLimit,
    offset: parsedOffset,
  });
});

export default router;
