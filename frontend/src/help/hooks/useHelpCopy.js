import useLocale from '../../hooks/useLocale.js'
import { getHelpCopy } from '../i18n.js'

/** Copy aide sans exiger HelpProvider. */
export function useHelpCopy() {
  const { locale } = useLocale()
  return getHelpCopy(locale)
}
