# Guide utilisateur — ArbiSport

## Table des matières

1. [Première installation](#installation)
2. [Ajout des clés API](#cles-api)
3. [Lancer un scan](#scan)
4. [Comprendre les résultats](#resultats)
5. [Gestion des quotas et rotation des clés](#quotas)
6. [Marchés 2-way](#marches)
7. [Analytics et hotspots](#analytics)
8. [Limitations et note réglementaire](#limitations)

---

## 1. Première installation {#installation}

Suivez le guide dans le [README.md](../README.md) racine.

Après lancement (`npm run dev`), accédez à **http://localhost:5173**.

---

## 2. Ajout des clés API {#cles-api}

Sans clé API, l'application affiche un message d'invite. Aucun scan ne peut être lancé.

### Où obtenir des clés ?

- **The Odds API** : [the-odds-api.com](https://the-odds-api.com)
  - Plan gratuit : 500 requêtes/mois
  - Couverture : sports mondiaux, bookmakers EU et US

- **Odds-API.io** : [odds-api.io](https://odds-api.io)
  - Fournit aussi les URLs deep-link vers les bookmakers
  - Plans payants avec quotas plus élevés

### Comment ajouter une clé

1. Naviguez vers **Clés API** dans la barre de navigation
2. Cliquez sur **Ajouter une clé**
3. Remplissez :
   - **Fournisseur** : TheOddsAPI ou OddsAPI.io
   - **Label** : Nom descriptif (ex: "The Odds API - Free Plan")
   - **Valeur de la clé** : Copiez-collez depuis le dashboard du fournisseur
   - **Plan** : Informations sur votre abonnement (optionnel)
4. Cliquez **Ajouter la clé**

### Statuts des clés

| Statut | Couleur | Signification |
|--------|---------|---------------|
| ACTIVE | Vert | Plus de 20% du quota restant |
| NEAR_LIMIT | Jaune | Entre 5% et 20% restant |
| LIMITED | Rouge | Moins de 5% ou quota épuisé |

---

## 3. Lancer un scan {#scan}

1. Naviguez vers **Paramètres scan**
2. Configurez les paramètres :

### Mode de scan
- **Scan complet** : Analyse tous les sports/marchés sélectionnés (recommandé pour les premiers scans)
- **Scan optimisé** : Cible les combinaisons historiquement les plus rentables (nécessite un historique)

### Sports
Sélectionnez un ou plusieurs sports. Chaque sport = une requête API. Adaptez selon votre quota.

### Marchés
- **H2H** : Victoire/Défaite directe (2 issues pour les sports sans nul, comme le basket/tennis)
- **Totals** : Paris sur le total de buts/points (Over/Under)
- **Spreads** : Paris avec handicap
- **Draw No Bet** : Victoire en excluant les matchs nuls

### Fenêtre temporelle
- **Live** : Événements déjà commencés
- **Prochaines 24h** : Recommandé pour limiter la consommation de requêtes
- **Prochaines 48h** : Plus large, consomme plus de quota
- **Personnalisé** : Durée en heures

### Mise totale
Montant fictif pour le calcul des mises et profits. N'implique aucun pari réel.

3. Cliquez **Lancer le scan**

---

## 4. Comprendre les résultats {#resultats}

### Carte d'opportunité

Chaque carte affiche :
- **Événement** : Nom du match, sport, ligue, date/heure
- **Marché** : Type de pari (H2H, Total, etc.)
- **ROI** : Rendement sur investissement garanti (en %)
  - 🟢 > 3% : Excellent
  - 🟡 1-3% : Bon
  - 🔴 < 1% : Faible
- **Cotes** : Cote de chaque bookmaker pour chaque issue
- **Gain minimum** : Profit garanti quel que soit le résultat

### Calculateur de mises (détail)

Cliquez sur une carte pour ouvrir le détail. Le **calculateur** vous permet de :
1. Ajuster la mise totale avec le slider
2. Voir les mises optimales sur chaque bookmaker (A et B)
3. Vérifier les profits pour chaque issue

### Boutons bookmakers

- **Bouton coloré** : URL disponible → cliquez pour accéder au bookmaker
- **Bouton grisé** : URL non disponible (aller manuellement sur le site)

---

## 5. Gestion des quotas et rotation automatique {#quotas}

Le système gère automatiquement plusieurs clés API :

1. **Sélection automatique** : La clé avec le plus de requêtes restantes est choisie
2. **Mise à jour des quotas** : Chaque réponse API met à jour les compteurs
3. **Rotation sur 429** : Si une clé est épuisée (erreur 429), elle est marquée LIMITED et la suivante est utilisée
4. **Affichage visuel** : La page Clés API affiche une jauge de consommation

**Conseil** : Ajoutez plusieurs clés (même fournisseur, plans différents) pour maximiser la capacité de scan.

---

## 6. Marchés 2-way {#marches}

### Qu'est-ce qu'un marché 2-way ?

Un marché à **exactement 2 issues** (ni plus, ni moins). Exemples :
- Tennis : Victoire Joueur A vs Victoire Joueur B ✓
- Football H2H sans nul : Victoire Équipe A vs Victoire Équipe B ✓
- Football H2H avec nul : 3 issues → **exclu** car 3-way

### Initialisation du catalogue

1. Naviguez vers **Marchés 2-way**
2. Sélectionnez les fournisseurs et sports à tester
3. Cliquez **Initialiser le catalogue**
4. L'application échantillonne ~20 événements par combinaison et détecte les marchés 2-way

### Sélection persistée

Cochez les marchés que vous souhaitez utiliser. La sélection est sauvegardée automatiquement.

---

## 7. Analytics et hotspots {#analytics}

La page **Analytics** analyse votre historique de scans pour identifier :
- Les **paires de bookmakers** qui génèrent le plus d'opportunités
- Les **marchés/sports** avec le ROI moyen le plus élevé

### Utilisation pour le scan optimisé

Ces données alimentent le **scan optimisé** qui cible automatiquement les combinaisons les plus rentables.

---

## 8. Limitations et note réglementaire {#limitations}

### Limitations techniques
- Les cotes des bookmakers changent rapidement. Une opportunité peut disparaître en quelques secondes.
- Les quotas des APIs gratuites limitent la fréquence des scans.
- Les délais de réseau peuvent affecter la simultanéité des mises.

### Note réglementaire importante

> ⚠️ **Ce logiciel ne place aucun pari automatiquement.** Il détecte uniquement des opportunités mathématiques.

Avant tout arbitrage :
1. Vérifiez que vous respectez les **Conditions Générales d'Utilisation** de chaque bookmaker
2. Certains bookmakers **limitent ou ferment les comptes** des arbitrageurs identifiés
3. L'arbitrage sportif peut être **restreint légalement** dans certaines juridictions
4. **Jouez de manière responsable** — consultez [joueurs-info-service.fr](https://www.joueurs-info-service.fr) si besoin
