/**
 * Badge coloré indiquant la qualité d'une opportunité d'arbitrage.
 * Vert > 3%, Jaune 1-3%, Rouge < 1%.
 */
interface QualityBadgeProps {
  roi: number
}

export default function QualityBadge({ roi }: QualityBadgeProps) {
  let className = 'badge '
  let label = ''

  if (roi >= 3) {
    className += 'badge-green'
    label = `+${roi.toFixed(2)}% excellent`
  } else if (roi >= 1) {
    className += 'badge-yellow'
    label = `+${roi.toFixed(2)}% bon`
  } else {
    className += 'badge-red'
    label = `+${roi.toFixed(2)}% faible`
  }

  return <span className={className}>{label}</span>
}
