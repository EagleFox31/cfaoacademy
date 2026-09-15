import { useMemo, useRef, useState } from 'react'
import Nav from '../../components/Nav'
import Footer from '../../components/Footer'
import KiPortalHero from '../../components/ki/KiPortalHero.jsx'
import PortalStickyBar from '../../components/PortalStickyBar'
import PortalDemoBar from '../../components/PortalDemoBar'
import PortalModal from '../../components/PortalModal'
import PvCard from '../../components/PvCard'
import FadStatusBadge from '../../components/FadStatusBadge.jsx'
import LearnerTestsSection from '../../components/LearnerTestsSection.jsx'
import PlanEntryCard from '../../components/PlanEntryCard.jsx'
import PortalSectionEyebrow from '../../components/PortalSectionEyebrow.jsx'
import PortalEmptyState from '../../components/PortalEmptyState.jsx'
import KiToyotaFilialeResultsSection from '../../components/KiToyotaFilialeResultsSection.jsx'
import KiToyotaFilialePifSection from '../../components/KiToyotaFilialePifSection.jsx'
import KiPersonalPathSection from '../../components/KiPersonalPathSection.jsx'
import { EvalDetail, CertDetail } from '../../components/LearnerEvalCard.jsx'
import useSiteEffects from '../../hooks/useSiteEffects'
import usePortalReveal from '../../hooks/usePortalReveal'
import useAuth from '../../hooks/useAuth'
import useLocale from '../../hooks/useLocale'
import useKiFilialeScope from '../../hooks/useKiFilialeScope.js'
import useLearnerEvaluations from '../../hooks/useLearnerEvaluations.js'
import useLearnerPif from '../../hooks/useLearnerPif.js'
import { resolveLearnerAssignedTrainings } from '../../utils/assignedTrainings.js'
import { resolvePlanItemYear } from '../../utils/learnerPlanning.js'
import { resolveEvalTitle } from '../../utils/learnerTests.js'
import { portalPvCardMedia } from '../../utils/portalCardMedia.js'
import { KI_PERSONAL_LMS_BASE, resolveKiDisplayUser } from '../../utils/kiScope.js'
import { resolveKiPersonalToyotaPath, resolveToyotaAchievedCertifications } from '../../utils/kiPersonalPath.js'
import { resolvePortalDisplayUser } from '../../utils/medacapEvaluations.js'
import { resolveMedacapLearnerCertGoals } from '../../utils/medacapLearner.js'

