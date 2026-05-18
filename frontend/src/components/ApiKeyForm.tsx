/**
 * Formulaire simplifié d'ajout d'une clé API.
 * - Checkbox fournisseur
 * - Champ valeur clé
 * - Quota pré-rempli automatiquement selon le fournisseur
 */
import { useState } from 'react'
import { createApiKey } from '../api/client'

interface Props {
  onSuccess: () => void
}

const PROVIDER_DEFAULTS = {
  theOddsApi: {
    label: 'The Odds API',
    quota_limit: 500,
    quota_period: 'monthly' as const,
    hint: '500 req / mois — all sports, most bookmakers',
    placeholder: 'Collez votre clé The Odds API',
  },
  oddsApiIo: {
    label: 'Odds-API.io',
    quota_limit: 100,
    quota_period: 'hourly' as const,
    hint: '100 req / heure — 2 bookmakers',
    placeholder: 'Collez votre clé Odds-API.io',
  },
}

export default function ApiKeyForm({ onSuccess }: Props) {
  const [provider, setProvider] = useState<'theOddsApi' | 'oddsApiIo'>('theOddsApi')
  const [apiKey, setApiKey] = useState('')
  const [quotaLimit, setQuotaLimit] = useState<number>(500)
  const [quotaPeriod, setQuotaPeriod] = useState<'hourly' | 'daily' | 'monthly'>('monthly')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleProviderChange(p: 'theOddsApi' | 'oddsApiIo') {
    setProvider(p)
    setQuotaLimit(PROVIDER_DEFAULTS[p].quota_limit)
    setQuotaPeriod(PROVIDER_DEFAULTS[p].quota_period)
    setApiKey('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await createApiKey({
        provider,
        label: PROVIDER_DEFAULTS[provider].label,
        api_key_value: apiKey,
        quota_limit: quotaLimit,
        quota_period: quotaPeriod,
      } as Parameters<typeof createApiKey>[0])
      setApiKey('')
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création')
    } finally {
      setLoading(false)
    }
  }

  const defaults = PROVIDER_DEFAULTS[provider]

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Sélection fournisseur */}
      <div>
        <label className="label">Fournisseur</label>
        <div className="flex gap-4">
          {(['theOddsApi', 'oddsApiIo'] as const).map(p => (
            <label key={p} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="provider"
                value={p}
                checked={provider === p}
                onChange={() => handleProviderChange(p)}
                className="accent-green-600"
              />
              <span className="text-sm font-medium">{PROVIDER_DEFAULTS[p].label}</span>
              <span className="text-xs text-gray-400">({PROVIDER_DEFAULTS[p].hint})</span>
            </label>
          ))}
        </div>
      </div>

      {/* Valeur clé */}
      <div>
        <label className="label">Clé API</label>
        <input
          type="password"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          className="input font-mono"
          placeholder={defaults.placeholder}
          required
          autoComplete="off"
        />
      </div>

      {/* Quota */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="label">Quota (nombre de req.)</label>
          <input
            type="number"
            value={quotaLimit}
            min={1}
            onChange={e => setQuotaLimit(Number(e.target.value))}
            className="input"
          />
        </div>
        <div className="flex-1">
          <label className="label">Période</label>
          <select
            value={quotaPeriod}
            onChange={e => setQuotaPeriod(e.target.value as 'hourly' | 'daily' | 'monthly')}
            className="input"
          >
            <option value="hourly">Par heure</option>
            <option value="daily">Par jour</option>
            <option value="monthly">Par mois</option>
          </select>
        </div>
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
