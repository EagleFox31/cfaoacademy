import { useCallback, useEffect, useMemo, useState, useRef, useId } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import useNavScrollSpy from '../../hooks/useNavScrollSpy.js'
import { useAuth } from '../../lib/auth'
import { sessionsDuFormateur } from '../../data/mock_sessions_formateur'
import { sessionsAVenir } from '../../utils/planningFormateur.js'
import { scrollToPortalSection } from '../../utils/portalScroll.js'

// Adresse du portail, quand le module en est un satellite : le bouton
// « Retour au site » n'existe que si elle est renseignée.
const PORTAIL_URL = import.meta.env.VITE_PORTAIL_URL

/** Sections du menu formateur ; « Priorités » et « sessions » n'existent que si elles ont du contenu. */
const SECTIONS_FORMATEUR = [
  { key: 'a-documenter', id: 'a-documenter', libelle: 'Priorités' },
  { key: 'comptes-rendus', id: 'comptes-rendus', libelle: 'Vos comptes rendus' },
  { key: 'sessions-a-venir', id: 'sessions-a-venir', libelle: 'Vos sessions de formation' },
]

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

function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
  const superadmin = (user.roles ?? []).includes('superadmin')

  return (
    <div className="nav-user-menu" ref={ref}>
      <button
        type="button"
        className="nav-user-btn"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className="nav-user-avatar">{initials}</span>
        <span className="nav-user-name">{user.firstName}</span>
        <span className="nav-user-chevron" aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="nav-user-dropdown" role="menu">
          <div className="nav-user-dropdown-head">
            <span className="nav-user-dropdown-name">{user.firstName} {user.lastName}</span>
            <span className="nav-user-dropdown-filiale">{user.filiale || (superadmin ? 'Super Admin' : 'Formateur')}</span>
          </div>
          {superadmin && (
            <Link
              to="/portail/journal-erreurs"
              className="nav-user-dropdown-item"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <span>Journal des erreurs</span>
              <span className="nav-user-dropdown-arrow">→</span>
            </Link>
          )}
          <button
            type="button"
            className="nav-user-dropdown-item nav-user-dropdown-logout"
            role="menuitem"
            onClick={() => { setOpen(false); onLogout() }}
          >
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  )
}

function NavLinkList({ variant, portalSections, isActive, handlePortalNavClick, onItemActivate }) {
  const listClass = variant === 'mobile' ? 'nav-mobile-links' : 'nav-links'
  const itemClass = (active) => {
    if (variant === 'mobile') return `nav-mobile-link${active ? ' active' : ''}`
    return active ? 'active' : ''
  }

  return (
    <ul className={listClass}>
      {portalSections.map((s) => (
        <li key={s.key}>
          <a
            href={`#${s.id}`}
            className={itemClass(isActive(s))}
            onClick={(e) => {
              handlePortalNavClick(s)(e)
              onItemActivate?.()
            }}
          >
            {s.libelle}
          </a>
        </li>
      ))}
    </ul>
  )
}

/**
 * La barre du haut, au rendu de celle du portail.
 *
 * Connecté : mode portail formateur (sections de l'accueil, menu du compte).
 * Sur la connexion : mode « non connecté », sans lien vers d'autres pages.
 */
export default function Nav({ sansPriorites = false }) {
  const { pathname, hash } = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const onHome = pathname === '/'
  const onLogin = pathname === '/connexion'
  const onPortal = Boolean(user) && !onLogin

  const [menuOpen, setMenuOpen] = useState(false)
  const toggleRef = useRef(null)
  const panelRef = useRef(null)
  const menuInstanceId = useId()
  const mobileMenuId = `nav-mobile-menu${menuInstanceId}`

  const portalSections = useMemo(() => {
    if (!onPortal) return []
    const aVenir = sessionsAVenir(sessionsDuFormateur(user)).length > 0
    return SECTIONS_FORMATEUR.filter(s => (aVenir || s.key !== 'sessions-a-venir')
      && !(sansPriorites && s.key === 'a-documenter'))
  }, [onPortal, user, sansPriorites])

  // Le suivi de défilement n'a de sens que sur l'accueil, où sont les sections.
  const spyEnabled = onPortal && onHome
  const { activeKey: scrollActive, setActiveKey, refresh } = useNavScrollSpy(spyEnabled, portalSections)

  const closeMenu = useCallback(() => {
    setMenuOpen(false)
  }, [])

  const openMenu = useCallback(() => {
    setMenuOpen(true)
  }, [])

  function handleLogout() {
    logout()
    navigate('/connexion', { replace: true })
    closeMenu()
  }

  const handlePortalNavClick = (section) => (e) => {
    e.preventDefault()
    // Depuis une autre page : retour à l'accueil, qui défile jusqu'à l'ancre.
    if (!onHome) {
      navigate({ pathname: '/', hash: `#${section.id}` })
      return
    }
    setActiveKey(section.key)
    scrollToSection(section.id)
    window.history.pushState(null, '', `#${section.id}`)
    window.setTimeout(refresh, 600)
  }

  useEffect(() => {
    if (!spyEnabled) return undefined
    const hashId = hash?.replace(/^#/, '')
    let defilement
    if (hashId) {
      const match = portalSections.find(s => s.id === hashId)
      if (match) {
        setActiveKey(match.key)
        // Arrivée par un lien d'ancre depuis une autre page : la page vient
        // de se monter, on attend qu'elle ait pris sa place.
        defilement = window.setTimeout(() => scrollToSection(match.id), 450)
      }
    }
    const timers = [100, 450, 1000].map(ms => window.setTimeout(refresh, ms))
    return () => {
      timers.forEach(clearTimeout)
      window.clearTimeout(defilement)
    }
  }, [hash, spyEnabled, refresh, portalSections, setActiveKey])

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

  const isActive = (item) => onHome && scrollActive === item.key

  const brandClick = onHome && onPortal
    ? (e) => {
        e.preventDefault()
        setActiveKey(null)
        scrollToSection('')
        window.history.pushState(null, '', '/')
        closeMenu()
      }
    : undefined

  const linkListProps = {
    portalSections,
    isActive,
    handlePortalNavClick,
  }

  return (
    <nav
      className={`nav${onLogin ? ' nav--login' : ''}${onPortal ? ' nav--portal' : ''}${menuOpen ? ' nav--menu-open' : ''}`}
      aria-label="Navigation principale"
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
          aria-label="Menu"
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
          {onPortal && PORTAIL_URL && (
            <a href={PORTAIL_URL} className="nav-cta nav-cta--ghost nav-home-btn">
              ← Retour au site
            </a>
          )}

          {onPortal ? (
            <UserMenu user={user} onLogout={handleLogout} />
          ) : (
            <Link
              to="/connexion"
              className={`nav-cta${onLogin ? ' nav-cta--primary' : ' nav-cta--ghost'}`}
              aria-current={onLogin ? 'page' : undefined}
            >
              Se connecter
            </Link>
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
          <NavLinkList
            variant="mobile"
            {...linkListProps}
            onItemActivate={closeMenu}
          />

          <div className="nav-mobile-foot">
            {onPortal && PORTAIL_URL && (
              <a href={PORTAIL_URL} className="nav-mobile-foot-link" onClick={closeMenu}>
                ← Retour au site
              </a>
            )}
            {!onPortal && (
              <Link to="/connexion" className="nav-mobile-foot-link" onClick={closeMenu}>
                Se connecter
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
