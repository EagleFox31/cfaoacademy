import { useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import VersConnexion from '../../components/VersConnexion.jsx'
import Nav from '../../components/Nav'
import Footer from '../../components/Footer'
import PortalDemoBar from '../../components/PortalDemoBar'
import PageCloseButton from '../../components/PageCloseButton.jsx'
import PortalSectionEyebrow from '../../components/PortalSectionEyebrow.jsx'
import DetailHeaderLogos from '../../components/DetailHeaderLogos.jsx'
import { PORTAL_SECTION_ICON_MAP } from '../../components/portalSectionIcons.jsx'
import useSiteEffects from '../../hooks/useSiteEffects'
import usePortalReveal from '../../hooks/usePortalReveal'
import useAuth from '../../hooks/useAuth'
import useLocale from '../../hooks/useLocale'
import usePortalBackground from '../../hooks/usePortalBackground'
import useBrandDetailEntrance, { animateBrandDetailExit } from '../../hooks/useBrandDetailEntrance.js'
import { LOGO_CFAO_MOBILITY } from '../../utils/resolveDetailCfaoLogo.js'
import { ouvrirApercu, peutOuvrirApercu, urlApercu } from '../../utils/apercuPortail.js'
import { GROUPES_PROFILS, medacapDuProfil, peutVoirPagePortails } from '../../utils/profilsPortails.js'

const RETOUR = '/portail#plateforme'

/** Icône de chaque type de profil, devant le titre de son tableau. */
const ICONE_GROUPE = { centre: 'graduationcap', groupe: 'building', filiale: 'map', apprenant: 'users' }

/** Nombre de comptes d'un profil : « — » tant que l'API n'a pas répondu (jamais de chiffre inventé). */
const nbComptes = (comptes, role) => (comptes ? (comptes[role] ?? 0) : '—')

/**
 * Une ligne de profil. Les 7 lettres de MEDACAP sont toujours là : allumées
 * quand le profil a des fonctionnalités à cette étape, éteintes sinon. Une lettre
 * allumée ouvre, sous la ligne, la liste de ces fonctionnalités. « Voir son
 * portail » ouvre l'aperçu en lecture seule quand le compte y a droit, sinon « Bientôt ».
 */
function LigneProfil({ role, perimetre, comptes, peutVoir, t }) {
  const [ouverte, setOuverte] = useState(null)
  const etapes = medacapDuProfil(role)
  const nomProfil = t[`dir_portails_nom_${role}`] ?? t[`role_${role}`] ?? role
  const description = t[`dir_portails_desc_${role}`]
  const etape = etapes?.find(e => e.cle === ouverte) ?? null
  const idDetail = `medacap-${role}`
  return (
    <>
      <tr>
        <td>
          <span className="portal-portails-profil">
            <strong>{nomProfil}</strong>
            {description && (
              <span
                className="portal-portails-aide"
                tabIndex={0}
                role="note"
                aria-label={`${t.dir_portails_desc_aide.replace('{profil}', nomProfil)} : ${description}`}
                data-testid={`aide-${role}`}
              >
                <span aria-hidden="true">?</span>
                <span className="portal-portails-bulle" aria-hidden="true">{description}</span>
              </span>
            )}
          </span>
        </td>
        <td className="portal-portails-nb" data-testid={`comptes-${role}`}>{nbComptes(comptes, role)}</td>
        <td>{t[`dir_portails_perim_${perimetre}`]}</td>
        <td data-testid={`medacap-${role}`}>
          {etapes ? (
            <div className="portal-portails-medacap">
              {etapes.map(e => {
                const nom = t[e.labelKey]
                const active = e.fonctions.length > 0
                return (
                  <button
                    key={e.cle}
                    type="button"
                    className={['portal-portails-lettre', active && 'is-active', ouverte === e.cle && 'is-open'].filter(Boolean).join(' ')}
                    disabled={!active}
                    title={nom}
                    aria-label={(active ? t.dir_portails_medacap_ouvrir : t.dir_portails_medacap_sans).replace('{etape}', nom)}
                    aria-expanded={active ? ouverte === e.cle : undefined}
                    aria-controls={active ? idDetail : undefined}
                    onClick={() => setOuverte(o => (o === e.cle ? null : e.cle))}
                  >
                    {e.lettre}
                  </button>
                )
              })}
            </div>
          ) : (
            <span className="portal-portails-medacap-inconnu">{t.dir_portails_medacap_inconnu}</span>
          )}
        </td>
        <td>
          <div className="portal-portails-acces">
            {peutVoir ? (
              <a
                className="portal-portails-cta is-active"
                href={urlApercu(role)}
                target="_blank"
                rel="noreferrer"
                data-testid={`voir-${role}`}
                onClick={e => { if (ouvrirApercu(role)) e.preventDefault() }}
              >
                {t.dir_portails_cta}
              </a>
            ) : (
              <>
                <span className="portal-portails-cta" aria-disabled="true">{t.dir_portails_cta}</span>
                <span className="portal-status-chip progress">{t.dir_portails_bientot}</span>
              </>
            )}
          </div>
        </td>
      </tr>
      {etape && (
        <tr className="portal-portails-sous-ligne" id={idDetail} data-testid={`medacap-detail-${role}`}>
          <td colSpan={5}>
            <p className="portal-portails-sous-titre">
              {t.dir_portails_medacap_detail.replace('{etape}', t[etape.labelKey]).replace('{profil}', nomProfil)}
            </p>
            <ul>
              {etape.fonctions.map(id => <li key={id}>{t[`dir_portails_fonc_${id}`] ?? id}</li>)}
            </ul>
          </td>
        </tr>
      )}
    </>
  )
}

/** Un groupe de profils : profil, comptes, périmètre, étapes MEDACAP, accès à son portail (bientôt). */
function TableauGroupe({ groupe, comptes, rolesCompte, t }) {
  const Icone = PORTAL_SECTION_ICON_MAP[ICONE_GROUPE[groupe.id]]
  return (
    <div role="group" className="portal-dps-tier-block" aria-labelledby={`portails-${groupe.id}`}>
      <h2 id={`portails-${groupe.id}`} className="portal-dps-tier-section-title portal-portails-groupe-titre">
        {Icone && <Icone size={20} strokeWidth={2.2} />}
        {t[`dir_portails_groupe_${groupe.id}`]}
      </h2>
      <div className="portal-table-wrap">
        <table className="portal-table portal-portails-table">
          <thead>
            <tr>
              <th scope="col">{t.dir_portails_col_profil}</th>
              <th scope="col" className="portal-portails-nb">{t.dir_portails_col_comptes}</th>
              <th scope="col">{t.dir_portails_col_perimetre}</th>
              <th scope="col">{t.dir_portails_col_medacap}</th>
              <th scope="col">{t.dir_portails_col_portail}</th>
            </tr>
          </thead>
          <tbody>
            {groupe.roles.map(({ role, perimetre }) => (
              <LigneProfil key={role} role={role} perimetre={perimetre} comptes={comptes} peutVoir={peutOuvrirApercu(rolesCompte, role)} t={t} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Directeur du centre : la liste des portails de chaque profil, au format des détails du DPS. */
export default function CenterProfilePortalsDetail() {
  useSiteEffects()
  usePortalReveal()
  const { user, status } = useAuth()
  usePortalBackground(user)
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useLocale('portal')
  const shellRef = useRef(null)
  const closingRef = useRef(false)
  const [isClosing, setIsClosing] = useState(false)
  const originRect = location.state?.originRect ?? null
  const autorise = peutVoirPagePortails(user?.roles)
  const [comptes, setComptes] = useState(null)

  useBrandDetailEntrance(shellRef, originRect, Boolean(user && autorise))

  useEffect(() => {
    if (!user || !autorise) return undefined
    let actif = true
    api.userRoleCounts()
      .then(r => { if (actif && r?.counts && typeof r.counts === 'object') setComptes(r.counts) })
      .catch(() => {})
    return () => { actif = false }
  }, [user, autorise])

  if (status === 'loading') return null
  if (!user) return <VersConnexion />
  if (!autorise) return <Navigate to="/portail" replace />

  const nbProfils = GROUPES_PROFILS.reduce((n, g) => n + g.roles.length, 0)

  async function fermer() {
    if (closingRef.current) return
    closingRef.current = true
    setIsClosing(true)
    await animateBrandDetailExit(shellRef.current, originRect)
    navigate(RETOUR)
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
          <div className="container article-shell portal-dps-brand-shell">
            <PageCloseButton onClick={fermer} ariaLabel={t.dir_portails_close} />
            <div className="article-main">
              <article className="article-sheet portal-dps-brand-sheet" data-testid="portails-profils">
                <header className="article-header portal-dps-brand-header portal-portails-header">
                  <DetailHeaderLogos cfaoLogo={LOGO_CFAO_MOBILITY} />
                  <div className="portal-dps-brand-header-intro">
                    <PortalSectionEyebrow icon="users" label={t.dir_portails_eyebrow} />
                    <h1>{t.dir_portails_title}</h1>
                    <p className="article-lead portal-dps-brand-detail-sub">
                      {t.dir_portails_lead.replace('{n}', nbProfils).replace('{g}', GROUPES_PROFILS.length)}
                    </p>
                  </div>
                </header>
                <div className="portal-dps-brand-sheet-body">
                  <div className="portal-dps-tier-sections">{GROUPES_PROFILS.map(g => <TableauGroupe key={g.id} groupe={g} comptes={comptes} rolesCompte={user.roles} t={t} />)}</div>
                </div>
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
