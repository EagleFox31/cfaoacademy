import { useMemo, useRef, useState } from 'react'
import Nav from '../../components/Nav'
import Footer from '../../components/Footer'
import PortalHeader from '../../components/PortalHeader'
import PortalStickyBar from '../../components/PortalStickyBar'
import PortalDemoBar from '../../components/PortalDemoBar'
import PortalModal from '../../components/PortalModal'
import PvCard from '../../components/PvCard'
import FadStatusBadge from '../../components/FadStatusBadge.jsx'
import LearnerTestsSection from '../../components/LearnerTestsSection.jsx'
import PlanEntryCard from '../../components/PlanEntryCard.jsx'
import { EvalDetail, CertDetail } from '../../components/LearnerEvalCard.jsx'
import useSiteEffects from '../../hooks/useSiteEffects'
import usePortalReveal from '../../hooks/usePortalReveal'
import useAuth from '../../hooks/useAuth'
import useLocale from '../../hooks/useLocale'
import { LMS_BY_USER } from '../../data/mock_lms'
import { resolveLearnerAssignedTrainings } from '../../utils/assignedTrainings.js'
import { resolvePlanItemYear } from '../../utils/learnerPlanning.js'
import { resolveEvalTitle } from '../../utils/learnerTests.js'
import { portalPvCardMedia } from '../../utils/portalCardMedia.js'

function initials(nom) {
  return nom.split(' ').map(n => n[0]).join('').toUpperCase()
}

