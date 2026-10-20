import { useMemo, useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PortalSectionEyebrow from './PortalSectionEyebrow.jsx'
import PortalSectionHead from './PortalSectionHead.jsx'
import PortalReveal from './PortalReveal.jsx'
import PortalStaggerGrid from './PortalStaggerGrid.jsx'
import PortalSectionSkeleton from './PortalSectionSkeleton.jsx'
import PortalBrandLogo from './PortalBrandLogo.jsx'
import PlanEntryCard from './PlanEntryCard.jsx'
import PortalTechnicianCardMedia from './PortalTechnicianCardMedia.jsx'
import ChipFilterBar from './ChipFilterBar.jsx'
import { resolveDpsFilialePifTechnicians, groupDpsFilialePifTechniciansByTier } from '../utils/dpsFilialePifTechnicians.js'
import { openTechnicianPifDetail } from '../utils/dpsTechnicianPifNavigation.js'
import { teamgpLevelChipClass } from '../utils/teamgpElearning.js'
import {
  dpsCompetencyTierChipClass,
  dpsCompetencyTierTableBandAccent,
} from '../utils/dpsCompetencyTierTheme.js'

const TIER_GROUPS = [
  { key: 'junior', titleKey: 'dps_pif_tier_group_maintenance', titleKeyOne: 'dps_pif_tier_group_maintenance_one' },
  { key: 'senior', titleKey: 'dps_pif_tier_group_repair', titleKeyOne: 'dps_pif_tier_group_repair_one' },
  { key: 'expert', titleKey: 'dps_pif_tier_group_diagnostic', titleKeyOne: 'dps_pif_tier_group_diagnostic_one' },
]

const TIER_FILTERS = [
  { key: 'all',    label: 'Toutes',      tier: null },
  { key: 'junior', label: 'Maintenance', tier: 'junior' },
  { key: 'senior', label: 'Réparation',  tier: 'senior' },
  { key: 'expert', label: 'Diagnostic',  tier: 'expert' },
]

function tierGroupTitle(count, titleKey, titleKeyOne, t) {
  const template = count <= 1 ? t[titleKeyOne] : t[titleKey]
  return template.replace('{count}', String(count))
}

function PifTechnicianCard({ technician, t, onOpenDetail }) {
  const tierAccent = dpsCompetencyTierTableBandAccent(technician.primaryTier) || '#1a56db'

  return (
    <PlanEntryCard
      kind="pif"
      onOpen={(e) => onOpenDetail(technician, e)}
      cardMedia={<PortalTechnicianCardMedia person={technician} />}
      className={[
        'portal-team-member-card',
        'portal-dps-collab-card',
        'portal-pif-tech-card',
        dpsCompetencyTierChipClass(technician.primaryTier),
      ].join(' ')}
      title={technician.name}
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
              <span
                className="portal-dps-collab-brand-row"
                aria-label={t.dps_collab_brands_aria}
              >
                {technician.brands.map(brandId => (
                  <PortalBrandLogo key={brandId} brand={brandId} size="chip" />
                ))}
                {technician.teamgp?.linked && technician.teamgp.level ? (
                  <span
                    className="portal-pif-teamgp-path"
                    aria-label={String(t.ki_pif_teamgp_path_aria ?? '')
                      .replace('{current}', technician.teamgp.level)
                      .replace('{next}', technician.teamgp.nextLevel ?? technician.teamgp.level)}
                  >
                    <span className={teamgpLevelChipClass(technician.teamgp.level)}>
                      {technician.teamgp.level}
                    </span>
                    {technician.teamgp.nextLevel ? (
                      <>
                        <span className="portal-pif-teamgp-path-arrow" aria-hidden="true">→</span>
                        <span className={teamgpLevelChipClass(technician.teamgp.nextLevel, { next: true })}>
                          {technician.teamgp.nextLevel}
                        </span>
                      </>
                    ) : null}
                  </span>
                ) : null}
              </span>
            </div>
          ) : null}
          {technician.pifTotal != null ? (
            <p className="portal-pif-card-count-line portal-pif-tech-card-count" style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: 'auto', paddingTop: '10px' }}>
              <span
                className="portal-pif-card-count-value"
                style={{
                  fontSize: 'clamp(24px, 2.8vw, 30px)',
                  fontWeight: 700,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: tierAccent,
                  lineHeight: 1,
                  display: 'inline-block',
                }}
              >
                {technician.pifTotal}
              </span>
              {' '}
              <span className="portal-pif-card-count-label" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {t.dps_pif_tech_formations_label || 'formations planifiées'}
              </span>
            </p>
          ) : (
            <p className="portal-pif-card-count-line portal-pif-tech-card-count portal-pif-tech-card-count--zero" style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: 'auto', paddingTop: '10px' }}>
              <span
                className="portal-pif-card-count-value"
                style={{
                  fontSize: 'clamp(24px, 2.8vw, 30px)',
                  fontWeight: 700,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: 'var(--muted)',
                  lineHeight: 1,
                  display: 'inline-block',
                }}
              >
                0
              </span>
              {' '}
              <span className="portal-pif-card-count-label" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {t.dps_pif_tech_formations_label || 'formations planifiées'}
              </span>
            </p>
          )}
          {technician.teamgp?.linked && technician.teamgp.onlineRequired != null ? (
            <p className="portal-pif-card-count-line portal-pif-tech-card-count portal-pif-tech-card-count--teamgp">
              <span className="portal-pif-card-count-value">{technician.teamgp.onlineRequired}</span>
              {' '}
              <span className="portal-pif-card-count-label">{t.ki_pif_teamgp_modules_label}</span>
            </p>
          ) : technician.teamgp?.linked && technician.teamgp.required != null ? (
            <p className="portal-pif-card-count-line portal-pif-tech-card-count portal-pif-tech-card-count--teamgp">
              <span className="portal-pif-card-count-value">{technician.teamgp.required}</span>
              {' '}
              <span className="portal-pif-card-count-label">{t.ki_pif_teamgp_modules_label}</span>
            </p>
          ) : null}
        </div>
      )}
      cta={t.dps_pif_tech_card_cta}
      hoverHint={t.dps_pif_tech_card_hint}
      accentColor={tierAccent}
      corner
    />
  )
}

