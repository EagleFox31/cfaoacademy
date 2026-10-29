import { periodeLongue } from '../../utils/compteRendu'
import { certificationDe } from '../../data/certifications'
import { SESSIONS_FORMATEUR } from '../../data/mock_sessions_formateur'

/**
 * La carte d'un compte rendu, la meme sur toutes les pages du module :
 * choix de la session, comptes rendus a documenter, en cours, termines.
 *
 *   code de session                         etat
 *   intitule
 *   periode   effectif
 *   marque   lieu                     FORMATION
 *
 * Seul le badge d'etat change d'une page a l'autre. Une saisie en cours
 * y ajoute sa corbeille, discrete jusqu'au survol.
 */

const ETAPES = ['la formation', 'les notes', 'les pages', 'compléter']

function IconeCorbeille() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l.9 12.5h9.2L17.5 7M10 11v5M14 11v5" />
    </svg>
  )
}

function dateCourte(iso) {
  const d = iso ? new Date(iso) : null
  return d && !Number.isNaN(d.getTime())
    ? d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : ''
}

/** L'etat d'un compte rendu : en cours (etape), a rediger, session en cours, termine. */
export function BadgeCompteRendu({ etat, phase = 0, termineLe }) {
  if (etat === 'en_cours_redaction') {
    const i = Math.min(phase ?? 0, ETAPES.length - 1)
    return (
      <span className="cr-badge cr-badge--info" title={`Reprendre à l’étape ${i + 1} : ${ETAPES[i]}`}>
        Non terminé · étape {i + 1}
      </span>
    )
  }
  if (etat === 'termine') {
    const le = dateCourte(termineLe)
    return <span className="cr-badge cr-badge--ok">{le ? `Terminé le ${le}` : 'Terminé'}</span>
  }
  if (etat === 'a_rediger') return <span className="cr-badge cr-badge--warn">À rédiger</span>
  if (etat === 'session_en_cours') return <span className="cr-badge cr-badge--muted">Session en cours</span>
  return null
}

/** Les champs de la carte, depuis une session du planning. */
export function carteDeSession(s) {
  return {
    code: s.codeSession || s.codeFormation,
    titre: s.moduleFormation,
    debut: s.debut,
    fin: s.fin,
    effectif: s.participants?.length ?? 0,
    marque: s.marque,
    lieu: s.lieu,
    certification: Boolean(certificationDe(s.codeFormation)),
  }
}

/** Les champs de la carte, depuis un brouillon (`brouillonsEnregistres`). */
export function carteDeBrouillon(b) {
  // Un brouillon ne du planning reprend le code et le cadre de sa session.
  const s = b.manuel ? null : SESSIONS_FORMATEUR.find(x => x.id === b.id)
  return {
    code: s?.codeSession || b.code || (b.manuel ? 'Saisie libre' : '—'),
    titre: b.session || s?.moduleFormation,
    debut: b.debut || s?.debut,
    fin: b.fin || s?.fin,
    effectif: b.effectif,
    marque: b.marque || s?.marque,
    lieu: b.lieu || s?.lieu,
    certification: b.certification || Boolean(certificationDe(b.code)),
  }
}

export default function CarteCompteRendu({ carte, badge, onClick, onSupprimer, actif = false }) {
  const ouvrir = e => {
    if (e.type === 'keydown') {
      if (e.key !== 'Enter' && e.key !== ' ') return
      e.preventDefault()
    }
    onClick?.()
  }
  const pluriel = carte.effectif > 1 ? 's' : ''
  return (
    <div className={`cr-session cr-brouillon${actif ? ' cr-session--active' : ''}`}
      role="button" tabIndex={0} onClick={ouvrir} onKeyDown={ouvrir}>
      <div className="cr-session-top">
        <span className="cr-session-code">{carte.code}</span>
        <span className="cr-session-etat">
          {badge}
          {onSupprimer && (
            <button type="button" className="cr-brouillon-suppr cr-carte-suppr"
              title="Supprimer ce compte rendu non terminé" aria-label="Supprimer ce compte rendu non terminé"
              onClick={e => { e.stopPropagation(); onSupprimer() }}
              onKeyDown={e => e.stopPropagation()}>
              <IconeCorbeille />
            </button>
          )}
        </span>
      </div>
      <h3 className="cr-session-title" title={carte.titre || ''}>
        {carte.titre || 'Compte rendu sans intitulé'}
      </h3>
      <div className="cr-session-meta">
        {carte.debut && <span>{periodeLongue(carte.debut, carte.fin)}</span>}
        <span>{carte.effectif} {carte.certification ? 'candidat' : 'stagiaire'}{pluriel}</span>
      </div>
      <div className="cr-session-meta cr-session-pied">
        {carte.marque && <span>{carte.marque}</span>}
        <span className="cr-session-lieu" title={carte.lieu || ''}>{carte.lieu}</span>
        {carte.certification
          ? <span className="cr-session-type cr-session-type--certif">Certification</span>
          : <span className="cr-session-type">Formation</span>}
      </div>
    </div>
  )
}
