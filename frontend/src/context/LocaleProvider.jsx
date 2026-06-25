import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { DEFAULT_LOCALE, LOCALES } from '../i18n/index.js'

const LS_KEY = 'cfao_locale_v1'
const LS_KEY_LEGACY = 'cfao_login_locale_v1'

const LocaleContext = createContext(null)

function readStoredLocale() {
  try {
    for (const key of [LS_KEY, LS_KEY_LEGACY]) {
      const stored = localStorage.getItem(key)
      if (LOCALES.includes(stored)) return stored
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE
}

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(readStoredLocale)

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback((next) => {
    if (!LOCALES.includes(next)) return
    setLocaleState(next)
    try {
      localStorage.setItem(LS_KEY, next)
    } catch {
      /* ignore */
    }
  }, [])

  const value = useMemo(
    () => ({ locale, setLocale }),
    [locale, setLocale],
  )

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocaleContext() {
  const ctx = useContext(LocaleContext)
  if (!ctx) {
    throw new Error('useLocaleContext must be used within LocaleProvider')
  }
  return ctx
}
