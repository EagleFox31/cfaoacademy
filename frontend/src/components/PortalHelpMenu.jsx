import { useEffect, useRef, useState } from 'react'
import { ChevronIcon, GuideTourIcon, HelpBookIcon, HelpCircleIcon, LifeBuoyIcon } from './portalSectionIcons.jsx'
import { goToPortalQuestion, portalHasAssistance } from '../utils/portalHelp.js'
import { useHelpOptional } from '../help/context/HelpProvider.jsx'
import useLocale from '../hooks/useLocale.js'
import { getHelpCopy } from '../help/i18n.js'

export default function PortalHelpMenu({
  t,
  hasTour,
  onStartTour,
  navigate,
  pathname,
  portalSections,
  onMenuAction,
  variant = 'desktop',
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const hasAssistance = portalHasAssistance(portalSections)
  const help = useHelpOptional()
  const { locale } = useLocale()
  const helpUi = getHelpCopy(locale)

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

  function close() {
    setOpen(false)
    onMenuAction?.()
  }

function handleStartTour() {
    close()
    const onDashboard = pathname === '/portail' || pathname === '/portail/'
    if (!onDashboard) {
      navigate('/portail')
      window.setTimeout(() => onStartTour?.(), 600)
      return
    }
    onStartTour?.()
  }

  function handleQuestion() {
    close()
    goToPortalQuestion({ navigate, pathname, portalSections })
  }

  function handleHelpCenter() {
    close()
    help?.openHelp()
  }

  const centerItem = help ? (
    <button
      type="button"
      className="nav-help-dropdown-item"
      role="menuitem"
      onClick={handleHelpCenter}
    >
      <span className="nav-help-dropdown-icon nav-help-dropdown-icon--center" aria-hidden="true">
        <HelpBookIcon size={18} strokeWidth={2.2} />
      </span>
      <span className="nav-help-dropdown-copy">
        <span className="nav-help-dropdown-title">{helpUi.nav_help_center_title}</span>
        <span className="nav-help-dropdown-desc">{helpUi.nav_help_center_desc}</span>
      </span>
    </button>
  ) : null

  if (variant === 'mobile') {
    return (
      <div className="nav-mobile-foot-help-group">
        <p className="nav-mobile-foot-help-title">{t.nav_help}</p>
        {centerItem ? (
          <button
            type="button"
            className="nav-mobile-foot-link nav-mobile-foot-help"
            onClick={handleHelpCenter}
          >
            <span className="nav-mobile-foot-help-icon" aria-hidden="true">
              <HelpBookIcon size={16} strokeWidth={2.2} />
            </span>
            {helpUi.nav_help_center_title}
          </button>
        ) : null}
        {hasTour ? (
          <button
            type="button"
            className="nav-mobile-foot-link nav-mobile-foot-help"
            data-portal-help
            onClick={handleStartTour}
          >
            <span className="nav-mobile-foot-help-icon" aria-hidden="true">
              <GuideTourIcon size={16} strokeWidth={2.2} />
            </span>
            {t.nav_help_tour_title}
          </button>
        ) : null}
        <button
          type="button"
          className="nav-mobile-foot-link nav-mobile-foot-help"
          onClick={handleQuestion}
        >
          <span className="nav-mobile-foot-help-icon nav-mobile-foot-help-icon--question" aria-hidden="true">
            <LifeBuoyIcon size={16} strokeWidth={2.2} />
          </span>
          {t.nav_help_question_title}
        </button>
      </div>
    )
  }

  const questionDesc = hasAssistance
    ? t.nav_help_question_desc_assistance
    : t.nav_help_question_desc_contact

  return (
    <div className="nav-help-menu" ref={ref}>
      <button
        type="button"
        className={`nav-help-btn${open ? ' is-open' : ''}`}
        data-portal-help
        aria-label={t.nav_help_aria}
        aria-expanded={open}
        aria-haspopup="menu"
        title={t.nav_help}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="nav-help-btn-icon" aria-hidden="true">
          <HelpCircleIcon size={15} strokeWidth={2.2} />
        </span>
        <span className="nav-help-btn-label">{t.nav_help}</span>
        <ChevronIcon open={open} className="nav-help-btn-chevron" />
      </button>

      {open ? (
        <div className="nav-help-dropdown" role="menu">
          <p className="nav-help-dropdown-head">{t.nav_help_menu_title}</p>
          {centerItem}
          {hasTour ? (
            <button
              type="button"
              className="nav-help-dropdown-item"
              role="menuitem"
              onClick={handleStartTour}
            >
              <span className="nav-help-dropdown-icon nav-help-dropdown-icon--tour" aria-hidden="true">
                <GuideTourIcon size={18} strokeWidth={2.2} />
              </span>
              <span className="nav-help-dropdown-copy">
                <span className="nav-help-dropdown-title">{t.nav_help_tour_title}</span>
                <span className="nav-help-dropdown-desc">{t.nav_help_tour_desc}</span>
              </span>
            </button>
          ) : null}
          <button
            type="button"
            className="nav-help-dropdown-item"
            role="menuitem"
            onClick={handleQuestion}
          >
            <span className="nav-help-dropdown-icon nav-help-dropdown-icon--question" aria-hidden="true">
              <LifeBuoyIcon size={18} strokeWidth={2.2} />
            </span>
            <span className="nav-help-dropdown-copy">
              <span className="nav-help-dropdown-title">{t.nav_help_question_title}</span>
              <span className="nav-help-dropdown-desc">{questionDesc}</span>
            </span>
          </button>
        </div>
      ) : null}
    </div>
  )
}
