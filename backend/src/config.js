/**
 * Configuration centrale de l'application.
 * Charge les variables d'environnement et définit les valeurs par défaut.
 */
import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charge le .env depuis la racine du projet
loadDotenv({ path: join(__dirname, '../../.env') });

export const config = {
  // Serveur
  port: parseInt(process.env.PORT || '4317', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Base de données
  dbPath: process.env.DB_PATH || join(__dirname, '../../data/arbitrage.db'),

  // Frontends autorisés en CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  // Version de l'app
  version: '1.0.0',

  // Quotas par défaut pour le statut des clés API
  keyStatusThresholds: {
    nearLimit: 0.20,  // 20% restant → NEAR_LIMIT
    limited: 0.05,    // 5% restant  → LIMITED
  },
};

export default config;
