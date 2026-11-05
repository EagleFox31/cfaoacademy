/**
 * Mon profil — ce que le système sait de moi, et ce que ça change pour ma saisie.
 *
 * Une page de profil qui n'affiche qu'un nom et un bouton de déconnexion ne sert
 * à personne. Celle-ci répond à la question qu'on se pose vraiment dans ce
 * module : **pourquoi je vois ces marques-là et pas les autres ?**
 *
 * Le périmètre n'est donc pas une ligne décorative, c'est le sujet principal :
 * les marques affichées ici sont exactement celles que les policies laissent
 * passer dans la grille de saisie.
 */
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

import { useCampaign } from '../App'
import BrandLogo from '../components/BrandLogo'
import { IconInfo, IconTag, IconUsers } from '../components/icons'
import PageCloseButton from '../components/PageCloseButton'
import { Banner, Counter, Empty } from '../components/ui'
import { useFormatters, useLocale } from '../i18n'
import { logout, rolesOf } from '../lib/auth'

/** Libellés de rôle — le nom technique Keycloak ne parle à personne. */
const ROLE_LABELS = {
  workshop_manager: 'role.workshopManager',
  team_manager: 'role.teamManager',
  dps: 'role.dps',
  dop: 'role.dop',
  branch_director: 'role.branchDirector',
  branch_admin: 'role.branchAdmin',
  branch_hr: 'role.branchHr',
  center_assistant: 'role.centerAssistant',
  training_coordinator: 'role.trainingCoordinator',
  center_director: 'role.centerDirector',
  group_admin: 'role.groupAdmin',
  group_director: 'role.groupDirector',
  superadmin: 'role.superadmin',
}

const STATUS_TONE = {
  DRAFT: 'draft',
  SUBMITTED: 'review',
  VALIDATED: 'ok',
  REOPENED: 'crit',
}

