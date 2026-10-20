import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import PortalSectionEyebrow from './PortalSectionEyebrow.jsx'
import PortalSectionHead from './PortalSectionHead.jsx'
import PortalSectionSkeleton from './PortalSectionSkeleton.jsx'
import PortalReveal from './PortalReveal.jsx'
import PortalStaggerGrid from './PortalStaggerGrid.jsx'
import PlanEntryCard from './PlanEntryCard.jsx'
import { resolveTeamBrands } from '../utils/teamBrands.js'
import { resolveDpsTierSummaries } from '../utils/dpsMetrics.js'
import { evalScoreAccentColor } from '../utils/learnerTests.js'
import { hasDpsCompetencyDisplayData } from '../utils/dpsScopeSessionCache.js'

function serializeRect(rect) {
  if (!rect) return null
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  }
}

export default function DpsTierResultsSection({
  user,
  lms,
  t,
  updatedAt,
  scopeLoading = false,
  insightsLoading = false,
  sectionId = 'niveaux',
}) {
  const navigate = useNavigate()

  const brandList = useMemo(
    () => resolveTeamBrands(user?.brands ?? []),
    [user?.brands],
  )

  const tierSummaries = useMemo(
    () => resolveDpsTierSummaries(lms, brandList),
    [lms, brandList],
  )

  function openTierDetail(tierKey, event) {
    event.preventDefault()
    event.stopPropagation()
    const rect = serializeRect(event.currentTarget?.getBoundingClientRect?.())
    navigate(`/portail/niveaux/${encodeURIComponent(tierKey)}`, {
      state: { originRect: rect },
    })
  }

  const showSkeleton = scopeLoading && !hasDpsCompetencyDisplayData(lms)

  return (
    <PortalReveal as="div" id={sectionId} className="portal-dps-tier-section">
      <div className="container" style={{ padding: '16px 32px' }}>
        <PortalSectionHead
          eyebrow={<PortalSectionEyebrow icon="award" label={t.eyebrow_skills || 'Compétences'} />}
          title={t.dps_title_tier_results || 'Compétences des techniciens par niveau'}
          updatedAt={updatedAt}
          updating={scopeLoading || insightsLoading}
          t={t}
        />

        {showSkeleton ? (
          <PortalSectionSkeleton
            cols={3}
            count={3}
            ariaLabel={t.data_skeleton_aria}
          />
        ) : (
          <PortalStaggerGrid className="cols-3 pv-grid--stretch portal-dps-tier-results">
            {tierSummaries.map(({ tierKey, labelKey, avgScore, techniciansCount, evaluatedCount }) => {
              const label = t[labelKey] || tierKey
              const muted = avgScore == null && evaluatedCount === 0
              const accent = evalScoreAccentColor(avgScore)

              return (
                <PlanEntryCard
                  key={tierKey}
                  kind="results"
                  className={`portal-plan-entry-card--tier-${tierKey}`}
                  onOpen={(e) => openTierDetail(tierKey, e)}
                  muted={muted}
                  brandLabel={label}
                  accentColor={accent}
                  meta={(
                    <div className="portal-dps-tier-card-content">
                      <div className="portal-dps-tier-score-display">
                        <div className="portal-dps-tier-score-main">
                          <span className="portal-dps-tier-score-val" style={{ color: accent }}>
                            {avgScore != null ? `${avgScore}%` : '—'}
                          </span>
                          <span className="portal-dps-tier-score-caption">
                            {avgScore != null ? (t.dps_results_tier_avg_label || 'Maîtrise moyenne') : (t.dps_results_brand_no_score || 'Mesure en cours')}
                          </span>
                        </div>
                        {avgScore != null ? (
                          <div className="portal-dps-tier-score-progress-bar">
                            <div
                              className="portal-dps-tier-score-progress-fill"
                              style={{
                                width: `${Math.min(100, Math.max(0, avgScore))}%`,
                                backgroundColor: accent,
                              }}
                            />
                          </div>
                        ) : null}
                      </div>
                      <div className="portal-dps-tier-card-footer">
                        <span className="portal-dps-tier-evaluated-badge">
                          <strong className="portal-dps-tier-evaluated-count">
                            {evaluatedCount}/{techniciansCount}
                          </strong>
                          {' '}
                          techniciens évalués
                        </span>
                      </div>
                    </div>
                  )}
                  cta={t.dps_results_tier_cta || 'Voir le détail par niveau'}
                  hoverHint={t.dps_results_tier_cta || 'Voir le détail par niveau'}
                />
              )
            })}
          </PortalStaggerGrid>
        )}
      </div>
    </PortalReveal>
  )
}
