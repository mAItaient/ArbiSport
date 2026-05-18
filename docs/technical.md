# Documentation technique — ArbiSport

## Architecture générale

```
┌─────────────────────────────────────────────────────┐
│                   Frontend (React)                   │
│  Vite + TypeScript + Tailwind + React Router        │
│  Port 5173 (dev) / servi par Express (prod)         │
└─────────────────────────────┬───────────────────────┘
                              │ HTTP /api/*
┌─────────────────────────────▼───────────────────────┐
│                  Backend (Express)                   │
│  Node.js ESM, Port 4317                             │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐             │
│  │ Routes  │ │   Core   │ │  Models  │             │
│  │  /api   │ │  Engine  │ │ SQLite   │             │
│  └────┬────┘ └────┬─────┘ └────┬─────┘             │
│       │           │             │                   │
│  ┌────▼───────────▼─────────────▼────────────────┐  │
│  │          Database (SQLite - better-sqlite3)   │  │
│  │          data/arbitrage.db                    │  │
│  └───────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────┐   │
│  │      Integrations (HTTP externes)            │   │
│  │  TheOddsApiClient  │  OddsApiIoClient        │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Modules backend

### `core/arbitrageEngine.js`

Implémente la détection et le calcul d'arbitrage 2-way.

**Formule mathématique :**

Pour deux issues A et B avec cotes décimales `oA` et `oB` :
- Condition d'arbitrage : `1/oA + 1/oB < 1` (somme des inverses `S < 1`)
- Mise optimale sur A : `stakeA = T × (1/oA) / S`
- Mise optimale sur B : `stakeB = T × (1/oB) / S`
- Profit si A gagne : `profitA = stakeA × oA − T`
- Profit si B gagne : `profitB = stakeB × oB − T`
- Gain minimum garanti : `gainMin = min(profitA, profitB)`
- ROI : `roi = gainMin / T × 100`

**Propriétés garanties :**
- `stakeA + stakeB = T` (les mises somment à la mise totale)
- `profitA > 0` et `profitB > 0` (gains nets positifs sur toutes les issues)

### `core/apiKeyManager.js`

Singleton gérant la sélection et la rotation des clés API.

**Stratégie de sélection :** `requests_remaining DESC, requests_used_total ASC`

**Calcul des statuts :**
| Condition | Statut |
|-----------|--------|
| remaining > 20% du quota | ACTIVE |
| 5% ≤ remaining ≤ 20% | NEAR_LIMIT |
| remaining < 5% ou 429 | LIMITED |

**Parsing des headers :**
- TheOddsAPI : `x-requests-remaining`, `x-requests-used`
- Odds-API.io : `x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-reset`

### `core/twoWayCatalog.js`

Détecte automatiquement les marchés à exactement 2 issues.

**Algorithme :**
1. Pour chaque `(provider, sport)`, récupère ~20 événements via `getOdds`
2. Pour chaque `(provider, sport, league, bookmaker, market_key)`, agrège les outcomes par événement
3. Si `100%` des événements ont exactement 2 outcomes → `is_two_way = true`
4. Persiste le taux dans `two_way_markets.two_outcome_rate`

### `core/analytics.js`

Agrège les opportunités historiques.

**Algorithme hotspots :**
- Groupe par `(sport, market_key)` ou `(bookmaker_a, bookmaker_b)`
- Calcule : COUNT, AVG(roi), MAX(roi), AVG(gain_min)
- Trie par occurrences DESC, avg_roi DESC

### `core/scanner.js`

Orchestre les scans complets et optimisés.

**Scan complet :**
1. Pour chaque `(provider, sport)`, appelle `getOdds(markets, bookmakers, timeWindow)`
2. Passe les quotes à `findOpportunities`
3. Persiste en base via `ArbitrageOpportunity.bulkCreate`

**Scan optimisé :**
1. Récupère les `topN` hotspots des 7 derniers jours
2. Construit des requêtes ciblées `(provider, sport, markets=marché_chaud, bookmakers=paire_chaude)`
3. Exécute ces requêtes ciblées uniquement

### `integrations/bookmakerUrls.js`

**Priorité de résolution d'URL :**
1. `event.urls[bookmakerKey]` (fourni par Odds-API.io)
2. Pattern de deep-link si disponible (Stake, 1xbet)
3. Homepage du bookmaker
4. `null` si le bookmaker est inconnu

## Schéma de base de données

Voir `backend/src/db/migrations/001_init.sql` pour le DDL complet.

**Tables principales :**
- `api_keys` : Clés API avec quotas et statuts
- `arbitrage_opportunities` : Opportunités détectées avec toutes les métriques
- `two_way_markets` : Catalogue des marchés 2-way
- `scan_runs` : Historique des scans avec paramètres et résultats
- `app_config` : Configuration clé/valeur (JSON) persistée

## Frontend

### Structure des composants

```
App.tsx (Router)
├── DashboardPage — Polling 30s, liste opportunités
├── ScanSettingsPage — Formulaire scan + résultats
├── ApiKeysPage — CRUD clés API + jauges
├── MarketsPage — Catalogue 2-way + sélection persistée
└── AnalyticsPage — Hotspots + graphiques Recharts
```

### Calcul local des mises

`StakeCalculator.tsx` recalcule les mises **sans appel API** via une copie des formules :
```typescript
const S = 1/oA + 1/oB;
const stakeA = T * (1/oA) / S;
const stakeB = T * (1/oB) / S;
```

### Gestion des états

Hooks personnalisés :
- `useApi<T>` : Wrapping d'appels API avec loading/error/data
- `usePolling` : Appel périodique d'une fonction (utilisé sur Dashboard)

## Tests

Les tests Vitest sont dans `backend/tests/` :

| Fichier | Couverture |
|---------|-----------|
| `arbitrage.test.js` | isArb, computeStakes, findOpportunities |
| `oddsConversion.test.js` | decimalFromAmerican, americanFromDecimal |
| `apiKeyManager.test.js` | parseQuotaHeaders, rotation, statuts |
| `bookmakerUrls.test.js` | getBookmakerUrl, fallbacks, deep-links |
| `integration.scan.test.js` | DB en mémoire, insertion, rotation de clés |

Lancement : `npm test` (depuis la racine)
