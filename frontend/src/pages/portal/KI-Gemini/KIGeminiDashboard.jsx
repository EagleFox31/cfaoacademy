import { useState, useMemo, useRef } from 'react'
import Nav from '../../../components/Nav'
import Footer from '../../../components/Footer'
import PortalHeader from '../../../components/PortalHeader'
import PortalStickyBar from '../../../components/PortalStickyBar.jsx'
import PortalDemoBar from '../../../components/PortalDemoBar'
import PortalSectionHead from '../../../components/PortalSectionHead.jsx'
import PortalSectionEyebrow from '../../../components/PortalSectionEyebrow.jsx'
import PortalReveal from '../../../components/PortalReveal.jsx'
import PortalStaggerGrid from '../../../components/PortalStaggerGrid.jsx'
import PlanEntryCard from '../../../components/PlanEntryCard.jsx'
import FadStatusBadge from '../../../components/FadStatusBadge.jsx'
import PvCard from '../../../components/PvCard.jsx'
import { EvalDetail, CertDetail } from '../../../components/LearnerEvalCard.jsx'
import PortalModal from '../../../components/PortalModal.jsx'
import useSiteEffects from '../../../hooks/useSiteEffects'
import usePortalReveal from '../../../hooks/usePortalReveal'
import useAuth from '../../../hooks/useAuth'
import useLocale from '../../../hooks/useLocale'
import { LMS_BY_USER } from '../../../data/mock_lms'
import { mergeKiScopeWithLms } from '../../../data/ki/cmrToyotaKiMock.js'
import { resolveKiDisplayUser } from '../../../utils/kiScope.js'
import { portalPvCardMedia } from '../../../utils/portalCardMedia.js'
import { dpsCompetencyTierChipClass, dpsCompetencyTierTableBandAccent } from '../../../utils/dpsCompetencyTierTheme.js'

// Importations des briques novatrices KI-Gemini
import KIGeminiSkillHeatmap from './components/KIGeminiSkillHeatmap.jsx'
import KIGeminiDojoOjtModal from './components/KIGeminiDojoOjtModal.jsx'
import KIGeminiEscalationModal from './components/KIGeminiEscalationModal.jsx'
import KIGeminiFlashBriefingCard from './components/KIGeminiFlashBriefingCard.jsx'
import {
  KI_GEMINI_SCOPE,
  KI_GEMINI_TECHNICIANS,
  KI_GEMINI_FAD,
  KI_GEMINI_ESCALATIONS,
} from './data/kiGeminiData.js'

import './styles/kiGemini.css'

