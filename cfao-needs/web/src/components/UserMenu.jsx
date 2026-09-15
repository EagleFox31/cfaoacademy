import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { isReviewer, logout } from '../lib/auth'

/** Drapeaux ISO par pays */
const COUNTRY_FLAGS = {
  cm: { flag: 'cm', label: 'Cameroun' },
  ci: { flag: 'ci', label: "Côte d'Ivoire" },
  sn: { flag: 'sn', label: 'Sénégal' },
  ga: { flag: 'ga', label: 'Gabon' },
  mg: { flag: 'mg', label: 'Madagascar' },
  ng: { flag: 'ng', label: 'Nigeria' },
  gh: { flag: 'gh', label: 'Ghana' },
  cd: { flag: 'cd', label: 'RDC' },
  bj: { flag: 'bj', label: 'Bénin' },
  tg: { flag: 'tg', label: 'Togo' },
}

export default function UserMenu({ session }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  const claims = session?.claims || {}
  const fullName = claims.name || claims.preferred_username || 'Chef d\'atelier Douala'
  const firstName = claims.given_name || fullName.split(' ')[0] || 'Utilisateur'
  const email = claims.email || ''
  
  const reviewer = isReviewer(session)
  const roleLabel = reviewer
    ? 'Reviewer Academy'
    : claims.role || 'Chef d\'atelier'

  // Détection / fallback pays
  const countryCode = (claims.country || 'cm').toLowerCase()
  const countryMeta = COUNTRY_FLAGS[countryCode] || COUNTRY_FLAGS.cm

  const parts = fullName.trim().split(/\s+/)
  const initials = parts.length > 1
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : fullName.slice(0, 2).toUpperCase()

  useEffect(() => {
    if (!open) return undefined
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="nav-user-menu" ref={ref}>
      <button
        type="button"
        className="nav-user-btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        title={email || fullName}
      >
        <span className="nav-user-avatar">{initials}</span>
        <span className="nav-user-name">{firstName}</span>
        <span className="nav-user-chevron" aria-hidden="true">
          {open ? '▴' : '▾'}
        </span>
      </button>

      {open && (
        <div className="nav-user-dropdown" role="menu">
          <div className="nav-user-dropdown-head">
            <span className="nav-user-dropdown-name">{fullName}</span>
            <div className="nav-user-dropdown-meta">
              <span className="nav-user-dropdown-role">{roleLabel}</span>
              {countryMeta && (
                <span className="nav-user-dropdown-pays">
                  <img
                    src={`https://flagcdn.com/w40/${countryMeta.flag}.png`}
                    srcSet={`https://flagcdn.com/w80/${countryMeta.flag}.png 2x`}
                    alt=""
                    className="nav-user-dropdown-flag"
                    width={20}
                    height={15}
                    loading="lazy"
                    decoding="async"
                  />
                  <span>{countryMeta.label}</span>
                </span>
              )}
            </div>
          </div>



          <button
            type="button"
            className="nav-user-dropdown-item"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              navigate('/profil')
            }}
          >
            Mon profil
          </button>

          <button
            type="button"
            className="nav-user-dropdown-item nav-user-dropdown-logout"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              logout()
            }}
          >
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  )
}
