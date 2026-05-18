/**
 * Routes /api/pending-matches — gestion des appariements d'événements en attente.
 */
import { Router } from 'express';
import PendingEventMatch from '../models/PendingEventMatch.js';
import ConfirmedAlias from '../models/ConfirmedAlias.js';
import logger from '../utils/logger.js';

const router = Router();

router.get('/', (req, res) => {
  const status = req.query.status || 'pending';
  try {
    const rows = PendingEventMatch.findAll(status);
    res.json({ items: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/count', (req, res) => {
  try {
    res.json({ pending: PendingEventMatch.countPending() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/confirm', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const row = PendingEventMatch.findById(id);
  if (!row) return res.status(404).json({ error: 'Appariement introuvable' });

  // Apprentissage des alias d'équipes (canonical = nom A, alias = nom B et vice-versa)
  try {
    if (row.event_a_home && row.event_b_home) {
      ConfirmedAlias.create({
        team_canonical: row.event_a_home,
        team_alias: row.event_b_home,
        source_provider: row.event_b_provider,
      });
    }
    if (row.event_a_away && row.event_b_away) {
      ConfirmedAlias.create({
        team_canonical: row.event_a_away,
        team_alias: row.event_b_away,
        source_provider: row.event_b_provider,
      });
    }
  } catch (err) {
    logger.warn(`Erreur création alias confirmé : ${err.message}`);
  }

  const updated = PendingEventMatch.updateStatus(id, 'confirmed');
  res.json(updated);
});

router.post('/:id/reject', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const row = PendingEventMatch.findById(id);
  if (!row) return res.status(404).json({ error: 'Appariement introuvable' });
  const updated = PendingEventMatch.updateStatus(id, 'rejected');
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const ok = PendingEventMatch.delete(id);
  if (!ok) return res.status(404).json({ error: 'Appariement introuvable' });
  res.json({ ok: true });
});

export default router;
