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

export function visuelSession(session) {
  const { logo, label } = resolvePortalCardBrand(session.marque)
  return {
    img: VISUEL_POLE[session.pole] ?? '/assets/img_cards/techniciens-carte.jpg',
    logo,
    brandLabel: logo ? undefined : label,
  }
}

/** « 12–14 mars 2027 » dans la langue de l'interface. */
export function periode(locale, debut, fin) {
  const d = new Date(debut)
  const f = new Date(fin)
  if (Number.isNaN(d.getTime()) || Number.isNaN(f.getTime())) return ''
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).formatRange(d, f)
}

/** Nombre de stagiaires, au singulier jusqu'à 1 ; rien si les inscrits sont inconnus. */
function stagiaires(t, participants) {
  if (!participants) return ''
  const n = participants.length
  return ((n <= 1 && t.session_trainees_one) || t.session_trainees).replace('{n}', n)
}

/** Ligne d'information de la carte : période · stagiaires · lieu, sans trou. */
export function metaSession(t, locale, s) {
  return [periode(locale, s.debut, s.fin), stagiaires(t, s.participants), s.lieu].filter(Boolean).join(' · ')
}

const MESSAGE = { loading: 'sessions_loading', error: 'sessions_error', unlinked: 'sessions_unlinked' }

/** Les sessions que le formateur anime bientôt, lues dans le planning. La
 * fiche de session n'existe pas encore : visuel gardé, chantier au survol,
 * aucun lien. */
export default function TrainerSessionsSection({ t, locale, values }) {
  const { etat, sessions } = values.sessions ?? { etat: 'loading', sessions: [] }
  const message = MESSAGE[etat] ?? (sessions.length ? null : 'sessions_empty')
  if (message) {
    return <p className="portal-empty-panel" role={etat === 'loading' ? 'status' : undefined}>{t[message]}</p>
  }
  return (
    <PortalStaggerGrid>
      {sessions.map(s => (
        <div key={s.id} className="portal-card-anchor">
          <PvCard
            {...visuelSession(s)}
            kicker={
              <span className={`portal-status-chip ${s.statut === 'en_cours' ? 'open' : 'todo'}`}>
                {s.statut === 'en_cours' ? t.session_running : t.session_upcoming}
              </span>
            }
            title={s.moduleFormation}
            meta={metaSession(t, locale, s)}
            enConstruction={t.under_construction}
          />
        </div>
      ))}
    </PortalStaggerGrid>
  )
}
