import PortalSectionEyebrow from './PortalSectionEyebrow.jsx'
import { useMemo, useState } from 'react'
import ChipFilterBar from './ChipFilterBar.jsx'
import TeamMemberCard from './TeamMemberCard.jsx'
import { TeamMemberFicheModal, TeamMemberManageModal } from './TeamMemberModals.jsx'
import {
  TEAM_FILTER_IDS,
  filterTeamMembers,
  teamBrandFilterIds,
} from '../utils/teamManagerMetrics.js'

function filterLabel(filterId, t) {
  if (filterId === 'all') return t.tm_filter_all
  if (filterId === 'alert') return t.tm_filter_alert
  if (filterId === 'pending_test') return t.tm_filter_pending_test
  return filterId
}

export default function TeamSection({
  members: initialMembers,
  lms,
  user,
  t,
  planYear,
  sectionId = 'equipe',
  titleOverride,
  eyebrowOverride,
}) {
  const [members, setMembers] = useState(initialMembers)
  const [filter, setFilter] = useState('all')
  const [ficheMember, setFicheMember] = useState(null)
  const [manageMember, setManageMember] = useState(null)

  const brandFilters = useMemo(() => teamBrandFilterIds(members), [members])
  const filterOptions = useMemo(
    () => [
      ...TEAM_FILTER_IDS.map(id => ({ id, label: filterLabel(id, t) })),
      ...brandFilters.map(brand => ({
        id: brand,
        label: brand.charAt(0).toUpperCase() + brand.slice(1),
      })),
    ],
    [brandFilters, t],
  )
  const visible = useMemo(
    () => filterTeamMembers(members, filter, lms),
    [members, filter, lms],
  )

  function saveMember(updates) {
    if (!manageMember) return
    setMembers(prev => prev.map(m => (m.id === manageMember.id ? { ...m, ...updates } : m)))
    setManageMember(null)
    if (ficheMember?.id === manageMember.id) {
      setFicheMember(prev => (prev ? { ...prev, ...updates } : null))
    }
  }

  return (
    <section id={sectionId}>
      <div className="container" style={{ padding: '16px 32px' }}>
        <div className="portal-section-head">
          <PortalSectionEyebrow icon="users" label={eyebrowOverride ?? t.eyebrow_individual} />
          <h2 className="portal-section-title">{titleOverride ?? t.title_my_team}</h2>
        </div>

        <ChipFilterBar
          portal
          label={t.tm_filter_lbl}
          ariaLabel={t.tm_filter_aria}
          value={filter}
          onChange={setFilter}
          options={filterOptions}
        />

        {visible.length === 0 ? (
          <div className="portal-plan-filter-empty" role="status">{t.tm_filter_empty}</div>
        ) : (
          <div className="pv-grid cols-4 pv-grid--stretch">
            {visible.map(member => (
              <div key={member.id} id={`team-member-${member.id}`} className="portal-card-anchor">
                <TeamMemberCard
                  member={member}
                  t={t}
                  onFiche={() => setFicheMember(member)}
                  onManage={() => setManageMember(member)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {ficheMember && (
        <TeamMemberFicheModal
          member={ficheMember}
          t={t}
          planYear={planYear}
          onClose={() => setFicheMember(null)}
          onManage={() => { setManageMember(ficheMember); setFicheMember(null) }}
        />
      )}
      {manageMember && (
        <TeamMemberManageModal
          member={manageMember}
          allowedBrands={user.brands}
          t={t}
          onClose={() => setManageMember(null)}
          onSave={saveMember}
        />
      )}
    </section>
  )
}
