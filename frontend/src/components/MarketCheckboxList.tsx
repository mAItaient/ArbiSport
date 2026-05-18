/**
 * Liste de marchés 2-way avec checkboxes persistées en configuration.
 */
import type { TwoWayMarket } from '../types'

interface Props {
  markets: TwoWayMarket[]
  selected: string[]
  onChange: (marketKeys: string[]) => void
}

export default function MarketCheckboxList({ markets, selected, onChange }: Props) {
  // Groupement par sport
  const bySport: Record<string, TwoWayMarket[]> = {}
  for (const m of markets) {
    const s = m.sport || 'Inconnu'
    if (!bySport[s]) bySport[s] = []
    bySport[s].push(m)
  }

  function toggleMarket(marketKey: string) {
    onChange(
      selected.includes(marketKey)
        ? selected.filter(k => k !== marketKey)
        : [...selected, marketKey]
    )
  }

  if (markets.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500 text-sm">
        Aucun marché 2-way dans le catalogue. Lancez une initialisation ci-dessus.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {Object.entries(bySport).map(([sport, sportMarkets]) => (
        <div key={sport}>
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
            {sport}
          </h3>
          <div className="space-y-1 pl-2">
            {/* Dédupliquer par market_key */}
            {Array.from(new Map(sportMarkets.map(m => [m.market_key, m])).values()).map(market => (
              <label key={market.market_key} className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(market.market_key)}
                  onChange={() => toggleMarket(market.market_key)}
                  className="rounded accent-green-600"
                />
                <span>{market.market_key}</span>
                {market.two_outcome_rate != null && (
                  <span className="text-xs text-gray-400">
                    ({Math.round(market.two_outcome_rate * 100)}% 2-way)
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
