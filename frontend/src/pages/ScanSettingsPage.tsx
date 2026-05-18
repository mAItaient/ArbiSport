/**
 * Page Paramètres scan.
 * Permet de configurer et déclencher un scan d'arbitrage.
 */
import { useState } from 'react'
import { runScan } from '../api/client'
import type { ScanParams, ScanResult } from '../types'
import ScanControls from '../components/ScanControls'
import OpportunityCard from '../components/OpportunityCard'
import OpportunityDetailModal from '../components/OpportunityDetailModal'
import type { ArbitrageOpportunity } from '../types'

export default function ScanSettingsPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [selectedOpp, setSelectedOpp] = useState<ArbitrageOpportunity | null>(null)

  async function handleScan(params: ScanParams) {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await runScan(params)
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du scan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Paramètres scan</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Configurez et lancez un scan pour détecter des opportunités d'arbitrage.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        {/* Panneau de contrôle */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Configuration</h2>
          <ScanControls onScan={handleScan} loading={loading} />
        </div>

        {/* Résultats */}
        <div>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-sm text-red-700">
              ⚠️ {error}
              {error.includes('Aucune clé API') && (
                <p className="mt-1">
                  Rendez-vous sur la page <strong>Gestion clés API</strong> pour ajouter une clé.
                </p>
              )}
            </div>
          )}

          {loading && (
            <div className="card text-center py-12">
              <div className="text-4xl mb-3">⏳</div>
              <p className="font-medium text-gray-700">Scan en cours…</p>
              <p className="text-sm text-gray-500 mt-1">
                Cette opération peut prendre quelques secondes selon le nombre de marchés.
              </p>
            </div>
          )}

          {result && !loading && (
            <>
              <div className="card mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">Scan terminé</p>
                    <p className="text-sm text-gray-500">
                      {result.opportunitiesFound} opportunité(s) trouvée(s) en {result.requestsEstimated} requête(s)
                    </p>
                  </div>
                  <span className={`badge ${result.opportunitiesFound > 0 ? 'badge-green' : 'badge-gray'}`}>
                    {result.opportunitiesFound > 0 ? '✅ Succès' : 'Aucune opportunité'}
                  </span>
                </div>
              </div>

              {result.opportunities.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {result.opportunities.map((opp, i) => (
                    <OpportunityCard
                      key={opp.id || i}
                      opportunity={opp}
                      onClick={() => setSelectedOpp(opp)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-4xl mb-3">🔍</p>
                  <p>Aucune opportunité d'arbitrage détectée pour ces paramètres.</p>
                  <p className="text-sm mt-1">Essayez d'élargir la sélection de sports/marchés ou d'abaisser le ROI minimum.</p>
                </div>
              )}
            </>
          )}

          {!result && !loading && !error && (
            <div className="text-center py-16 text-gray-400">
              <p className="text-5xl mb-4">🔍</p>
              <p className="text-lg font-medium text-gray-600">Prêt à scanner</p>
              <p className="text-sm mt-2">Configurez les paramètres à gauche et cliquez sur Lancer le scan.</p>
            </div>
          )}
        </div>
      </div>

      {selectedOpp && (
        <OpportunityDetailModal
          opportunity={selectedOpp}
          onClose={() => setSelectedOpp(null)}
        />
      )}
    </div>
  )
}
