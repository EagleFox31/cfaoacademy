import { useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import Nav from '../../components/Nav'
import Footer from '../../components/Footer'
import PortalDemoBar from '../../components/PortalDemoBar'
import KiTeamgpDetailView from '../../components/KiTeamgpDetailView.jsx'
import useSiteEffects from '../../hooks/useSiteEffects'
import usePortalReveal from '../../hooks/usePortalReveal'
import useAuth from '../../hooks/useAuth'
import useLocale from '../../hooks/useLocale'
import usePortalBackground from '../../hooks/usePortalBackground'
import useKiFilialeScope from '../../hooks/useKiFilialeScope.js'
import useBrandDetailEntrance, { animateBrandDetailExit } from '../../hooks/useBrandDetailEntrance.js'
import { resolvePortalFilialeDetailAccess } from '../../utils/portalFilialeDetailAccess.js'

/** Page détail TEAM-GP — accès KI / PIC uniquement. */
export default function KiTeamgpDetail() {
  useSiteEffects()
  usePortalReveal()
  const { user, status } = useAuth()
  usePortalBackground(user)
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
  const { filialeLms: lms, scopeLoading } = useKiFilialeScope(
    access.isKi ? user : null,
  )

  const ready = Boolean(lms) || (!scopeLoading && access.isKi)
  useBrandDetailEntrance(shellRef, originRect, ready && access.isKi)

  if (status === "loading") return null
  if (!user) return <Navigate to="/login" replace />
  if (!access.allowed || !access.isKi) {
    return <Navigate to="/portail#toyota-resultats" replace />
  }
  if (!scopeLoading && !lms) {
    return <Navigate to="/portail#toyota-resultats" replace />
  }
  if (!ready) return null

  async function handleBack() {
    if (closingRef.current) return
    closingRef.current = true
    setIsClosing(true)
    await animateBrandDetailExit(shellRef.current, originRect)
    navigate('/portail#toyota-resultats')
  }

  return (
    <>
      <Nav notifications={lms?.alerts ?? []} />
      <main
        className={[
          'article-page',
          'portal-brand-detail-page',
          isClosing && 'portal-brand-detail-page--closing',
        ].filter(Boolean).join(' ')}
      >
        <KiTeamgpDetailView
          shellRef={shellRef}
          t={t}
          onBack={handleBack}
        />
      </main>
      <Footer />
      <PortalDemoBar />
    </>
  )
}
