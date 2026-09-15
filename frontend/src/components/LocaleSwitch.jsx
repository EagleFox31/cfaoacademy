import { useEffect, useRef, useState } from 'react'
import { LOCALES } from '../i18n/index.js'
import { flagCdnUrl } from '../utils/sessionLieuFlag.js'
import { ChevronIcon } from './portalSectionIcons.jsx'

const LOCALE_META = {
  fr: { flag: 'fr', label: 'Français' },
  en: { flag: 'gb', label: 'English' },
  pt: { flag: 'pt', label: 'Português' },
}

function Flag({ flag }) {
  return (
    <img
      className="locale-switch-flag"
      src={flagCdnUrl(flag, 40)}
      srcSet={`${flagCdnUrl(flag, 80)} 2x`}
      alt=""
      width={22}
      height={16}
      loading="lazy"
      decoding="async"
    />
  )
}

/* Mode portail : un seul drapeau (langue active) + menu déroulant — allège le cluster nav */
function CollapsedLocaleSwitch({ locale, onChange, ariaLabel, className }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const active = LOCALE_META[locale] ?? LOCALE_META[LOCALES[0]]

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
    <div
      className={`locale-switch locale-switch--collapsed${className ? ` ${className}` : ''}`}
      ref={ref}
      data-portal-locale=""
    >
      <button
        type="button"
        className="locale-switch-current"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        title={active.label}
      >
        <Flag flag={active.flag} />
        <ChevronIcon open={open} className="locale-switch-caret" />
      </button>

      {open && (
        <div className="locale-switch-menu" role="menu">
          {LOCALES.map((code) => {
            const meta = LOCALE_META[code]
            if (!meta) return null
            return (
              <button
                key={code}
                type="button"
                role="menuitemradio"
                aria-checked={locale === code}
                className={`locale-switch-option${locale === code ? ' is-active' : ''}`}
                onClick={() => { onChange(code); setOpen(false) }}
              >
                <Flag flag={meta.flag} />
                <span>{meta.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function LocaleSwitch({ locale, onChange, ariaLabel, className = '', portalMarker = false }) {
  if (portalMarker) {
    return (
      <CollapsedLocaleSwitch
        locale={locale}
        onChange={onChange}
        ariaLabel={ariaLabel}
        className={className}
      />
    )
  }

  return (
    <div
      className={`locale-switch${className ? ` ${className}` : ''}`}
      role="group"
      aria-label={ariaLabel}
    >
      {LOCALES.map((code) => {
        const meta = LOCALE_META[code]
        if (!meta) return null
        return (
          <button
            key={code}
            type="button"
            className={`locale-switch-btn${locale === code ? ' is-active' : ''}`}
            onClick={() => onChange(code)}
            aria-pressed={locale === code}
            aria-label={meta.label}
            title={meta.label}
          >
            <Flag flag={meta.flag} />
          </button>
        )
      })}
    </div>
  )
}
