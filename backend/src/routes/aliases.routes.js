/**
 * Routes /api/aliases — gestion des alias d'équipes confirmés.
 */
import { Router } from 'express';
import ConfirmedAlias from '../models/ConfirmedAlias.js';

const router = Router();

router.get('/', (req, res) => {
  try {
    res.json(ConfirmedAlias.findAll());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  const { team_canonical, team_alias, source_provider } = req.body || {};
  if (!team_canonical || !team_alias) {
    return res.status(400).json({ error: 'team_canonical et team_alias requis' });
  }
  const row = ConfirmedAlias.create({ team_canonical, team_alias, source_provider });
  res.status(row ? 201 : 200).json(row || { ok: true });
});

router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const ok = ConfirmedAlias.delete(id);
  if (!ok) return res.status(404).json({ error: 'Alias introuvable' });
  res.json({ ok: true });
});

export default router;
