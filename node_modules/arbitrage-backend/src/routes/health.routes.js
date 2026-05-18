/**
 * Route de santé de l'application.
 * GET /api/health → {status, version, uptime, dbOk}
 */
import { Router } from 'express';
import getDb from '../db/index.js';
import config from '../config.js';

const router = Router();

router.get('/', (req, res) => {
  let dbOk = false;
  try {
    const db = getDb();
    db.prepare('SELECT 1').get();
    dbOk = true;
  } catch {
    dbOk = false;
  }

  res.json({
    status: 'ok',
    version: config.version,
    uptime: Math.floor(process.uptime()),
    dbOk,
  });
});

export default router;
