import PortalStaggerGrid from '../../../../components/PortalStaggerGrid.jsx'
import PortalConstructionMedia from '../../../../components/PortalConstructionMedia.jsx'
import PvCard from '../../../../components/PvCard'
import { tx } from '../texte.js'
import { PLACES_MAX, pastilleSession } from '../sources/assistant.js'
import { periode, visuelSession } from './TrainerSessionsSection.jsx'

/**
 * Prochaines sessions de formation de l'assistante : une fiche par session
 * (logo de la marque, intitulé, formateur, lieu, dates, places prises).
 * Sans source (`sessions` null), une carte annonce la section. La liste à
 * cocher n'existe pas encore : la fiche garde son visuel, chantier au survol.
 */
export default function AssistantSessionsSection({ t, locale, values }) {
  const { sessions } = values
  if (sessions == null) {
    return (
      <PortalStaggerGrid>
        <div className="portal-card-anchor">
          <PvCard
            cardMedia={<PortalConstructionMedia label={t.under_construction} />}
            kicker={<span className="portal-status-chip todo">{t.chip_follow}</span>}
            title={t.sessions_card}
            meta={t.sessions_card_meta}
          />
        </div>
      </PortalStaggerGrid>
    )
  }
  if (sessions.length === 0) return <p className="portal-empty-panel">{t.sessions_empty}</p>

  return (
    <PortalStaggerGrid>
      {sessions.map(s => {
        const pastille = pastilleSession(s)
        const places = tx(t, 'session_seats', { n: s.inscrits ?? 0, max: s.places ?? PLACES_MAX })
        return (
          <div key={s.id} className="portal-card-anchor">
            <PvCard
              {...visuelSession(s)}
              kicker={pastille && (
                <span className={`portal-status-chip ${pastille.cls}`}>{tx(t, pastille.key, { n: pastille.n })}</span>
              )}
              title={s.intitule}
              meta={[s.formateur, s.lieu, periode(locale, s.debut, s.fin), places].filter(Boolean).join(' · ')}
              enConstruction={t.under_construction}
            />
          </div>
        )
      })}
    </PortalStaggerGrid>
  )
}
