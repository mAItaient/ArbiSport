/**
 * Formulaire d'ajout d'une clé API.
 */
import { useState } from 'react'
import { createApiKey } from '../api/client'

interface Props {
  onSuccess: () => void
}

export default function ApiKeyForm({ onSuccess }: Props) {
  const [provider, setProvider] = useState<'theOddsApi' | 'oddsApiIo'>('theOddsApi')
  const [label, setLabel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [planInfo, setPlanInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await createApiKey({
        provider,
        label,
        api_key_value: apiKey,
        plan_info: planInfo || undefined,
      })
      setLabel('')
      setApiKey('')
      setPlanInfo('')
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Fournisseur</label>
        <select
          value={provider}
          onChange={e => setProvider(e.target.value as 'theOddsApi' | 'oddsApiIo')}
          className="input"
        >
          <option value="theOddsApi">The Odds API</option>
          <option value="oddsApiIo">Odds-API.io</option>
        </select>
      </div>

      <div>
        <label className="label">Label (ex: Clé principale Free)</label>
        <input
          type="text"
          value={label}
          onChange={e => setLabel(e.target.value)}
          className="input"
          placeholder="Mon nom pour cette clé"
          required
        />
      </div>

      <div>
        <label className="label">Valeur de la clé API</label>
        <input
          type="password"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          className="input font-mono"
          placeholder="Collez ici votre clé API"
          required
          autoComplete="off"
        />
      </div>

      <div>
        <label className="label">Informations sur le plan (optionnel)</label>
        <input
          type="text"
          value={planInfo}
          onChange={e => setPlanInfo(e.target.value)}
          className="input"
          placeholder="ex: Free 500 req/mois"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? 'Ajout en cours…' : 'Ajouter la clé'}
      </button>
    </form>
  )
}
