import { useMemo, useState } from 'react'
import ChipFilterBar from './ChipFilterBar.jsx'
import LearnerEvalCard from './LearnerEvalCard.jsx'
import PortalReveal from './PortalReveal.jsx'
import PortalStaggerGrid from './PortalStaggerGrid.jsx'
import { resolveTeamBrands } from '../utils/teamBrands.js'
import {
  competencyTestEvaluations,
  EVAL_STATUS_FILTER_IDS,
  formationTestEvaluations,
  groupEvaluationsByBrand,
  learnerTestEvaluations,
  matchesEvalStatusFilter,
} from '../utils/learnerTests.js'
import { scrollToPortalSection } from '../utils/portalScroll.js'

function testStatusFilterLabel(filterId, t) {
  const key = `test_filter_${filterId}`
  return t[key] ?? filterId
}

function TestSubsection({ id, title, count, isOpen, onToggle, emptyMessage, children, brandLogo }) {
  const panelId = `portal-test-panel-${id}`

  return (
    <div
      className={`portal-plan-subsection portal-test-subsection portal-results-subsection portal-test-subsection--${id}${isOpen ? ' is-open' : ' is-collapsed'}`}
    >
      <button
        type="button"
        className="portal-plan-subsection-head"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
      >
        {brandLogo ? (
          <span className="portal-results-subsection-brand">
            <span className="portal-brand-logo portal-brand-logo--subsection">
              <img src={brandLogo} alt="" loading="lazy" />
            </span>
            <span className="portal-plan-subsection-title">{title}</span>
          </span>
        ) : (
          <span className="portal-plan-subsection-title">{title}</span>
        )}
        <span className="portal-plan-subsection-count">{count}</span>
        <span className="portal-plan-subsection-chevron" aria-hidden="true" />
      </button>
      <div
        id={panelId}
        className="portal-plan-subsection-body"
        hidden={!isOpen}
      >
        {count === 0 ? (
          <div className="portal-plan-subsection-empty" role="status">
            <span className="portal-plan-subsection-empty-dot" aria-hidden="true" />
            <p>{emptyMessage}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}

export default function LearnerTestsSection({
  user, lms, t, onOpenEval, evaluations: evaluationsSource, medacapLive,
  isMedacapLearner = false, medacapLoading = false, medacapError = null,
}) {
  const [testStatusFilter, setTestStatusFilter] = useState('all')
  const [testOpen, setTestOpen] = useState({})

  const sourceEvaluations = evaluationsSource ?? lms?.evaluations ?? []

  const brandItems = useMemo(
    () => resolveTeamBrands(user?.brands ?? []),
    [user?.brands],
  )

  const visibleEvaluations = useMemo(
    () => learnerTestEvaluations(sourceEvaluations),
    [sourceEvaluations],
  )
  const testStatusCounts = useMemo(() => {
    const counts = { all: visibleEvaluations.length, todo: 0, done: 0 }
    for (const e of visibleEvaluations) {
      if (matchesEvalStatusFilter(e, 'todo')) counts.todo += 1
      if (matchesEvalStatusFilter(e, 'done')) counts.done += 1
    }
    return counts
  }, [visibleEvaluations])
  const evaluationsByStatus = useMemo(
    () => visibleEvaluations.filter(e => matchesEvalStatusFilter(e, testStatusFilter)),
    [visibleEvaluations, testStatusFilter],
  )
  const competencyItems = useMemo(
    () => competencyTestEvaluations(evaluationsByStatus),
    [evaluationsByStatus],
  )
  const formationByBrand = useMemo(() => {
    if (isMedacapLearner) return { groups: {} }
    return groupEvaluationsByBrand(
      formationTestEvaluations(evaluationsByStatus),
      user?.brands ?? [],
    )
  }, [evaluationsByStatus, user?.brands, isMedacapLearner])
  const { groups: formationGroups } = formationByBrand
  const testFilteredTotal = evaluationsByStatus.length

  function toggleTestSubsection(sectionId) {
    setTestOpen(prev => ({ ...prev, [sectionId]: !(prev[sectionId] ?? true) }))
  }

  const scrollToResults = () => scrollToPortalSection('resultats')

  if (!isMedacapLearner && !visibleEvaluations.length && !medacapLive) return null

  // Learner MEDACAP sans aucune évaluation exploitable (ni live, ni mock) :
  // on affiche l'état loading/erreur seul. Si des tests mock existent, on les
  // rend normalement (un bandeau non bloquant peut accompagner en cas d'erreur).
  if (isMedacapLearner && !visibleEvaluations.length) {
    if (medacapLoading) {
      return (
        <PortalReveal id="tests">
          <div className="container" style={{ padding: '16px 32px' }}>
            <div className="portal-section-head">
              <p className="portal-section-eyebrow">{t.eyebrow_skills}</p>
              <h2 className="portal-section-title">{t.title_your_tests}</h2>
            </div>
            <div className="portal-medacap-status" role="status">{t.medacap_loading}</div>
          </div>
        </PortalReveal>
      )
    }
    if (medacapError) {
      return (
        <PortalReveal id="tests">
          <div className="container" style={{ padding: '16px 32px' }}>
            <div className="portal-section-head">
              <p className="portal-section-eyebrow">{t.eyebrow_skills}</p>
              <h2 className="portal-section-title">{t.title_your_tests}</h2>
            </div>
            <div className="portal-medacap-status portal-medacap-status--error" role="alert">
              {t.medacap_error}
            </div>
          </div>
        </PortalReveal>
      )
    }
  }

  const evalGrid = items => (
    <PortalStaggerGrid>
      {items.map(e => (
        <LearnerEvalCard
          key={e.id}
          e={e}
          user={user}
          lms={lms}
          t={t}
          onOpen={onOpenEval}
          onViewResults={e.status === 'done' ? scrollToResults : undefined}
        />
      ))}
    </PortalStaggerGrid>
  )

  return (
    <PortalReveal id="tests">
      <div className="container" style={{ padding: '16px 32px' }}>
        <div className="portal-section-head">
          <p className="portal-section-eyebrow">{t.eyebrow_skills}</p>
          <h2 className="portal-section-title">{t.title_your_tests}</h2>
        </div>
        <ChipFilterBar
          portal
          label={t.test_filter_lbl}
          ariaLabel={t.test_filter_aria}
          value={testStatusFilter}
          onChange={setTestStatusFilter}
          options={EVAL_STATUS_FILTER_IDS.map(filterId => ({
            id: filterId,
            label: testStatusFilterLabel(filterId, t),
            count: testStatusCounts[filterId] ?? 0,
          }))}
        />
        {testFilteredTotal === 0 && testStatusFilter !== 'all' ? (
          <div className="portal-plan-filter-empty" role="status">
            {t.test_filter_empty}
          </div>
        ) : (
          <div className="portal-plan-subsections portal-test-subsections">
            {(isMedacapLearner || competencyItems.length > 0) && (
              competencyItems.length > 0
                ? evalGrid(competencyItems)
                : (
                  <div className="portal-plan-filter-empty" role="status">
                    {t.medacap_no_tests}
                  </div>
                )
            )}

            {!isMedacapLearner && brandItems.map(({ id, label, logo }) => {
              const items = formationGroups[id] ?? []
              return (
                <TestSubsection
                  key={id}
                  id={id}
                  title={label}
                  brandLogo={logo}
                  count={items.length}
                  isOpen={testOpen[id] ?? true}
                  onToggle={() => toggleTestSubsection(id)}
                  emptyMessage={t.tests_brand_empty}
                >
                  {evalGrid(items)}
                </TestSubsection>
              )
            })}
          </div>
        )}
      </div>
    </PortalReveal>
  )
}
