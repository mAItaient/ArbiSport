/**
 * Liste des clés API avec statut colorisé, jauge de quota et période.
 */
import type { ApiKey } from '../types'
import { deleteApiKey, toggleApiKey } from '../api/client'

interface Props {
  keys: ApiKey[]
  onRefresh: () => void
}

const PERIOD_LABELS: Record<string, string> = {
  hourly: 'req/h',
  daily: 'req/j',
  monthly: 'req/mois',
}

export default function ApiKeyList({ keys, onRefresh }: Props) {
  if (keys.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-4xl mb-3">🔑</p>
        <p className="font-medium">Aucune clé API configurée</p>
        <p className="text-sm mt-1">Ajoutez une clé ci-dessus pour commencer les scans.</p>
      </div>
    )
  }

  async function handleToggle(id: number) {
    try { await toggleApiKey(id); onRefresh() } catch (err) { console.error(err) }
  }

  async function handleDelete(id: number) {
    if (!confirm('Supprimer cette clé API ?')) return
    try { await deleteApiKey(id); onRefresh() } catch (err) { console.error(err) }
  }

  return (
    <div className="space-y-3">
      {keys.map(key => (
        <KeyCard key={key.id} apiKey={key} onToggle={handleToggle} onDelete={handleDelete} />
      ))}
    </div>
  )
}

function KeyCard({
  apiKey: k,
  onToggle,
  onDelete,
}: {
  apiKey: ApiKey
  onToggle: (id: number) => void
  onDelete: (id: number) => void
}) {
  const statusColors: Record<string, string> = {
    ACTIVE: 'badge-green',
    NEAR_LIMIT: 'badge-yellow',
    LIMITED: 'badge-red',
  }
  const statusLabels: Record<string, string> = {
    ACTIVE: 'Actif',
    NEAR_LIMIT: 'Presque épuisé',
    LIMITED: 'Épuisé',
  }

  const remaining = k.requests_remaining ?? null
  const limit = k.requests_limit ?? k.quota_limit ?? null
  const pct = remaining != null && limit ? Math.round((remaining / limit) * 100) : null
  const providerLabel = k.provider === 'theOddsApi' ? 'The Odds API' : 'Odds-API.io'
  const periodLabel = k.quota_period ? PERIOD_LABELS[k.quota_period] || k.quota_period : ''

  return (
    <div className={`card ${!k.enabled ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="badge badge-gray">{providerLabel}</span>
            <span className={`badge ${statusColors[k.status] || 'badge-gray'}`}>
              {statusLabels[k.status] || k.status}
            </span>
            {!k.enabled && <span className="badge badge-gray">Désactivé</span>}
          </div>
          <p className="text-xs text-gray-400 font-mono">{k.api_key_value}</p>
          {k.quota_limit && (
            <p className="text-xs text-gray-500 mt-1">
              Quota : <strong>{k.quota_limit.toLocaleString()} {periodLabel}</strong>
            </p>
          )}
          <p className="text-xs text-gray-400 mt-0.5">Requêtes utilisées : {k.requests_used_total}</p>
        </div>

        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={() => onToggle(k.id)}
            className={`text-xs px-2 py-1 rounded border ${
              k.enabled
                ? 'border-gray-300 text-gray-600 hover:bg-gray-50'
                : 'border-green-400 text-green-600 hover:bg-green-50'
            }`}
          >
            {k.enabled ? 'Désactiver' : 'Activer'}
          </button>
          <button
            onClick={() => onDelete(k.id)}
            className="text-xs px-2 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50"
          >
            Supprimer
          </button>
        </div>
      </div>

      {pct !== null && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Quota restant</span>
            <span>{remaining?.toLocaleString()} / {limit?.toLocaleString()} ({pct}%)</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                pct > 20 ? 'bg-green-500' : pct > 5 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
