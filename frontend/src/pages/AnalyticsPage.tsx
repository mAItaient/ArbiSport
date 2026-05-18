/**
 * Page Analytics.
 * Affiche les hotspots d'arbitrage : top combinaisons par fréquence et ROI.
 */
import { useState, useEffect } from 'react'
import { getHotspots, getAnalyticsStats } from '../api/client'
import type { Hotspot } from '../types'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'

export default function AnalyticsPage() {
  const [hotspots, setHotspots] = useState<Hotspot[]>([])
  const [stats, setStats] = useState<{ count: number; avgRoi: number; maxRoi: number; avgGainMin: number } | null>(null)
  const [days, setDays] = useState(7)
  const [groupBy, setGroupBy] = useState<'market' | 'pair'>('market')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [days, groupBy])

  async function loadData() {
    setLoading(true)
    try {
      const [hs, st] = await Promise.all([
        getHotspots({ days, groupBy }),
        getAnalyticsStats(days),
      ])
      setHotspots(hs.hotspots)
      setStats(st)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const chartData = hotspots.slice(0, 10).map(h => ({
    name: groupBy === 'pair'
      ? `${h.bookmaker_a} / ${h.bookmaker_b}`
      : `${h.sport} · ${h.market_key}`,
    occurrences: h.occurrences,
    avg_roi: parseFloat((h.avg_roi || 0).toFixed(2)),
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Analyse des opportunités historiques pour identifier les zones les plus rentables.
        </p>
      </div>

      {/* Contrôles */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Période :</label>
          {[7, 14, 30].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`text-sm px-3 py-1.5 rounded-lg border ${
                days === d ? 'bg-green-600 text-white border-green-600' : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              {d}j
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Grouper par :</label>
          <button
            onClick={() => setGroupBy('market')}
            className={`text-sm px-3 py-1.5 rounded-lg border ${
              groupBy === 'market' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 hover:bg-gray-50'
            }`}
          >
            Marché/Sport
          </button>
          <button
            onClick={() => setGroupBy('pair')}
            className={`text-sm px-3 py-1.5 rounded-lg border ${
              groupBy === 'pair' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 hover:bg-gray-50'
            }`}
          >
            Paire bookmakers
          </button>
        </div>
      </div>

      {/* Statistiques globales */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Opportunités', value: stats.count.toString(), color: 'text-green-700' },
            { label: 'ROI moyen', value: `${stats.avgRoi.toFixed(2)}%`, color: 'text-blue-700' },
            { label: 'ROI max', value: `${stats.maxRoi.toFixed(2)}%`, color: 'text-purple-700' },
            { label: 'Gain min moyen', value: `${stats.avgGainMin.toFixed(2)} €`, color: 'text-orange-700' },
          ].map(s => (
            <div key={s.label} className="card text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-sm text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-400">Chargement…</div>
      ) : hotspots.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📈</p>
          <p className="font-medium text-gray-600">Pas encore de données analytics</p>
          <p className="text-sm mt-1">Effectuez des scans pour construire l'historique des opportunités.</p>
        </div>
      ) : (
        <>
          {/* Graphique */}
          {chartData.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">
                Top 10 — {groupBy === 'pair' ? 'Paires de bookmakers' : 'Marchés/Sports'} (occurrences)
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    angle={-30}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="occurrences" name="Occurrences" radius={[4, 4, 0, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={`hsl(${140 + i * 15}, 60%, ${55 - i * 2}%)`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tableau des hotspots */}
          <div className="card overflow-hidden">
            <h2 className="text-lg font-semibold mb-4">Tableau des hotspots</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-gray-500 text-xs uppercase">
                    <th className="text-left py-2 px-3">
                      {groupBy === 'pair' ? 'Paire bookmakers' : 'Sport / Marché'}
                    </th>
                    <th className="text-right py-2 px-3">Occurrences</th>
                    <th className="text-right py-2 px-3">ROI moyen</th>
                    <th className="text-right py-2 px-3">ROI max</th>
                    <th className="text-right py-2 px-3">Gain min moy.</th>
                    <th className="text-right py-2 px-3">Dernière vue</th>
                  </tr>
                </thead>
                <tbody>
                  {hotspots.map((h, i) => (
                    <tr key={i} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-3 font-medium">
                        {groupBy === 'pair'
                          ? `${h.bookmaker_a} vs ${h.bookmaker_b}`
                          : `${h.sport} · ${h.market_key}`}
                      </td>
                      <td className="text-right py-2 px-3">
                        <span className="font-semibold text-green-700">{h.occurrences}</span>
                      </td>
                      <td className="text-right py-2 px-3 text-blue-700">
                        {(h.avg_roi || 0).toFixed(2)}%
                      </td>
                      <td className="text-right py-2 px-3 text-purple-700">
                        {(h.max_roi || 0).toFixed(2)}%
                      </td>
                      <td className="text-right py-2 px-3 text-orange-700">
                        {(h.avg_gain_min || 0).toFixed(2)} €
                      </td>
                      <td className="text-right py-2 px-3 text-gray-400 text-xs">
                        {h.last_seen
                          ? new Date(h.last_seen).toLocaleDateString('fr-FR')
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
