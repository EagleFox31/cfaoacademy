import PortalStaggerGrid from '../../../../components/PortalStaggerGrid.jsx'
import PvCard from '../../../../components/PvCard'
import { resolvePortalCardBrand } from '../../../../utils/portalCardMedia.js'

/** Visuel des cartes de session, par pôle — même table que `SessionCard`.
 *
 * Surtout pas la fiche catalogue : `technicien_<marque>.png` est le
 * schéma des niveaux de compétences, lisible sur une fiche A4, illisible
 * et hors sujet en vignette de carte. Les `*-carte.jpg` sont les visuels
 * des publics sans leur cadre blanc : la photo couvre toute la vignette. */
const VISUEL_POLE = {
  Motors: '/assets/img_cards/techniciens-carte.jpg',
  Equipment: '/assets/img_cards/techniciens-carte.jpg',
  Carrosserie: '/assets/publics/carrossiers.jpg',
}

function visuelSession(session) {
  const { logo, label } = resolvePortalCardBrand(session.marque)
  return {
    img: VISUEL_POLE[session.pole] ?? '/assets/img_cards/techniciens-carte.jpg',
    logo,
    brandLabel: logo ? undefined : label,
  }
}

/** « 12–14 mars 2027 » dans la langue de l'interface. */
function periode(locale, debut, fin) {
  const d = new Date(debut)
  const f = new Date(fin)
  if (Number.isNaN(d.getTime()) || Number.isNaN(f.getTime())) return ''
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).formatRange(d, f)
}

/** Nombre de stagiaires, au singulier jusqu'à 1. */
function stagiaires(t, n) {
  return ((n <= 1 && t.session_trainees_one) || t.session_trainees).replace('{n}', n)
}

/** Les sessions que le formateur anime bientôt. La fiche de session
 * n'existe pas encore : visuel gardé, chantier au survol, aucun lien. */
export default function TrainerSessionsSection({ t, locale, values }) {
  return (
    <PortalStaggerGrid>
      {values.aVenir.map(s => (
        <div key={s.id} className="portal-card-anchor">
          <PvCard
            {...visuelSession(s)}
            kicker={
              <span className={`portal-status-chip ${s.statut === 'en_cours' ? 'progress' : 'todo'}`}>
                {s.statut === 'en_cours' ? t.session_running : t.session_upcoming}
              </span>
            }
            title={s.moduleFormation}
            meta={`${periode(locale, s.debut, s.fin)} · ${stagiaires(t, s.participants.length)} · ${s.lieu}`}
            enConstruction={t.under_construction}
          />
        </div>
      ))}
    </PortalStaggerGrid>
  )
}