export default function KIGeminiDashboard() {
  useSiteEffects()
  usePortalReveal()
  const { user } = useAuth()
  const { t } = useLocale('portal')
  const headerRef = useRef(null)

  // Double Casquette : 'instructor' (défaut) vs 'learner'
  const [activeHat, setActiveHat] = useState('instructor')

  // Modales
  const [selectedTechForOjt, setSelectedTechForOjt] = useState(null)
  const [showEscalationModal, setShowEscalationModal] = useState(false)
  const [modal, setModal] = useState(null)
  const [toastMessage, setToastMessage] = useState(null)

  // Données dynamiques
  const [technicians, setTechnicians] = useState(KI_GEMINI_TECHNICIANS)
  const [escalations, setEscalations] = useState(KI_GEMINI_ESCALATIONS)

  const personalLms = LMS_BY_USER[user?.demoKey || 'u11']
  const lms = useMemo(() => mergeKiScopeWithLms(personalLms, user), [personalLms, user])
  const displayUser = useMemo(() => resolveKiDisplayUser(user, lms), [user, lms])

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 4000)
  }

  const handleOjtValidated = (result) => {
    showToast(`✅ Évaluation OJT enregistrée pour ${result.technicianName} (${result.score}%) !`)
    setTechnicians((prev) =>
      prev.map((tech) => {
        if (tech.id === result.technicianId) {
          return {
            ...tech,
            skills: {
              ...tech.skills,
              braking: Math.max(tech.skills.braking, result.score),
            },
          }
        }
        return tech
      })
    )
  }

  const handleEscalationCreated = (esc) => {
    showToast(`🚀 Dossier ${esc.ref} transmis avec succès au Flying Doctor !`)
    setEscalations((prev) => [esc, ...prev])
  }

  // Groupement des techniciens par palier MEDACAP (LEGO du DPS)
  const groupedTechnicians = useMemo(() => {
    return {
      junior: technicians.filter((t) => t.primaryTier === 'junior'),
      senior: technicians.filter((t) => t.primaryTier === 'senior'),
      expert: technicians.filter((t) => t.primaryTier === 'expert'),
    }
  }, [technicians])

  if (!lms) return null

  return (
    <>
      <Nav notifications={lms.alerts ?? []} />
      <PortalStickyBar user={displayUser} lms={lms} headerRef={headerRef} />

      <main className="portal-page">
        {/* En-tête officiel CFAO Academy */}
        <div ref={headerRef}>
          <PortalHeader user={displayUser} certGoals={lms.certGoals} lms={lms} />
        </div>

        {/* ─── SMART CONTEXT SWITCHER STRIP (BASCULE DE DOUBLE CASQUETTE) ─── */}
        <div className="portal-ki-context-switcher-strip">
          <div className="container portal-ki-context-switcher-inner">
            <div className="portal-ki-context-indicator">
              <span className="portal-ki-brand-chip-active">TOYOTA</span>
              <span>
                Périmètre : <strong>CFAO Motors Cameroun</strong> · Marque Instructeur : <strong>Toyota</strong>
              </span>
            </div>

            <div className="portal-ki-mode-toggles">
              <button
                type="button"
                className={`portal-ki-mode-btn ${activeHat === 'instructor' ? 'active' : ''}`}
                onClick={() => setActiveHat('instructor')}
              >
                <span>🛠️ Espace Formateur Relais</span>
                <span className="badge-count">3 FAD</span>
              </button>

              <button
                type="button"
                className={`portal-ki-mode-btn ${activeHat === 'learner' ? 'active' : ''}`}
                onClick={() => setActiveHat('learner')}
              >
                <span>🎓 Mon Parcours Praticien (G1)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Toast Alert Flottant */}
        {toastMessage && (
          <div
            style={{
              position: 'fixed',
              bottom: '24px',
              right: '24px',
              zIndex: 999,
              background: '#0f172a',
              color: '#ffffff',
              padding: '14px 24px',
              borderRadius: '12px',
              borderLeft: '4px solid #1aab5b',
              boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            {toastMessage}
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* MODE INSTRUCTEUR (Actif par défaut)                             */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        {activeHat === 'instructor' && (
          <>
            {/* 1. SECTION BILAN & KPIS ATELIER */}
            <PortalReveal id="bilan">
              <div className="container" style={{ padding: '16px 32px' }}>
                <PortalSectionHead
                  eyebrow={<PortalSectionEyebrow icon="presentation" label="PILOTAGE ATELIER & PÉDAGOGIE" />}
                  title="Vue d'ensemble de l'activité Key Instructor"
                  methodText="Agrégat filiale Cameroun · Marque Toyota"
                  t={t}
                />

                <div className="portal-kpi-row">
                  <div className="portal-kpi-card">
                    <div className="portal-kpi-value accent">{KI_GEMINI_FAD.length}</div>
                    <div className="portal-kpi-label">Sessions à animer (FAD)</div>
                  </div>
                  <div className="portal-kpi-card">
                    <div className="portal-kpi-value green">{technicians.length}</div>
                    <div className="portal-kpi-label">Techniciens Toyota suivis</div>
                  </div>
                  <div className="portal-kpi-card">
                    <div className="portal-kpi-value green">{KI_GEMINI_SCOPE.evaluatedCount}</div>
                    <div className="portal-kpi-label">Évaluations pratiques validées</div>
                  </div>
                  <div className="portal-kpi-card">
                    <div className="portal-kpi-value">{KI_GEMINI_SCOPE.avgScore}%</div>
                    <div className="portal-kpi-label">Score moyen filiale (MEDACAP)</div>
                  </div>
                </div>
              </div>
            </PortalReveal>

            {/* 2. SECTION SESSIONS À ANIMER (FAD) */}
            <PortalReveal id="fad">
              <div className="container" style={{ padding: '16px 32px' }}>
                <PortalSectionHead
                  eyebrow={<PortalSectionEyebrow icon="presentation" label="CALENDRIER DES ATELIERS PRATIQUES" />}
                  title="Formations & Ateliers Pratiques à Dispenser (FAD)"
                  methodText="Sessions autorisées par le niveau G2 Diagnostic pour les paliers Junior (G4) & Senior (G3)"
                  t={t}
                />

                <div className="portal-ki-fad-grid">
                  {KI_GEMINI_FAD.map((fad) => (
                    <div
                      key={fad.id}
                      className="portal-ki-fad-card"
                      style={{ '--ki-accent': fad.accentColor }}
                    >
                      <div>
                        <div className="portal-ki-fad-card-head">
                          <div>
                            <span className="portal-ki-fad-code-badge">{fad.code} · {fad.level}</span>
                            <h3 className="portal-ki-fad-card-title">{fad.title}</h3>
                          </div>
                          <FadStatusBadge statut={fad.statut} label={fad.statut === 'planifie' ? 'Planifiée' : 'En attente'} />
                        </div>

                        <div className="portal-ki-fad-card-meta" style={{ marginTop: '14px' }}>
                          <div className="portal-ki-fad-card-meta-row">
                            <span>📅 {fad.date} ({fad.time})</span>
                          </div>
                          <div className="portal-ki-fad-card-meta-row">
                            <span>📍 {fad.lieu}</span>
                          </div>
                          <div style={{ marginTop: '8px' }}>
                            <strong style={{ fontSize: '12px', color: 'var(--navy)' }}>
                              Stagiaires convoqués ({fad.apprenants}) :
                            </strong>
                            <div className="portal-ki-fad-learners-chips">
                              {fad.learnersList.map((name, i) => (
                                <span key={i} className="portal-ki-learner-tag">{name}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                        <button
                          type="button"
                          className="portal-ki-action-btn-mini ojt"
                          onClick={() => {
                            const firstTech = technicians.find(t => t.name === fad.learnersList[0]) || technicians[0]
                            setSelectedTechForOjt(firstTech)
                          }}
                        >
                          ⚡ Démarrer l'atelier OJT
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </PortalReveal>

            {/* 3. SECTION DOJO D'ATELIER & MATRICE VIVANTE DES COMPÉTENCES */}
            <PortalReveal id="dojo-atelier">
              <div className="container" style={{ padding: '16px 32px' }}>
                <PortalSectionHead
                  eyebrow={<PortalSectionEyebrow icon="award" label="MATRICE DES COMPÉTENCES & DOJO D'ATELIER" />}
                  title="Matrice Thermique des Compétences Toyota Cameroun"
                  methodText="Cartographie temps réel des compétences par domaine technique et déclenchement d'évaluations OJT"
                  t={t}
                />

                <KIGeminiSkillHeatmap
                  onStartOjt={(tech) => setSelectedTechForOjt(tech)}
                />
              </div>
            </PortalReveal>

            {/* 4. SECTION RÉSULTATS MARQUE TOYOTA (RÉUTILISATION LEGO DPS) */}
            <PortalReveal id="toyota-resultats">
              <div className="container" style={{ padding: '16px 32px' }}>
                <PortalSectionHead
                  eyebrow={<PortalSectionEyebrow icon="award" label="SYNTHÈSE MEDACAP MOTORS" />}
                  title="Résultats globaux des compétences Toyota"
                  methodText="Scores moyens théoriques et pratiques consolidés pour la filiale Cameroun"
                  t={t}
                />

                <PortalStaggerGrid className="cols-3 pv-grid--stretch">
                  <PlanEntryCard
                    kind="results"
                    className="portal-plan-entry-card--brand-toyota"
                    logo="/assets/logos/toyota.png"
                    brandLabel="Toyota"
                    meta={
                      <div className="portal-dps-brand-result-meta">
                        <div className="portal-dps-brand-result-tiers">
                          <div className="portal-dps-result-tier-row">
                            <span className="portal-dps-result-tier-label">Maintenance (Junior) :</span>
                            <strong className="portal-dps-result-tier-score green">92%</strong>
                          </div>
                          <div className="portal-dps-result-tier-row">
                            <span className="portal-dps-result-tier-label">Réparation (Senior) :</span>
                            <strong className="portal-dps-result-tier-score green">82%</strong>
                          </div>
                          <div className="portal-dps-result-tier-row">
                            <span className="portal-dps-result-tier-label">Diagnostic (Expert) :</span>
                            <strong className="portal-dps-result-tier-score amber">60%</strong>
                          </div>
                          <div className="portal-dps-result-tier-row is-global" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                            <span className="portal-dps-result-tier-label"><strong>Moyenne Générale :</strong></span>
                            <strong className="portal-dps-result-tier-score green" style={{ fontSize: '16px' }}>78%</strong>
                          </div>
                        </div>
                        <p className="portal-dps-brand-result-sub">8 techniciens évalués sur 10</p>
                      </div>
                    }
                    cta="Consulter la fiche détaillée →"
                    accentColor="#e60012"
                    corner
                  />

                  {/* Flash Briefing TSB Card */}
                  <div style={{ gridColumn: 'span 2' }}>
                    <KIGeminiFlashBriefingCard />
                  </div>
                </PortalStaggerGrid>
              </div>
            </PortalReveal>

            {/* 5. SECTION PIF TECHNICIENS (RÉUTILISATION LEGO DPS PAR PALIERS) */}
            <PortalReveal id="toyota-pif">
              <div className="container" style={{ padding: '16px 32px' }}>
                <PortalSectionHead
                  eyebrow={<PortalSectionEyebrow icon="milestone" label="PLANS INDIVIDUELS DE FORMATION (DEFINE)" />}
                  title="Techniciens Toyota — Suivi des Parcours & PIF"
                  methodText="Groupement officiel par palier MEDACAP : Junior (Maintenance) · Senior (Réparation) · Expert (Diagnostic)"
                  t={t}
                />

                {/* Palier 1 : Maintenance (Junior) - Bleu #1a56db */}
                <div style={{ marginBottom: '28px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                    <span className="portal-status-chip portal-tier-junior">Maintenance (Junior)</span>
                    <span style={{ fontSize: '13px', color: 'var(--muted)' }}>— {groupedTechnicians.junior.length} techniciens</span>
                  </div>
                  <PortalStaggerGrid className="cols-4 pv-grid--stretch">
                    {groupedTechnicians.junior.map((tech) => (
                      <PlanEntryCard
                        key={tech.id}
                        kind="pif"
                        className="portal-team-member-card portal-pif-tech-card portal-tier-junior"
                        title={tech.name}
                        meta={
                          <div className="portal-team-member-subcards">
                            <div className="portal-team-member-subcard">
                              <span className="portal-team-member-subcard-lbl">Agence</span>
                              <span className="portal-team-member-subcard-val">{tech.agency}</span>
                            </div>
                            <p className="portal-pif-card-count-line portal-pif-tech-card-count" style={{ marginTop: '8px' }}>
                              <span className="portal-pif-card-count-value">{tech.pifTotal}</span> formations prévues
                            </p>
                          </div>
                        }
                        cta="Évaluer OJT →"
                        onOpen={() => setSelectedTechForOjt(tech)}
                        accentColor={dpsCompetencyTierTableBandAccent('junior')}
                        corner
                      />
                    ))}
                  </PortalStaggerGrid>
                </div>

                {/* Palier 2 : Réparation (Senior) - Orange #e67e00 */}
                <div style={{ marginBottom: '28px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                    <span className="portal-status-chip portal-tier-senior">Réparation (Senior)</span>
                    <span style={{ fontSize: '13px', color: 'var(--muted)' }}>— {groupedTechnicians.senior.length} techniciens</span>
                  </div>
                  <PortalStaggerGrid className="cols-4 pv-grid--stretch">
                    {groupedTechnicians.senior.map((tech) => (
                      <PlanEntryCard
                        key={tech.id}
                        kind="pif"
                        className="portal-team-member-card portal-pif-tech-card portal-tier-senior"
                        title={tech.name}
                        meta={
                          <div className="portal-team-member-subcards">
                            <div className="portal-team-member-subcard">
                              <span className="portal-team-member-subcard-lbl">Agence</span>
                              <span className="portal-team-member-subcard-val">{tech.agency}</span>
                            </div>
                            <p className="portal-pif-card-count-line portal-pif-tech-card-count" style={{ marginTop: '8px' }}>
                              <span className="portal-pif-card-count-value">{tech.pifTotal}</span> formations prévues
                            </p>
                          </div>
                        }
                        cta="Évaluer OJT →"
                        onOpen={() => setSelectedTechForOjt(tech)}
                        accentColor={dpsCompetencyTierTableBandAccent('senior')}
                        corner
                      />
                    ))}
                  </PortalStaggerGrid>
                </div>

                {/* Palier 3 : Diagnostic (Expert) - Vert #1aab5b */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                    <span className="portal-status-chip portal-tier-expert">Diagnostic (Expert)</span>
                    <span style={{ fontSize: '13px', color: 'var(--muted)' }}>— {groupedTechnicians.expert.length} techniciens</span>
                  </div>
                  <PortalStaggerGrid className="cols-4 pv-grid--stretch">
                    {groupedTechnicians.expert.map((tech) => (
                      <PlanEntryCard
                        key={tech.id}
                        kind="pif"
                        className="portal-team-member-card portal-pif-tech-card portal-tier-expert"
                        title={tech.name}
                        meta={
                          <div className="portal-team-member-subcards">
                            <div className="portal-team-member-subcard">
                              <span className="portal-team-member-subcard-lbl">Agence</span>
                              <span className="portal-team-member-subcard-val">{tech.agency}</span>
                            </div>
                            <p className="portal-pif-card-count-line portal-pif-tech-card-count" style={{ marginTop: '8px' }}>
                              <span className="portal-pif-card-count-value">{tech.pifTotal}</span> formations prévues
                            </p>
                          </div>
                        }
                        cta="Évaluer OJT →"
                        onOpen={() => setSelectedTechForOjt(tech)}
                        accentColor={dpsCompetencyTierTableBandAccent('expert')}
                        corner
                      />
                    ))}
                  </PortalStaggerGrid>
                </div>
              </div>
            </PortalReveal>

            {/* 6. SECTION ESCALADE DIAGNOSTIC & SUPPORT ACADEMY */}
            <PortalReveal id="escalade">
              <div className="container" style={{ padding: '16px 32px' }}>
                <PortalSectionHead
                  eyebrow={<PortalSectionEyebrow icon="presentation" label="SUPPORT TECHNIQUE NIVEAU 2" />}
                  title="Hub d'Escalade Diagnostic & Flying Doctor"
                  methodText="Transmission de cas complexes à l'équipe pédagogique et ingénierie de l'Academy"
                  t={t}
                />

                <div style={{ background: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid rgba(15,23,42,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                    <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted)' }}>
                      Dossiers d'assistance diagnostic ouverts pour la filiale Cameroun ({escalations.length})
                    </p>
                    <button
                      type="button"
                      className="portal-ki-action-btn-mini ojt"
                      style={{ padding: '8px 16px', fontSize: '13px' }}
                      onClick={() => setShowEscalationModal(true)}
                    >
                      ➕ Ouvrir une escalade diagnostic
                    </button>
                  </div>

                  <div className="portal-ki-table-responsive">
                    <table className="portal-ki-heatmap-table">
                      <thead>
                        <tr>
                          <th>Réf. Dossier</th>
                          <th>Véhicule</th>
                          <th>Agence & Déclarant</th>
                          <th>Symptômes / DTC</th>
                          <th>Statut</th>
                          <th>Intervenant Academy</th>
                        </tr>
                      </thead>
                      <tbody>
                        {escalations.map((esc) => (
                          <tr key={esc.id || esc.ref}>
                            <td><strong>{esc.ref}</strong></td>
                            <td>{esc.vehicle}</td>
                            <td>{esc.agency || 'Douala'} ({esc.technician || 'André YOGBA'})</td>
                            <td><span style={{ color: '#ef4444', fontWeight: 600 }}>{esc.dtc}</span></td>
                            <td>
                              <span className="portal-status-chip portal-status-chip--progress">
                                {esc.status === 'en_cours' ? 'En cours d\'analyse' : 'Transmis Academy'}
                              </span>
                            </td>
                            <td>{esc.flyingDoctor || 'Eugène EBENE'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </PortalReveal>
          </>
        )}

        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* MODE PRATICIEN / APPRENANT (Mon Parcours G1 Master Tech)        */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        {activeHat === 'learner' && (
          <div id="parcours">
            <div className="container" style={{ padding: '16px 32px' }}>
              <div className="portal-ki-hat-divider" style={{ margin: '0 0 24px 0', textAlign: 'left' }}>
                <PortalSectionEyebrow icon="graduationcap" label="CASQUETTE APPRENANT — PARCOURS PERSONNEL" />
                <h2 className="portal-ki-hat-divider-title" style={{ marginTop: '8px' }}>
                  Objectif de Certification : Toyota G1 Master Diagnostic Technician
                </h2>
                <p className="portal-ki-hat-divider-desc">
                  En tant que Key Instructor certifié G2, André prépare sa montée en compétences vers le grade le plus élevé de l'organigramme technique Toyota.
                </p>
                <div className="portal-ki-hat-stats">
                  <span>8/10 modules e-learning complétés</span>
                  <span>80% d'avancement</span>
                  <span>3 Certifications constructeur obtenues</span>
                </div>
              </div>

              {/* Certifications obtenues */}
              <div style={{ marginTop: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--navy)', marginBottom: '16px' }}>
                  Mes Certifications Actives
                </h3>
                <div className="pv-grid cols-3 pv-grid--stretch">
                  {lms.certifications?.map((c) => (
                    <div key={c.id}>
                      <PvCard
                        {...portalPvCardMedia({ ...c, kind: 'cert' })}
                        kicker={<span className={`portal-brand-chip ${c.brand}`}>{c.brand}</span>}
                        title={c.title}
                        meta={`Délivré par CFAO Academy le ${c.date}`}
                        cta="Voir l'attestation →"
                        accentColor="#1aab5b"
                        onClick={() => setModal({ type: 'cert', data: c })}
                        corner
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
      <PortalDemoBar />

      {/* Modale d'évaluation Dojo d'Atelier OJT */}
      {selectedTechForOjt && (
        <KIGeminiDojoOjtModal
          technician={selectedTechForOjt}
          onClose={() => setSelectedTechForOjt(null)}
          onValidated={handleOjtValidated}
        />
      )}

      {/* Modale d'escalade diagnostic */}
      {showEscalationModal && (
        <KIGeminiEscalationModal
          onClose={() => setShowEscalationModal(false)}
          onCreated={handleEscalationCreated}
        />
      )}

      {/* Modales détail évaluation / certif standard */}
      {modal?.type === 'eval' && (
        <PortalModal title="Détail de l'évaluation" onClose={() => setModal(null)}>
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
