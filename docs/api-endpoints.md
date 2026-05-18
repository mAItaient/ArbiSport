# Référence API REST — ArbiSport

Base URL : `http://localhost:4317/api`

---

## GET /api/health

Santé de l'application.

**Réponse 200 :**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 3600,
  "dbOk": true
}
```

---

## GET /api/config

Retourne toute la configuration applicative.

**Réponse 200 :**
```json
{
  "selectedMarketKeys": ["h2h", "totals"],
  "defaultStake": 100
}
```

## PUT /api/config

Met à jour un ou plusieurs paramètres de configuration.

**Body :**
```json
{
  "selectedMarketKeys": ["h2h"],
  "defaultStake": 200
}
```

**Réponse 200 :**
```json
{ "ok": true, "config": { ... } }
```

---

## GET /api/api-keys

Liste toutes les clés API (valeur masquée).

**Réponse 200 :**
```json
[
  {
    "id": 1,
    "provider": "theOddsApi",
    "label": "Ma clé principale",
    "api_key_value": "abcd****wxyz",
    "status": "ACTIVE",
    "requests_remaining": 450,
    "requests_limit": 500,
    "requests_used_total": 50,
    "enabled": 1,
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

## POST /api/api-keys

Crée une nouvelle clé API.

**Body :**
```json
{
  "provider": "theOddsApi",
  "label": "Ma clé",
  "api_key_value": "xxxxxxxxxxxxxxxx",
  "plan_info": "Free 500 req/mois"
}
```

**Réponse 201 :** Clé créée (valeur masquée)

## PUT /api/api-keys/:id

Met à jour le label ou le plan d'une clé.

**Body :**
```json
{ "label": "Nouveau label", "plan_info": "Plan Pro" }
```

## DELETE /api/api-keys/:id

Supprime une clé API.

**Réponse 200 :** `{ "ok": true }`

## POST /api/api-keys/:id/toggle

Active ou désactive une clé API.

**Réponse 200 :** Clé mise à jour

---

## POST /api/scan

Lance un scan d'arbitrage synchrone.

**Body :**
```json
{
  "mode": "full",
  "providers": ["theOddsApi"],
  "timeWindow": { "kind": "next24" },
  "sports": ["soccer_epl", "basketball_nba"],
  "marketKeys": ["h2h"],
  "stakeTotal": 100,
  "filters": {
    "minRoiPct": 1.0,
    "minGuaranteedPct": 0,
    "minProfitAbs": 0,
    "minMinutesBeforeStart": 30
  },
  "topN": 5
}
```

**Paramètres `timeWindow.kind` :**
- `live` : Événements en cours
- `next24` : Prochaines 24h
- `next48` : Prochaines 48h
- `custom` : Avec `timeWindow.hours`

**Réponse 200 :**
```json
{
  "ok": true,
  "runId": 42,
  "opportunitiesFound": 3,
  "requestsEstimated": 10,
  "opportunities": [ ... ]
}
```

**Erreur 400 :** Aucune clé API active
```json
{
  "error": "Aucune clé API active disponible.",
  "code": "NO_API_KEYS"
}
```

---

## GET /api/opportunities

Liste paginée des opportunités d'arbitrage détectées.

**Paramètres query :**
| Param | Type | Description |
|-------|------|-------------|
| `limit` | number | Nombre de résultats (max 200, défaut 50) |
| `offset` | number | Décalage pour la pagination |
| `since` | string | ISO 8601 — filtre par timestamp minimum |
| `minRoiPct` | number | ROI minimum en % |

**Réponse 200 :**
```json
{
  "items": [ ... ],
  "total": 147,
  "limit": 50,
  "offset": 0
}
```

---

## GET /api/analytics/hotspots

Statistiques agrégées des opportunités historiques.

**Paramètres query :**
| Param | Type | Description |
|-------|------|-------------|
| `days` | number | Période d'analyse en jours (défaut 7) |
| `groupBy` | string | `market` ou `pair` |
| `minOccurrences` | number | Nombre minimum d'occurrences |

**Réponse 200 (`groupBy=pair`) :**
```json
{
  "hotspots": [
    {
      "bookmaker_a": "pinnacle",
      "bookmaker_b": "betclic",
      "occurrences": 12,
      "avg_roi": 2.35,
      "max_roi": 4.1,
      "avg_gain_min": 2.35,
      "first_seen": "2024-01-01T00:00:00Z",
      "last_seen": "2024-01-07T15:30:00Z"
    }
  ],
  "days": 7,
  "groupBy": "pair"
}
```

## GET /api/analytics/stats

Statistiques globales sur une période.

**Réponse 200 :**
```json
{
  "count": 47,
  "avgRoi": 2.15,
  "maxRoi": 6.3,
  "avgGainMin": 2.15
}
```

---

## GET /api/markets/two-way

Liste le catalogue des marchés 2-way.

**Paramètres query :**
| Param | Type | Description |
|-------|------|-------------|
| `provider` | string | Filtre par fournisseur |
| `sport` | string | Filtre par sport |
| `twoWayOnly` | boolean | Si `true`, retourne uniquement les marchés 2-way confirmés |

**Réponse 200 :**
```json
{
  "markets": [
    {
      "id": 1,
      "provider": "theOddsApi",
      "sport": "basketball_nba",
      "market_key": "h2h",
      "is_two_way": 1,
      "two_outcome_rate": 1.0,
      "events_tested": 20
    }
  ]
}
```

## POST /api/markets/init-two-way

Lance la détection des marchés 2-way en arrière-plan.

**Body :**
```json
{
  "providers": ["theOddsApi"],
  "sports": ["basketball_nba", "tennis_atp_french_open"]
}
```

**Réponse 200 :**
```json
{
  "ok": true,
  "message": "Initialisation des marchés 2-way lancée en arrière-plan"
}
```
