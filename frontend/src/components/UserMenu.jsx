import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getPrimaryRole } from '../data/index.js'
import { USER_MENU_DEFAULT, userMenuItems } from '../data/userMenu.js'
import useLocale from '../hooks/useLocale.js'
import { formatLearnerRoleBadge } from '../utils/portalPersona.js'
import { resolveProfilePays } from '../utils/profileOrg.js'
import { countryCodeFromName, flagCdnUrlForCountry } from '../utils/countryFlag.js'
import { localizedCountryName } from '../utils/localizeGeo.js'
import { NotificationItems } from './PortalNotificationsBell.jsx'
import ProfileAvatar from './ProfileAvatar.jsx'
import MenuMiseAJour, { useOffreMiseAJour } from './MenuMiseAJour.jsx'
import {
  ActivityIcon, BellIcon, ChevronIcon, GlobeIcon, LifeBuoyIcon, LightbulbIcon, LogOutIcon, MilestoneIcon, UserIcon,
} from './portalSectionIcons.jsx'

const ICONS = {
  user: UserIcon, bell: BellIcon, lifebuoy: LifeBuoyIcon, milestone: MilestoneIcon, globe: GlobeIcon, activity: ActivityIcon,
  lightbulb: LightbulbIcon,
}

const compte = n => (n > 9 ? '9+' : n)

/**
 * Ce qu'on affiche du compte : nom, e-mail, fonction, pays et drapeau. Repris par
 * le menu du compte, la carte du menu mobile et la page Profil.
 * `paysConnu` : pays tiré d'une source qui fait foi (ex. fiche formateur du
 * planning), prioritaire sur celui du compte.
 */
export function useAccountSummary(user, paysConnu = null) {
  const { locale, t } = useLocale('portal')
  const { t: heroT } = useLocale('hero')
  const { t: publicsT } = useLocale('publics')
  if (!user) return null
  const primaryRole = getPrimaryRole(user.roles)
  const baseRoleLabel = t[`role_${primaryRole}`] || primaryRole
  const pays = paysConnu || resolveProfilePays(user)
  return {
    fullName: [user.firstName, user.lastName].filter(Boolean).join(' '),
    email: user.email || (user.username ? `${user.username}@cfao.com` : ''),
    roleLabel: primaryRole === 'learner'
      ? formatLearnerRoleBadge(baseRoleLabel, user, heroT, publicsT)
      : baseRoleLabel,
    pays,
    paysLabel: pays ? localizedCountryName(pays, locale, countryCodeFromName(pays)) : null,
    flagUrl: pays ? flagCdnUrlForCountry(pays, 40) : null,
    flagUrl2x: pays ? flagCdnUrlForCountry(pays, 80) : null,
  }
}

/** Pastilles fonction + pays, communes au menu et au menu mobile. */
export function AccountBadges({ summary }) {
  return (
    <>
      <span className="nav-user-dropdown-role">{summary.roleLabel}</span>
      {summary.flagUrl && summary.paysLabel ? (
        <span className="nav-user-dropdown-pays">
          <img
            src={summary.flagUrl}
            srcSet={`${summary.flagUrl2x} 2x`}
            alt=""
            className="nav-user-dropdown-flag"
            width={20}
            height={15}
            loading="lazy"
            decoding="async"
          />
          <span>{summary.paysLabel}</span>
        </span>
      ) : null}
    </>
  )
}

/**
 * Les options du menu du compte (USER_MENU_OPTIONS), filtrées par rôle.
 * Une option `panel: 'notifications'` déplie les alertes sur place.
 */
