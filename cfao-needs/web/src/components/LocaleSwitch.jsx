import { useEffect, useRef, useState } from 'react'

const LOCALE_META = {
  fr: { flag: 'fr', label: 'Français' },
  en: { flag: 'gb', label: 'English' },
  pt: { flag: 'pt', label: 'Português' },
}

function Flag({ flag }) {
  return (
    <img
      className="locale-switch-flag"
      src={`https://flagcdn.com/w40/${flag}.png`}
      srcSet={`https://flagcdn.com/w80/${flag}.png 2x`}
      alt=""
      width={22}
      height={15}
      loading="lazy"
      decoding="async"
    />
  )
}

export default function LocaleSwitch({
  locale,
  onChange,
  available = ['fr', 'en'],
  ariaLabel = 'Changer de langue',
  className = '',
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const active = LOCALE_META[locale] ?? LOCALE_META.fr

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
    <div className={`locale-switch locale-switch--collapsed${className ? ` ${className}` : ''}`} ref={ref}>
      <button
        type="button"
        className="locale-switch-current"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        title={active.label}
      >
        <Flag flag={active.flag} />
        <span className="locale-switch-caret" aria-hidden="true">
          {open ? '▴' : '▾'}
        </span>
      </button>

      {open && (
        <div className="locale-switch-menu" role="menu">
          {available.map((code) => {
            const meta = LOCALE_META[code]
            if (!meta) return null
            return (
              <button
                key={code}
                type="button"
                role="menuitemradio"
                aria-checked={locale === code}
                className={`locale-switch-option${locale === code ? ' is-active' : ''}`}
                onClick={() => {
                  onChange(code)
                  setOpen(false)
                }}
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
