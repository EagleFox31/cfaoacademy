import { useMemo } from 'react'
import PortalReveal from './PortalReveal.jsx'
import PortalStaggerGrid from './PortalStaggerGrid.jsx'
import PortalSessionCard from './PortalSessionCard.jsx'
import useLocale from '../hooks/useLocale'
import {
  resolveLearnerPlanningSessions,
  planningSessionAccent,
} from '../utils/learnerPlanning.js'

/**
 * « Formations suggérées » — toutes les sessions du niveau immédiatement
 * supérieur (N+1) pour les marques du technicien, à venir. Ce n'est PAS le PIF
 * (plan post-test) : c'est une vitrine « ces formations arrivent, souhaitez-vous
 * y participer ? » avec le bouton d'intérêt sur chaque carte.
 */
export default function LearnerSuggestedTrainingsSection({ user, lms, year = 2026 }) {
  const { t } = useLocale('portal')
  const { t: cardsT } = useLocale('cards')

  const sessions = useMemo(
    () => resolveLearnerPlanningSessions(user, lms, year, { targetLevelOnly: true })
      .filter(s => s.annualStatus !== 'fait'),
    [user, lms, year],
  )

  if (!sessions.length) return null

  return (
    <PortalReveal id="formations-suggerees">
      <div className="container" style={{ padding: '16px 32px' }}>
        <div className="portal-section-head">
          <p className="portal-section-eyebrow">{t.eyebrow_suggested_trainings ?? 'Formations à venir'}</p>
          <h2 className="portal-section-title">{t.title_suggested_trainings ?? 'Formations suggérées pour vous'}</h2>
        </div>

        <PortalStaggerGrid>
          {sessions.map(s => (
            <div key={s.uid ?? s.id} className="portal-card-anchor">
              <PortalSessionCard
                session={s}
                annualStatus={s.annualStatus}
                t={t}
                user={user}
                allowSuggest
                statusOnImage
                accentColor={planningSessionAccent(s.annualStatus)}
                hoverHint={cardsT.sessionFicheHint}
              />
            </div>
          ))}
        </PortalStaggerGrid>
      </div>
    </PortalReveal>
  )
}
