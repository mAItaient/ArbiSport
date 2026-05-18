/**
 * Page Tableau de bord.
 * Affiche les dernières opportunités d'arbitrage avec polling automatique (30s).
 */
import { useState, useCallback } from 'react'
import { getOpportunities, getAnalyticsStats } from '../api/client'
import type { ArbitrageOpportunity } from '../types'
import { usePolling } from '../hooks/usePolling'
import OpportunityCard from '../components/OpportunityCard'
import OpportunityDetailModal from '../components/OpportunityDetailModal'

export default function DashboardPage() {
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<{ count: number; avgRoi: number; maxRoi: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedOpp, setSelectedOpp] = useState<ArbitrageOpportunity | null>(null)
  const [minRoi, setMinRoi] = useState(0)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [oppData, statsData] = await Promise.all([
        getOpportunities({ limit: 50, minRoiPct: minRoi }),
        getAnalyticsStats(7),
      ])
      setOpportunities(oppData.items)
      setTotal(oppData.total)
      setStats(statsData)
      setLastRefresh(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [minRoi])

  const { refresh } = usePolling(fetchData, 30_000)

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {lastRefresh
              ? `Dernière mise à jour : ${lastRefresh.toLocaleTimeString('fr-FR')}`
              : 'Chargement…'}
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="btn-secondary flex items-center gap-2"
        >
          {loading ? '⏳' : '🔄'} Rafraîchir
        </button>
      </div>

      {/* Stats rapides */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card text-center">
            <div className="text-2xl font-bold text-green-700">{total}</div>
            <div className="text-sm text-gray-500">Opportunités total</div>
          </div>
          <div className="card text-center">
            <div className="text-2xl font-bold text-blue-700">{stats.avgRoi.toFixed(2)}%</div>
            <div className="text-sm text-gray-500">ROI moyen (7j)</div>
          </div>
          <div className="card text-center">
            <div className="text-2xl font-bold text-purple-700">{stats.maxRoi.toFixed(2)}%</div>
            <div className="text-sm text-gray-500">ROI max (7j)</div>
          </div>
        </div>
      )}

      {/* Filtre ROI */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
          ROI minimum : {minRoi}%
        </label>
        <input
          type="range" min={0} max={10} step={0.5}
          value={minRoi}
          onChange={e => setMinRoi(parseFloat(e.target.value))}
          className="flex-1 accent-green-600"
        />
      </div>

      {/* Erreur */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {/* Liste des opportunités */}
      {opportunities.length === 0 && !loading ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-5xl mb-4">📊</p>
          <p className="text-lg font-medium text-gray-600">Aucune opportunité d'arbitrage</p>
          <p className="text-sm mt-2">
            Lancez un scan depuis la page <strong>Paramètres scan</strong> pour détecter
            des opportunités, ou vérifiez que vous avez ajouté des clés API.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {opportunities.map(opp => (
            <OpportunityCard
              key={opp.id}
              opportunity={opp}
              onClick={() => setSelectedOpp(opp)}
            />
          ))}
        </div>
      )}

      {/* Modal de détail */}
      {selectedOpp && (
        <OpportunityDetailModal
          opportunity={selectedOpp}
          onClose={() => setSelectedOpp(null)}
        />
      )}
    </div>
  )
}
