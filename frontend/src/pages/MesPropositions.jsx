import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import VersConnexion from '../components/VersConnexion.jsx'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import PortalDemoBar from '../components/PortalDemoBar'
import PageCloseButton from '../components/PageCloseButton.jsx'
import PortalSectionEyebrow from '../components/PortalSectionEyebrow.jsx'
import DetailHeaderLogos from '../components/DetailHeaderLogos.jsx'
import { PORTAL_SECTION_ICON_MAP } from '../components/portalSectionIcons.jsx'
import { peutProposer } from '../components/ProposerModification.jsx'
import useSiteEffects from '../hooks/useSiteEffects'
import usePortalReveal from '../hooks/usePortalReveal'
import useAuth from '../hooks/useAuth.js'
import useLocale from '../hooks/useLocale.js'
import usePortalBackground from '../hooks/usePortalBackground'
import useBrandDetailEntrance, { animateBrandDetailExit } from '../hooks/useBrandDetailEntrance.js'
import useMesPropositions from '../hooks/useMesPropositions.js'
import { LOGO_CFAO_MOBILITY } from '../utils/resolveDetailCfaoLogo.js'
import { retourInterne } from '../utils/planningAccess.js'
import { libelleType } from '../utils/typesProposition.js'
import { NON_RETENUE, cleChangement, dateCourte, estTerminee, statutDe } from '../utils/etapesProposition.js'

/** Les deux tableaux de la page, chacun avec l'icône de son titre. */
const GROUPES = [
  { id: 'en_cours', icone: 'listtodo' },
  { id: 'terminees', icone: 'milestone' },
]

/** Une proposition : ce qui a été proposé, sur quel portail, quand, son étape et le mot de l'équipe. */
function LigneProposition({ proposition: p, nouvelle, t, locale }) {
  const statut = statutDe(p)
  const quoi = p.type ? libelleType(p.type, t) : (p.section || t.apercu_proposer_toute_page)
  return (
    <tr className={`mes-prop-ligne is-${statut}`} data-testid="mes-prop-ligne">
      <td>
        <strong className="mes-prop-quoi">{quoi}</strong>
        {p.section && p.type ? <span className="mes-prop-section"> · {p.section}</span> : null}
        <p className="mes-prop-message">{p.message}</p>
      </td>
      <td>{t[`role_${p.role_vu}`] ?? p.role_vu}</td>
      <td className="mes-prop-date">{dateCourte(p.created_at, locale)}</td>
      <td>
        <span className="mes-prop-pastilles">
          <span className={`mes-propositions-statut is-${statut}`}>{t[`proposition_etape_${statut}`] ?? statut}</span>
          {nouvelle ? <span className="mes-prop-nouveau">{t.mes_prop_nouveau}</span> : null}
        </span>
        {statut === 'planifiee' && p.echeance ? (
          <p className="mes-prop-echeance">{t.mes_prop_echeance.replace('{date}', dateCourte(p.echeance, locale))}</p>
        ) : null}
      </td>
      <td className="mes-prop-reponse">
        {p.reponse_equipe ? (
          <>
            {statut === NON_RETENUE ? <span className="mes-prop-reponse-titre">{t.mes_prop_motif}</span> : null}
            <p>{p.reponse_equipe}</p>
          </>
        ) : <span className="mes-prop-sans-reponse">—</span>}
      </td>
    </tr>
  )
}

