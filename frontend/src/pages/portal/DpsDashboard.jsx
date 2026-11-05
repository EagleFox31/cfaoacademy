import { useMemo, useEffect, useState, useRef } from 'react'
import Nav from '../../components/Nav'
import Footer from '../../components/Footer'
import PortalHeader from '../../components/PortalHeader'
import PortalStickyBar from '../../components/PortalStickyBar.jsx'
import PortalDemoBar from '../../components/PortalDemoBar'
import DpsAssistanceSection from '../../components/DpsAssistanceSection.jsx'
import DpsTrainingNeedsSection from '../../components/DpsTrainingNeedsSection.jsx'
import DpsFilialePifSection from '../../components/DpsFilialePifSection.jsx'
import DpsCollaboratorResultsSection from '../../components/DpsCollaboratorResultsSection.jsx'
import DpsTierResultsSection from '../../components/DpsTierResultsSection.jsx'
import useSiteEffects from '../../hooks/useSiteEffects'
import usePortalReveal from '../../hooks/usePortalReveal'
import useAuth from '../../hooks/useAuth'
import useLocale from '../../hooks/useLocale'
import useDpsFilialeScope from '../../hooks/useDpsFilialeScope.js'
import { LMS_BY_USER } from '../../data/mock_lms'
import { fetchMedacapCompetencyEvaluations, resolvePortalDisplayUser } from '../../utils/medacapEvaluations.js'
import { resolveMedacapDefineLaunchUrl } from '../../utils/dpsMetrics.js'

export default function DpsDashboard() {
  useSiteEffects()
  usePortalReveal()
  const { user } = useAuth()
  const { t } = useLocale('portal')
  const headerRef = useRef(null)
  const mockLms = LMS_BY_USER[user.demoKey]
  const { lms, displayUser: scopeUser, filialeBrands, scopeLoading, insightsLoading, lastUpdatedAt } = useDpsFilialeScope(user, mockLms)
  const [medacapProfile, setMedacapProfile] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchMedacapCompetencyEvaluations(user)
      .then(data => {
        if (!cancelled && data?.profile) setMedacapProfile(data.profile)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user])

  const displayUser = useMemo(
    () => resolvePortalDisplayUser(scopeUser, medacapProfile),
    [scopeUser, medacapProfile],
  )

  const defineLaunchUrl = useMemo(
    () => resolveMedacapDefineLaunchUrl(displayUser, { view: 'pluri' }),
    [displayUser],
  )

  if (!lms) return null

  return (
    <>
      <Nav notifications={lms.alerts ?? []} />
      <PortalStickyBar
        user={displayUser}
        lms={lms}
        headerRef={headerRef}
        variant="dps"
        filialeBrands={filialeBrands}
      />
      <main className="portal-page">
        <div ref={headerRef}>
          <PortalHeader user={displayUser} filialeBrands={filialeBrands} lms={lms} />
        </div>

        <DpsTrainingNeedsSection
          t={t}
          updatedAt={lastUpdatedAt}
        />

        <DpsCollaboratorResultsSection
          user={displayUser}
          lms={lms}
          t={t}
          updatedAt={lastUpdatedAt}
          scopeLoading={scopeLoading}
          insightsLoading={insightsLoading}
        />

        <DpsTierResultsSection
          user={displayUser}
          lms={lms}
          t={t}
          updatedAt={lastUpdatedAt}
          scopeLoading={scopeLoading}
          insightsLoading={insightsLoading}
        />

        <DpsFilialePifSection
          user={displayUser}
          lms={lms}
          t={t}
          updatedAt={lastUpdatedAt}
          scopeLoading={scopeLoading}
          insightsLoading={insightsLoading}
        />

        {/* Effectifs filiale — masqué temporairement
        <DpsCollaboratorsSection
          lms={lms}
          t={t}
          defineLaunchUrl={defineLaunchUrl}
          updatedAt={lastUpdatedAt}
          scopeLoading={scopeLoading}
          insightsLoading={insightsLoading}
        />
        */}

        <DpsAssistanceSection
          t={t}
          tickets={lms.filialeTickets ?? []}
        />
      </main>
      <Footer />
      <PortalDemoBar />
    </>
  )
}
