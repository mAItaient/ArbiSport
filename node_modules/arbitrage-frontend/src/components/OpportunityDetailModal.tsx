/**
 * Modal de détail d'une opportunité d'arbitrage.
 * Affiche toutes les informations + calculateur de mises en live.
 */
import type { ArbitrageOpportunity } from '../types'
import StakeCalculator from './StakeCalculator'
import BookmakerLinkButtons from './BookmakerLinkButtons'
import QualityBadge from './QualityBadge'

interface Props {
  opportunity: ArbitrageOpportunity
  onClose: () => void
}

export default function OpportunityDetailModal({ opportunity: opp, onClose }: Props) {
  const commenceDate = opp.commence_time
    ? new Date(opp.commence_time).toLocaleString('fr-FR')
    : '—'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* En-tête */}
        <div className="p-6 border-b flex items-start justify-between">
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">
              {opp.sport} {opp.league ? `· ${opp.league}` : ''}
            </div>
            <h2 className="text-lg font-bold text-gray-900">{opp.event_label}</h2>
            <div className="flex items-center gap-3 mt-1">
              <QualityBadge roi={opp.roi ?? 0} />
              <span className="text-sm text-gray-500">{opp.market_label || opp.market_key}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Corps */}
        <div className="p-6 space-y-4">
          {/* Informations de l'événement */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Date :</span>
              <span className="ml-2 font-medium">{commenceDate}</span>
            </div>
            <div>
              <span className="text-gray-500">Fournisseur :</span>
              <span className="ml-2 font-medium">{opp.provider || '—'}</span>
            </div>
          </div>

          {/* Cotes côte à côte */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">Bookmaker A</div>
              <div className="font-bold text-blue-800 text-xl">{opp.bookmaker_a}</div>
              <div className="text-sm text-gray-600 mt-1">{opp.outcome_a_label}</div>
              <div className="text-2xl font-bold text-blue-700 mt-2">{opp.odds_a?.toFixed(3)}</div>
            </div>
            <div className="bg-purple-50 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">Bookmaker B</div>
              <div className="font-bold text-purple-800 text-xl">{opp.bookmaker_b}</div>
              <div className="text-sm text-gray-600 mt-1">{opp.outcome_b_label}</div>
              <div className="text-2xl font-bold text-purple-700 mt-2">{opp.odds_b?.toFixed(3)}</div>
            </div>
          </div>

          {/* Liens vers les bookmakers */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Accéder aux bookmakers :</p>
            <BookmakerLinkButtons
              bookmakerA={opp.bookmaker_a || ''}
              bookmakerB={opp.bookmaker_b || ''}
              urlA={opp.bookmaker_a_url}
              urlB={opp.bookmaker_b_url}
            />
          </div>

          {/* Calculateur de mises */}
          <StakeCalculator opportunity={opp} />

          {/* Avertissement légal */}
          <p className="text-xs text-gray-400 italic">
            ⚠️ L'arbitrage sportif peut être restreint ou interdit par certains bookmakers.
            Vérifiez les conditions d'utilisation avant de parier. Ce logiciel ne place
            aucun pari automatiquement.
          </p>
        </div>
      </div>
    </div>
  )
}
