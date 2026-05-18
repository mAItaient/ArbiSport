/**
 * Point d'entrée du serveur Express.
 * Initialise la base de données, monte les routes et démarre l'écoute.
 */
import express from 'express';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import config from './config.js';
import { getDb } from './db/index.js';
import logger from './utils/logger.js';

// Import des routes
import healthRouter from './routes/health.routes.js';
import configRouter from './routes/config.routes.js';
import apiKeysRouter from './routes/apiKeys.routes.js';
import scanRouter from './routes/scan.routes.js';
import opportunitiesRouter from './routes/opportunities.routes.js';
import analyticsRouter from './routes/analytics.routes.js';
import marketsRouter from './routes/markets.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Log des requêtes en développement
if (config.nodeEnv === 'development') {
  app.use((req, res, next) => {
    logger.debug(`${req.method} ${req.path}`);
    next();
  });
}

// ─── Routes API ───────────────────────────────────────────────────────────────
app.use('/api/health', healthRouter);
app.use('/api/config', configRouter);
app.use('/api/api-keys', apiKeysRouter);
app.use('/api/scan', scanRouter);
app.use('/api/opportunities', opportunitiesRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/markets', marketsRouter);

// ─── Serveur frontend (mode production) ───────────────────────────────────────
const frontendDist = join(__dirname, '../../frontend/dist');
if (config.nodeEnv === 'production' && existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    res.sendFile(join(frontendDist, 'index.html'));
  });
}

// ─── Gestion des erreurs 404 ──────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route introuvable : ${req.method} ${req.path}` });
});

// ─── Gestion des erreurs globales ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error(`Erreur non gérée : ${err.message}`, err);
  res.status(500).json({ error: 'Erreur interne du serveur', details: err.message });
});

// ─── Démarrage ────────────────────────────────────────────────────────────────
function startServer() {
  try {
    // Initialise la DB au démarrage (crée le fichier et les tables si absents)
    getDb();
    logger.info('Base de données initialisée');
  } catch (err) {
    logger.error(`Impossible d'initialiser la base de données : ${err.message}`);
    process.exit(1);
  }

  app.listen(config.port, () => {
    logger.info(`Serveur démarré sur http://localhost:${config.port}`);
    logger.info(`Mode : ${config.nodeEnv}`);
  });
}

startServer();

export { app };
