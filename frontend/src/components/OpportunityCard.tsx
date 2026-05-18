/**
 * Carte résumée d'une opportunité d'arbitrage.
 */
import type { ArbitrageOpportunity } from '../types'
import QualityBadge from './QualityBadge'
import BookmakerLinkButtons from './BookmakerLinkButtons'

interface OpportunityCardProps {
  opportunity: ArbitrageOpportunity
  onClick?: () => void
}

export default function OpportunityCard({ opportunity: opp, onClick }: OpportunityCardProps) {
  const roi = opp.roi ?? 0
  const commenceDate = opp.commence_time
    ? new Date(opp.commence_time).toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit',
        hour: '2-digit', minute: '2-digit',
      })
    : '—'

  return (
    <div
      className="card hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* En-tête : événement + marché */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              {opp.sport} {opp.league ? `· ${opp.league}` : ''}
            </span>
          </div>
          <p className="font-semibold text-gray-900 truncate">
            {opp.event_label || opp.event_id}
          </p>
          <p className="text-sm text-gray-500">
            {opp.market_label || opp.market_key} · {commenceDate}
          </p>
        </div>

        {/* ROI */}
        <div className="text-right flex-shrink-0">
          <QualityBadge roi={roi} />
          <p className="text-xs text-gray-400 mt-1">ROI</p>
        </div>
      </div>

      {/* Cotes */}
      <div className="mt-3 flex items-center gap-3 text-sm">
        <div className="flex-1 bg-blue-50 rounded-lg p-2 text-center">
          <div className="text-xs text-gray-500 truncate">{opp.bookmaker_a}</div>
          <div className="font-bold text-blue-700">{opp.odds_a?.toFixed(3)}</div>
          <div className="text-xs text-gray-500">{opp.outcome_a_label}</div>
        </div>
        <div className="text-gray-400 font-bold">VS</div>
        <div className="flex-1 bg-purple-50 rounded-lg p-2 text-center">
          <div className="text-xs text-gray-500 truncate">{opp.bookmaker_b}</div>
          <div className="font-bold text-purple-700">{opp.odds_b?.toFixed(3)}</div>
          <div className="text-xs text-gray-500">{opp.outcome_b_label}</div>
        </div>
      </div>

      {/* Gain minimal */}
      {opp.stake_total != null && opp.gain_min != null && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-gray-500">
            Mise totale : <span className="font-medium text-gray-700">{opp.stake_total} €</span>
          </span>
          <span className="font-semibold text-green-700">
            Gain min : +{opp.gain_min?.toFixed(2)} €
          </span>
        </div>
      )}

      {/* Liens bookmakers */}
      <div className="mt-3">
        <BookmakerLinkButtons
          bookmakerA={opp.bookmaker_a || ''}
          bookmakerB={opp.bookmaker_b || ''}
          urlA={opp.bookmaker_a_url}
          urlB={opp.bookmaker_b_url}
        />
      </div>
    </div>
  )
}