function TableauGroupe({ groupe, propositions, nouvelles, t, locale }) {
  const Icone = PORTAL_SECTION_ICON_MAP[groupe.icone]
  const idTitre = `mes-prop-${groupe.id}`
  return (
    <div role="group" className="portal-dps-tier-block" aria-labelledby={idTitre} data-testid={`mes-prop-groupe-${groupe.id}`}>
      <h2 id={idTitre} className="portal-dps-tier-section-title portal-portails-groupe-titre">
        {Icone && <Icone size={20} strokeWidth={2.2} />}
        {t[`mes_prop_groupe_${groupe.id}`]}
        <span className="mes-prop-nb">{propositions.length}</span>
      </h2>
      <div className="portal-table-wrap">
        <table className="portal-table mes-prop-table">
          <thead>
            <tr>
              <th scope="col">{t.mes_prop_col_demande}</th>
              <th scope="col">{t.mes_prop_col_portail}</th>
              <th scope="col">{t.mes_prop_col_date}</th>
              <th scope="col">{t.mes_prop_col_etape}</th>
              <th scope="col">{t.mes_prop_reponse}</th>
            </tr>
          </thead>
          <tbody>
            {propositions.map(p => (
              <LigneProposition key={p.id} proposition={p} nouvelle={Boolean(nouvelles?.has(cleChangement(p)))} t={t} locale={locale} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/**
 * Page « Mes propositions » (menu du compte), au format des détails du portail :
 * les propositions de modification envoyées depuis l'aperçu des portails, en
 * deux tableaux (en cours, terminées). L'ouvrir vaut lecture des changements
 * d'étape (compteur du menu et cloche remis à zéro) ; ceux qui étaient nouveaux
 * gardent la pastille « Nouveau » pendant la visite.
 */
export default function MesPropositions() {
  useSiteEffects()
  usePortalReveal()
  const { user, status } = useAuth()
  usePortalBackground(user)
  const location = useLocation()
  const navigate = useNavigate()
  const { t, locale } = useLocale('portal')
  const shellRef = useRef(null)
  const closingRef = useRef(false)
  const [isClosing, setIsClosing] = useState(false)
  const originRect = location.state?.originRect ?? null
  const retour = retourInterne(location.state?.from) ?? '/portail'
  const autorise = Boolean(user && peutProposer(user.roles))
  const { liste, nouvelles, marquerVues } = useMesPropositions(autorise ? user : null)
  const [nouvellesALArrivee, setNouvellesALArrivee] = useState(null)

  useBrandDetailEntrance(shellRef, originRect, autorise)

  // Premier chargement : retenir ce qui était nouveau, puis le marquer vu.
  useEffect(() => {
    if (!Array.isArray(liste) || nouvellesALArrivee) return
    setNouvellesALArrivee(new Set(nouvelles.map(cleChangement)))
    if (nouvelles.length) marquerVues(nouvelles)
  }, [liste, nouvelles, marquerVues, nouvellesALArrivee])

  const parGroupe = useMemo(() => {
    const l = Array.isArray(liste) ? liste : []
    return { en_cours: l.filter(p => !estTerminee(p)), terminees: l.filter(estTerminee) }
  }, [liste])

  if (status === 'loading') return null
  if (!user) return <VersConnexion />
  if (!autorise) return <Navigate to="/portail" replace />

  async function fermer() {
    if (closingRef.current) return
    closingRef.current = true
    setIsClosing(true)
    await animateBrandDetailExit(shellRef.current, originRect)
    navigate(retour)
  }

  let corps
  if (liste === undefined) corps = <p className="mes-prop-vide">{t.mes_prop_chargement}</p>
  else if (liste === null) corps = <p className="mes-prop-vide" role="alert">{t.mes_prop_indispo}</p>
  else if (liste.length === 0) corps = <p className="mes-prop-vide" data-testid="mes-prop-aucune">{t.mes_prop_aucune}</p>
  else {
    // Un tableau vide n'est pas montré : rien en cours, la page s'ouvre sur les terminées.
    corps = (
      <div className="portal-dps-tier-sections">
        {GROUPES.filter(g => parGroupe[g.id].length).map(g => (
          <TableauGroupe key={g.id} groupe={g} propositions={parGroupe[g.id]} nouvelles={nouvellesALArrivee} t={t} locale={locale} />
        ))}
      </div>
    )
  }

  return (
    <>
      <Nav notifications={[]} />
      <main
        className={[
          'article-page',
          'portal-brand-detail-page',
          isClosing && 'portal-brand-detail-page--closing',
        ].filter(Boolean).join(' ')}
      >
        <div ref={shellRef} className="portal-brand-detail-shell">
          <div className="container article-shell portal-dps-brand-shell portal-portails-shell">
            <PageCloseButton onClick={fermer} ariaLabel={t.mes_prop_fermer} />
            <div className="article-main">
              <article className="article-sheet portal-dps-brand-sheet" data-testid="mes-propositions-page">
                <header className="article-header portal-dps-brand-header portal-portails-header">
                  <DetailHeaderLogos cfaoLogo={LOGO_CFAO_MOBILITY} />
                  <div className="portal-dps-brand-header-intro">
                    <PortalSectionEyebrow icon="clipboard" label={t.mes_prop_eyebrow} />
                    <h1>{t.mes_prop_titre}</h1>
                    <p className="article-lead portal-dps-brand-detail-sub">{t.mes_prop_intro}</p>
                  </div>
                </header>
                <div className="portal-dps-brand-sheet-body">{corps}</div>
              </article>
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <PortalDemoBar />
    </>
  )
}
