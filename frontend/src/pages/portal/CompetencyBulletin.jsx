import { useEffect, useMemo } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import PortalDemoBar from '../../components/PortalDemoBar.jsx'
import BulletinAppShell from '../../components/bulletin/BulletinAppShell.jsx'
import useSiteEffects from '../../hooks/useSiteEffects.js'
import useAuth from '../../hooks/useAuth.js'
import usePortalBackground from '../../hooks/usePortalBackground.js'
import useLocale from '../../hooks/useLocale.js'
import useLearnerEvaluations from '../../hooks/useLearnerEvaluations.js'
import { LMS_BY_USER } from '../../data/mock_lms.js'
import { resolvePortalDisplayUser } from '../../utils/medacapEvaluations.js'
import {
  buildCompetencyBulletinModel,
  defaultBulletinSelection,
  findBulletinTest,
} from '../../utils/competencyBulletin.js'
import { evalScoreTier, evalScoreTierClass, formatEvalDate, isEvalDone } from '../../utils/learnerTests.js'
import { dpsCompetencyTierAccent } from '../../utils/dpsCompetencyTierTheme.js'
import { launchMedacapEval } from '../../utils/medacapEvaluations.js'

function SummaryStrip({ summary, t }) {
  const items = [
    { label: t.bulletin_kpi_done, value: summary.testsDone },
    { label: t.bulletin_kpi_passed, value: summary.testsPassed },
    { label: t.bulletin_kpi_avg, value: summary.avgScore != null ? `${summary.avgScore}` : '—', unit: summary.avgScore != null ? '%' : '' },
    { label: t.bulletin_kpi_pending, value: summary.testsPending },
  ]

  return (
    <div className="bltn-summary" role="group" aria-label={t.bulletin_summary_aria}>
      {items.map(item => (
        <div key={item.label} className="bltn-summary-card">
          <span className="bltn-summary-val">
            {item.value}
            {item.unit ? <span className="bltn-summary-unit">{item.unit}</span> : null}
          </span>
          <span className="bltn-summary-lbl">{item.label}</span>
        </div>
      ))}
    </div>
  )
}

function TestListItem({ test, active, onSelect, t }) {
  const done = isEvalDone(test)
  return (
    <button
      type="button"
      className={`bltn-test-item${active ? ' is-active' : ''}${done ? ' is-done' : ''}`}
      onClick={() => onSelect(test.id)}
    >
      <span className="bltn-test-item-top">
        <span className={`portal-status-chip tier portal-tier-${test.competencyTier}`}>
          {test.tierLabel}
        </span>
        <span className="bltn-test-modality">
          {test.modality === 'practical' ? t.test_modality_practical : t.test_modality_theory}
        </span>
      </span>
      <span className="bltn-test-item-title">{test.title}</span>
      {done && test.score != null ? (
        <span className={`bltn-test-item-score${evalScoreTierClass(test.scoreTier)}`}>
          {test.score}<span>%</span>
        </span>
      ) : (
        <span className="bltn-test-item-pending">{t.status_todo}</span>
      )}
    </button>
  )
}

function SpecialitiesPanel({ test, t }) {
  if (test.specialities?.length) {
    return (
      <div className="bltn-gf-panel">
        <h3 className="bltn-panel-title">{t.bulletin_gf_title}</h3>
        <ul className="bltn-gf-list">
          {test.specialities.map(row => {
            const score = row.score
            const tier = score != null ? evalScoreTier(score) : null
            return (
            <li key={row.name ?? row.speciality} className="bltn-gf-row">
              <span className="bltn-gf-name">{row.name ?? row.speciality}</span>
              <span className={`bltn-gf-score${tier ? evalScoreTierClass(tier) : ''}`}>
                {score ?? '—'}
              </span>
            </li>
            )
          })}
        </ul>
      </div>
    )
  }

  return (
    <div className="bltn-gf-panel bltn-gf-panel--placeholder">
      <h3 className="bltn-panel-title">{t.bulletin_gf_title}</h3>
      <p className="bltn-gf-placeholder">{t.bulletin_gf_placeholder}</p>
    </div>
  )
}