export default function KIDashboard() {
  useSiteEffects()
  usePortalReveal()
  const { user } = useAuth()
  const { t } = useLocale('portal')
  const [modal, setModal] = useState(null)
  const headerRef = useRef(null)
  const planYear = new Date().getFullYear()
  const lms = LMS_BY_USER[user.id]

  const assignedTrainings = useMemo(
    () => (lms ? resolveLearnerAssignedTrainings(user, lms, planYear) : []),
    [user, lms, planYear],
  )
  const planningYearCount = useMemo(
    () => assignedTrainings.filter(f => resolvePlanItemYear(f) === planYear).length,
    [assignedTrainings, planYear],
  )

  if (!lms) return null

  const done = lms.modules.filter(m => m.status === 'done').length
  const total = lms.modules.length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const fadCount = lms.formationsADispenser?.length || 0
  const appCount = lms.apprenants?.length || 0
  const kiResults = lms.kiResults ?? {}
  return (
    <>
      <Nav />
      <PortalStickyBar user={user} lms={lms} headerRef={headerRef} />
      <main className="portal-page">
        <div ref={headerRef}>
          <PortalHeader user={user} certGoals={lms.certGoals} lms={lms} />
        </div>

        {/* ── Vue d'ensemble formateur ── */}
        <section id="bilan">
          <div className="container" style={{ padding: '16px 32px' }}>
            <div className="portal-section-head">
              <p className="portal-section-eyebrow">{t.ki_eyebrow_instructor}</p>
              <h2 className="portal-section-title">{t.ki_title_overview}</h2>
            </div>

            <div className="portal-kpi-row">
              <div className="portal-kpi-card">
                <div className="portal-kpi-value accent">{fadCount}</div>
                <div className="portal-kpi-label">
                  {fadCount > 1 ? t.ki_trainings_pl : t.ki_trainings}
                </div>
              </div>
              <div className="portal-kpi-card">
                <div className="portal-kpi-value green">{appCount}</div>
                <div className="portal-kpi-label">{t.kpi_learners_to_train}</div>
              </div>
              <div className="portal-kpi-card">
                <div className="portal-kpi-value">{kiResults.testsValidated ?? '—'}</div>
                <div className="portal-kpi-label">{t.kpi_ki_tests_validated}</div>
              </div>
              <div className="portal-kpi-card">
                <div className={`portal-kpi-value ${(kiResults.avgScore ?? 0) >= 80 ? 'green' : 'accent'}`}>
                  {kiResults.avgScore != null ? `${kiResults.avgScore}%` : '—'}
                </div>
                <div className="portal-kpi-label">{t.kpi_ki_avg_score}</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Sessions à animer ── */}
        <section id="fad">
          <div className="container" style={{ padding: '16px 32px' }}>
            <div className="portal-section-head">
              <p className="portal-section-eyebrow">{t.eyebrow_instructor_hat}</p>
              <h2 className="portal-section-title">{t.ki_title_fad}</h2>
            </div>

            <div className="portal-plan-entries pv-grid cols-2 pv-grid--stretch">
              <PlanEntryCard
                kind="sessions"
                title={t.ki_entry_sessions_title}
                desc={t.ki_entry_sessions_desc}
                meta={t.ki_entry_sessions_meta
                  .replace('{count}', String(fadCount))}
                cta={t.plan_entry_open}
                hoverHint={t.plan_entry_coming_soon}
                accentColor="#c05600"
              />
            </div>

            {lms.formationsADispenser?.length > 0 && (
              <div className="portal-fad-list portal-ki-fad-preview">
                {lms.formationsADispenser.map(fad => (
                  <div key={fad.id} className="portal-fad-card">
                    <div>
                      <div className="portal-fad-title">{fad.title}</div>
                      <div className="portal-fad-meta">
                        {fad.apprenants} {fad.apprenants > 1 ? t.ki_learners_pl : t.ki_learners} · {fad.date}
                      </div>
                    </div>
                    <FadStatusBadge
                      statut={fad.statut}
                      label={fad.statut === 'planifie' ? t.fad_planned : t.fad_pending}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── Mes apprenants ── */}
        <section id="apprenants">
          <div className="container" style={{ padding: '16px 32px' }}>
            <div className="portal-section-head">
              <p className="portal-section-eyebrow">{t.eyebrow_field}</p>
              <h2 className="portal-section-title">{t.title_my_learners}</h2>
            </div>

            <div className="portal-plan-entries pv-grid cols-2 pv-grid--stretch">
              <PlanEntryCard
                kind="learners"
                title={t.ki_entry_learners_title}
                desc={t.ki_entry_learners_desc}
                meta={t.ki_entry_learners_meta
                  .replace('{count}', String(appCount))}
                cta={t.plan_entry_open}
                hoverHint={t.plan_entry_coming_soon}
                accentColor="#0d8a47"
              />
            </div>

            {lms.apprenants?.length > 0 && (
              <div className="portal-ki-apprenants portal-ki-apprenants--preview">
                {lms.apprenants.map(a => (
                  <div key={a.id} className="portal-ki-apprenant">
                    <div className="portal-mini-avatar">{initials(a.nom)}</div>
                    <div className="portal-ki-apprenant-info">
                      <div className="portal-ki-apprenant-name">{a.nom}</div>
                      <div className="portal-ki-apprenant-meta">{t.level_badge} {a.niveau} · {a.lastActivity}</div>
                    </div>
                    <div className="portal-inline-bar">
                      <div className="portal-inline-track">
                        <div className="portal-inline-fill" style={{ width: `${a.progress}%` }} />
                      </div>
                      <span className="portal-inline-pct">{a.progress}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── Résultats terrain ── */}
        <section id="resultats">
          <div className="container" style={{ padding: '16px 32px' }}>
            <div className="portal-section-head">
              <p className="portal-section-eyebrow">{t.eyebrow_instructor_hat}</p>
              <h2 className="portal-section-title">{t.ki_title_results}</h2>
            </div>

            <div className="portal-kpi-row portal-kpi-row--compact">
              <div className="portal-kpi-card">
                <div className="portal-kpi-value">{kiResults.testsValidated ?? '—'}</div>
                <div className="portal-kpi-label">{t.kpi_ki_tests_validated}</div>
              </div>
              <div className="portal-kpi-card">
                <div className={`portal-kpi-value ${(kiResults.avgScore ?? 0) >= 80 ? 'green' : 'accent'}`}>
                  {kiResults.avgScore != null ? `${kiResults.avgScore}%` : '—'}
                </div>
                <div className="portal-kpi-label">{t.kpi_ki_avg_score}</div>
              </div>
              <div className="portal-kpi-card">
                <div className="portal-kpi-value green">{kiResults.learnersAssessed ?? appCount}</div>
                <div className="portal-kpi-label">{t.kpi_ki_learners_assessed}</div>
              </div>
            </div>

            <div className="portal-plan-entries pv-grid cols-2 pv-grid--stretch" style={{ marginTop: 24 }}>
              <PlanEntryCard
                kind="results"
                title={t.ki_entry_results_title}
                desc={t.ki_entry_results_desc}
                meta={t.ki_entry_results_meta}
                cta={t.plan_entry_open}
                hoverHint={t.plan_entry_coming_soon}
                accentColor="#475569"
              />
            </div>
          </div>
        </section>

        {/* ── Casquette apprenant ── */}
        <div id="parcours" className="portal-ki-hat-divider">
          <div className="container">
            <p className="portal-section-eyebrow">{t.eyebrow_learner_hat}</p>
            <h2 className="portal-ki-hat-divider-title">{t.ki_hat_divider_title}</h2>
            <p className="portal-ki-hat-divider-desc">{t.ki_hat_divider_desc}</p>
            <div className="portal-ki-hat-stats">
              <span>{done}/{total} {t.kpi_personal_modules}</span>
              <span>{pct}% {t.kpi_personal_progress}</span>
              <span>{lms.certifications.length} {lms.certifications.length > 1 ? t.kpi_certifications_pl : t.kpi_certifications}</span>
            </div>
          </div>
        </div>

        <LearnerTestsSection
          user={user}
          lms={lms}
          t={t}
          onOpenEval={e => setModal({ type: 'eval', data: e })}
        />

        <section id="plan">
          <div className="container" style={{ padding: '16px 32px' }}>
            <div className="portal-section-head">
              <p className="portal-section-eyebrow">{t.eyebrow_plan}</p>
              <h2 className="portal-section-title">{t.title_plan}</h2>
            </div>

            <div className="portal-plan-entries pv-grid cols-2 pv-grid--stretch">
              <PlanEntryCard
                kind="pif"
                title={t.plan_entry_pif_title}
                desc={t.plan_entry_pif_desc}
                meta={t.plan_entry_pif_meta}
                cta={t.plan_entry_open}
                hoverHint={t.plan_entry_coming_soon}
                accentColor="var(--red)"
              />
              <PlanEntryCard
                kind="planning"
                title={t.plan_entry_planning_title}
                desc={t.plan_entry_planning_desc}
                meta={t.plan_entry_planning_meta
                  .replace('{count}', String(planningYearCount))
                  .replace('{year}', String(planYear))}
                cta={t.plan_entry_open}
                hoverHint={t.plan_entry_coming_soon}
                accentColor="#1a56db"
              />
            </div>
          </div>
        </section>

        <section id="certifs">
          <div className="container" style={{ padding: '16px 32px' }}>
            <div className="portal-section-head">
              <p className="portal-section-eyebrow">{t.eyebrow_manufacturer}</p>
              <h2 className="portal-section-title">{t.title_my_certifications}</h2>
            </div>
            <div className="pv-grid cols-4 pv-grid--stretch">
              {lms.certifications.map(c => (
                <div key={c.id} id={`portal-card-${c.id}`} className="portal-card-anchor">
                  <PvCard
                    {...portalPvCardMedia({ ...c, kind: 'cert' })}
                    kicker={<span className={`portal-brand-chip ${c.brand}`}>{c.brand}</span>}
                    title={c.title}
                    meta={`${t.obtained_on} ${c.date}`}
                    cta={t.attestation}
                    accentColor="#1aab5b"
                    onClick={() => setModal({ type: 'cert', data: c })}
                    hoverHint={t.card_view_detail}
                    corner
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <PortalDemoBar />

      {modal?.type === 'eval' && (
        <PortalModal title={resolveEvalTitle(modal.data, t, user)} onClose={() => setModal(null)}>
          <EvalDetail e={modal.data} t={t} user={user} />
        </PortalModal>
      )}
      {modal?.type === 'cert' && (
        <PortalModal title={modal.data.title} onClose={() => setModal(null)}>
          <CertDetail c={modal.data} t={t} />
        </PortalModal>
      )}
    </>
  )
}
