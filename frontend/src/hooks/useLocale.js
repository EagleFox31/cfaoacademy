import { getCopy } from '../i18n/index.js'
import { useLocaleContext } from '../context/LocaleProvider.jsx'

export default function useLocale(section) {
  const { locale, setLocale } = useLocaleContext()
  return {
    locale,
    setLocale,
    t: getCopy(section, locale),
  }
}