function TestDetail({ test, brand, t, user }) {
  const done = isEvalDone(test)
  const accent = dpsCompetencyTierAccent(test.competencyTier)

  return (
    <article className="bltn-detail">
      <header className="bltn-detail-head">
        {brand?.logo ? (
          <img src={brand.logo} alt="" className="bltn-detail-logo" width={48} height={48} />
        ) : null}
        <div className="bltn-detail-head-text">
          <p className="bltn-detail-brand">{brand?.label}</p>
          <h2 className="bltn-detail-title">{test.title}</h2>
          <div className="bltn-detail-chips">
            <span className={`portal-status-chip tier portal-tier-${test.competencyTier}`}>
              {test.tierLabel}
            </span>
            <span className="portal-status-chip kind-competency">{t.test_kind_competency}</span>
          </div>
        </div>
      </header>

      <div className="bltn-score-hero" style={{ '--bltn-accent': accent }}>
        {done && test.score != null ? (
          <>
            <span className={`bltn-score-value${evalScoreTierClass(test.scoreTier)}`}>
              {test.score}
            </span>
            <span className="bltn-score-denom">%</span>
            <p className="bltn-score-hint">
              {test.passed ? t.bulletin_passed : t.bulletin_below_threshold}
              {test.passMark != null ? ` (${t.modal_pass_mark} ${test.passMark}%)` : ''}
            </p>
          </>
        ) : (
          <p className="bltn-score-pending">{t.bulletin_not_taken_yet}</p>
        )}
      </div>

      <dl className="bltn-facts">
        <div className="bltn-fact">
          <dt>{t.test_modal_modality}</dt>
          <dd>{test.modality === 'practical' ? t.test_modality_practical : t.test_modality_theory}</dd>
        </div>
        <div className="bltn-fact">
          <dt>{t.modal_date}</dt>
          <dd>{formatEvalDate(test.date)}</dd>
        </div>
        {test.attempts != null && (
          <div className="bltn-fact">
            <dt>{t.bulletin_attempts}</dt>
            <dd>{test.attempts}</dd>
          </div>
        )}
        {test.questions != null && (
          <div className="bltn-fact">
            <dt>{t.modal_questions}</dt>
            <dd>{test.questions}</dd>
          </div>
        )}
      </dl>

      {test.feedback ? (
        <div className="bltn-feedback">
          <strong>{t.modal_feedback}</strong>
          <p>{test.feedback}</p>
        </div>
      ) : null}

      <SpecialitiesPanel test={test} t={t} />

      <div className="bltn-detail-actions">
        {!done && test.medacap?.launchUrl ? (
          <button
            type="button"
            className="bltn-btn bltn-btn--primary"
            onClick={() => launchMedacapEval(test)}
          >
            {test.status === 'progress' ? t.eval_finish_test : t.test_launch}
          </button>
        ) : null}
        <Link to="/portail#tests" className="bltn-btn bltn-btn--ghost">
          {t.bulletin_go_tests}
        </Link>
        <Link to="/portail#resultats" className="bltn-btn bltn-btn--ghost">
          {t.bulletin_back_overview}
        </Link>
      </div>
    </article>
  )
}

export default function CompetencyBulletin() {
  useSiteEffects()
  const { user, status } = useAuth()
  const { evalId } = useParams()
  const navigate = useNavigate()
  const { t } = useLocale('portal')
  const lms = LMS_BY_USER[user?.demoKey]
  const {
    evaluations,
    medacapProfile,
    loading,
    error,
    isMedacapLearner,
  } = useLearnerEvaluations(user, lms)

  const displayUser = useMemo(
    () => resolvePortalDisplayUser(user, medacapProfile),
    [user, medacapProfile],
  )

  usePortalBackground(displayUser)

  const model = useMemo(
    () => buildCompetencyBulletinModel(evaluations, displayUser, t),
    [evaluations, displayUser, t],
  )

  const selection = useMemo(() => {
    if (evalId) {
      const found = findBulletinTest(model, evalId)
      if (found) return { ...found, evalId }
    }
    const def = defaultBulletinSelection(model)
    if (!def) return null
    const found = findBulletinTest(model, def.evalId)
    return found ? { ...found, evalId: def.evalId } : null
  }, [model, evalId])

  const activeBrandId = selection?.brand?.id ?? model.brands[0]?.id
  const brandTests = model.brands.find(b => b.id === activeBrandId)?.tests ?? []

  useEffect(() => {
    if (!evalId && selection?.evalId) {
      navigate(`/portail/resultats/${encodeURIComponent(selection.evalId)}`, { replace: true })
    }
  }, [evalId, selection?.evalId, navigate])

  if (status === "loading") return null
  if (!user) return <Navigate to="/login" replace />

  const isLearner = user.roles?.includes('learner') || isMedacapLearner

  if (!isLearner) {
    return <Navigate to="/portail" replace />
  }

  return (
    <>
      <BulletinAppShell
        t={t}
        user={displayUser}
        lead={t.bulletin_lead}
      >
        {loading ? (
          <div className="bltn-state" role="status">{t.bulletin_loading}</div>
        ) : error ? (
          <div className="bltn-state bltn-state--error" role="alert">{error}</div>
        ) : model.brands.length === 0 ? (
          <div className="bltn-empty">
            <p>{t.bulletin_empty}</p>
            <Link to="/portail#tests" className="bltn-btn bltn-btn--primary">
              {t.bulletin_go_tests}
            </Link>
          </div>
        ) : (
          <>
            <SummaryStrip summary={model.summary} t={t} />

            <div className="bltn-brand-bar" role="tablist" aria-label={t.bulletin_brands_aria}>
              {model.brands.map(brand => (
                <button
                  key={brand.id}
                  type="button"
                  role="tab"
                  aria-selected={brand.id === activeBrandId}
                  className={`bltn-brand-chip${brand.id === activeBrandId ? ' is-active' : ''}`}
                  onClick={() => {
                    const target = brand.tests.find(isEvalDone) ?? brand.tests[0]
                    if (target) navigate(`/portail/resultats/${encodeURIComponent(target.id)}`)
                  }}
                >
                  {brand.logo ? <img src={brand.logo} alt="" width={20} height={20} /> : null}
                  <span>{brand.label}</span>
                  {brand.avgScore != null ? (
                    <span className="bltn-brand-chip-score">{brand.avgScore}</span>
                  ) : null}
                </button>
              ))}
            </div>

            <div className="bltn-layout">
              <nav className="bltn-sidebar" aria-label={t.bulletin_tests_aria}>
                {brandTests.map(test => (
                  <TestListItem
                    key={test.id}
                    test={test}
                    active={test.id === selection?.evalId}
                    onSelect={id => navigate(`/portail/resultats/${encodeURIComponent(id)}`)}
                    t={t}
                  />
                ))}
              </nav>
              <div className="bltn-main">
                {selection?.test ? (
                  <TestDetail
                    test={selection.test}
                    brand={selection.brand}
                    t={t}
                    user={displayUser}
                  />
                ) : null}
              </div>
            </div>
          </>
        )}
      </BulletinAppShell>
      <PortalDemoBar />
    </>
  )
}
