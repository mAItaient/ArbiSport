/**
 * Page Doutes — appariements d'événements entre fournisseurs nécessitant
 * une validation manuelle (score 0.70 - 0.90).
 */
import { useEffect, useState } from 'react'
import {
  getPendingMatches,
  confirmPendingMatch,
  rejectPendingMatch,
  getAliases,
  deleteAlias,
} from '../api/client'
import type { PendingMatch, ConfirmedAlias } from '../types'

export default function DoutesPage() {
  const [items, setItems] = useState<PendingMatch[]>([])
  const [aliases, setAliases] = useState<ConfirmedAlias[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const [list, al] = await Promise.all([getPendingMatches('pending'), getAliases()])
      setItems(list.items)
      setAliases(al)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
  }, [])

  async function handleConfirm(id: number) {
    await confirmPendingMatch(id)
    await reload()
  }

  async function handleReject(id: number) {
    await rejectPendingMatch(id)
    await reload()
  }

  async function handleDeleteAlias(id: number) {
    await deleteAlias(id)
    await reload()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">🤔 Doutes d'appariement</h1>
        <p className="text-sm text-gray-500 mt-1">
          Événements pour lesquels la confiance d'appariement est entre 70&nbsp;% et 90&nbsp;%.
          Confirmez pour fusionner les cotes des deux fournisseurs et apprendre les alias.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <section className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-lg font-semibold mb-3">
          Appariements en attente ({items.length})
        </h2>

        {loading ? (
          <p className="text-sm text-gray-400">Chargement…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-400">
            Aucun appariement en attente. Tout est cohérent ✅.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-4">Provider A</th>
                  <th className="py-2 pr-4">Match A</th>
                  <th className="py-2 pr-4">Provider B</th>
                  <th className="py-2 pr-4">Match B</th>
                  <th className="py-2 pr-4">Confiance</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(m => (
                  <tr key={m.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 pr-4 text-xs text-gray-500">{m.event_a_provider}</td>
                    <td className="py-2 pr-4">
                      <div className="font-medium">{m.event_a_home} vs {m.event_a_away}</div>
                      <div className="text-xs text-gray-400">{m.event_a_commence}</div>
                    </td>
                    <td className="py-2 pr-4 text-xs text-gray-500">{m.event_b_provider}</td>
                    <td className="py-2 pr-4">
                      <div className="font-medium">{m.event_b_home} vs {m.event_b_away}</div>
                      <div className="text-xs text-gray-400">{m.event_b_commence}</div>
                    </td>
                    <td className="py-2 pr-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        m.score >= 0.85 ? 'bg-green-100 text-green-700' :
                        m.score >= 0.78 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {(m.score * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleConfirm(m.id)}
                          className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                        >
                          ✓ Valider
                        </button>
                        <button
                          onClick={() => handleReject(m.id)}
                          className="px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
                        >
                          ✕ Rejeter
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-lg font-semibold mb-3">
          Alias confirmés ({aliases.length})
        </h2>
        {aliases.length === 0 ? (
          <p className="text-sm text-gray-400">Aucun alias enregistré.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-4">Forme canonique</th>
                <th className="py-2 pr-4">Alias</th>
                <th className="py-2 pr-4">Source</th>
                <th className="py-2 pr-4">Créé le</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {aliases.map(a => (
                <tr key={a.id} className="border-b">
                  <td className="py-2 pr-4 font-medium">{a.team_canonical}</td>
                  <td className="py-2 pr-4">{a.team_alias}</td>
                  <td className="py-2 pr-4 text-xs text-gray-500">{a.source_provider || '—'}</td>
                  <td className="py-2 pr-4 text-xs text-gray-400">{a.created_at}</td>
                  <td className="py-2 pr-4">
                    <button
                      onClick={() => handleDeleteAlias(a.id)}
                      className="px-2 py-1 text-red-600 text-xs hover:underline"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
