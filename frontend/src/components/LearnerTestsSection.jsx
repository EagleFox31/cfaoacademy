import PortalSectionEyebrow from './PortalSectionEyebrow.jsx'
import { useMemo } from 'react'
import LearnerEvalCard from './LearnerEvalCard.jsx'
import PortalReveal from './PortalReveal.jsx'
import PortalStaggerGrid from './PortalStaggerGrid.jsx'
import { competencyTierForCertLevel } from '../utils/learnerTests.js'

const TIER_ORDER = {
  junior: 1,
  maintenance: 1,
  senior: 2,
  reparation: 2,
  'réparation': 2,
  repair: 2,
  expert: 3,
  diagnostic: 3,
  diagnostics: 3,
}

export default function LearnerTestsSection({
  user,
  lms,
  t,
  onOpenEval,
  evaluations: evaluationsSource,
  medacapLive,
  isMedacapLearner = false,
  medacapLoading = false,
  medacapError = null,
  titleOverride,
  eyebrowOverride,
  id = 'tests',
}) {
  const sourceEvaluations = evaluationsSource ?? lms?.evaluations ?? []

  // Plafond de tier atteignable par l'apprenant (basé sur ses certLevels multimarques).
  // Un technicien SENIOR (Réparation) ne doit pas voir les tests Diagnostic (Expert), etc.
  const userMaxTierRank = useMemo(() => {
    const levels = user?.certLevels && typeof user.certLevels === 'object'
      ? Object.values(user.certLevels)
      : []
    let max = 0
    for (const lvl of levels) {
      const tier = competencyTierForCertLevel(lvl)
      const rank = TIER_ORDER[tier] ?? 0
      if (rank > max) max = rank
    }
    return max
  }, [user])

  // Tests de mesure de compétences MEDACAP filtrés par tier atteignable.
  const allCompetencyTests = useMemo(
    () => sourceEvaluations.filter(e => {
      if (e.kind !== 'competency') return false
      if (!userMaxTierRank) return true
      const rank = TIER_ORDER[(e.competencyTier ?? '').toLowerCase()] ?? 0
      return rank <= userMaxTierRank
    }),
    [sourceEvaluations, userMaxTierRank],
  )

  const tierTitles = {
    junior: t.tests_title_maintenance ?? 'Maintenance préventive des véhicules',
    maintenance: t.tests_title_maintenance ?? 'Maintenance préventive des véhicules',
    senior: t.tests_title_reparation ?? 'Réparation des composants des véhicules',
    reparation: t.tests_title_reparation ?? 'Réparation des composants des véhicules',
    'réparation': t.tests_title_reparation ?? 'Réparation des composants des véhicules',
    repair: t.tests_title_reparation ?? 'Réparation des composants des véhicules',
  }

  const tierImages = {
    junior: '/assets/publics/techniciens.jpg',
    maintenance: '/assets/publics/techniciens.jpg',
    senior: '/assets/img_cards/equipment_niveau_2_test_pratique.png',
    reparation: '/assets/img_cards/equipment_niveau_2_test_pratique.png',
    'réparation': '/assets/img_cards/equipment_niveau_2_test_pratique.png',
    repair: '/assets/img_cards/equipment_niveau_2_test_pratique.png',
  }

  // Une seule card par niveau : on regroupe les modalités (théorique + pratique) et
  // on agrège le statut. Click → ouvre le premier test non terminé, sinon le premier.
  const tierCards = useMemo(() => {
    const byTier = new Map()
    for (const e of allCompetencyTests) {
      const key = (e.competencyTier ?? '').toLowerCase()
      if (!byTier.has(key)) byTier.set(key, [])
      byTier.get(key).push(e)
    }
    return [...byTier.entries()]
      .sort(([a], [b]) => (TIER_ORDER[a] ?? 99) - (TIER_ORDER[b] ?? 99))
      .map(([tierKey, evals]) => {
        const allDone = evals.every(x => x.status === 'done')
        const anyProgress = evals.some(x => x.status === 'progress')
        const status = allDone ? 'done' : anyProgress ? 'progress' : 'todo'
        const base = evals.find(x => x.modality === 'theory') ?? evals[0]
        const nextTodo = evals.find(x => x.status !== 'done') ?? base
        const tierImg = tierImages[tierKey] ?? base.img
        return {
          ...base,
          id: `tier-card-${tierKey}`,
          modality: 'theory',
          status,
          img: tierImg,
          imgFallback: tierImg,
          medacap: nextTodo?.medacap,
          __openTarget: nextTodo,
        }
      })
  }, [allCompetencyTests])

  const effectiveTitle = titleOverride ?? t.title_your_tests
  const effectiveEyebrow = eyebrowOverride ? (
    typeof eyebrowOverride === 'string'
      ? <PortalSectionEyebrow icon="award" label={eyebrowOverride} />
      : eyebrowOverride
  ) : <PortalSectionEyebrow icon="award" label={t.tests_eyebrow_label ?? 'Mesure des compétences'} />

  if (!isMedacapLearner && !allCompetencyTests.length && !medacapLive) return null

  // Des tests déjà connus restent affichés : l'état chargement/erreur ne
  // remplace la section que si aucune évaluation n'est exploitable.
  if (isMedacapLearner && !allCompetencyTests.length && medacapLoading) {
    return (
      <PortalReveal id={id}>
        <div className="container" style={{ padding: '16px 32px' }}>
          <div className="portal-section-head">
            {effectiveEyebrow}
            <h2 className="portal-section-title">{effectiveTitle}</h2>
          </div>
          <div className="portal-medacap-status" role="status">{t.medacap_loading}</div>
        </div>
      </PortalReveal>
    )
  }

  if (isMedacapLearner && !allCompetencyTests.length && medacapError) {
    return (
      <PortalReveal id={id}>
        <div className="container" style={{ padding: '16px 32px' }}>
          <div className="portal-section-head">
            {effectiveEyebrow}
            <h2 className="portal-section-title">{effectiveTitle}</h2>
          </div>
          <div className="portal-medacap-status portal-medacap-status--error" role="alert">
            {t.medacap_error}
          </div>
        </div>
      </PortalReveal>
    )
  }

  return (
    <PortalReveal id={id}>
      <div className="container" style={{ padding: '16px 32px' }}>
        <div className="portal-section-head">
          {effectiveEyebrow}
          <h2 className="portal-section-title">{effectiveTitle}</h2>
        </div>

        {tierCards.length === 0 ? (
          <div className="portal-plan-filter-empty" role="status">
            {t.test_filter_empty}
          </div>
        ) : (
          <PortalStaggerGrid className="cols-4 pv-grid--stretch">
            {tierCards.map(card => (
              <LearnerEvalCard
                key={card.id}
                e={card}
                user={user}
                lms={lms}
                t={t}
                statusOnly={true}
                titleOverride={tierTitles[(card.competencyTier ?? '').toLowerCase()]}
                onOpen={(x) => onOpenEval?.(x.__openTarget ?? x)}
              />
            ))}
          </PortalStaggerGrid>
        )}
      </div>
    </PortalReveal>
  )
}
