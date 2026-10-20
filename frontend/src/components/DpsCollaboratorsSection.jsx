import { useMemo, useState } from 'react'
import PortalSectionEyebrow from './PortalSectionEyebrow.jsx'
import PortalSectionHead from './PortalSectionHead.jsx'
import PortalReveal from './PortalReveal.jsx'
import PortalStaggerGrid from './PortalStaggerGrid.jsx'
import ChipFilterBar from './ChipFilterBar.jsx'
import PvCard from './PvCard.jsx'
import PortalSectionSkeleton from './PortalSectionSkeleton.jsx'
import PortalBrandLogo from './PortalBrandLogo.jsx'
import DpsCompetencyTierChip from './DpsCompetencyTierChip.jsx'
import DpsCompetencyTierMemberTitle from './DpsCompetencyTierMemberTitle.jsx'
import PortalTechnicianCardMedia from './PortalTechnicianCardMedia.jsx'
import {
  DPS_RESULT_TIER_ALL,
  DPS_RESULT_TIER_FILTERS,
} from '../utils/dpsMetrics.js'
import {
  countDpsTechniciansByTier,
  dpsCompetencyTierChipClass,
  dpsCompetencyTierTableBandAccent,
  filterDpsTechniciansByTier,
  resolveDpsTechnicians,
} from '../utils/dpsTechnicians.js'
import { resolveMedacapCollaboratorDashboardLaunchUrl } from '../utils/medacapDefine.js'

const TIER_FILTER_LABEL_KEY = {
  all: 'dps_results_filter_all',
  junior: 'dps_results_filter_maintenance',
  senior: 'dps_results_filter_repair',
  expert: 'dps_results_filter_diagnostic',
}

function DpsTechnicianCard({ technician, t, launchUrl }) {
  const primaryBrand = technician.brands?.[0] ?? null
  if (!launchUrl) return null

  return (
    <PvCard
      href={launchUrl}
      className={[
        'portal-team-member-card',
        'portal-dps-collab-card',
        dpsCompetencyTierChipClass(technician.primaryTier),
      ].join(' ')}
      cardMedia={<PortalTechnicianCardMedia person={technician} brand={primaryBrand} />}
      kicker={<DpsCompetencyTierChip tier={technician.primaryTier} t={t} />}
      title={(
        <DpsCompetencyTierMemberTitle
          name={technician.name}
          tier={technician.primaryTier}
          person={technician}
        />
      )}
      meta={(
        <div className="portal-team-member-subcards">
          {technician.agency ? (
            <div className="portal-team-member-subcards-row">
              <div className="portal-team-member-subcard">
                <span className="portal-team-member-subcard-lbl">{t.dps_collab_agency_lbl}</span>
                <span className="portal-team-member-subcard-val">{technician.agency}</span>
              </div>
            </div>
          ) : null}
          {technician.brands?.length ? (
            <div className="portal-team-member-subcard portal-team-member-subcard--wide">
              <span className="portal-team-member-subcard-lbl">{t.dps_collab_brands_lbl}</span>
              <span className="portal-dps-collab-brand-row">
                {technician.brands.map(brandId => (
                  <PortalBrandLogo key={brandId} brand={brandId} size="chip" />
                ))}
              </span>
            </div>
          ) : null}
        </div>
      )}
      cta={t.dps_collab_card_cta}
      hoverHint={t.dps_collab_card_cta}
      accentColor={dpsCompetencyTierTableBandAccent(technician.primaryTier)}
      corner
    />
  )
}

export default function DpsCollaboratorsSection({
  user,
  lms,
  t,
  updatedAt,
  scopeLoading = false,
}) {
  const [tierScope, setTierScope] = useState(DPS_RESULT_TIER_ALL)

  const technicianLaunchUrl = useMemo(
    () => (tech) => resolveMedacapCollaboratorDashboardLaunchUrl(user, tech),
    [user],
  )

  const technicians = useMemo(() => resolveDpsTechnicians(lms), [lms])
  const tierCounts = useMemo(() => countDpsTechniciansByTier(technicians), [technicians])

  const filtered = useMemo(
    () => filterDpsTechniciansByTier(technicians, tierScope),
    [technicians, tierScope],
  )

  const filterOptions = useMemo(
    () => DPS_RESULT_TIER_FILTERS.map(id => ({
      id,
      label: t[TIER_FILTER_LABEL_KEY[id]],
      count: tierCounts[id],
    })),
    [t, tierCounts],
  )

  if (!scopeLoading && !technicians.length) return null

  return (
    <PortalReveal id="collaborateurs">
      <div className="container" style={{ padding: '16px 32px' }}>
        <PortalSectionHead
          eyebrow={<PortalSectionEyebrow icon="users" label={t.dps_eyebrow_collaborators} />}
          title={t.dps_title_collaborators}
          updatedAt={updatedAt}
          updating={scopeLoading}
          methodText={t.dps_method_collaborators}
          t={t}
        />

        {scopeLoading ? (
          <PortalSectionSkeleton cols={4} count={8} ariaLabel={t.data_skeleton_aria} />
        ) : (
          <>
            <ChipFilterBar
              portal
              label={t.dps_results_filter_lbl}
              ariaLabel={t.dps_collab_filter_aria}
              value={tierScope}
              onChange={setTierScope}
              options={filterOptions}
            />

            {filtered.length ? (
              <PortalStaggerGrid className="cols-4 pv-grid--stretch portal-dps-collab-grid">
                {filtered.map(tech => (
                  <DpsTechnicianCard
                    key={tech.id}
                    technician={tech}
                    t={t}
                    launchUrl={technicianLaunchUrl(tech)}
                  />
                ))}
              </PortalStaggerGrid>
            ) : (
              <p className="portal-dps-collab-empty">{t.dps_collab_filter_empty}</p>
            )}
          </>
        )}
      </div>
    </PortalReveal>
  )
}
