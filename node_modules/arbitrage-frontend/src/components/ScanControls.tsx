/**
 * Panneau de déclenchement de scan avec paramètres configurables.
 */
import { useState } from 'react'
import type { ScanParams } from '../types'

const SPORTS_POPULAIRES = [
  { key: 'soccer_epl', label: 'Football – Premier League' },
  { key: 'soccer_france_ligue_one', label: 'Football – Ligue 1' },
  { key: 'soccer_spain_la_liga', label: 'Football – La Liga' },
  { key: 'soccer_germany_bundesliga', label: 'Football – Bundesliga' },
  { key: 'soccer_uefa_champs_league', label: 'Football – Champions League' },
  { key: 'basketball_nba', label: 'Basketball – NBA' },
  { key: 'tennis_atp_french_open', label: 'Tennis – Roland-Garros' },
  { key: 'americanfootball_nfl', label: 'Football américain – NFL' },
]

const MARKET_KEYS = [
  { key: 'h2h', label: 'Victoire/Défaite (H2H)' },
  { key: 'totals', label: 'Total buts/points' },
  { key: 'spreads', label: 'Handicap (Spreads)' },
  { key: 'draw_no_bet', label: 'Victoire sans nul' },
]

const TIME_WINDOWS = [
  { kind: 'live', label: 'En direct (live)' },
  { kind: 'next24', label: 'Prochaines 24h' },
  { kind: 'next48', label: 'Prochaines 48h' },
  { kind: 'custom', label: 'Personnalisé' },
] as const

interface Props {
  onScan: (params: ScanParams) => void
  loading?: boolean
}

export default function ScanControls({ onScan, loading = false }: Props) {
  const [mode, setMode] = useState<'full' | 'optimized'>('full')
  const [selectedSports, setSelectedSports] = useState<string[]>(['soccer_epl'])
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>(['h2h'])
  const [timeWindowKind, setTimeWindowKind] = useState<'live' | 'next24' | 'next48' | 'custom'>('next24')
  const [customHours, setCustomHours] = useState(24)
  const [stakeTotal, setStakeTotal] = useState(100)
  const [minRoi, setMinRoi] = useState(0)
  const [providers, setProviders] = useState<string[]>(['theOddsApi'])

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
        <div className="flex gap-3">
          {['theOddsApi', 'oddsApiIo'].map(p => (
            <label key={p} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={providers.includes(p)}
                onChange={() => toggleItem(providers, setProviders, p)}
                className="rounded accent-green-600"
              />
              <span className="text-sm">{p === 'theOddsApi' ? 'The Odds API' : 'Odds-API.io'}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Sports */}
      <div>
        <label className="label">Sports ({selectedSports.length} sélectionné(s))</label>
        <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto border rounded-lg p-2">
          {SPORTS_POPULAIRES.map(s => (
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
