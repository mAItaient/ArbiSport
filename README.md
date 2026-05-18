# ArbiSport — Détecteur d'arbitrage sur paris sportifs 2-way

MVP local de détection d'opportunités d'arbitrage sportif. L'application analyse les cotes de plusieurs bookmakers et identifie les situations où placer des paris sur toutes les issues garantit un profit.

> ⚠️ **Avertissement légal** : L'arbitrage sportif peut être restreint ou interdit par certains bookmakers. Ce logiciel est un outil de détection uniquement — il ne place aucun pari automatiquement. Vérifiez les conditions générales de chaque bookmaker avant d'utiliser ces informations.

## Stack technique

- **Backend** : Node.js 20+, Express, SQLite (better-sqlite3), axios
- **Frontend** : React 18, Vite, TypeScript, Tailwind CSS
- **Tests** : Vitest

## Installation rapide

### Prérequis
- Node.js v20+ (`node --version`)
- npm v9+

### Méthode 1 — Script automatique (recommandé)

**Linux/macOS :**
```bash
cd arbitrage-app
chmod +x scripts/install.sh
./scripts/install.sh
```

**Windows :**
```bat
cd arbitrage-app
scripts\install.bat
```

### Méthode 2 — Manuelle

```bash
# 1. Cloner et entrer dans le projet
cd arbitrage-app

# 2. Installer les dépendances
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# 3. Copier le fichier d'environnement
cp .env.example .env

# 4. Créer le dossier de données
mkdir -p data
```

## Démarrage

### Mode développement (backend + frontend en parallèle)

```bash
npm run dev
```

- Frontend disponible sur : **http://localhost:5173**
- Backend API sur : **http://localhost:4317**

### Mode production

```bash
# 1. Construire le frontend
npm run build

# 2. Lancer le serveur (sert aussi le frontend statique)
npm start
```

Application disponible sur : **http://localhost:4317**

## Tests

```bash
npm test
```

## Premier lancement

1. **Ouvrez** http://localhost:5173
2. **Ajoutez une clé API** : naviguez vers "Clés API" → "Ajouter une clé"
   - Obtenez une clé gratuite sur [the-odds-api.com](https://the-odds-api.com) (500 req/mois) ou [odds-api.io](https://odds-api.io)
3. **Lancez un scan** : naviguez vers "Paramètres scan", sélectionnez un sport et cliquez "Lancer le scan"
4. **Consultez les résultats** sur le Tableau de bord

## Structure du projet

```
arbitrage-app/
├── backend/              # API Express + SQLite
│   ├── src/
│   │   ├── core/         # Moteur d'arbitrage, gestionnaire de clés
│   │   ├── integrations/ # Clients The Odds API et Odds-API.io
│   │   ├── models/       # Couche d'accès SQLite
│   │   └── routes/       # Endpoints REST
│   └── tests/            # Tests Vitest
├── frontend/             # React + Vite + TypeScript
│   └── src/
│       ├── pages/        # Pages de l'application
│       └── components/   # Composants réutilisables
├── data/                 # Base de données SQLite (créée au démarrage)
└── docs/                 # Documentation détaillée
```

## Documentation

- [Guide utilisateur](docs/user-guide.md)
- [Documentation technique](docs/technical.md)
- [Référence API REST](docs/api-endpoints.md)
