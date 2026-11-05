import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import PlanEntryCard from './PlanEntryCard.jsx'
import DpsResultTierRow from './DpsResultTierRow.jsx'
import { resolveTeamgpElearningFilialeSummary } from '../utils/teamgpElearning.js'
import { evalScoreAccentColor } from '../utils/learnerTests.js'

function serializeRect(rect) {
  if (!rect) return null
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  }
}

function formatTrackedLine(count, t) {
  const template = count === 1
    ? (t.ki_elearning_card_tracked_one ?? t.ki_elearning_card_tracked)
    : t.ki_elearning_card_tracked
  return String(template ?? '').replace('{count}', String(count))
}

function formatLevelLabel(level, count, t) {
  const base = String(t.medacap_define_kpi_elearning_level ?? 'Niveau {level}')
    .replace('{level}', level)
  if (!count) return base
  const withCount = t.ki_elearning_level_with_count
  if (!withCount) return base
  return String(withCount)
    .replace('{level}', level)
    .replace('{count}', String(count))
}

/** Card e-learning Toyota — section résultats KI (à côté de la maîtrise compétence). */
export default function KiTeamgpElearningResultCard({ t }) {
  const navigate = useNavigate()
  const summary = useMemo(() => resolveTeamgpElearningFilialeSummary(), [])
  const muted = summary.linkedCount === 0 || summary.avgPct == null
  const accent = evalScoreAccentColor(summary.avgPct)
  const pendingLabel = t.dps_results_brand_no_score

  const levelRows = (summary.levelOrder ?? [])
    .map(level => {
      const row = summary.byLevel?.[level]
      if (!row?.count) return null
      return (
        <DpsResultTierRow
          key={level}
          label={formatLevelLabel(level, row.count, t)}
          score={row.avgPct}
          pendingLabel={pendingLabel}
          scoreTitle={t.ki_elearning_level_tooltip}
        />
      )
    })
    .filter(Boolean)

  return (
    <PlanEntryCard
      kind="results"
      className="portal-plan-entry-card--teamgp-elearning"
      muted={muted}
      logo="/assets/logos/teamgp.png"
      accentColor={accent}
      onOpen={(e) => {
        e.preventDefault()
        e.stopPropagation()
        const rect = serializeRect(e.currentTarget?.getBoundingClientRect?.())
        navigate('/portail/teamgp', { state: { originRect: rect } })
      }}
      meta={(
        <div className="portal-dps-brand-result-meta">
          <div className="portal-dps-brand-result-tiers">
            {levelRows}
            <DpsResultTierRow
              label={t.ki_elearning_card_rate_label}
              score={summary.avgPct}
              pendingLabel={pendingLabel}
              scoreTitle={t.ki_elearning_card_rate_tooltip}
              isGlobal
            />
          </div>
          <p className="portal-dps-brand-result-sub">
            {formatTrackedLine(summary.linkedCount, t)}
          </p>
        </div>
      )}
      cta={t.ki_elearning_card_cta}
      hoverHint={t.ki_elearning_card_cta}
    />
  )
}
