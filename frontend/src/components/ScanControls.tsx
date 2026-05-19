/**
 * Panneau de déclenchement de scan avec paramètres configurables.
 */
import { useEffect, useState } from 'react'
import type { ScanParams } from '../types'

const PROVIDERS = [
  { key: 'theOddsApi', label: 'The Odds API' },
  { key: 'oddsApiIo',  label: 'Odds-API.io' },
] as const
type ProviderKey = typeof PROVIDERS[number]['key']

// 13 bookmakers cibles uniquement. Le badge indique les providers qui les couvrent :
//  - T = The Odds API
//  - O = Odds-API.io
// (id interne = utilisé en interne par filterBookmakersForProvider côté backend)
const BOOKMAKERS_LIST = [
  { key: 'betclic',   label: 'Betclic',   providers: 'T+O' },
  { key: 'netbet',    label: 'NetBet',    providers: 'O' },
  { key: 'unibet',    label: 'Unibet',    providers: 'T+O' },
  { key: 'pmu',       label: 'PMU',       providers: 'T+O' },
  { key: 'winamax',   label: 'Winamax',   providers: 'T+O' },
  { key: 'pinnacle',  label: 'Pinnacle',  providers: 'T' },
  { key: 'betfair',   label: 'Betfair',   providers: 'T+O' },
  { key: '888sport',  label: '888sport',  providers: 'T+O' },
  { key: 'onexbet',   label: '1xBet',     providers: 'T+O' },
  { key: 'betonline', label: 'Betonline', providers: 'T+O' },
  { key: 'everygame', label: 'Everygame', providers: 'T' },
  { key: 'bcgame',    label: 'BC.Game',   providers: 'O' },
  { key: 'stake',     label: 'Stake',     providers: 'O' },
]

const SPORTS_LIST = [
  // Football
  { key: 'soccer_epl',                  label: 'Football – Premier League' },
  { key: 'soccer_france_ligue_one',     label: 'Football – Ligue 1' },
  { key: 'soccer_spain_la_liga',        label: 'Football – La Liga' },
  { key: 'soccer_germany_bundesliga',   label: 'Football – Bundesliga' },
  { key: 'soccer_uefa_champs_league',   label: 'Football – Champions League' },
  { key: 'soccer_italy_serie_a',        label: 'Football – Serie A' },
  { key: 'soccer_uefa_europa_league',   label: 'Football – Europa League' },
  // Basketball
  { key: 'basketball_nba',              label: 'Basketball – NBA' },
  { key: 'basketball_euroleague',       label: 'Basketball – EuroLeague' },
  // Tennis
  { key: 'tennis_atp_french_open',      label: 'Tennis – Roland-Garros' },
  { key: 'tennis_wta_french_open',      label: 'Tennis WTA – Roland-Garros' },
  { key: 'tennis_atp_wimbledon',        label: 'Tennis – Wimbledon' },
  { key: 'tennis_atp_us_open',          label: 'Tennis – US Open' },
  // MMA / UFC
  { key: 'mma_mixed_martial_arts',      label: 'MMA – UFC / Bellator' },
  // Football américain
  { key: 'americanfootball_nfl',        label: 'Football américain – NFL' },
  { key: 'americanfootball_ncaaf',      label: 'Football américain – NCAA' },
  // Baseball
  { key: 'baseball_mlb',                label: 'Baseball – MLB' },
  // Hockey
  { key: 'icehockey_nhl',               label: 'Hockey – NHL' },
  // Rugby
  { key: 'rugbyleague_nrl',             label: 'Rugby – NRL' },
  { key: 'rugbyunion_premiership',      label: 'Rugby Union – Premiership' },
  // Boxe
  { key: 'boxing_boxing',               label: 'Boxe' },
  // Cricket
  { key: 'cricket_icc_world_cup',       label: 'Cricket – Coupe du monde' },
]

const MARKET_KEYS = [
  // H2H = 2-way uniquement pour sports SANS nul (tennis, MMA, NBA, NFL…).
  // Pour le football, le 1X2 a 3 issues et est automatiquement rejeté.
  { key: 'h2h',          label: 'Victoire/Défaite (H2H) – sports sans nul' },
  { key: 'totals',       label: 'Total buts/points' },
  { key: 'spreads',      label: 'Handicap (Spreads)' },
  { key: 'draw_no_bet',  label: 'Victoire sans nul' },
]

const TIME_WINDOWS = [
  { kind: 'live',    label: 'En direct (live)' },
  { kind: 'next24',  label: 'Prochaines 24h' },
  { kind: 'next48',  label: 'Prochaines 48h' },
  { kind: 'custom',  label: 'Personnalisé' },
] as const

interface Props {
  onScan: (params: ScanParams) => void
  loading?: boolean
}

