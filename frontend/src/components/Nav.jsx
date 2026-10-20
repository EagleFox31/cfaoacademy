import { useCallback, useEffect, useMemo, useState, useRef, useId } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { NAV, resolvePortalNavSections, getPrimaryRole } from '../data/index.js'
import { LMS_BY_USER } from '../data/mock_lms.js'
import { scrollToPortalSection } from '../utils/portalScroll.js'
import useNavScrollSpy from '../hooks/useNavScrollSpy.js'
import useLocale from '../hooks/useLocale.js'
import LocaleSwitch from './LocaleSwitch.jsx'
import useAuth from '../hooks/useAuth.js'
import { usePortalOnboarding } from '../context/PortalOnboardingContext.jsx'
import PortalHelpMenu from './PortalHelpMenu.jsx'
import PortalNotificationsBell from './PortalNotificationsBell.jsx'
import { formatLearnerRoleBadge } from '../utils/portalPersona.js'
import { resolveProfilePays } from '../utils/profileOrg.js'
import { countryCodeFromName, flagCdnUrlForCountry } from '../utils/countryFlag.js'
import { localizedCountryName } from '../utils/localizeGeo.js'
import {
  ChevronIcon,
  PortalNavSectionIcon,
  LogOutIcon,
  MilestoneIcon,
  LifeBuoyIcon,
} from './portalSectionIcons.jsx'
import ProfileAvatar from './ProfileAvatar.jsx'

function scrollToSection(hash) {
  if (!hash) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }
  // Portail : les sections entrent au scroll, il faut les révéler avant de
  // mesurer (cf. portalScroll.js). Ailleurs, l'ancrage natif suffit.
  if (document.querySelector('.portal-page')) {
    if (scrollToPortalSection(hash, { highlight: false })) return
  }
  const el = document.getElementById(hash)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function UserMenu({ user, onLogout, t, onPortal = false }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const { locale } = useLocale()
  const { t: heroT } = useLocale('hero')
  const { t: publicsT } = useLocale('publics')

  const primaryRole = getPrimaryRole(user.roles)
  const baseRoleLabel = t[`role_${primaryRole}`] || primaryRole
  const roleLabel = primaryRole === 'learner'
    ? formatLearnerRoleBadge(baseRoleLabel, user, heroT, publicsT)
    : baseRoleLabel
  const pays = resolveProfilePays(user)
  const paysLabel = pays
    ? localizedCountryName(pays, locale, countryCodeFromName(pays))
    : null
  const flagUrl = pays ? flagCdnUrlForCountry(pays, 40) : null
  const userEmail = user.email || (user.username ? `${user.username}@cfao.com` : '')
  const isAdminOrSuper = ['superadmin', 'build_team', 'group_admin', 'group_hr'].some(r => user.roles?.includes(r))
  const isLearner = user.roles?.includes('learner')

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

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
          name={`${user.firstName} ${user.lastName}`}
          className="nav-user-avatar"
          imgClassName="nav-user-avatar-img"
        />
        <span className="nav-user-name">{user.firstName}</span>
        <ChevronIcon open={open} className="nav-user-chevron" />
      </button>

      {open && (
        <div className="nav-user-dropdown" role="menu">
          <div className="nav-user-dropdown-head">
            <span className="nav-user-dropdown-name">{user.firstName} {user.lastName}</span>
            {userEmail && <span className="nav-user-dropdown-email">{userEmail}</span>}
            <div className="nav-user-dropdown-meta">
              <span className="nav-user-dropdown-role">{roleLabel}</span>
              {flagUrl && paysLabel ? (
                <span className="nav-user-dropdown-pays">
                  <img
                    src={flagUrl}
                    srcSet={`${flagCdnUrlForCountry(pays, 80)} 2x`}
                    alt=""
                    className="nav-user-dropdown-flag"
                    width={20}
                    height={15}
                    loading="lazy"
                    decoding="async"
                  />
                  <span>{paysLabel}</span>
                </span>
              ) : null}
            </div>
          </div>

          <div className="nav-user-dropdown-section" role="group" aria-label="Espaces">
            {isAdminOrSuper && (
              <Link
                to="/portail/delivery"
                className="nav-user-dropdown-item"
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                <MilestoneIcon size={16} className="nav-user-dropdown-item-icon" />
                <span className="nav-user-dropdown-item-label">{t.nav_delivery_cockpit || 'Cockpit Projets & Delivery'}</span>
                <span className="nav-user-dropdown-arrow">→</span>
              </Link>
            )}

            <Link
              to="/portail/assistance"
              className="nav-user-dropdown-item"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <LifeBuoyIcon size={16} className="nav-user-dropdown-item-icon" />
              <span className="nav-user-dropdown-item-label">{t.nav_tech_assistance || 'Assistance technique'}</span>
              <span className="nav-user-dropdown-arrow">→</span>
            </Link>
          </div>

          <div className="nav-user-dropdown-divider" />

          <button
            type="button"
            className="nav-user-dropdown-item nav-user-dropdown-logout"
            role="menuitem"
            onClick={() => { setOpen(false); onLogout() }}
          >
            <LogOutIcon size={16} className="nav-user-dropdown-item-icon" />
            <span className="nav-user-dropdown-item-label">{t.nav_logout || 'Se déconnecter'}</span>
          </button>
        </div>
      )}
    </div>
  )
}

