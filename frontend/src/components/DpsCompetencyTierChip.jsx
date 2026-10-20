import {
  dpsCompetencyTierChipClass,
  resolveDpsCompetencyTierLabel,
} from '../utils/dpsCompetencyTierTheme.js'

/**
 * Puce palier MEDACAP — fond blanc, contour et texte couleur palier.
 * @see docs/dps-competency-tier-visual.md
 */
export default function DpsCompetencyTierChip({ tier, label, t, className = '' }) {
  const text = label ?? resolveDpsCompetencyTierLabel(tier, t)
  if (!text) return null

  const cls = [
    'portal-status-chip',
    dpsCompetencyTierChipClass(tier),
    className,
  ].filter(Boolean).join(' ')

  return <span className={cls}>{text}</span>
}
