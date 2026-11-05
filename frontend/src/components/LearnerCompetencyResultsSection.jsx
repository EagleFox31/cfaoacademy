import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PortalSectionEyebrow from './PortalSectionEyebrow.jsx'
import LearnerEvalCard from './LearnerEvalCard.jsx'
import PortalReveal from './PortalReveal.jsx'
import PortalStaggerGrid from './PortalStaggerGrid.jsx'
import { competencyResultEvaluations } from '../utils/learnerTests.js'

const DEFAULT_RESULTS = [
  // --- Renault Trucks ---
  {
    id: 'res-rt-maint',
    kind: 'competency',
    brand: 'renault-trucks',
    competencyTier: 'junior',
    title: 'Bilan de compétences',
    img: '/assets/img_cards/bilan_competences_junior.jpg',
    score: 71,
    passMark: 60,
    status: 'done',
    date: 'Passé le 21 août 2024',
    minReason: null,
    feedback: 'Validation des fondamentaux de maintenance châssis et moteur Renault Trucks.',
  },
  {
    id: 'res-rt-repar',
    kind: 'competency',
    brand: 'renault-trucks',
    competencyTier: 'senior',
    title: 'Bilan de compétences',
    img: '/assets/img_cards/bilan_competences_senior.jpg',
    score: 56,
    passMark: 60,
    status: 'done',
    date: 'Passé le 21 août 2024',
    minReason: 'Connaissances à consolider',
    feedback: 'Les connaissances théoriques (56%) nécessitent un renforcement pour valider le palier Réparation.',
  },

  // --- Sinotruk ---
  {
    id: 'res-sino-maint',
    kind: 'competency',
    brand: 'sinotruk',
    competencyTier: 'junior',
    title: 'Bilan de compétences',
    img: '/assets/img_cards/bilan_competences_junior.jpg',
    score: 62,
    passMark: 60,
    status: 'done',
    date: 'Passé le 21 août 2024',
    minReason: null,
    feedback: 'Validation du palier Maintenance sur le référentiel des groupes fonctionnels.',
  },
  {
    id: 'res-sino-repar',
    kind: 'competency',
    brand: 'sinotruk',
    competencyTier: 'senior',
    title: 'Bilan de compétences',
    img: '/assets/img_cards/bilan_competences_senior.jpg',
    score: 54,
    passMark: 60,
    status: 'done',
    date: 'Passé le 21 août 2024',
    minReason: 'Connaissances à consolider',
    feedback: 'Les connaissances théoriques (54%) sont à renforcer pour valider le palier Réparation.',
  },
]

export default function LearnerCompetencyResultsSection({
  user,
  lms,
  t,
  evaluations: evaluationsSource,
  titleOverride,
  eyebrowOverride,
  id = 'resultats',
}) {
  const navigate = useNavigate()

  const sourceEvaluations = evaluationsSource ?? lms?.evaluations ?? []

  const displayResults = useMemo(() => {
    const isPlOrEquipment = user?.brands?.includes('renault-trucks') ||
      user?.brands?.includes('sinotruk') ||
      user?.persona === 'pl' ||
      user?.departments?.includes('equipment')

    if (isPlOrEquipment) {
      const realResults = competencyResultEvaluations(sourceEvaluations)
      return DEFAULT_RESULTS.map((def) => {
        const theoryTest = realResults.find(
          (r) => r.brand === def.brand &&
            (r.modality === 'theory' || !r.modality) &&
            (r.competencyTier === def.competencyTier ||
              (def.competencyTier === 'junior' && (r.title?.toLowerCase().includes('maint') || r.title?.toLowerCase().includes('junior'))) ||
              (def.competencyTier === 'senior' && (r.title?.toLowerCase().includes('répar') || r.title?.toLowerCase().includes('senior'))))
        )
        const practicalTest = realResults.find(
          (r) => r.brand === def.brand &&
            r.modality === 'practical' &&
            (r.competencyTier === def.competencyTier ||
              (def.competencyTier === 'junior' && (r.title?.toLowerCase().includes('maint') || r.title?.toLowerCase().includes('junior'))) ||
              (def.competencyTier === 'senior' && (r.title?.toLowerCase().includes('répar') || r.title?.toLowerCase().includes('senior'))))
        )

        if (theoryTest && practicalTest) {
          const tScore = theoryTest.score ?? 0
          const pScore = practicalTest.score ?? 0
          const minScore = Math.min(tScore, pScore)
          const isTheoryLimiting = tScore <= pScore
          const pass = minScore >= 60

          return {
            ...def,
            score: minScore,
            status: 'done',
            subDetail: undefined,
            date: 'Passé le 21 août 2024',
            modality: undefined,
            minReason: pass ? null : (isTheoryLimiting ? 'Connaissances à consolider' : 'Pratique à consolider'),
          }
        } else if (theoryTest) {
          return {
            ...def,
            score: theoryTest.score ?? def.score,
            date: 'Passé le 21 août 2024',
            modality: undefined,
          }
        }
        return {
          ...def,
          modality: undefined,
        }
      })
    }

    const results = competencyResultEvaluations(sourceEvaluations)
    return results.length ? results : DEFAULT_RESULTS
  }, [sourceEvaluations, user])

  const effectiveTitle = titleOverride ?? 'Mes Résultats'
  const effectiveEyebrow = eyebrowOverride ? (
    typeof eyebrowOverride === 'string'
      ? <PortalSectionEyebrow icon="award" label={eyebrowOverride} />
      : eyebrowOverride
  ) : <PortalSectionEyebrow icon="award" label="Bilan des compétences" />

  return (
    <PortalReveal id={id}>
      <div className="container" style={{ padding: '16px 32px' }}>
        <div className="portal-section-head portal-section-head--with-action">
          <div>
            {effectiveEyebrow}
            <h2 className="portal-section-title">{effectiveTitle}</h2>
          </div>
          <Link
            to="/portail/resultats"
            className="portal-section-head-action portal-btn-open-bulletin"
            aria-label="Ouvrir le bulletin de compétences"
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ flexShrink: 0 }}
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <span>{t?.bulletin_view_all ?? 'Ouvrir le bulletin'}</span>
            <span className="portal-btn-arrow" aria-hidden="true">→</span>
          </Link>
        </div>

        <PortalStaggerGrid className="cols-4 pv-grid--stretch">
          {displayResults.map((e) => (
            <LearnerEvalCard
              key={e.id}
              e={e}
              user={user}
              lms={lms}
              t={t}
              statusOnly={false}
              showBrandLogo={true}
              titleOverride={e.title}
              onOpen={() => navigate(`/portail/resultats/${encodeURIComponent(e.id)}`)}
            />
          ))}
        </PortalStaggerGrid>
      </div>
    </PortalReveal>
  )
}
