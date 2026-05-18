/**
 * Calculateur de mises en temps réel (calcul local, sans appel API).
 * Recalcule les mises et profits dès que la mise totale change.
 */
import { useState, useMemo } from 'react'
import type { ArbitrageOpportunity, StakeCalculation } from '../types'

interface StakeCalculatorProps {
  opportunity: ArbitrageOpportunity
}

/**
 * Calcule les mises optimales pour un arbitrage 2-way.
 * Réplique la logique du backend arbitrageEngine.js.
 */
function computeStakesLocal(oA: number, oB: number, T: number): StakeCalculation | null {
  if (!oA || !oB || oA <= 1.0 || oB <= 1.0) return null
  const S = 1 / oA + 1 / oB
  if (S >= 1) return null

  const stakeA = T * (1 / oA) / S
  const stakeB = T * (1 / oB) / S
  const profitA = stakeA * oA - T
  const profitB = stakeB * oB - T
  const gainMin = Math.min(profitA, profitB)
  const gainMinPct = (gainMin / T) * 100
  const roi = gainMinPct

  return {
    stakeA: parseFloat(stakeA.toFixed(2)),
    stakeB: parseFloat(stakeB.toFixed(2)),
    profitA: parseFloat(profitA.toFixed(2)),
    profitB: parseFloat(profitB.toFixed(2)),
    gainMin: parseFloat(gainMin.toFixed(2)),
    gainMinPct: parseFloat(gainMinPct.toFixed(4)),
    roi: parseFloat(roi.toFixed(4)),
  }
}

export default function StakeCalculator({ opportunity }: StakeCalculatorProps) {
  const [stake, setStake] = useState<number>(opportunity.stake_total || 100)

  const oA = opportunity.odds_a || 0
  const oB = opportunity.odds_b || 0

  const calc = useMemo(() => computeStakesLocal(oA, oB, stake), [oA, oB, stake])

  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
      <h4 className="text-sm font-semibold text-gray-700">Calculateur de mises</h4>

      {/* Slider de mise totale */}
      <div>
        <label className="label">Mise totale : <span className="font-bold text-green-700">{stake} €</span></label>
        <input
          type="range"
          min={10}
          max={10000}
          step={10}
          value={stake}
          onChange={e => setStake(Number(e.target.value))}
          className="w-full accent-green-600"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>10 €</span>
          <span>
            <input
              type="number"
              value={stake}
              min={1}
              onChange={e => setStake(Math.max(1, Number(e.target.value)))}
              className="w-20 border rounded px-2 py-0.5 text-center text-sm"
            />
            €
          </span>
          <span>10 000 €</span>
        </div>
      </div>

      {calc ? (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-white rounded p-3 border">
            <div className="text-xs text-gray-500 mb-1">{opportunity.bookmaker_a} — {opportunity.outcome_a_label}</div>
            <div className="font-bold text-blue-700 text-lg">{calc.stakeA.toFixed(2)} €</div>
            <div className="text-xs text-gray-500">Cote : {oA}</div>
            <div className="text-xs text-green-600">Gain : +{calc.profitA.toFixed(2)} €</div>
          </div>
          <div className="bg-white rounded p-3 border">
            <div className="text-xs text-gray-500 mb-1">{opportunity.bookmaker_b} — {opportunity.outcome_b_label}</div>
            <div className="font-bold text-blue-700 text-lg">{calc.stakeB.toFixed(2)} €</div>
            <div className="text-xs text-gray-500">Cote : {oB}</div>
            <div className="text-xs text-green-600">Gain : +{calc.profitB.toFixed(2)} €</div>
          </div>
          <div className="col-span-2 bg-green-50 rounded p-3 border border-green-200 text-center">
            <div className="text-sm text-gray-600">Gain minimum garanti</div>
            <div className="font-bold text-green-700 text-xl">+{calc.gainMin.toFixed(2)} € ({calc.roi.toFixed(2)}%)</div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-red-500">Cotes invalides pour le calcul.</p>
      )}
    </div>
  )
}
