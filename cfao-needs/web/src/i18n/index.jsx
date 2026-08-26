/**
 * i18n — bilingue dès le départ, jamais de chaîne en dur dans le JSX.
 *
 * La langue suit la personne, pas sa filiale : elle vient du profil (claim
 * `locale`), avec le choix manuel qui prend le pas. C'est la correction de ce qui
 * a coûté six PR correctives à Academix (docs/AUDIT_ACADEMIX.md F19).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import en from './en.json'
import fr from './fr.json'

const CATALOGS = { fr, en }
const STORAGE_KEY = 'needs.locale'

const LocaleContext = createContext(null)

function detect(profileLocale) {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored && CATALOGS[stored]) return stored
  } catch {
    /* navigation privée : on retombe sur la suite */
  }
  if (profileLocale && CATALOGS[profileLocale]) return profileLocale
  const nav = (navigator.language || 'fr').slice(0, 2)
  return CATALOGS[nav] ? nav : 'fr'
}

export function LocaleProvider({ children, profileLocale }) {
  const [locale, setLocaleState] = useState(() => detect(profileLocale))

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback((next) => {
    if (!CATALOGS[next]) return
    setLocaleState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* préférence non persistée : sans conséquence */
    }
  }, [])

  const t = useCallback(
    (key, vars) => {
      const template = CATALOGS[locale][key] ?? CATALOGS.fr[key] ?? key
      if (!vars) return template
      return template.replace(/\{(\w+)\}/g, (match, name) =>
        vars[name] === undefined || vars[name] === null ? match : String(vars[name]),
      )
    },
    [locale],
  )

  const value = useMemo(
    () => ({ locale, setLocale, t, available: Object.keys(CATALOGS) }),
    [locale, setLocale, t],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale doit être utilisé dans un LocaleProvider')
  return ctx
}

/** Formatage des dates dans la locale courante — jamais de date brute à l'écran. */
export function useFormatters() {
  const { locale } = useLocale()
  return useMemo(
    () => ({
      date: (value) =>
        value
          ? new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(value))
          : '—',
      dateTime: (value) =>
        value
          ? new Intl.DateTimeFormat(locale, {
              dateStyle: 'medium',
              timeStyle: 'short',
            }).format(new Date(value))
          : '—',
      number: (value) => new Intl.NumberFormat(locale).format(value ?? 0),
    }),
    [locale],
  )
}
