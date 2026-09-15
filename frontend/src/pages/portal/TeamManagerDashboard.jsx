import { useRef } from 'react'
import Nav from '../../components/Nav'
import Footer from '../../components/Footer'
import PortalHeader from '../../components/PortalHeader'
import PortalStickyBar from '../../components/PortalStickyBar'
import PortalDemoBar from '../../components/PortalDemoBar'
import TeamManagerNextActions from '../../components/TeamManagerNextActions.jsx'
import TeamSection from '../../components/TeamSection.jsx'
import TeamResultsSection from '../../components/TeamResultsSection.jsx'
import TeamPlansSection from '../../components/TeamPlansSection.jsx'
import PortalAssistanceSection from '../../components/PortalAssistanceSection.jsx'
import useSiteEffects from '../../hooks/useSiteEffects'
import usePortalReveal from '../../hooks/usePortalReveal'
import useAuth from '../../hooks/useAuth'
import useLocale from '../../hooks/useLocale'
import { LMS_BY_USER } from '../../data/mock_lms'
import { resolveTeamMembers } from '../../utils/teamManagerMetrics.js'

export default function TeamManagerDashboard({ mode = 'team' }) {
  useSiteEffects()
  usePortalReveal()
  const { user } = useAuth()
  const { t } = useLocale('portal')
  const headerRef = useRef(null)
  const planYear = new Date().getFullYear()
  const isWorkshop = mode === 'workshop'
  const lms = LMS_BY_USER[user.demoKey]
  if (!lms) return null

  const allMembers = resolveTeamMembers(lms, { workshop: isWorkshop })

  return (
    <>
      <Nav />
      <PortalStickyBar user={user} lms={lms} headerRef={headerRef} />
      <main className="portal-page">
        <div ref={headerRef}>
          <PortalHeader user={user} lms={lms} workshop={isWorkshop} />
        </div>

        <TeamManagerNextActions lms={lms} />

        {isWorkshop ? (
          lms.teams?.map((team, index) => (
            <TeamSection
              key={team.chef}
              sectionId={index === 0 ? 'equipes' : `equipe-${team.chef}`}
              titleOverride={team.label}
              eyebrowOverride={`${t.team_manager_label} : ${team.chef}`}
              members={team.membres}
              lms={lms}
              user={user}
              t={t}
              planYear={planYear}
            />
          ))
        ) : (
          <TeamSection
            members={lms.team}
            lms={lms}
            user={user}
            t={t}
            planYear={planYear}
          />
        )}

        <TeamResultsSection members={allMembers} t={t} />
        <TeamPlansSection members={allMembers} t={t} planYear={planYear} />

        <PortalAssistanceSection t={t} variant="manager" />
      </main>
      <Footer />
      <PortalDemoBar />
    </>
  )
}
