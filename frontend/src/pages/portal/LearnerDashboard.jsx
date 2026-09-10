import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Nav from '../../components/Nav'
import Footer from '../../components/Footer'
import PortalHeader from '../../components/PortalHeader'
import PortalStickyBar from '../../components/PortalStickyBar'
import PortalDemoBar from '../../components/PortalDemoBar'
import PortalModal from '../../components/PortalModal'
import PortalReveal from '../../components/PortalReveal.jsx'
import PortalStaggerGrid from '../../components/PortalStaggerGrid.jsx'
import PortalAssistanceSection from '../../components/PortalAssistanceSection.jsx'
import PvCard from '../../components/PvCard'
import LearnerNextActions from '../../components/LearnerNextActions.jsx'
import LearnerPifSection from '../../components/LearnerPifSection.jsx'
import LearnerCompetencyResultsSection from '../../components/LearnerCompetencyResultsSection.jsx'
import LearnerSuggestedTrainingsSection from '../../components/LearnerSuggestedTrainingsSection.jsx'
import LearnerTestsSection from '../../components/LearnerTestsSection.jsx'
import { EvalDetail, CertDetail } from '../../components/LearnerEvalCard.jsx'
import useSiteEffects from '../../hooks/useSiteEffects'
import useAuth from '../../hooks/useAuth'
import useLocale from '../../hooks/useLocale'
import { LMS_BY_USER } from '../../data/mock_lms'
import { resolveLearnerNextActions } from '../../utils/learnerNextActions.js'
import { resolveEvalTitle, isFormationTestLocked } from '../../utils/learnerTests.js'
import { handleEvalOpen, resolvePortalDisplayUser, medacapLearnerSections } from '../../utils/medacapEvaluations.js'
import useLearnerEvaluations from '../../hooks/useLearnerEvaluations.js'
import { portalPvCardMedia } from '../../utils/portalCardMedia.js'
import { isPlMedacapVariant } from '../../utils/portalVariant.js'

// Mapping marque → section homepage correspondante
const BRAND_SECTION = {
  toyota: 'offres', mercedes: 'offres', suzuki: 'offres',
  byd: 'offres', mitsubishi: 'offres', citroen: 'offres',
  yamaha: 'offres', stellantis: 'offres', omoda: 'offres',
  hino: 'formations-equipment', fuso: 'formations-equipment',
  sinotruk: 'formations-equipment', shacman: 'formations-equipment',
  bt: 'formations-equipment', jcb: 'formations-equipment',
  lovol: 'formations-equipment', kinglong: 'formations-equipment',
  'king-long': 'formations-equipment', 'renault-trucks': 'formations-equipment',
}

function getDiscoverTarget(brands = []) {
  for (const b of brands) {
    const section = BRAND_SECTION[b.toLowerCase()]
    if (section) return { section, brand: b }
  }
  return { section: 'offres', brand: null }
}

/* ── Dashboard ─────────────────────────────────────────────────── */

export default function LearnerDashboard() {
  useSiteEffects()
  const { user } = useAuth()
  const { t } = useLocale('portal')
  const [modal, setModal] = useState(null)
  const headerRef = useRef(null)
  const lms = LMS_BY_USER[user.id]
  const {
    evaluations,
    usingMedacapCompetency,
    medacapProfile,
    loading: medacapLoading,
    error: medacapError,
    isMedacapLearner,
  } = useLearnerEvaluations(user, lms)

  const displayUser = useMemo(
    () => resolvePortalDisplayUser(user, medacapProfile),
    [user, medacapProfile],
  )

  const medacapSections = useMemo(
    () => medacapLearnerSections(lms),
    [lms],
  )

  const lmsLive = useMemo(
    () => (lms ? { ...lms, evaluations } : lms),
    [lms, evaluations],
  )

  const nextActions = useMemo(
    () => resolveLearnerNextActions(displayUser, lmsLive),
    [displayUser, lmsLive],
  )

  function handleOpenEval(e) {
    handleEvalOpen(
      e,
      item => setModal({ type: 'eval', data: item }),
      { locked: isFormationTestLocked(user, lmsLive, e) },
    )
  }

  if (!lms) return null

  return (
    <>
      <Nav />
      <PortalStickyBar user={displayUser} lms={lms} headerRef={headerRef} />
      <main className="portal-page">
        <div ref={headerRef}>
          <PortalHeader user={displayUser} certGoals={lms.certGoals} lms={lms} />
        </div>

        <LearnerNextActions
          user={displayUser}
          lms={lmsLive}
          actions={nextActions}
          onEval={handleOpenEval}
        />

        <LearnerTestsSection
          user={displayUser}
          lms={lmsLive}
          evaluations={evaluations}
          medacapLive={usingMedacapCompetency}
          isMedacapLearner={isMedacapLearner}
          medacapLoading={medacapLoading}
          medacapError={medacapError}
          t={t}
          onOpenEval={handleOpenEval}
        />

        <LearnerCompetencyResultsSection
          user={displayUser}
          lms={lmsLive}
          evaluations={evaluations}
          t={t}
          onOpenEval={handleOpenEval}
        />

        <LearnerPifSection user={displayUser} lms={lms} t={t} />

        {isPlMedacapVariant(lms) && (
          <LearnerSuggestedTrainingsSection user={displayUser} lms={lmsLive} />
        )}

        {lms.certifications.length > 0 && (
          <PortalReveal id="certifs">
            <div className="container" style={{ padding: '16px 32px' }}>
              <div className="portal-section-head">
                <p className="portal-section-eyebrow">{t.eyebrow_manufacturer}</p>
                <h2 className="portal-section-title">{t.title_my_certifications}</h2>
              </div>
              <PortalStaggerGrid>
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
              </PortalStaggerGrid>
            </div>
          </PortalReveal>
        )}
        <PortalAssistanceSection t={t} variant="learner" />

        {(!isMedacapLearner || medacapSections.discover) && (() => {
          const { section, brand } = getDiscoverTarget(displayUser.brands || [])
          const brandLabel = brand ? brand.charAt(0).toUpperCase() + brand.slice(1) : 'CFAO'
          return (
            <PortalReveal className="portal-discover-section">
              <div className="container" style={{ padding: '0 32px' }}>
                <div className="portal-discover-block">
                  <div className="portal-discover-text">
                    <p className="portal-section-eyebrow" style={{ color: 'rgba(255,255,255,0.5)' }}>{t.eyebrow_discover}</p>
                    <h2 className="portal-discover-title">{t.title_discover}</h2>
                    <p className="portal-discover-desc">{t.discover_desc}</p>
                  </div>
                  <Link
                    to={`/#${section}`}
                    className="portal-discover-cta"
                  >
                    {t.discover_cta} {brandLabel} →
                  </Link>
                </div>
              </div>
            </PortalReveal>
          )
        })()}
      </main>

      <Footer />
      <PortalDemoBar />

      {modal?.type === 'eval' && <PortalModal title={resolveEvalTitle(modal.data, t, user)} onClose={() => setModal(null)}><EvalDetail e={modal.data} t={t} user={user} /></PortalModal>}
      {modal?.type === 'cert' && <PortalModal title={modal.data.title} onClose={() => setModal(null)}><CertDetail c={modal.data} t={t} /></PortalModal>}
    </>
  )
}