export default function ScanControls({ onScan, loading = false }: Props) {
  const [mode, setMode] = useState<'full' | 'optimized'>('full')
  const [selectedSports, setSelectedSports] = useState<string[]>(['soccer_epl'])
  // Par défaut : tous les marchés 2-way cochés. Le moteur rejette
  // automatiquement les marchand qui s'avèrent à 3+ issues (1X2 football).
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>(
    MARKET_KEYS.map((m) => m.key)
  )
  const [selectedBookmakers, setSelectedBookmakers] = useState<string[]>([]) // vide = tous (regions=eu)
  const [timeWindowKind, setTimeWindowKind] = useState<'live' | 'next24' | 'next48' | 'custom'>('next24')
  const [customHours, setCustomHours] = useState(24)
  const [stakeTotal, setStakeTotal] = useState(100)
  const [minRoi, setMinRoi] = useState(0)
  const [providers, setProviders] = useState<string[]>([])
  const [availableProviders, setAvailableProviders] = useState<Set<ProviderKey>>(new Set())
  const [keysLoaded, setKeysLoaded] = useState(false)
  const [showAllSports, setShowAllSports] = useState(false)
  // Bookmakers sélectionnés côté compte Odds-API.io (limités par le plan).
  const [oddsApiIoAllowed, setOddsApiIoAllowed] = useState<string[] | null>(null)

  // Charge la liste des clés API pour déterminer quels providers sont utilisables.
  useEffect(() => {
    let cancelled = false
    fetch('/api/api-keys')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (cancelled) return
        const rows: Array<{ provider: string; enabled?: number | boolean; status?: string }> =
          Array.isArray(data) ? data : []
        const avail = new Set<ProviderKey>()
        for (const row of rows) {
          const enabled = row.enabled === undefined || row.enabled === 1 || row.enabled === true
          if (!enabled) continue
          if (row.provider === 'theOddsApi' || row.provider === 'oddsApiIo') {
            avail.add(row.provider)
          }
        }
        setAvailableProviders(avail)
        // Auto-sélectionne uniquement les providers ayant au moins une clé.
        setProviders((prev) => {
          const filtered = prev.filter((p) => avail.has(p as ProviderKey))
          if (filtered.length > 0) return filtered
          // Initial : on coche tous les providers disponibles.
          return Array.from(avail)
        })
        setKeysLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setKeysLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Charge la liste des bookmakers sélectionnés côté compte Odds-API.io.
  useEffect(() => {
    if (!availableProviders.has('oddsApiIo')) return
    let cancelled = false
    fetch('/api/api-keys/odds-api-io/selected-bookmakers')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        setOddsApiIoAllowed(Array.isArray(data.bookmakers) ? data.bookmakers : [])
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [availableProviders])

  const displayedSports = showAllSports ? SPORTS_LIST : SPORTS_LIST.slice(0, 10)

  function toggleItem(list: string[], setList: (v: string[]) => void, item: string) {
    setList(list.includes(item) ? list.filter(x => x !== item) : [...list, item])
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (selectedSports.length === 0) return

    const params: ScanParams = {
      mode,
      providers,
      sports: selectedSports,
      marketKeys: selectedMarkets,
      bookmakers: selectedBookmakers.length > 0 ? selectedBookmakers : undefined,
      timeWindow: timeWindowKind === 'custom'
        ? { kind: 'custom', hours: customHours }
        : { kind: timeWindowKind },
      stakeTotal,
      filters: { minRoiPct: minRoi },
    }
    onScan(params)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Mode */}
      <div>
        <label className="label">Mode de scan</label>
        <div className="flex gap-2">
          {(['full', 'optimized'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-colors ${
                mode === m
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {m === 'full' ? '🔍 Scan complet' : '⚡ Scan optimisé'}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {mode === 'full' ? 'Scanne tous les marchés demandés.' : 'Cible les combinaisons les plus rentables historiquement.'}
        </p>
      </div>

      {/* Fournisseurs */}
      <div>
        <label className="label">Fournisseurs de données</label>
        <div className="flex gap-4 flex-wrap">
          {PROVIDERS.map(p => {
            const hasKey = availableProviders.has(p.key)
            const disabled = !hasKey
            return (
              <label
                key={p.key}
                className={`flex items-center gap-2 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                title={disabled ? 'Aucune clé API configurée pour ce fournisseur' : ''}
              >
                <input
                  type="checkbox"
                  checked={providers.includes(p.key)}
                  disabled={disabled}
                  onChange={() => toggleItem(providers, setProviders, p.key)}
                  className="rounded accent-green-600"
                />
                <span className="text-sm">{p.label}</span>
                {disabled && (
                  <span className="text-xs text-orange-600 font-medium">(pas de clé)</span>
                )}
              </label>
            )
          })}
        </div>
        {keysLoaded && availableProviders.size === 0 && (
          <p className="text-xs text-orange-600 mt-1">
            Aucune clé API configurée. Allez dans <strong>Gestion des clés API</strong> pour en ajouter.
          </p>
        )}
      </div>

      {/* Sports */}
      <div>
        <label className="label">Sports ({selectedSports.length} sélectionné(s))</label>
        <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto border rounded-lg p-2">
          {displayedSports.map(s => (
            <label key={s.key} className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={selectedSports.includes(s.key)}
                onChange={() => toggleItem(selectedSports, setSelectedSports, s.key)}
                className="rounded accent-green-600"
              />
              {s.label}
            </label>
          ))}
        </div>
        {!showAllSports && SPORTS_LIST.length > 10 && (
          <button type="button" onClick={() => setShowAllSports(true)}
            className="text-xs text-blue-600 mt-1 hover:underline">
            + Voir tous les sports ({SPORTS_LIST.length})
          </button>
        )}
      </div>

      {/* Bookmakers */}
      <div>
        <label className="label">
          Bookmakers
          {selectedBookmakers.length === 0 && (
            <span className="text-xs text-gray-400 ml-2">(tous par défaut)</span>
          )}
        </label>
        <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto border rounded-lg p-2">
          {BOOKMAKERS_LIST.map(b => (
            <label key={b.key} className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={selectedBookmakers.includes(b.key)}
                onChange={() => toggleItem(selectedBookmakers, setSelectedBookmakers, b.key)}
                className="rounded accent-green-600"
              />
              <span>{b.label}</span>
              <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                b.providers === 'T+O' ? 'bg-green-100 text-green-700'
                  : b.providers === 'T' ? 'bg-orange-100 text-orange-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>{b.providers}</span>
            </label>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 mt-1">
          <span className="font-medium">T</span> = The Odds API,&nbsp;
          <span className="font-medium">O</span> = Odds-API.io.&nbsp;
          BC.Game, Stake et NetBet ne sont disponibles que via Odds-API.io.&nbsp;
          Pinnacle et Everygame ne sont disponibles que via The Odds API.
        </p>
        {oddsApiIoAllowed !== null && (
          <div className="mt-2 text-[11px] bg-blue-50 border border-blue-200 rounded p-2">
            <span className="font-medium text-blue-700">Plan Odds-API.io :</span>{' '}
            {oddsApiIoAllowed.length > 0 ? (
              <>
                limité à <span className="font-mono font-semibold">{oddsApiIoAllowed.join(', ')}</span>
                {' '}({oddsApiIoAllowed.length} bookmaker{oddsApiIoAllowed.length > 1 ? 's' : ''}).{' '}
                Les autres seront automatiquement ignorés sur ce fournisseur.
              </>
            ) : (
              <>aucun bookmaker sélectionné côté compte. Visitez{' '}
                <a href="https://odds-api.io/manage" target="_blank" rel="noreferrer" className="underline">odds-api.io/manage</a>.
              </>
            )}
          </div>
        )}
        {selectedBookmakers.length > 0 && (
          <button type="button" onClick={() => setSelectedBookmakers([])}
            className="text-xs text-gray-500 mt-1 hover:underline">
            ✕ Effacer la sélection (utiliser tous)
          </button>
        )}
      </div>

      {/* Marchés */}
      <div>
        <label className="label">Marchés</label>
        <div className="flex flex-wrap gap-2">
          {MARKET_KEYS.map(m => (
            <label key={m.key} className="flex items-center gap-1 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={selectedMarkets.includes(m.key)}
                onChange={() => toggleItem(selectedMarkets, setSelectedMarkets, m.key)}
                className="rounded accent-green-600"
              />
              {m.label}
            </label>
          ))}
        </div>
      </div>

      {/* Fenêtre temporelle */}
      <div>
        <label className="label">Fenêtre temporelle</label>
        <div className="flex gap-2 flex-wrap">
          {TIME_WINDOWS.map(tw => (
            <button
              key={tw.kind}
              type="button"
              onClick={() => setTimeWindowKind(tw.kind)}
              className={`py-1.5 px-3 rounded-lg border text-sm transition-colors ${
                timeWindowKind === tw.kind
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {tw.label}
            </button>
          ))}
        </div>
        {timeWindowKind === 'custom' && (
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              value={customHours}
              min={1}
              max={168}
              onChange={e => setCustomHours(Number(e.target.value))}
              className="input w-24"
            />
            <span className="text-sm text-gray-500">heures</span>
          </div>
        )}
      </div>

      {/* Mise totale */}
      <div>
        <label className="label">Mise totale pour calcul : {stakeTotal} €</label>
        <input
          type="range" min={10} max={10000} step={10}
          value={stakeTotal}
          onChange={e => setStakeTotal(Number(e.target.value))}
          className="w-full accent-green-600"
        />
      </div>

      {/* ROI minimum */}
      <div>
        <label className="label">ROI minimum : {minRoi}%</label>
        <input
          type="range" min={0} max={10} step={0.1}
          value={minRoi}
          onChange={e => setMinRoi(parseFloat(e.target.value))}
          className="w-full accent-green-600"
        />
      </div>

      <button
        type="submit"
        className="btn-primary w-full text-base py-3"
        disabled={loading || selectedSports.length === 0}
      >
        {loading ? '⏳ Scan en cours…' : '🚀 Lancer le scan'}
      </button>
    </form>
  )
}