export function UserMenuItems({ user, items = USER_MENU_DEFAULT, notifications, propositions, onNavigate, variant = 'desktop' }) {
  const { t } = useLocale('profile')
  const { pathname, search, hash } = useLocation()
  const [panel, setPanel] = useState(null)
  const mobile = variant === 'mobile'
  const alerts = notifications ?? []
  const itemClass = mobile ? 'nav-mobile-foot-link nav-user-menu-option' : 'nav-user-dropdown-item'

  const options = userMenuItems(user.roles ?? [], items).map(option => {
    const Icon = ICONS[option.icon] ?? UserIcon
    const label = t[option.labelKey]
    const nombre = {
      notifications: alerts.length,
      propositions: propositions?.nouvelles?.length ?? 0,
    }[option.id] ?? 0
    const inner = (
      <>
        <Icon size={16} className="nav-user-dropdown-item-icon" />
        <span className="nav-user-dropdown-item-label">{label}</span>
        {nombre > 0 ? <span className="nav-user-dropdown-count">{compte(nombre)}</span> : null}
      </>
    )

    if (option.panel) {
      const open = panel === option.id
      const basculer = () => setPanel(open ? null : option.id)
      return (
        <div key={option.id} className="nav-user-dropdown-group">
          <button
            type="button"
            className={itemClass}
            role={mobile ? undefined : 'menuitem'}
            aria-expanded={open}
            onClick={basculer}
          >
            {inner}
            <ChevronIcon open={open} className="nav-user-dropdown-arrow" />
          </button>
          {open && option.panel === 'notifications' ? (
            alerts.length === 0 ? (
              <p className="nav-user-dropdown-empty">{t.notifications_empty}</p>
            ) : (
              <NotificationItems
                alerts={alerts}
                onClose={onNavigate}
                menu={!mobile}
                className="nav-notif-dropdown-list nav-user-dropdown-notifs"
              />
            )
          ) : null}
        </div>
      )
    }

    return (
      <Link
        key={option.id}
        to={option.to}
        state={{ from: `${pathname}${search}${hash}` }}
        className={itemClass}
        role={mobile ? undefined : 'menuitem'}
        onClick={onNavigate}
      >
        {inner}
        {mobile ? null : <span className="nav-user-dropdown-arrow">→</span>}
      </Link>
    )
  })
  // Toujours présent, quel que soit le rôle : recherche à la demande, ou mise à jour en attente.
  return [...options, <MenuMiseAJour key="mise-a-jour" variant={variant} />]
}

/**
 * Menu du compte : avatar dans la barre du haut, carte du compte, options
 * choisies par `items` (ids de USER_MENU_OPTIONS, défaut : profil + notifications),
 * puis déconnexion.
 */
export default function UserMenu({ user, onLogout, items = USER_MENU_DEFAULT, notifications, propositions }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const { t } = useLocale('profile')
  const summary = useAccountSummary(user)
  const majEnAttente = Boolean(useOffreMiseAJour())
  const { t: majT } = useLocale('miseAJour')

  useEffect(() => {
    if (!open) return undefined
    function onPointerDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="nav-user-menu" ref={ref}>
      <button
        type="button"
        className="nav-user-btn"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <ProfileAvatar
          person={user}
          name={summary.fullName}
          className="nav-user-avatar"
          imgClassName="nav-user-avatar-img"
        />
        <span className="nav-user-name">{user.firstName}</span>
        {majEnAttente ? (
          <span className="nv-menu-point" title={majT.menuDisponible}>
            <span className="nv-masque">{majT.menuDisponible}</span>
          </span>
        ) : null}
        <ChevronIcon open={open} className="nav-user-chevron" />
      </button>

      {open && (
        <div className="nav-user-dropdown" role="menu">
          <div className="nav-user-dropdown-head">
            <span className="nav-user-dropdown-name">{summary.fullName}</span>
            {summary.email && <span className="nav-user-dropdown-email">{summary.email}</span>}
            <div className="nav-user-dropdown-meta">
              <AccountBadges summary={summary} />
            </div>
          </div>

          <div className="nav-user-dropdown-section" role="group" aria-label={t.menu_aria}>
            <UserMenuItems
              user={user}
              items={items}
              notifications={notifications}
              propositions={propositions}
              onNavigate={() => setOpen(false)}
            />
          </div>

          <div className="nav-user-dropdown-divider" />

          <button
            type="button"
            className="nav-user-dropdown-item nav-user-dropdown-logout"
            role="menuitem"
            onClick={() => { setOpen(false); onLogout() }}
          >
            <LogOutIcon size={16} className="nav-user-dropdown-item-icon" />
            <span className="nav-user-dropdown-item-label">{t.menu_logout}</span>
          </button>
        </div>
      )}
    </div>
  )
}
