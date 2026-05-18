/**
 * Page Gestion des clés API.
 * Affiche la liste des clés avec statuts colorisés et jauges de quota.
 */
import { useState, useEffect, useCallback } from 'react'
import { getApiKeys } from '../api/client'
import type { ApiKey } from '../types'
import ApiKeyForm from '../components/ApiKeyForm'
import ApiKeyList from '../components/ApiKeyList'

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadKeys = useCallback(async () => {
    try {
      const data = await getApiKeys()
      setKeys(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadKeys()
  }, [loadKeys])

  const hasActiveKeys = keys.some(k => k.enabled && k.status !== 'LIMITED')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des clés API</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Gérez vos clés pour The Odds API et Odds-API.io.
          </p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="btn-primary"
        >
          {showForm ? '✕ Fermer' : '+ Ajouter une clé'}
        </button>
      </div>

      {/* Message d'invite si aucune clé */}
      {!loading && keys.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
          <p className="text-4xl mb-3">🔑</p>
          <p className="font-semibold text-blue-900">Ajoutez votre première clé API</p>
          <p className="text-sm text-blue-700 mt-2 max-w-md mx-auto">
            Pour détecter des opportunités d'arbitrage, vous avez besoin d'une clé API
            d'au moins un fournisseur de cotes.
          </p>
          <div className="flex gap-3 justify-center mt-4 text-sm">
            <a href="https://the-odds-api.com" target="_blank" rel="noopener noreferrer"
              className="text-blue-600 underline hover:text-blue-800">
              The Odds API (500 req/mois gratuit)
            </a>
            <span className="text-gray-400">·</span>
            <a href="https://odds-api.io" target="_blank" rel="noopener noreferrer"
              className="text-blue-600 underline hover:text-blue-800">
              Odds-API.io
            </a>
          </div>
          <button onClick={() => setShowForm(true)} className="btn-primary mt-4">
            Ajouter ma première clé
          </button>
        </div>
      )}

      {/* Avertissement si aucune clé active */}
      {!loading && keys.length > 0 && !hasActiveKeys && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
          ⚠️ Toutes vos clés sont épuisées ou désactivées. Ajoutez une nouvelle clé ou attendez la réinitialisation de votre quota.
        </div>
      )}

      {/* Formulaire d'ajout */}
      {showForm && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Nouvelle clé API</h2>
          <ApiKeyForm
            onSuccess={() => {
              setShowForm(false)
              loadKeys()
            }}
          />
        </div>
      )}

      {/* Erreur */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {/* Liste des clés */}
      {loading ? (
        <div className="text-center py-8 text-gray-400">Chargement…</div>
      ) : (
        <ApiKeyList keys={keys} onRefresh={loadKeys} />
      )}

      {/* Documentation */}
      <div className="card bg-gray-50">
        <h3 className="font-medium text-gray-700 mb-2">Comment obtenir des clés API ?</h3>
        <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
          <li>
            <strong>The Odds API</strong> : Inscrivez-vous sur{' '}
            <a href="https://the-odds-api.com" target="_blank" rel="noopener noreferrer"
              className="text-blue-600 underline">the-odds-api.com</a>.
            Plan gratuit : 500 requêtes/mois.
          </li>
          <li>
            <strong>Odds-API.io</strong> : Inscrivez-vous sur{' '}
            <a href="https://odds-api.io" target="_blank" rel="noopener noreferrer"
              className="text-blue-600 underline">odds-api.io</a>.
          </li>
        </ul>
      </div>
    </div>
  )
}