function NavLinkList({
  variant,
  onPortal,
  user,
  portalSections,
  portalT,
  navT,
  isActive,
  handlePortalNavClick,
  handleNavClick,
  onItemActivate,
}) {
  const listClass = [
    variant === 'mobile' ? 'nav-mobile-links' : 'nav-links',
    onPortal && variant === 'desktop' ? 'nav-links--portal-pills' : '',
  ].filter(Boolean).join(' ')
  const itemClass = (active) => {
    if (onPortal) return `nav-portal-pill${active ? ' active' : ''}`
    if (variant === 'mobile') return `nav-mobile-link${active ? ' active' : ''}`
    return active ? 'active' : ''
  }

  return (
    <ul className={listClass}>
      {onPortal && user ? (
        portalSections.map((s) => {
          const label = portalT[s.labelKey] ?? s.key
          const display = s.key === 'planning'
            ? `${label} ${new Date().getFullYear()}`
            : label
          const active = isActive(s)
          return (
            <li key={s.key}>
              <a
                href={`#${s.id}`}
                className={[
                  itemClass(active),
                  variant === 'mobile' ? 'nav-mobile-link' : '',
                ].filter(Boolean).join(' ')}
                aria-current={active ? 'location' : undefined}
                onClick={(e) => {
                  handlePortalNavClick(s)(e)
                  onItemActivate?.()
                }}
              >
                <PortalNavSectionIcon
                  sectionKey={s.key}
                  iconKey={s.iconKey}
                  size={variant === 'mobile' ? 20 : 18}
                  strokeWidth={2}
                  className="nav-portal-pill-icon"
                />
                <span className="nav-portal-pill-label">{display}</span>
              </a>
            </li>
          )
        })
      ) : (
        NAV.map((n) => (
          <li key={n.key}>
            <Link
              to={n.to}
              className={itemClass(isActive(n))}
              onClick={(e) => {
                handleNavClick(n)(e)
                onItemActivate?.()
              }}
              aria-current={isActive(n) ? 'page' : undefined}
            >
              {navT[n.key] ?? n.label}
            </Link>
          </li>
        ))
      )}
    </ul>
  )
}

