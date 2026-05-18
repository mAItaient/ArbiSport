/**
 * Page Marchés 2-way.
 * Affiche le catalogue des marchés 2-way détectés, groupés par sport.
 * Les sélections sont persistées dans la config de l'application.
 */
import { useState, useEffect } from 'react'
import { getTwoWayMarkets, initTwoWayMarkets, getConfig, updateConfig } from '../api/client'
import type { TwoWayMarket } from '../types'
import MarketCheckboxList from '../components/MarketCheckboxList'

const PROVIDERS = ['theOddsApi', 'oddsApiIo']
const SPORTS = [
  'soccer_epl', 'soccer_france_ligue_one', 'soccer_spain_la_liga',
  'basketball_nba', 'americanfootball_nfl', 'tennis_atp_french_open',
]

export default function MarketsPage() {
  const [markets, setMarkets] = useState<TwoWayMarket[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [initLoading, setInitLoading] = useState(false)
  const [providers, setProviders] = useState<string[]>(['theOddsApi'])
  const [sports, setSports] = useState<string[]>(['soccer_epl'])
  const [message, setMessage] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'twoWayOnly'>('twoWayOnly')

  useEffect(() => {
    loadData()
  }, [filter])

  async function loadData() {
    setLoading(true)
    try {
      const [mData, cfg] = await Promise.all([
        getTwoWayMarkets({ twoWayOnly: filter === 'twoWayOnly' }),
        getConfig(),
      ])
      setMarkets(mData.markets)
      const savedSelected = cfg['selectedMarketKeys']
      if (Array.isArray(savedSelected)) setSelected(savedSelected)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSelectionChange(marketKeys: string[]) {
    setSelected(marketKeys)
    try {
      await updateConfig({ selectedMarketKeys: marketKeys })
    } catch (err) {
      console.error('Erreur sauvegarde sélection:', err)
    }
  }

  async function handleInit() {
    if (providers.length === 0 || sports.length === 0) {
      setMessage('Sélectionnez au moins un fournisseur et un sport.')
      return
    }
    setInitLoading(true)
    setMessage(null)
    try {
      await initTwoWayMarkets({ providers, sports })
      setMessage('Initialisation lancée en arrière-plan. Rechargez dans quelques instants.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Erreur lors de l\'initialisation')
    } finally {
      setInitLoading(false)
    }
  }

  function toggleItem(list: string[], setList: (v: string[]) => void, item: string) {
    setList(list.includes(item) ? list.filter(x => x !== item) : [...list, item])
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Marchés 2-way</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Catalogue des marchés à 2 issues détectés automatiquement.
        </p>
      </div>

      {/* Initialisation */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Initialisation du catalogue</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Fournisseurs</label>
            <div className="flex gap-3">
              {PROVIDERS.map(p => (
                <label key={p} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={providers.includes(p)}
                    onChange={() => toggleItem(providers, setProviders, p)}
                    className="rounded accent-green-600"
                  />
                  {p === 'theOddsApi' ? 'The Odds API' : 'Odds-API.io'}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Sports à tester</label>
            <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto">
              {SPORTS.map(s => (
                <label key={s} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sports.includes(s)}
                    onChange={() => toggleItem(sports, setSports, s)}
                    className="rounded accent-green-600"
                  />
                  {s.replace(/_/g, ' ')}
                </label>
              ))}
            </div>
          </div>
        </div>
        {message && (
          <p className={`mt-3 text-sm ${message.includes('Erreur') ? 'text-red-600' : 'text-green-600'}`}>
            {message}
          </p>
        )}
        <div className="flex gap-3 mt-4">
          <button
            onClick={handleInit}
            className="btn-primary"
            disabled={initLoading}
          >
            {initLoading ? 'Initialisation…' : '🔄 Initialiser le catalogue'}
          </button>
          <button onClick={loadData} className="btn-secondary">
            Recharger
          </button>
        </div>
      </div>

      {/* Filtre */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-700">Afficher :</span>
        <button
          onClick={() => setFilter('twoWayOnly')}
          className={`text-sm px-3 py-1.5 rounded-lg border ${filter === 'twoWayOnly' ? 'bg-green-600 text-white border-green-600' : 'border-gray-300 hover:bg-gray-50'}`}
        >
          Marchés 2-way uniquement
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`text-sm px-3 py-1.5 rounded-lg border ${filter === 'all' ? 'bg-green-600 text-white border-green-600' : 'border-gray-300 hover:bg-gray-50'}`}
        >
          Tous les marchés
        </button>
      </div>

      {/* Sélection persistée */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            Catalogue ({markets.length} entrées)
          </h2>
          {selected.length > 0 && (
            <span className="badge badge-green">{selected.length} sélectionné(s)</span>
          )}
        </div>
        {loading ? (
          <div className="text-center py-6 text-gray-400">Chargement…</div>
        ) : (
          <MarketCheckboxList
            markets={markets}
            selected={selected}
            onChange={handleSelectionChange}
          />
        )}
      </div>
    </div>
  )
}
