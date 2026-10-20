import { useMemo, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import Nav from '../../components/Nav'
import Footer from '../../components/Footer'
import PortalDemoBar from '../../components/PortalDemoBar'
import DpsBrandCompetencyDetailView from '../../components/DpsBrandCompetencyDetailView.jsx'
import useSiteEffects from '../../hooks/useSiteEffects'
import usePortalReveal from '../../hooks/usePortalReveal'
import useAuth from '../../hooks/useAuth'
import useLocale from '../../hooks/useLocale'
import usePortalBackground from '../../hooks/usePortalBackground'
import useDpsFilialeScope from '../../hooks/useDpsFilialeScope.js'
import useKiFilialeScope from '../../hooks/useKiFilialeScope.js'
import useBrandDetailEntrance, { animateBrandDetailExit } from '../../hooks/useBrandDetailEntrance.js'
import { LMS_BY_USER } from '../../data/mock_lms'
import { resolveTeamBrands } from '../../utils/teamBrands.js'
import { resolveKiDisplayUser } from '../../utils/kiScope.js'
import { resolvePortalFilialeDetailAccess } from '../../utils/portalFilialeDetailAccess.js'

export default function DpsBrandCompetencyDetail() {
  useSiteEffects()
  usePortalReveal()
  const { user, status } = useAuth()
  usePortalBackground(user)
  const { brandId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useLocale('portal')
  const shellRef = useRef(null)
  const closingRef = useRef(false)
  const [isClosing, setIsClosing] = useState(false)
  const originRect = location.state?.originRect ?? null

  const access = resolvePortalFilialeDetailAccess(user?.roles, {
    dpsHash: 'resultats',
    kiHash: 'toyota-resultats',
  })
  const mockLms = LMS_BY_USER[user?.demoKey]
  const { lms: dpsLms, scopeLoading: dpsScopeLoading } = useDpsFilialeScope(
    access.isKi ? null : user,
    access.isKi ? null : mockLms,
  )
  const { filialeLms: kiLms, scopeLoading: kiScopeLoading } = useKiFilialeScope(
    access.isKi ? user : null,
  )
  const lms = access.isKi ? kiLms : dpsLms
  const scopeLoading = access.isKi ? kiScopeLoading : dpsScopeLoading

  const displayUser = useMemo(
    () => (access.isKi ? resolveKiDisplayUser(user, lms) : user),
    [access.isKi, user, lms],
  )

  const brandItem = useMemo(() => {
    if (brandId === 'toutes-marques') {
      return {
        id: 'toutes-marques',
        label: t.dps_results_brand_all_brands || 'Toutes marques',
        logo: null,
        isAllBrands: true,
      }
    }
    const items = resolveTeamBrands(displayUser?.brands ?? [])
    return items.find(item => item.id === brandId) ?? null
  }, [displayUser?.brands, brandId, t.dps_results_brand_all_brands])

  const ready = Boolean(lms && brandItem)
  const listHash = access.backHash

  useBrandDetailEntrance(shellRef, originRect, ready)

  if (status === "loading") return null
  if (!user) return <Navigate to="/login" replace />
  if (!access.allowed) return <Navigate to="/portail" replace />
  if (!scopeLoading && lms && !brandItem) {
    return <Navigate to={`/portail#${listHash}`} replace />
  }
  if (!scopeLoading && !lms) {
    return <Navigate to={`/portail#${listHash}`} replace />
  }
  if (!ready) return null

  async function handleBack() {
    if (closingRef.current) return
    closingRef.current = true
    setIsClosing(true)
    await animateBrandDetailExit(shellRef.current, originRect)
    navigate(`/portail#${listHash}`)
  }

  return (
    <>
      <Nav notifications={lms.alerts ?? []} />
      <main
        className={[
          'article-page',
          'portal-brand-detail-page',
          isClosing && 'portal-brand-detail-page--closing',
        ].filter(Boolean).join(' ')}
      >
        <DpsBrandCompetencyDetailView
          shellRef={shellRef}
          brandItem={brandItem}
          lms={lms}
          t={t}
          onBack={handleBack}
          tierNomenclature={access.isKi ? 'toyota' : 'medacap'}
        />
      </main>
      <Footer />
      <PortalDemoBar />
    </>
  )
}
