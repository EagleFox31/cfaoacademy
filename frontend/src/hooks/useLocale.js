import { getCopy } from '../i18n/index.js'
import { useLocaleContext } from '../context/localeContext.js'

export default function useLocale(section) {
  const { locale, setLocale } = useLocaleContext()
  return {
    locale,
    setLocale,
    t: getCopy(section, locale),
  }
}
