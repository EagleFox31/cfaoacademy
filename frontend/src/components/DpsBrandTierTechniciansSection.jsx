import DpsBrandTierTechniciansTable from './DpsBrandTierTechniciansTable.jsx'
import { avgScoreFromTierTableRows } from '../utils/dpsMetrics.js'
import { dpsCompetencyTierChipClass } from '../utils/dpsCompetencyTierTheme.js'
import { resolveBrandResultTierRows } from '../utils/dpsBrandResultSummary.js'

function tierSectionTitle(count, tierLabel, t) {
  const template = count <= 1 ? t.dps_tier_section_title_one : t.dps_tier_section_title
  return template
    .replace('{count}', String(count))
    .replace('{tier}', tierLabel)
}

export default function DpsBrandTierTechniciansSection({
  detail,
  t,
  nomenclature = 'medacap',
}) {
  const sections = resolveBrandResultTierRows(nomenclature).map(({ key, labelKey }) => {
    const rows = detail?.techniciansByTier?.[key] ?? []
    const tierLabel = t[labelKey]
    const tierAvgScore = avgScoreFromTierTableRows(rows)
    const tierAvgTheoryScore = avgScoreFromTierTableRows(rows, 'theory')
    const tierAvgPracticalScore = avgScoreFromTierTableRows(rows, 'practical')
    return {
      key,
      rows,
      tierAvgScore,
      tierAvgTheoryScore,
      tierAvgPracticalScore,
      title: tierSectionTitle(rows.length, tierLabel, t),
    }
  }).filter(section => section.rows.length > 0)

  if (!sections.length) return null

  return (
    <div className="portal-dps-tier-sections">
      {sections.map(section => (
        <section
          key={section.key}
          className="portal-dps-tier-block"
          aria-labelledby={`portal-dps-tier-${section.key}`}
        >
          <h2
            id={`portal-dps-tier-${section.key}`}
            className={`portal-dps-tier-section-title ${dpsCompetencyTierChipClass(section.key)}`}
          >
            {section.title}
          </h2>
          <DpsBrandTierTechniciansTable
            rows={section.rows}
            tierKey={section.key}
            tierAvgScore={section.tierAvgScore}
            tierAvgTheoryScore={section.tierAvgTheoryScore}
            tierAvgPracticalScore={section.tierAvgPracticalScore}
            t={t}
          />
        </section>
      ))}
    </div>
  )
}
