import { useMemo, useState } from 'react'
import LearnerEvalCard from './LearnerEvalCard.jsx'
import PortalReveal from './PortalReveal.jsx'
import PortalStaggerGrid from './PortalStaggerGrid.jsx'
import { resolveTeamBrands } from '../utils/teamBrands.js'
import {
  competencyResultEvaluations,
  groupEvaluationsByBrand,
} from '../utils/learnerTests.js'
import { isPlMedacapVariant } from '../utils/portalVariant.js'

/* ─────────────────────────────────────────────────────────────
   Rendu HISTORIQUE — sous-sections dépliables par marque.
   ───────────────────────────────────────────────────────────── */
function ResultsByBrandAccordion({ user, lms, t, onOpenEval, brandItems, groups }) {
  const [brandOpen, setBrandOpen] = useState({})

  function toggleBrandSubsection(brandId) {
    setBrandOpen(prev => ({ ...prev, [brandId]: !(prev[brandId] ?? true) }))
  }

  return (
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
            <div id={panelId} className="portal-plan-subsection-body" hidden={!isOpen}>
              {items.length === 0 ? (
                <div className="portal-plan-subsection-empty" role="status">
                  <span className="portal-plan-subsection-empty-dot" aria-hidden="true" />
                  <p>{t.results_brand_empty}</p>
                </div>
              ) : (
                <PortalStaggerGrid>
                  {items.map(e => (
                    <LearnerEvalCard key={e.id} e={e} user={user} lms={lms} t={t} onOpen={onOpenEval} resultOnly />
                  ))}
                </PortalStaggerGrid>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Rendu VARIANTE PL-MEDACAP — liste continue + pastilles de
   filtre (logo + nom). Tri : plus récents d'abord.
   ───────────────────────────────────────────────────────────── */
function ResultsFlatFiltered({ user, lms, t, onOpenEval, brandItems, results }) {
  const [brandFilter, setBrandFilter] = useState('all')

  const countByBrand = useMemo(() => {
    const acc = {}
    for (const e of results) acc[e.brand] = (acc[e.brand] ?? 0) + 1
    return acc
  }, [results])

  const filtered = useMemo(() => {
    const list = brandFilter === 'all'
      ? results
      : results.filter(e => e.brand === brandFilter)
    return [...list].sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')))
  }, [results, brandFilter])

  const pills = [
    { id: 'all', label: t.results_filter_all ?? 'Toutes', logo: null, count: results.length },
    ...brandItems
      .filter(b => (countByBrand[b.id] ?? 0) > 0)
      .map(b => ({ ...b, count: countByBrand[b.id] ?? 0 })),
  ]

  return (
    <>
      <div className="portal-results-pills" role="group" aria-label={t.results_filter_aria ?? 'Filtrer par marque'}>
        {pills.map(p => (
          <button
            key={p.id}
            type="button"
            className={`portal-results-pill${brandFilter === p.id ? ' is-active' : ''}`}
            aria-pressed={brandFilter === p.id}
            onClick={() => setBrandFilter(p.id)}
          >
            {p.logo && (
              <span className="portal-results-pill-logo">
                <img src={p.logo} alt="" loading="lazy" />
              </span>
            )}
            <span>{p.label}</span>
            <span className="portal-results-pill-count">{p.count}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="portal-plan-filter-empty" role="status">{t.results_brand_empty}</div>
      ) : (
        <PortalStaggerGrid>
          {filtered.map(e => (
            <LearnerEvalCard key={e.id} e={e} user={user} lms={lms} t={t} onOpen={onOpenEval} resultOnly />
          ))}
        </PortalStaggerGrid>
      )}
    </>
  )
}

export default function LearnerCompetencyResultsSection({
  user, lms, t, onOpenEval, evaluations: evaluationsSource,
}) {
  const sourceEvaluations = evaluationsSource ?? lms?.evaluations ?? []
  const plVariant = isPlMedacapVariant(lms)

  const brandItems = useMemo(
    () => resolveTeamBrands(user?.brands ?? []),
    [user?.brands],
  )

  const results = useMemo(
    () => competencyResultEvaluations(sourceEvaluations),
    [sourceEvaluations],
  )

  const { groups } = useMemo(
    () => groupEvaluationsByBrand(results, user?.brands ?? []),
    [results, user?.brands],
  )

  if (!brandItems.length) return null
  if (plVariant && !results.length) return null

  return (
    <PortalReveal id="resultats">
      <div className="container" style={{ padding: '16px 32px' }}>
        <div className="portal-section-head">
          <p className="portal-section-eyebrow">{t.eyebrow_skills}</p>
          <h2 className="portal-section-title">{t.title_competency_results}</h2>
        </div>

        {plVariant ? (
          <ResultsFlatFiltered
            user={user}
            lms={lms}
            t={t}
            onOpenEval={onOpenEval}
            brandItems={brandItems}
            results={results}
          />
        ) : (
          <ResultsByBrandAccordion
            user={user}
            lms={lms}
            t={t}
            onOpenEval={onOpenEval}
            brandItems={brandItems}
            groups={groups}
          />
        )}
      </div>
    </PortalReveal>
  )
}
