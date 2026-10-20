import { useMemo, useRef, useState } from 'react'
import PortalLayout from '../../components/PortalLayout.jsx'
import PortalModal from '../../components/PortalModal'
import LearnerCompetencyResultsSection from '../../components/LearnerCompetencyResultsSection.jsx'
import LearnerTestsSection from '../../components/LearnerTestsSection.jsx'
import LearnerPifsSection from '../../components/LearnerPifsSection.jsx'
import LearnerFormationsSection from '../../components/LearnerFormationsSection.jsx'
import LearnerCertificationsSection from '../../components/LearnerCertificationsSection.jsx'
import { EvalDetail, CertDetail } from '../../components/LearnerEvalCard.jsx'
import useAuth from '../../hooks/useAuth'
import useLocale from '../../hooks/useLocale'
import { LMS_BY_USER } from '../../data/mock_lms'
import { resolveLearnerNextActions } from '../../utils/learnerNextActions.js'
import { resolveEvalTitle, isFormationTestLocked } from '../../utils/learnerTests.js'
import { handleEvalOpen, resolvePortalDisplayUser, medacapLearnerSections } from '../../utils/medacapEvaluations.js'
import { resolveMedacapLearnerCertGoals } from '../../utils/medacapLearner.js'
import useLearnerEvaluations from '../../hooks/useLearnerEvaluations.js'
import useLearnerPif from '../../hooks/useLearnerPif.js'

