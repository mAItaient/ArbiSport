/**
 * Routes d'analytics.
 * GET /api/analytics/hotspots → stats agrégées par marché ou paire de bookmakers
 */
import { Router } from 'express';
import { hotspots, getGlobalStats } from '../core/analytics.js';

const router = Router();

// GET /api/analytics/hotspots?days=7&groupBy=market|pair&minOccurrences=1
router.get('/hotspots', (req, res) => {
  const {
    days = '7',
    groupBy = 'market',
    minOccurrences = '1',
  } = req.query;

  const parsedDays = parseInt(days, 10) || 7;
  const parsedMinOcc = parseInt(minOccurrences, 10) || 1;
  const validGroupBy = ['market', 'pair'].includes(groupBy) ? groupBy : 'market';

  const data = hotspots({
    days: parsedDays,
    groupBy: validGroupBy,
    minOccurrences: parsedMinOcc,
  });

  res.json({
    hotspots: data,
    days: parsedDays,
    groupBy: validGroupBy,
  });
});

// GET /api/analytics/stats?days=7
router.get('/stats', (req, res) => {
  const days = parseInt(req.query.days, 10) || 7;
  const stats = getGlobalStats(days);
  res.json(stats);
});

export default router;