export default function DpsFilialePifSection({
  user,
  lms,
  t,
  updatedAt,
  scopeLoading = false,
  insightsLoading = false,
  sectionId = 'pif',
  technicians: techniciansOverride = null,
  title = null,
  eyebrow = null,
  titleKey = 'dps_title_filiale_plans',
  eyebrowKey = 'dps_eyebrow_filiale_plans',
  methodKey = 'dps_method_pif',
}) {
  const navigate = useNavigate()
  const technicians = useMemo(
    () => techniciansOverride ?? resolveDpsFilialePifTechnicians(lms),
    [lms, techniciansOverride],
  )

  const tierGroups = useMemo(
    () => groupDpsFilialePifTechniciansByTier(technicians),
    [technicians],
  )

  const [activeTier, setActiveTier] = useState('all')

  const tierCounts = useMemo(() => {
    const c = { all: 0, junior: 0, senior: 0, expert: 0 }
    for (const g of tierGroups) {
      const n = g.rows?.length ?? 0
      c.all += n
      if (c[g.key] != null) c[g.key] += n
    }
    return c
  }, [tierGroups])

  const visibleTierGroups = useMemo(() => {
    if (activeTier === 'all') return tierGroups
    return tierGroups.filter(g => g.key === activeTier)
  }, [tierGroups, activeTier])

  const filterOptions = useMemo(
    () => TIER_FILTERS.map(f => ({
      id: f.key,
      label: (f.key === 'all' && t.dps_filter_all) ? t.dps_filter_all : f.label,
      count: tierCounts[f.key] ?? 0,
    })),
    [t, tierCounts],
  )

  const handleOpenDetail = useCallback((technician, event) => {
    openTechnicianPifDetail(navigate, technician, event)
  }, [navigate])

  if (!scopeLoading && !technicians.length) return null

  return (
    <PortalReveal id={sectionId} className="portal-pif-filiale-section">
      <div className="container portal-pif-section-inner" style={{ padding: '16px 32px' }}>
        <PortalSectionHead
          eyebrow={(
            <PortalSectionEyebrow icon="milestone" label={eyebrow ?? t[eyebrowKey]} />
          )}
          title={title ?? t[titleKey]}
          updatedAt={updatedAt}
          updating={scopeLoading || insightsLoading}
          methodText={methodKey ? t[methodKey] : null}
          t={t}
        />

        {!scopeLoading && (
          <ChipFilterBar
            portal
            label={t.dps_assistance_filter_lbl || 'Filtrer'}
            ariaLabel="Filtrer les techniciens par niveau MEDACAP"
            value={activeTier}
            onChange={setActiveTier}
            options={filterOptions}
          />
        )}

        {scopeLoading ? (
          <PortalSectionSkeleton cols={4} count={8} ariaLabel={t.data_skeleton_aria} />
        ) : (
          <div className="portal-dps-tier-sections portal-pif-tier-sections">
            {visibleTierGroups.map(group => {
              const config = TIER_GROUPS.find(row => row.key === group.key)
              if (!config) return null

              return (
                <div
                  key={group.key}
                  role="group"
                  className="portal-pif-tier-block"
                  aria-labelledby={`portal-pif-tier-${group.key}`}
                >
                  <h3
                    id={`portal-pif-tier-${group.key}`}
                    className={`portal-dps-tier-section-title ${dpsCompetencyTierChipClass(group.key)}`}
                  >
                    {tierGroupTitle(group.rows.length, config.titleKey, config.titleKeyOne, t)}
                  </h3>
                  <PortalStaggerGrid className="cols-4 pv-grid--stretch portal-dps-collab-grid portal-pif-tech-cards">
                    {group.rows.map(tech => (
                      <PifTechnicianCard
                        key={tech.id}
                        technician={tech}
                        t={t}
                        onOpenDetail={handleOpenDetail}
                      />
                    ))}
                  </PortalStaggerGrid>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </PortalReveal>
  )
}
