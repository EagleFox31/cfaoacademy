import { useMemo, useRef, useState, useEffect } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import Nav from '../../components/Nav'
import Footer from '../../components/Footer'
import PortalDemoBar from '../../components/PortalDemoBar'
import PortalLoader from '../../components/PortalLoader.jsx'
import DpsTechnicianPifDetailView from './DpsTechnicianPifDetailView.jsx'
import useSiteEffects from '../../hooks/useSiteEffects'
import usePortalReveal from '../../hooks/usePortalReveal'
import useAuth from '../../hooks/useAuth'
import useLocale from '../../hooks/useLocale'
import usePortalBackground from '../../hooks/usePortalBackground'
import useDpsFilialeScope from '../../hooks/useDpsFilialeScope.js'
import useKiFilialeScope from '../../hooks/useKiFilialeScope.js'
import useBrandDetailEntrance, { animateBrandDetailExit } from '../../hooks/useBrandDetailEntrance.js'
import { LMS_BY_USER } from '../../data/mock_lms'
import { findDpsFilialeTechnician } from '../../medacap/index.js'
import { resolvePortalFilialeDetailAccess } from '../../utils/portalFilialeDetailAccess.js'

export default function DpsTechnicianPifDetail() {
  useSiteEffects()
  usePortalReveal()
  const { user, status } = useAuth()
  usePortalBackground(user)
  const { technicianId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useLocale('portal')
  const shellRef = useRef(null)
  const closingRef = useRef(false)
  const [isClosing, setIsClosing] = useState(false)
  const originRect = location.state?.originRect ?? null

  const access = resolvePortalFilialeDetailAccess(user?.roles, {
    dpsHash: 'pif',
    kiHash: 'toyota-pif',
  })
  const mockLms = LMS_BY_USER[user?.demoKey]
  /* Les deux hooks sont appelés (règles React) ; un seul scope est consommé. */
  const { lms: dpsLms, scopeLoading: dpsScopeLoading } = useDpsFilialeScope(
    access.isKi ? null : user,
    access.isKi ? null : mockLms,
  )
  const { filialeLms: kiLms, scopeLoading: kiScopeLoading } = useKiFilialeScope(
    access.isKi ? user : null,
  )
  const lms = access.isKi ? kiLms : dpsLms
  const scopeLoading = access.isKi ? kiScopeLoading : dpsScopeLoading

  const technician = useMemo(
    () => (lms ? findDpsFilialeTechnician(lms, technicianId) : null),
    [lms, technicianId],
  )

  const ready = Boolean(lms && technician)
  const listHash = access.backHash

  useBrandDetailEntrance(shellRef, originRect, ready)

  useEffect(() => {
    document.body.classList.add('portal-bg-define-tech')
    return () => document.body.classList.remove('portal-bg-define-tech')
  }, [])

  if (status === "loading") return null
  if (!user) return <Navigate to="/login" replace />
  if (!access.allowed) return <Navigate to="/portail" replace />
  /* Scope chargé mais technicien introuvable → retour liste (évite un loader infini). */
  if (!scopeLoading && lms && !technician) {
    return <Navigate to={`/portail#${listHash}`} replace />
  }
  if (!scopeLoading && !lms) {
    return <Navigate to={`/portail#${listHash}`} replace />
  }
  const showLoader = !ready
  const loaderMessages = [
    t.dps_pif_open_loading_1,
    t.dps_pif_open_loading_2,
    t.dps_pif_open_loading_3,
  ]

  async function handleBack() {
    if (closingRef.current) return
    closingRef.current = true
    setIsClosing(true)
    await animateBrandDetailExit(shellRef.current, originRect)
    navigate(`/portail#${listHash}`)
  }

  return (
    <>
      {showLoader ? (
        <PortalLoader
          messages={loaderMessages}
          ariaLabel={t.dps_pif_open_loading_aria}
        />
      ) : null}
      {ready ? (
        <>
      <Nav notifications={lms.alerts ?? []} />
      <main
        className={[
          'portal-page',
          'portal-define-tech-page',
          isClosing && 'portal-brand-detail-page--closing',
        ].filter(Boolean).join(' ')}
      >
        <DpsTechnicianPifDetailView
          shellRef={shellRef}
          lms={lms}
          technicianKey={technicianId}
          t={t}
          onBack={handleBack}
          showTeamgpElearning={access.isKi}
        />
      </main>
      <Footer />
      <PortalDemoBar />
        </>
      ) : null}
    </>
  )
}