export default function Nav({ user: propUser, active: pageActive, notifications }) {
  const { pathname, hash } = useLocation()
  const navigate = useNavigate()
  const onHome    = pathname === '/'
  const onLogin   = pathname === '/login'
  const onPortal  = pathname.startsWith('/portail')

  const { user: authUser, login, logout } = useAuth()
  const user = propUser ?? authUser
  const { startTour, hasTour } = usePortalOnboarding()
  const { locale, setLocale, t: navT } = useLocale('nav')
  const { t: commonT }  = useLocale('common')
  const { t: portalT }  = useLocale('portal')

  const [menuOpen, setMenuOpen] = useState(false)
  const toggleRef = useRef(null)
  const panelRef = useRef(null)
  const menuInstanceId = useId()
  const mobileMenuId = `nav-mobile-menu${menuInstanceId}`

  const portalSections = useMemo(
    () => (user ? resolvePortalNavSections(user.roles, LMS_BY_USER[user.id], user) : []),
    [user],
  )

  const spyEnabled  = onHome || onPortal
  const spySections = onPortal ? portalSections : undefined
  const { activeKey: scrollActive, setActiveKey, refresh } = useNavScrollSpy(spyEnabled, spySections)

  const closeMenu = useCallback(() => {
    setMenuOpen(false)
  }, [])

  const openMenu = useCallback(() => {
    setMenuOpen(true)
  }, [])

  function handleLogout() {
    logout()
    navigate('/')
    closeMenu()
  }

  const handleNavClick = (item) => (e) => {
    if (!onHome) return
    e.preventDefault()
    setActiveKey(item.key)
    scrollToSection(item.hash)
    const nextHash = item.hash ? `#${item.hash}` : ''
    window.history.pushState(null, '', `/${nextHash}`)
    window.setTimeout(refresh, 600)
  }

  const handlePortalNavClick = (section) => (e) => {
    e.preventDefault()
    setActiveKey(section.key)
    scrollToSection(section.id)
    window.history.pushState(null, '', `#${section.id}`)
    window.setTimeout(refresh, 600)
  }

  useEffect(() => {
    if (!onHome && !onPortal) return undefined
    const hashId = hash?.replace(/^#/, '')
    if (onPortal && hashId) {
      const match = portalSections.find(s => s.id === hashId)
      if (match) setActiveKey(match.key)
    }
    const timers = [100, 450, 1000].map(ms => window.setTimeout(refresh, ms))
    return () => timers.forEach(clearTimeout)
  }, [hash, onHome, onPortal, refresh, portalSections, setActiveKey])

  useEffect(() => {
    closeMenu()
  }, [pathname, closeMenu])

  useEffect(() => {
    if (!menuOpen) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeMenu()
        toggleRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)

    const focusTimer = window.setTimeout(() => {
      const first = panelRef.current?.querySelector('a, button')
      first?.focus()
    }, 0)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      window.clearTimeout(focusTimer)
    }
  }, [menuOpen, closeMenu])

  const isActive = (item) => {
    if (onPortal) return scrollActive === item.key
    if (!onHome) return pageActive === item.key
    if (scrollActive) return scrollActive === item.key
    if (item.hash && hash === `#${item.hash}`) return true
    return false
  }

  const brandClick = onHome
    ? (e) => {
        e.preventDefault()
        setActiveKey(null)
        scrollToSection('')
        window.history.pushState(null, '', '/')
        closeMenu()
      }
    : undefined

  const linkListProps = {
    onPortal,
    user,
    portalSections,
    portalT,
    navT,
    isActive,
    handlePortalNavClick,
    handleNavClick,
  }

  const { t: heroT } = useLocale('hero')
  const { t: publicsT } = useLocale('publics')

  const primaryRole = user ? getPrimaryRole(user.roles) : 'learner'
  const baseRoleLabel = user ? (portalT[`role_${primaryRole}`] || primaryRole) : ''
  const roleLabel = primaryRole === 'learner' && user
    ? formatLearnerRoleBadge(baseRoleLabel, user, heroT, publicsT)
    : baseRoleLabel
  const pays = user ? resolveProfilePays(user) : null
  const paysLabel = pays
    ? localizedCountryName(pays, locale, countryCodeFromName(pays))
    : null
  const flagUrl = pays ? flagCdnUrlForCountry(pays, 40) : null
  const userEmail = user?.email || (user?.username ? `${user.username}@cfao.com` : '')
  const isAdminOrSuper = user ? ['superadmin', 'build_team', 'group_admin', 'group_hr'].some(r => user.roles?.includes(r)) : false
  const isDpsRole = user ? (['dps', 'dop'].includes(primaryRole) || Boolean(user.roles?.some(r => ['dps', 'dop'].includes(r)))) : false

  return (
    <nav
      className={`nav${onHome ? ' nav--home' : ''}${onLogin ? ' nav--login' : ''}${onPortal ? ' nav--portal' : ''}${menuOpen ? ' nav--menu-open' : ''}`}
      aria-label={commonT.mainNavAria}
    >
      <div className="nav-shell">
        <Link to="/" className="brand nav-brand" style={{ textDecoration: 'none' }} onClick={brandClick}>
          <img src="/assets/logo-cfao-mobility.jpg" alt="cfao mobility" className="brand-mark" />
          <div className="brand-label">Academy<span>.</span></div>
        </Link>

        <button
          ref={toggleRef}
          type="button"
          className="nav-toggle"
          aria-expanded={menuOpen}
          aria-controls={mobileMenuId}
          aria-label={commonT.menuToggleAria}
          onClick={() => (menuOpen ? closeMenu() : openMenu())}
        >
          <span className="nav-toggle-bars" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>

        <NavLinkList variant="desktop" {...linkListProps} />

        <div className="nav-actions">
          <LocaleSwitch
            locale={locale}
            onChange={setLocale}
            ariaLabel={commonT.langSwitchAria}
            className="locale-switch--nav"
            portalMarker={onPortal}
          />

          {onPortal && user && notifications != null && (
            <PortalNotificationsBell t={portalT} alerts={notifications} />
          )}

          {onPortal && user && !isDpsRole && (
            <PortalHelpMenu
              t={portalT}
              hasTour={hasTour}
              onStartTour={startTour}
              navigate={navigate}
              pathname={pathname}
              portalSections={portalSections}
            />
          )}

          {onPortal && user && (
            <>
              <span className="nav-actions-sep nav-actions-sep--account" aria-hidden="true" />
              <Link to="/#actualites" className="nav-cta nav-cta--ghost nav-home-btn">
                {portalT.nav_home}
              </Link>
            </>
          )}

          {!onPortal && user && (
            <>
              <span className="nav-actions-sep" aria-hidden="true" />
              <Link to="/portail" className="nav-cta nav-cta--ghost nav-myspace-btn">
                {portalT.nav_my_space} →
              </Link>
            </>
          )}

          {user ? (
            <UserMenu user={user} onLogout={handleLogout} t={portalT} onPortal={onPortal} />
          ) : (
            <>
              <Link
                to="/login"
                className={`nav-cta${
                  onLogin ? ' nav-cta--primary' : onHome ? '' : ' nav-cta--ghost'
                }`}
                aria-current={onLogin ? 'page' : undefined}
              >
                {navT.signIn}
              </Link>
              <Link
                to="/contact"
                className={`nav-cta nav-cta--ghost nav-cta--contact${onHome || onLogin ? '' : ''}`}
              >
                {navT.contactUs}
              </Link>
            </>
          )}
        </div>
      </div>

      <div
        id={mobileMenuId}
        ref={panelRef}
        className="nav-mobile-panel"
        hidden={!menuOpen}
      >
        <button
          type="button"
          className="nav-mobile-backdrop"
          tabIndex={-1}
          aria-hidden="true"
          onClick={closeMenu}
        />
        <div className="nav-mobile-drawer">
          {user && (
            <div className="nav-mobile-user-card">
              <ProfileAvatar
                person={user}
                name={`${user.firstName} ${user.lastName}`}
                className="nav-mobile-user-avatar"
                imgClassName="nav-user-avatar-img"
              />
              <div className="nav-mobile-user-info">
                <span className="nav-mobile-user-name">{user.firstName} {user.lastName}</span>
                {userEmail && <span className="nav-mobile-user-email">{userEmail}</span>}
                <div className="nav-mobile-user-badges">
                  <span className="nav-user-dropdown-role">{roleLabel}</span>
                  {flagUrl && paysLabel ? (
                    <span className="nav-user-dropdown-pays">
                      <img
                        src={flagUrl}
                        alt=""
                        className="nav-user-dropdown-flag"
                        width={18}
                        height={13}
                      />
                      <span>{paysLabel}</span>
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          <NavLinkList
            variant="mobile"
            {...linkListProps}
            onItemActivate={closeMenu}
          />

          <div className="nav-mobile-foot">
            {onPortal && user && notifications != null && (
              <PortalNotificationsBell
                variant="mobile"
                t={portalT}
                alerts={notifications}
                onMenuAction={closeMenu}
              />
            )}
            {onPortal && user && !isDpsRole && (
              <PortalHelpMenu
                variant="mobile"
                t={portalT}
                hasTour={hasTour}
                onStartTour={() => { startTour(); closeMenu() }}
                navigate={navigate}
                pathname={pathname}
                portalSections={portalSections}
                onMenuAction={closeMenu}
              />
            )}
            {onPortal && user && (
              <Link to="/#actualites" className="nav-mobile-foot-link" onClick={closeMenu}>
                {portalT.nav_public_site || portalT.nav_home}
              </Link>
            )}
            {onPortal && user && (
              <Link to="/#offres" className="nav-mobile-foot-link" onClick={closeMenu}>
                {portalT.nav_training_catalog || 'Catalogue des formations'}
              </Link>
            )}
            {onPortal && user && (
              <Link to="/portail/assistance" className="nav-mobile-foot-link" onClick={closeMenu}>
                {portalT.nav_tech_assistance || 'Assistance technique'}
              </Link>
            )}
            {onPortal && user && isAdminOrSuper && (
              <Link to="/portail/delivery" className="nav-mobile-foot-link" onClick={closeMenu}>
                {portalT.nav_delivery_cockpit || 'Cockpit Projets & Delivery'}
              </Link>
            )}
            {!onPortal && user && (
              <Link to="/portail" className="nav-mobile-foot-link" onClick={closeMenu}>
                {portalT.nav_my_space} →
              </Link>
            )}
            {user && (
              <button
                type="button"
                className="nav-mobile-foot-link nav-mobile-logout"
                onClick={handleLogout}
              >
                <LogOutIcon size={16} />
                <span>{portalT.nav_logout || 'Se déconnecter'}</span>
              </button>
            )}
            {!user && (
              <>
                <Link to="/login" className="nav-mobile-foot-link" onClick={closeMenu}>
                  {navT.signIn}
                </Link>
                <Link to="/contact" className="nav-mobile-foot-link" onClick={closeMenu}>
                  {navT.contactUs}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