export default function Profile({ session }) {
  const { t, tData } = useLocale()
  const { number } = useFormatters()
  const navigate = useNavigate()
  const { campaign, submission } = useCampaign()

  const claims = session?.claims ?? {}
  const fullName = claims.name || claims.preferred_username || t('profile.unknownUser')
  const email = claims.email || ''
  const locale = claims.locale || 'fr'

  const initials = useMemo(() => {
    const parts = String(fullName).trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return '?'
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  }, [fullName])

  // Les rôles techniques sont traduits ; ceux qu'on ne connaît pas s'affichent
  // tels quels plutôt que d'être masqués — un rôle invisible est un rôle qu'on
  // oublie de retirer.
  const roles = rolesOf(session)
  const knownRoles = roles.filter((r) => ROLE_LABELS[r])
  const otherRoles = roles.filter((r) => !ROLE_LABELS[r] && !r.startsWith('default-'))

  const brands = Array.isArray(claims.brands) ? claims.brands : []
  const orgUnit = submission?.org_unit_label || claims.scopeNode || ''
  const country = submission?.country || ''

  function close() {
    // Retour à l'écran précédent ; repli sur l'accueil si on est arrivé
    // directement par l'URL (onglet restauré, lien partagé).
    if (window.history.length > 1) navigate(-1)
    else navigate('/', { replace: true })
  }

  return (
    <div className="stack profile-page">
      <div className="card entry-head">
        <PageCloseButton ariaLabel={t('profile.closeAria')} onClick={close} />
        <div className="entry-head__side">
          <span className="profile-avatar" aria-hidden="true">{initials}</span>
        </div>
        <h1 className="entry-head__title">{fullName}</h1>
        <div className="entry-head__side entry-head__side--end">
          {email && <span className="profile-email">{email}</span>}
        </div>
      </div>

      <div className="card">
        <div className="card__body stack">
          <h2 className="section-title">
            <IconInfo />
            {t('profile.scopeTitle')}
          </h2>
          <div className="instructions">
            <p>{t('profile.scopeHelp')}</p>
          </div>
        </div>
      </div>

      <div className="counter-grid">
        <Counter
          tone="red"
          icon={<IconUsers />}
          label={t('profile.kpiPlaces')}
          value={number(submission?.total_headcount ?? 0)}
        />
        <Counter
          tone="ok"
          icon={<IconTag />}
          label={t('profile.kpiBrands')}
          value={number(brands.length)}
        />
      </div>

      {/* ── Périmètre ───────────────────────────────────────────────────── */}
      <div className="card">
        <div className="card__head">
          <h2>{t('profile.perimeter')}</h2>
        </div>
        <div className="card__body stack">
          <dl className="profile-facts">
            <div>
              <dt>{t('profile.orgUnit')}</dt>
              <dd>{orgUnit || <span className="muted">{t('profile.notSet')}</span>}</dd>
            </div>
            <div>
              <dt>{t('profile.country')}</dt>
              <dd>{country || <span className="muted">{t('profile.notSet')}</span>}</dd>
            </div>
            <div>
              <dt>{t('profile.roles')}</dt>
              <dd>
                {roles.length === 0 ? (
                  <span className="muted">{t('profile.notSet')}</span>
                ) : (
                  <span className="chip-list">
                    {knownRoles.map((role) => (
                      <span className="chip" key={role}>{t(ROLE_LABELS[role])}</span>
                    ))}
                    {otherRoles.map((role) => (
                      <span className="chip" key={role}>{role}</span>
                    ))}
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt>{t('profile.language')}</dt>
              <dd>{tData(`profile.lang.${locale}`, locale)}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* ── Marques : la réponse à « pourquoi je vois ça » ───────────────── */}
      <div className="card">
        <div className="card__head">
          <h2>{t('profile.brands')}</h2>
          <span className="muted">{t('profile.brandsCount', { count: brands.length })}</span>
        </div>
        <div className="card__body">
          {brands.length === 0 ? (
            <Empty>{t('profile.noBrand')}</Empty>
          ) : (
            <div className="profile-brands">
              {brands.map((code) => (
                <div className="profile-brands__item" key={code}>
                  <BrandLogo code={code} label={code} size={54} />
                  <span className="profile-brands__label">{code}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Ma fiche de campagne ─────────────────────────────────────────── */}
      <div className="card">
        <div className="card__head">
          <h2>{t('profile.myEntry')}</h2>
          {campaign && <span className="muted">{campaign.year}</span>}
        </div>
        <div className="card__body stack">
          {!submission ? (
            <Banner tone="info">{t('profile.noEntry')}</Banner>
          ) : (
            <dl className="profile-facts">
              <div>
                <dt>{t('profile.entryStatus')}</dt>
                <dd>
                  <span className={`pill pill--${STATUS_TONE[submission.status] ?? 'draft'}`}>
                    {tData(`status.${submission.status}`, submission.status)}
                  </span>
                </dd>
              </div>
              <div>
                <dt>{t('profile.kpiPlaces')}</dt>
                <dd>{number(submission.total_headcount ?? 0)}</dd>
              </div>
            </dl>
          )}
          <div className="profile-actions">
            <button type="button" className="btn btn--primary" onClick={() => navigate('/')}>
              {t('profile.goToEntry')}
            </button>
          </div>
        </div>
      </div>

      {/* ── Session ──────────────────────────────────────────────────────── */}
      <div className="card">
        <div className="card__head">
          <h2>{t('profile.session')}</h2>
        </div>
        <div className="card__body stack">
          {/* Aucun mot de passe n'est géré ici : Keycloak en est seul dépositaire.
              Le dire évite qu'on cherche un formulaire qui n'existera jamais. */}
          <p className="muted" style={{ margin: 0 }}>{t('profile.passwordNote')}</p>
          <div className="profile-actions">
            <button type="button" className="btn" onClick={logout}>
              {t('profile.signOut')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
