import { LOCALES } from '../i18n/index.js'
import { flagCdnUrl } from '../utils/sessionLieuFlag.js'

const LOCALE_META = {
  fr: { flag: 'fr', label: 'Français' },
  en: { flag: 'gb', label: 'English' },
  pt: { flag: 'pt', label: 'Português' },
}

export default function LocaleSwitch({ locale, onChange, ariaLabel, className = '' }) {
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
            <img
              className="locale-switch-flag"
              src={flagCdnUrl(meta.flag, 40)}
              srcSet={`${flagCdnUrl(meta.flag, 80)} 2x`}
              alt=""
              width={22}
              height={16}
              loading="lazy"
              decoding="async"
            />
          </button>
        )
      })}
    </div>
  )
}
