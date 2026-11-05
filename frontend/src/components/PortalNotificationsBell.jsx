import { useEffect, useRef, useState } from 'react'
import { BellIcon } from './portalSectionIcons.jsx'

export default function PortalNotificationsBell({ alerts = [], t, onMenuAction, variant = 'desktop' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const count = alerts.length

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

  if (variant === 'mobile') {
    return (
      <div className="nav-mobile-foot-notif-group">
        <p className="nav-mobile-foot-help-title">{t.notifications_title}</p>
        {count === 0 ? (
          <p className="nav-mobile-foot-notif-empty">{t.notifications_empty}</p>
        ) : (
          <ul className="nav-mobile-foot-notif-list">
            {alerts.map(alert => (
              <li key={alert.id} className="nav-notif-item">
                <span className="nav-notif-item-label">{alert.label}</span>
                <span className="nav-notif-item-text">{alert.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <div className="nav-notif-menu" ref={ref}>
      <button
        type="button"
        className={`nav-notif-btn${open ? ' is-open' : ''}`}
        data-portal-notifications
        aria-label={
          count > 0
            ? (t.notifications_aria_unread ?? t.notifications_aria).replace('{n}', String(count))
            : t.notifications_aria
        }
        aria-expanded={open}
        aria-haspopup="menu"
        title={t.notifications_title}
        onClick={() => setOpen(v => !v)}
      >
        <span className="nav-notif-btn-icon" aria-hidden="true">
          <BellIcon size={16} strokeWidth={2.2} />
        </span>
        {count > 0 ? (
          <span className="nav-notif-badge" aria-hidden="true">
            {count > 9 ? '9+' : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="nav-notif-dropdown" role="menu">
          <p className="nav-notif-dropdown-head">{t.notifications_title}</p>
          {count === 0 ? (
            <p className="nav-notif-dropdown-empty">{t.notifications_empty}</p>
          ) : (
            <ul className="nav-notif-dropdown-list">
              {alerts.map(alert => (
                <li key={alert.id} className="nav-notif-item" role="menuitem">
                  <span className="nav-notif-item-label">{alert.label}</span>
                  <span className="nav-notif-item-text">{alert.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