export default function LearnerDashboard() {
  const { user } = useAuth()
  const { t } = useLocale('portal')
  const [modal, setModal] = useState(null)
  const headerRef = useRef(null)
  const lms = LMS_BY_USER[user.demoKey] || LMS_BY_USER.u9
  const {
    evaluations,
    usingMedacapCompetency,
    medacapProfile,
    loading: medacapLoading,
    error: medacapError,
    isMedacapLearner,
  } = useLearnerEvaluations(user, lms)
  const { pif: medacapPif } = useLearnerPif(user)

  const displayUser = useMemo(
    () => resolvePortalDisplayUser(user, medacapProfile),
    [user, medacapProfile],
  )

  const certGoals = useMemo(() => {
    if (isMedacapLearner && medacapProfile) {
      const fromApi = resolveMedacapLearnerCertGoals(medacapProfile)
      if (fromApi.length) return fromApi
    }
    return lms?.certGoals ?? []
  }, [isMedacapLearner, medacapProfile, lms?.certGoals])

  const lmsLive = useMemo(() => {
    if (!lms) return lms
    const fromApi = medacapPif && Object.keys(medacapPif.planningStatus ?? {}).length
    return {
      ...lms,
      evaluations,
      certGoals,
      ...(fromApi ? {
        planningStatus: medacapPif.planningStatus,
        planPathway: medacapPif.planPathway?.length ? medacapPif.planPathway : lms.planPathway,
      } : {}),
    }
  }, [lms, evaluations, certGoals, medacapPif])

  function handleOpenEval(e) {
    handleEvalOpen(
      e,
      item => setModal({ type: 'eval', data: item }),
      { locked: isFormationTestLocked(user, lmsLive, e) },
    )
  }

  if (!lms && !user) return null

  const modalNode = modal ? (
    <>
      {modal.type === 'eval' && (
        <PortalModal
          title={resolveEvalTitle(modal.data, t, user)}
          onClose={() => setModal(null)}
        >
          <EvalDetail e={modal.data} t={t} user={user} />
        </PortalModal>
      )}
      {modal.type === 'cert' && (
        <PortalModal
          title={modal.data.title}
          onClose={() => setModal(null)}
        >
          <CertDetail c={modal.data} t={t} />
        </PortalModal>
      )}
      {modal.type === 'pif' && (
        <PortalModal
          title={modal.data.title}
          onClose={() => setModal(null)}
        >
          <div className="portal-modal-pif-body" style={{ padding: '8px 0' }}>
            <p style={{ margin: '0 0 16px 0', fontSize: 13, color: 'var(--muted, #64748b)' }}>
              {modal.data.details?.subtitle} · <strong>{modal.data.details?.brand}</strong>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {modal.data.details?.modules?.map((m, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    background: 'var(--card-bg, #f8fafc)',
                    borderRadius: 8,
                    border: '1px solid var(--rule, #e2e8f0)',
                  }}
                >
                  <div>
                    <strong style={{ display: 'block', fontSize: 13, color: 'var(--ink, #0e1126)' }}>{m.name}</strong>
                    <span style={{ fontSize: 11.5, color: 'var(--muted, #64748b)' }}>Prévu : {m.date}</span>
                  </div>
                  <span className={`portal-status-chip ${m.status === 'Validé' || m.status === 'Fait' ? 'done' : m.status === 'En cours' ? 'progress' : 'todo'}`}>
                    {m.status}
                  </span>
                </div>
              ))}
            </div>
            <a
              href="#"
              className="portal-cert-dl"
              style={{ marginTop: 20, display: 'inline-block' }}
              onClick={ev => ev.preventDefault()}
            >
              Télécharger le document de synthèse PIF (PDF)
            </a>
          </div>
        </PortalModal>
      )}
      {modal.type === 'report' && (
        <PortalModal
          title={modal.data.title}
          onClose={() => setModal(null)}
        >
          <div className="portal-modal-report-body" style={{ padding: '8px 0' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                marginBottom: 18,
                paddingBottom: 14,
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <img
                src={modal.data.trainerPhoto}
                alt={modal.data.trainerName}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid #fff',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                }}
              />
              <div>
                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', fontWeight: 600 }}>Formateur certifié</span>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink, #0e1126)' }}>{modal.data.trainerName}</h4>
                <span style={{ fontSize: 12, color: 'var(--muted, #64748b)' }}>{modal.data.trainerRole}</span>
              </div>
            </div>
            <div className="portal-modal-row">
              <span className="portal-modal-label">Thématique</span>
              <span className="portal-modal-value">{modal.data.details?.theme}</span>
            </div>
            <div className="portal-modal-row">
              <span className="portal-modal-label">Lieu & Durée</span>
              <span className="portal-modal-value">{modal.data.details?.location} · {modal.data.details?.duration}</span>
            </div>
            <div className="portal-modal-row">
              <span className="portal-modal-label">Évaluation pratique</span>
              <span className="portal-modal-value" style={{ fontWeight: 700, color: '#1aab5b' }}>{modal.data.details?.practicalScore}</span>
            </div>
            {modal.data.details?.evaluation && (
              <div className="portal-modal-feedback" style={{ marginTop: 14 }}>
                <strong style={{ display: 'block', marginBottom: 4, fontSize: 12 }}>Appréciation du formateur</strong>
                {modal.data.details?.evaluation}
              </div>
            )}
            <a
              href="#"
              className="portal-cert-dl"
              style={{ marginTop: 20, display: 'inline-block' }}
              onClick={ev => ev.preventDefault()}
            >
              Télécharger le rapport officiel de formation (PDF)
            </a>
          </div>
        </PortalModal>
      )}
    </>
  ) : null

  return (
    <PortalLayout
      user={displayUser}
      lms={lmsLive}
      headerRef={headerRef}
      headerProps={{ certGoals }}
      modal={modalNode}
    >
      {/* 1. Mes Tests (affichage uniquement de l'état/statut sur la carte, plus de score) */}
      <LearnerTestsSection
        id="tests"
        titleOverride="Mes Tests"
        eyebrowOverride="Mesure des compétences"
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

      {/* 2. Mes Résultats (anciennement Évaluer mes compétences, plus de sous-groupes, cartes par marque et niveau avec logo avant les pastilles) */}
      <LearnerCompetencyResultsSection
        id="resultats"
        titleOverride="Mes Résultats"
        eyebrowOverride="Bilan des compétences"
        user={displayUser}
        lms={lmsLive}
        evaluations={evaluations}
        t={t}
      />

      {/* 3. Mes PIFs (PIF Pluriannuel, PIF 2026, PIF 2025 · 4 cartes par ligne) */}
      <LearnerPifsSection
        id="pifs"
        user={displayUser}
        lms={lmsLive}
        t={t}
        onOpenPif={p => setModal({ type: 'pif', data: p })}
      />

      {/* 4. Mes Formations (Rapports de formation avec auteur/formateur et sa photo en cercle · 4 cartes par ligne) */}
      <LearnerFormationsSection
        id="formations"
        user={displayUser}
        lms={lmsLive}
        t={t}
        onOpenReport={r => setModal({ type: 'report', data: r })}
      />

      {/* 5. Mes Certifications (Certifications de niveau passé avec visuel certif, logo de la marque et nom · 4 cartes par ligne) */}
      <LearnerCertificationsSection
        id="certifications"
        user={displayUser}
        lms={lmsLive}
        t={t}
        onOpenCert={c => setModal({ type: 'cert', data: c })}
      />
    </PortalLayout>
  )
}
