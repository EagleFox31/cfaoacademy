import { useMemo, useState } from 'react'
import LearnerEvalCard from './LearnerEvalCard.jsx'
import PortalReveal from './PortalReveal.jsx'
import PortalStaggerGrid from './PortalStaggerGrid.jsx'
import { resolveTeamBrands } from '../utils/teamBrands.js'
import {
  competencyResultEvaluations,
  groupEvaluationsByBrand,
} from '../utils/learnerTests.js'

export default function LearnerCompetencyResultsSection({
  user, lms, t, onOpenEval, evaluations: evaluationsSource,
}) {
  const [brandOpen, setBrandOpen] = useState({})

  const sourceEvaluations = evaluationsSource ?? lms?.evaluations ?? []

  const brandItems = useMemo(
    () => resolveTeamBrands(user?.brands ?? []),
    [user?.brands],
  )
  const resultsByBrand = useMemo(() => {
    const results = competencyResultEvaluations(sourceEvaluations)
    return groupEvaluationsByBrand(results, user?.brands ?? [])
  }, [sourceEvaluations, user?.brands])

  const { groups } = resultsByBrand

  if (!brandItems.length) return null

  function toggleBrandSubsection(brandId) {
    setBrandOpen(prev => ({ ...prev, [brandId]: !(prev[brandId] ?? true) }))
  }

  return (
    <PortalReveal id="resultats">
      <div className="container" style={{ padding: '16px 32px' }}>
        <div className="portal-section-head">
          <p className="portal-section-eyebrow">{t.eyebrow_skills}</p>
          <h2 className="portal-section-title">{t.title_competency_results}</h2>
        </div>

        <div className="portal-plan-subsections portal-results-subsections">
          {brandItems.map(({ id, label, logo }) => {
            const items = groups[id] ?? []
            const isOpen = brandOpen[id] ?? true
            const panelId = `portal-results-panel-${id}`

            return (
              <div
                key={id}
                className={`portal-plan-subsection portal-results-subsection portal-results-subsection--${id}${isOpen ? ' is-open' : ' is-collapsed'}`}
              >
                <button
                  type="button"
                  className="portal-plan-subsection-head"
                  onClick={() => toggleBrandSubsection(id)}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                >
                  <span className="portal-results-subsection-brand">
                    {logo ? (
                      <span className="portal-brand-logo portal-brand-logo--subsection">
                        <img src={logo} alt="" loading="lazy" />
                      </span>
                    ) : null}
                    <span className="portal-plan-subsection-title">{label}</span>
                  </span>
                  <span className="portal-plan-subsection-count">{items.length}</span>
                  <span className="portal-plan-subsection-chevron" aria-hidden="true" />
                </button>
                <div
                  id={panelId}
                  className="portal-plan-subsection-body"
                  hidden={!isOpen}
                >
                  {items.length === 0 ? (
                    <div className="portal-plan-subsection-empty" role="status">
                      <span className="portal-plan-subsection-empty-dot" aria-hidden="true" />
                      <p>{t.results_brand_empty}</p>
                    </div>
                  ) : (
                    <PortalStaggerGrid>
                      {items.map(e => (
                        <LearnerEvalCard
                          key={e.id}
                          e={e}
                          user={user}
                          lms={lms}
                          t={t}
                          onOpen={onOpenEval}
                        />
                      ))}
                    </PortalStaggerGrid>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </PortalReveal>
  )
}
