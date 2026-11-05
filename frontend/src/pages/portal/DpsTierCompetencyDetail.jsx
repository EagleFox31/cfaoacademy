import { useMemo, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import Nav from '../../components/Nav'
import Footer from '../../components/Footer'
import PortalDemoBar from '../../components/PortalDemoBar'
import DpsTierCompetencyDetailView from '../../components/DpsTierCompetencyDetailView.jsx'
import useSiteEffects from '../../hooks/useSiteEffects'
import usePortalReveal from '../../hooks/usePortalReveal'
import useAuth from '../../hooks/useAuth'
import useLocale from '../../hooks/useLocale'
import usePortalBackground from '../../hooks/usePortalBackground'
import useDpsFilialeScope from '../../hooks/useDpsFilialeScope.js'
import useBrandDetailEntrance, { animateBrandDetailExit } from '../../hooks/useBrandDetailEntrance.js'
import { LMS_BY_USER } from '../../data/mock_lms'
import { resolveTeamBrands } from '../../utils/teamBrands.js'

export default function DpsTierCompetencyDetail() {
  useSiteEffects()
  usePortalReveal()
  const { user, status } = useAuth()
  usePortalBackground(user)
  const { tierId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useLocale('portal')
  const shellRef = useRef(null)
  const closingRef = useRef(false)
  const [isClosing, setIsClosing] = useState(false)
  const originRect = location.state?.originRect ?? null

  const mockLms = LMS_BY_USER[user?.demoKey]
  const { lms, scopeLoading } = useDpsFilialeScope(user, mockLms)

  const brandList = useMemo(() => {
    return resolveTeamBrands(user?.brands ?? [])
  }, [user?.brands])

  const ready = Boolean(lms && tierId)

  useBrandDetailEntrance(shellRef, originRect, ready)

  if (status === "loading") return null
  if (!user) return <Navigate to="/login" replace />
  if (!scopeLoading && !lms) {
    return <Navigate to="/portail#niveaux" replace />
  }
  if (!ready) return null

  async function handleBack() {
    if (closingRef.current) return
    closingRef.current = true
    setIsClosing(true)
    await animateBrandDetailExit(shellRef.current, originRect)
    navigate('/portail#niveaux')
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
        <DpsTierCompetencyDetailView
          shellRef={shellRef}
          tierKey={tierId}
          brandList={brandList}
          lms={lms}
          t={t}
          onBack={handleBack}
        />
      </main>
      <Footer />
      <PortalDemoBar />
    </>
  )
}
