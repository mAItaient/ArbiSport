#!/usr/bin/env bash
# Script d'installation ArbiSport — Linux/macOS

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Installation d'ArbiSport ==="
echo ""

# ── Vérification Node.js ─────────────────────────────────────────────────────
echo "→ Vérification de Node.js..."
if ! command -v node &> /dev/null; then
  echo "ERREUR: Node.js n'est pas installé."
  echo "Installez Node.js v20+ depuis https://nodejs.org"
  exit 1
fi

NODE_VERSION=$(node --version | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "ERREUR: Node.js v20+ requis. Version actuelle : $(node --version)"
  exit 1
fi
echo "✓ Node.js $(node --version) détecté"

# ── Installation des dépendances ─────────────────────────────────────────────
echo ""
echo "→ Installation des dépendances racine..."
cd "$ROOT_DIR"
npm install

echo ""
echo "→ Installation des dépendances backend..."
cd "$ROOT_DIR/backend"
npm install

echo ""
echo "→ Installation des dépendances frontend..."
cd "$ROOT_DIR/frontend"
npm install

# ── Fichier d'environnement ──────────────────────────────────────────────────
echo ""
cd "$ROOT_DIR"
if [ ! -f ".env" ]; then
  echo "→ Création du fichier .env depuis .env.example..."
  cp .env.example .env
  echo "✓ Fichier .env créé. Modifiez-le si nécessaire."
else
  echo "✓ Fichier .env déjà présent."
fi

# ── Répertoire de données ────────────────────────────────────────────────────
echo ""
echo "→ Création du répertoire de données..."
mkdir -p "$ROOT_DIR/data"
echo "✓ Répertoire data/ prêt."

# ── Résumé ───────────────────────────────────────────────────────────────────
echo ""
echo "=== Installation terminée ! ==="
echo ""
echo "Pour démarrer l'application :"
echo "  npm run dev"
echo ""
echo "Puis ouvrez http://localhost:5173 dans votre navigateur."
echo "Ajoutez une clé API via l'interface pour commencer les scans."
