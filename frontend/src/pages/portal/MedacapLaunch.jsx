import { useEffect, useMemo } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import PortalLoader from '../../components/PortalLoader.jsx'
import useLocale from '../../hooks/useLocale.js'
import { isAllowedMedacapLaunchUrl } from '../../utils/launchMedacapExternal.js'

/** Pont : loader dans l’onglet courant, puis redirection vers MEDACAP (pas de login CFAO ici). */
export default function MedacapLaunch() {
  const [params] = useSearchParams()
  const target = params.get('to')
  const { t } = useLocale('portal')
  const allowed = Boolean(target && isAllowedMedacapLaunchUrl(target))

  const messages = useMemo(
    () => [
      t.dps_medacap_open_loading_1,
      t.dps_medacap_open_loading_2,
      t.dps_medacap_open_loading_3,
    ],
    [t],
  )

  useEffect(() => {
    if (!allowed) return undefined
    window.location.replace(target)
    return undefined
  }, [allowed, target])

  if (!allowed) {
    return <Navigate to="/portail" replace />
  }

  return (
    <PortalLoader
      messages={messages}
      ariaLabel={t.dps_medacap_open_loading_aria}
    />
  )
}