export default function KIDashboard() {
  useSiteEffects()
  usePortalReveal()
  const { user } = useAuth()
  const { t } = useLocale('portal')
  const [modal, setModal] = useState(null)
  const [pathStatusOverrides, setPathStatusOverrides] = useState({})
  const headerRef = useRef(null)
  const planYear = new Date().getFullYear()

  const {
    filialeLms,
    scopeLoading,
    insightsLoading,
    lastUpdatedAt,
    medacapLinked,
  } = useKiFilialeScope(user)

  const {
    evaluations,
    medacapProfile,
    isMedacapLearner,
  } = useLearnerEvaluations(user, KI_PERSONAL_LMS_BASE)

  const { pif: medacapPif } = useLearnerPif(user)

  const lms = useMemo(() => {
    const certGoals = isMedacapLearner && medacapProfile
      ? resolveMedacapLearnerCertGoals(medacapProfile)
      : []
    const personal = {
      ...KI_PERSONAL_LMS_BASE,
      evaluations,
      certGoals,
      ...(medacapPif && Object.keys(medacapPif.planningStatus ?? {}).length ? {
        planningStatus: medacapPif.planningStatus,
        planPathway: medacapPif.planPathway ?? [],
      } : {}),
    }
    if (!filialeLms) return personal
    return {
      ...filialeLms,
      ...personal,
      formationsADispenser: filialeLms.formationsADispenser ?? [],
      kiResults: filialeLms.kiResults,
    }
  }, [filialeLms, evaluations, medacapProfile, medacapPif, isMedacapLearner])

  const displayUser = useMemo(
    () => resolveKiDisplayUser(
      resolvePortalDisplayUser(user, medacapProfile),
      lms,
    ),
    [user, medacapProfile, lms],
  )

  const assignedTrainings = useMemo(
    () => resolveLearnerAssignedTrainings(user, lms, planYear),
    [user, lms, planYear],
  )
  const planningYearCount = useMemo(
    () => assignedTrainings.filter(f => resolvePlanItemYear(f) === planYear).length,
    [assignedTrainings, planYear],
  )

  const personalPath = useMemo(
    () => resolveKiPersonalToyotaPath(displayUser, lms, {
      statusOverrides: pathStatusOverrides,
    }),
    [displayUser, lms, pathStatusOverrides],
  )
  const certifications = useMemo(() => {
    if ((lms.certifications ?? []).length > 0) return lms.certifications
    return resolveToyotaAchievedCertifications(displayUser, lms, { t })
  }, [displayUser, lms, t])
  const kiResults = lms.kiResults ?? {}
  const instructorBrand = displayUser.brands?.[0] ?? 'toyota'
  const brandStat = lms.brandStats?.find(row => row.brand === instructorBrand)
  const brandPif = lms.brandPifStats?.find(row => row.brand === instructorBrand)

  function enrollPersonalPathItem(item) {
    if (!item.session?.date || !item.code) return
    const key = `${item.session.date}|${item.code}`
    setPathStatusOverrides((prev) => ({ ...prev, [key]: 'inscrit' }))
  }

  return (
    <>
      <Nav />
      <PortalStickyBar user={displayUser} lms={lms} headerRef={headerRef} />
      <main className="portal-page">
        <div ref={headerRef}>
          <KiPortalHero user={displayUser} lms={lms} loading={scopeLoading} />
        </div>

        {!medacapLinked && (
          <div className="container" style={{ padding: '0 32px 8px' }}>
            <p className="portal-morph-empty" role="status">
              {t.ki_medacap_unlinked}
            </p>
          </div>
        )}

        <section id="fad">
          <div className="container" style={{ padding: '16px 32px' }}>
            <div className="portal-section-head">
              <PortalSectionEyebrow icon="presentation" label={t.eyebrow_instructor_hat} />
              <h2 className="portal-section-title">{t.ki_title_fad}</h2>
            </div>

            {scopeLoading ? (
              <p className="portal-morph-empty" role="status">{t.data_updating}</p>
            ) : lms.formationsADispenser?.length > 0 ? (
              <div className="portal-fad-list portal-ki-fad-preview">
                {lms.formationsADispenser.map(fad => (
                  <div key={fad.id} className="portal-fad-card">
                    <div>
                      <div className="portal-fad-title">{fad.title}</div>
                      <div className="portal-fad-meta">
                        {fad.apprenants} {fad.apprenants > 1 ? t.ki_learners_pl : t.ki_learners}
                        {fad.lieu ? ` · ${fad.lieu}` : ''}
                        {fad.date ? ` · ${fad.date}` : ''}
                      </div>
                    </div>
                    <FadStatusBadge
                      statut={fad.statut}
                      label={fad.statut === 'planifie' ? t.fad_planned : t.fad_pending}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <PortalEmptyState
                title={t.ki_fad_empty_title}
                text={t.ki_fad_empty_text}
                statsLead={t.ki_fad_empty_needs_lead}
                stats={[
                  { value: kiResults.learnersAssessed, label: t.ki_fad_empty_stat_techs },
                  { value: brandPif?.pifProposed, label: t.ki_fad_empty_stat_plan },
                  { value: brandStat?.avgScore, unit: '%', label: t.ki_fad_empty_stat_mastery },
                ]}
                ctaHref="#toyota-pif"
                ctaLabel={t.ki_fad_empty_cta}
              />
            )}
          </div>
        </section>

        <KiToyotaFilialeResultsSection
          user={displayUser}
          lms={lms}
          t={t}
          updatedAt={lastUpdatedAt}
          scopeLoading={scopeLoading}
          insightsLoading={insightsLoading}
        />

        <KiToyotaFilialePifSection
          user={displayUser}
          lms={lms}
          t={t}
          updatedAt={lastUpdatedAt}
          scopeLoading={scopeLoading}
          insightsLoading={insightsLoading}
        />

        <KiPersonalPathSection
          path={personalPath}
          t={t}
          onEnroll={enrollPersonalPathItem}
        />

        <LearnerTestsSection
          user={user}
          lms={lms}
          t={t}
          onOpenEval={e => setModal({ type: 'eval', data: e })}
        />

        <section id="plan">
          <div className="container" style={{ padding: '16px 32px' }}>
            <div className="portal-section-head">
              <PortalSectionEyebrow icon="milestone" label={t.eyebrow_plan} />
              <h2 className="portal-section-title">{t.title_plan}</h2>
            </div>

            <div className="portal-plan-entries pv-grid cols-4 pv-grid--stretch">
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
              <PortalSectionEyebrow icon="award" label={t.eyebrow_manufacturer} />
              <h2 className="portal-section-title">{t.title_my_certifications}</h2>
            </div>
            {certifications.length > 0 ? (
              <div className="pv-grid cols-4 pv-grid--stretch">
                {certifications.map(c => (
                  <div key={c.id} id={`portal-card-${c.id}`} className="portal-card-anchor">
                    <PvCard
                      {...portalPvCardMedia({ ...c, kind: 'cert' })}
                      kicker={<span className={`portal-brand-chip ${c.brand}`}>{c.brand}</span>}
                      title={c.title}
                      meta={c.derived ? `${t.modal_level} ${c.level}` : `${t.obtained_on} ${c.date}`}
                      cta={t.attestation}
                      accentColor="#1aab5b"
                      onClick={() => setModal({ type: 'cert', data: c })}
                      hoverHint={t.card_view_detail}
                      corner
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="portal-morph-empty">{t.ki_no_certifications}</p>
            )}
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
