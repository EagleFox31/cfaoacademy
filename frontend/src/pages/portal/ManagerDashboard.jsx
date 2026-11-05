import { useMemo, useRef, useState } from 'react'
import Nav from '../../components/Nav'
import Footer from '../../components/Footer'
import PortalHeader from '../../components/PortalHeader'
import PortalStickyBar from '../../components/PortalStickyBar'
import PortalDemoBar from '../../components/PortalDemoBar'
import PortalSectionEyebrow from '../../components/PortalSectionEyebrow.jsx'
import PortalReveal from '../../components/PortalReveal.jsx'
import DpsAssistanceSection from '../../components/DpsAssistanceSection.jsx'
import DpsFilialePifSection from '../../components/DpsFilialePifSection.jsx'
import PortalEmptyState from '../../components/PortalEmptyState.jsx'
import AnimatedCount from '../../components/AnimatedCount.jsx'
import PvCard from '../../components/PvCard.jsx'
import PlanEntryCard from '../../components/PlanEntryCard.jsx'
import PortalSectionHead from '../../components/PortalSectionHead.jsx'
import ManagerFormationsSection from '../../components/ManagerFormationsSection.jsx'
import ManagerCertificationsSection from '../../components/ManagerCertificationsSection.jsx'
import PortalModal from '../../components/PortalModal.jsx'
import { CMR_EQUIPMENT_PIF_TECHNICIANS } from '../../data/dps/cmrEquipmentPlanning.js'
import { LMS_BY_USER } from '../../data/mock_lms.js'
import DpsBrandResultSummary from '../../components/DpsBrandResultSummary.jsx'
import PortalTechnicianCardMedia from '../../components/PortalTechnicianCardMedia.jsx'
import ChipFilterBar from '../../components/ChipFilterBar.jsx'
import DpsStatCard, { DpsProgressMeta, DpsSubcardRow } from '../../components/DpsStatCard.jsx'
import PortalBrandLogo from '../../components/PortalBrandLogo.jsx'
import DpsCompetencyTierMemberTitle from '../../components/DpsCompetencyTierMemberTitle.jsx'
import {
  dpsCompetencyTierChipClass,
  DPS_COMPETENCY_TIER_COLOR,
  normalizeDpsCompetencyTier,
} from '../../utils/dpsCompetencyTierTheme.js'
import { evalScoreAccentColor } from '../../utils/learnerTests.js'
import { TEAM_BRAND_DEFS } from '../../utils/teamBrands.js'
import useSiteEffects from '../../hooks/useSiteEffects'
import usePortalReveal from '../../hooks/usePortalReveal'
import useAuth from '../../hooks/useAuth'
import useLocale from '../../hooks/useLocale'
import useManagerScope from '../../hooks/useManagerScope.js'

function normalizeBrandSlug(brand) {
  const s = String(brand ?? '').trim().toLowerCase().replace(/\s+/g, '-')
  if (s === 'renault-truck' || s === 'renault-trucks') return 'renault-trucks'
  if (s === 'king-long') return 'king-long'
  if (s === 'toyota-forklift') return 'toyota-forklift'
  return s
}

function resolveBrandLabel(brand) {
  const slug = normalizeBrandSlug(brand)
  return TEAM_BRAND_DEFS[slug]?.label ?? brand
}

/* ── Section 1 : Mesure des compétences par niveau (norme DPS / Image 3) ── */
function TierResultsSection({ scope, t }) {
  const members = scope?.members ?? []
  if (!members.length) return null

  const juniorMembers = members.filter(m => (m.level || '').toLowerCase() === 'junior')
  const seniorMembers = members.filter(m => (m.level || '').toLowerCase() === 'senior')
  const expertMembers = members.filter(m => (m.level || '').toLowerCase() === 'expert')

  function getTierStats(tierMembers, tierName) {
    const totalCount = tierMembers.length
    const evaluatedMembers = tierMembers.filter(m =>
      Object.values(m.scores ?? {}).some(lvls => lvls[tierName]?.avg != null)
    )
    const evaluatedCount = evaluatedMembers.length
    // Nombre total de tests réalisés (théorie + pratique par marque évaluée)
    const testCount = tierMembers.reduce((acc, m) => {
      const brandScores = Object.values(m.scores ?? {})
      const brandsTested = brandScores.filter(lvls => lvls[tierName]?.avg != null).length
      return acc + (brandsTested * 2)
    }, 0)

    const scores = evaluatedMembers.flatMap(m =>
      Object.values(m.scores ?? {})
        .map(lvls => lvls[tierName]?.avg)
        .filter(v => v != null)
    )
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null

    return { totalCount, evaluatedCount, testCount: testCount > 0 ? testCount : evaluatedCount, avgScore }
  }

  const juniorStats = getTierStats(juniorMembers, 'Junior')
  const seniorStats = getTierStats(seniorMembers, 'Senior')
  const expertStats = getTierStats(expertMembers, 'Expert')

  const tiers = [
    {
      key: 'junior',
      label: 'Maintenance',
      defaultColor: '#1a56db',
      stats: juniorStats,
    },
    {
      key: 'senior',
      label: 'Réparation',
      defaultColor: '#e67e00',
      stats: seniorStats,
    },
    {
      key: 'expert',
      label: 'Diagnostic',
      defaultColor: '#1aab5b',
      stats: expertStats,
    },
  ]

  return (
    <PortalReveal id="mesurer" as="section" className="portal-dps-tier-section">
      <div className="container" style={{ padding: '16px 32px' }}>
        <PortalSectionHead
          eyebrow={<PortalSectionEyebrow icon="award" label="MESURE DES COMPÉTENCES" />}
          title="Mesurer les compétences de mes collaborateurs par niveau"
          t={t}
        />

        <div className="pv-grid cols-3 pv-grid--stretch portal-dps-tier-results">
          {tiers.map(({ key, label, defaultColor, stats }) => {
            const { totalCount, evaluatedCount, testCount, avgScore } = stats
            const muted = avgScore == null && evaluatedCount === 0
            const accent = avgScore != null ? evalScoreAccentColor(avgScore) : defaultColor

            return (
              <PlanEntryCard
                key={key}
                kind="results"
                className={`portal-plan-entry-card--tier-${key}`}
                muted={muted}
                brandLabel={label}
                accentColor={accent}
                to="#pif"
                corner
                meta={(
                  <div className="portal-dps-tier-card-content">
                    <div className="portal-dps-tier-score-display">
                      <div className="portal-dps-tier-score-main">
                        <span className="portal-dps-tier-score-val" style={{ color: accent }}>
                          {testCount}
                        </span>
                        <span className="portal-dps-tier-score-caption">
                          Nombre de tests effectués
                        </span>
                      </div>
                      {avgScore != null && (
                        <div className="portal-dps-tier-score-progress-bar">
                          <div
                            className="portal-dps-tier-score-progress-fill"
                            style={{
                              width: `${Math.min(100, Math.max(0, avgScore))}%`,
                              backgroundColor: accent,
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="portal-dps-tier-card-footer">
                      <span className="portal-dps-tier-evaluated-badge">
                        <strong className="portal-dps-tier-evaluated-count">
                          {evaluatedCount}/{totalCount}
                        </strong>
                        {' '}
                        techniciens évalués
                      </span>
                      {avgScore != null && (
                        <span style={{ fontSize: '12.5px', fontWeight: 700, color: accent }}>
                          {avgScore}% de Maîtrise des compétences métier
                        </span>
                      )}
                    </div>
                  </div>
                )}
                cta="Voir le détail par niveau"
                hoverHint="Voir le détail par niveau"
              />
            )
          })}
        </div>
      </div>
    </PortalReveal>
  )
}

/* ── Section 2 : Cartes compétences par marque (norme DPS / Image 2) ── */
function BrandMatrixSection({ scope, t }) {
  const matrix = scope?.brandMatrix ?? []
  if (!matrix.length) return null

  const members = scope?.members ?? []
  const juniorMembers = members.filter(m => (m.level || '').toLowerCase() === 'junior')
  const seniorMembers = members.filter(m => (m.level || '').toLowerCase() === 'senior')
  const expertMembers = members.filter(m => (m.level || '').toLowerCase() === 'expert')

  function tierAvgFromMembers(tierMembers, tierName) {
    const vals = tierMembers.flatMap(m =>
      Object.values(m.scores ?? {})
        .map(lvls => lvls[tierName]?.avg)
        .filter(v => v != null)
    )
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
  }

  const allJuniorAvg = tierAvgFromMembers(juniorMembers, 'Junior')
  const allSeniorAvg = tierAvgFromMembers(seniorMembers, 'Senior')
  const allExpertAvg = tierAvgFromMembers(expertMembers, 'Expert')

  const validTierAvgs = [allJuniorAvg, allSeniorAvg, allExpertAvg].filter(v => v != null)
  const globalScore = validTierAvgs.length
    ? Math.round(validTierAvgs.reduce((a, b) => a + b, 0) / validTierAvgs.length)
    : (scope?.kpis?.avgScore != null ? Math.round(scope.kpis.avgScore) : null)

  const allBrandsSummary = {
    avgScore: globalScore,
    evaluated: evaluatedTechs,
    technicians: totalTechs,
    tiers: {
      junior: { count: juniorMembers.length, avgScore: allJuniorAvg },
      senior: { count: seniorMembers.length, avgScore: allSeniorAvg },
      expert: { count: expertMembers.length, avgScore: allExpertAvg },
    },
  }

  return (
    <PortalReveal id="marques" as="section" className="portal-brand-matrix-section">
      <div className="container" style={{ padding: '16px 32px' }}>
        <PortalSectionHead
          eyebrow={<PortalSectionEyebrow icon="sliders" label="MAÎTRISE DES MÉTIERS PAR MARQUE" />}
          title={t.dps_title_collab_results || 'Compétences de vos Equipes par marques'}
          t={t}
        />

        <div className="pv-grid cols-4 pv-grid--stretch portal-dps-brand-results">
          {/* Carte 1 : Toutes marques */}
          <PlanEntryCard
            kind="results"
            className="portal-plan-entry-card--brand-toutes-marques"
            brandLabel={t.dps_results_brand_all_brands || 'Toutes marques'}
            logo={null}
            meta={(
              <DpsBrandResultSummary
                summary={allBrandsSummary}
                t={t}
                variant="card"
                nomenclature="medacap"
                globalLabelText={t.manager_results_team_label || 'techniciens Équipe'}
              />
            )}
            cta={t.dps_results_brand_cta || 'Voir le détail par marque'}
            hoverHint={t.dps_results_brand_cta || 'Voir le détail par marque'}
            accentColor={evalScoreAccentColor(allBrandsSummary.avgScore)}
            to="#equipe"
            corner
          />

          {/* Cartes par marque avec logos officiels */}
          {matrix.map(row => {
            const slug = normalizeBrandSlug(row.brand)
            const label = resolveBrandLabel(row.brand)
            const brandDef = TEAM_BRAND_DEFS[slug]
            const logo = brandDef?.logo ?? null

            const levels = row.levels ?? {}
            const junior = levels['Junior']
            const senior = levels['Senior']
            const expert = levels['Expert']

            const brandAssigned = members.filter(m => (m.brands ?? []).some(b => normalizeBrandSlug(b) === slug)).length
            const brandEvaluated = members.filter(m => {
              return Object.entries(m.scores ?? {}).some(([k, v]) => normalizeBrandSlug(k) === slug && Object.keys(v).length > 0)
            }).length || ((junior?.count || 0) + (senior?.count || 0) + (expert?.count || 0))

            const validAvgs = [junior?.avg, senior?.avg, expert?.avg].filter(v => v != null)
            const brandAvg = validAvgs.length ? Math.round(validAvgs.reduce((a, b) => a + b, 0) / validAvgs.length) : null

            const brandSummary = {
              avgScore: brandAvg,
              evaluated: brandEvaluated,
              technicians: brandAssigned > 0 ? brandAssigned : (brandEvaluated > 0 ? brandEvaluated : null),
              tiers: {
                junior: { count: junior?.count || 0, avgScore: junior?.avg != null ? Math.round(junior.avg) : null },
                senior: { count: senior?.count || 0, avgScore: senior?.avg != null ? Math.round(senior.avg) : null },
                expert: { count: expert?.count || 0, avgScore: expert?.avg != null ? Math.round(expert.avg) : null },
              },
            }

            const muted = brandSummary.avgScore == null && brandSummary.evaluated === 0

            return (
              <PlanEntryCard
                key={slug}
                kind="results"
                className={`portal-plan-entry-card--brand-${slug}`}
                logo={logo}
                brandLabel={logo ? undefined : label}
                muted={muted}
                meta={(
                  <DpsBrandResultSummary
                    summary={brandSummary}
                    t={t}
                    variant="card"
                    nomenclature="medacap"
                    globalLabelText={t.manager_results_team_label || 'techniciens Équipe'}
                  />
                )}
                cta={t.dps_results_brand_cta || 'Voir le détail par marque'}
                hoverHint={t.dps_results_brand_cta || 'Voir le détail par marque'}
                accentColor={evalScoreAccentColor(brandSummary.avgScore)}
                to="#pif"
                corner
              />
            )
          })}
        </div>
      </div>
    </PortalReveal>
  )
}

/* ── Section 3 : Membres de l'équipe (norme DPS/DOP PvCard) ───────── */
function MemberCard({ member, t }) {
  const tierKey = normalizeDpsCompetencyTier((member.level || 'junior').toLowerCase())
  const tierColor = DPS_COMPETENCY_TIER_COLOR[tierKey] || '#1a56db'
  const primaryBrand = member.brands?.[0] ? normalizeBrandSlug(member.brands[0]) : null

  const topBrandScore = Object.entries(member.scores ?? {})
    .flatMap(([brand, levels]) =>
      Object.entries(levels).map(([lvl, d]) => ({ brand, lvl, avg: d.avg, color: d.color }))
    )
    .sort((a, b) => b.avg - a.avg)[0]

  return (
    <PvCard
      className="portal-team-member-card portal-dps-collab-card"
      cardMedia={(
        <PortalTechnicianCardMedia
          person={{
            name: `${member.firstName} ${member.lastName}`,
            firstName: member.firstName,
            lastName: member.lastName,
            agency: member.agency,
            primaryTier: tierKey,
            brands: member.brands,
          }}
          brand={primaryBrand}
          mediaClassName="portal-dps-tech-result-card-media"
        />
      )}
      kicker={(
        <span className="pv-card-kicker-row">
          <span className={`portal-status-chip ${dpsCompetencyTierChipClass(tierKey)}`}>
            {member.level}
          </span>
          {topBrandScore ? (
            <span className={`portal-status-chip ${topBrandScore.avg >= 60 ? 'done' : 'progress'}`}>
              {Math.round(topBrandScore.avg)}%
            </span>
          ) : (
            <span className="portal-status-chip todo">—</span>
          )}
        </span>
      )}
      title={(
        <DpsCompetencyTierMemberTitle
          name={`${member.firstName} ${member.lastName}`}
          tier={tierKey}
          person={{
            firstName: member.firstName,
            lastName: member.lastName,
          }}
        />
      )}
      meta={(
        <div className="portal-team-member-subcards">
          <div className="portal-team-member-subcards-row">
            <div className="portal-team-member-subcard">
              <span className="portal-team-member-subcard-lbl">{t.dps_collab_agency_lbl || 'Agence'}</span>
              <span className="portal-team-member-subcard-val">{member.agency || '—'}</span>
            </div>
            <div className="portal-team-member-subcard">
              <span className="portal-team-member-subcard-lbl">Palier</span>
              <span className="portal-team-member-subcard-val">{member.level}</span>
            </div>
          </div>

          {member.brands?.length > 0 && (
            <div className="portal-team-member-subcard portal-team-member-subcard--wide">
              <span className="portal-team-member-subcard-lbl">{t.dps_collab_brands_lbl || 'Marques'}</span>
              <div className="portal-dps-collab-brand-row">
                {member.brands.map(b => (
                  <PortalBrandLogo key={b} brand={normalizeBrandSlug(b)} size="micro" />
                ))}
              </div>
            </div>
          )}

          {member.hasScores && Object.keys(member.scores).length > 0 && (
            <div className="portal-team-member-subcards-scores">
              {Object.entries(member.scores).slice(0, 3).map(([brand, levels]) => {
                const best = Object.entries(levels).sort((a, b) => b[1].avg - a[1].avg)[0]
                if (!best) return null
                const pct = Math.round(best[1].avg)
                return (
                  <DpsProgressMeta
                    key={brand}
                    label={resolveBrandLabel(brand)}
                    value={`${best[0]} · ${pct}%`}
                    pct={pct}
                    accent={pct >= 60 ? '#1aab5b' : '#e67e00'}
                  />
                )
              })}
            </div>
          )}
        </div>
      )}
      accentColor={tierColor}
      cta={t.card_view_detail || 'Consulter le profil'}
      href="#plans"
      corner={false}
    />
  )
}

function TeamSection({ scope, t }) {
  const members = scope?.members ?? []
  if (!members.length) return null
  const teamTitle = scope?.agencyName
    ? t.manager_section_team_title_at.replace('{agency}', scope.agencyName)
    : t.manager_section_team_title

  return (
    <section id="equipe">
      <div className="container" style={{ padding: '16px 32px' }}>
        <div className="portal-section-head">
          <PortalSectionEyebrow icon="users" label={t.manager_section_team_eyebrow} />
          <h2 className="portal-section-title">{teamTitle}</h2>
        </div>

        <div className="pv-grid cols-3 pv-grid--stretch">
          {members.map(member => (
            <MemberCard
              key={member.username || `${member.firstName}-${member.lastName}`}
              member={member}
              t={t}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Section 4 : Plans de formation (norme DPS/DOP PlanEntryCard) ── */
function ManagerPlanCard({ member, t }) {
  const tierKey = normalizeDpsCompetencyTier((member.level || 'junior').toLowerCase())
  const primaryBrand = member.brands?.[0] ? normalizeBrandSlug(member.brands[0]) : null

  return (
    <PlanEntryCard
      kind="pif"
      className={[
        'portal-team-member-card',
        'portal-dps-collab-card',
        'portal-pif-tech-card',
        dpsCompetencyTierChipClass(tierKey),
      ].join(' ')}
      cardMedia={(
        <PortalTechnicianCardMedia
          person={{
            name: `${member.firstName} ${member.lastName}`,
            firstName: member.firstName,
            lastName: member.lastName,
            agency: member.agency,
            primaryTier: tierKey,
            brands: member.brands,
          }}
          brand={primaryBrand}
        />
      )}
      kicker={(
        <span className="pv-card-kicker-row">
          <span className="portal-status-chip progress">Plan individuel</span>
          <span className={`portal-status-chip ${dpsCompetencyTierChipClass(tierKey)}`}>
            {member.level}
          </span>
        </span>
      )}
      title={(
        <DpsCompetencyTierMemberTitle
          name={`${member.firstName} ${member.lastName}`}
          tier={tierKey}
          person={{
            firstName: member.firstName,
            lastName: member.lastName,
          }}
        />
      )}
      meta={(
        <div className="portal-team-member-subcards">
          <div className="portal-team-member-subcards-row">
            <div className="portal-team-member-subcard">
              <span className="portal-team-member-subcard-lbl">{t.dps_collab_agency_lbl || 'Agence'}</span>
              <span className="portal-team-member-subcard-val">{member.agency || '—'}</span>
            </div>
            <div className="portal-team-member-subcard">
              <span className="portal-team-member-subcard-lbl">Objectif</span>
              <span className="portal-team-member-subcard-val">Renforcement</span>
            </div>
          </div>

          {member.brands?.length > 0 && (
            <div className="portal-team-member-subcard portal-team-member-subcard--wide">
              <span className="portal-team-member-subcard-lbl">{t.dps_collab_brands_lbl || 'Périmètre marques'}</span>
              <div className="portal-dps-collab-brand-row">
                {member.brands.map(b => (
                  <PortalBrandLogo key={b} brand={normalizeBrandSlug(b)} size="micro" />
                ))}
              </div>
            </div>
          )}

          {member.hasScores && Object.keys(member.scores).length > 0 && (
            <div className="portal-team-member-subcards-scores">
              {Object.entries(member.scores).slice(0, 2).map(([brand, levels]) => {
                const best = Object.entries(levels).sort((a, b) => b[1].avg - a[1].avg)[0]
                if (!best) return null
                const pct = Math.round(best[1].avg)
                return (
                  <DpsProgressMeta
                    key={brand}
                    label={resolveBrandLabel(brand)}
                    value={`${best[0]} · ${pct}%`}
                    pct={pct}
                    accent={pct >= 60 ? '#1aab5b' : '#e67e00'}
                  />
                )
              })}
            </div>
          )}
        </div>
      )}
      cta={t.pif_card_cta || 'Consulter le plan'}
      hoverHint={t.pif_card_cta || 'Consulter le plan'}
      accentColor="#e67e00"
      corner={false}
    />
  )
}

const TIER_FILTERS = [
  { key: 'all',    label: 'Toutes',      tier: null },
  { key: 'junior', label: 'Maintenance', tier: 'junior' },
  { key: 'senior', label: 'Réparation',  tier: 'senior' },
  { key: 'expert', label: 'Diagnostic',  tier: 'expert' },
]

function PlansSection({ scope, t }) {
  const [activeTier, setActiveTier] = useState('all')
  const members = (scope?.members ?? []).filter(m => m.brands.length > 0)

  const counts = useMemo(() => {
    const c = { all: members.length, junior: 0, senior: 0, expert: 0 }
    for (const m of members) {
      const tier = normalizeDpsCompetencyTier((m.level || 'junior').toLowerCase())
      if (c[tier] != null) c[tier] += 1
    }
    return c
  }, [members])

  const filtered = useMemo(() => {
    if (activeTier === 'all') return members
    return members.filter(m => normalizeDpsCompetencyTier((m.level || 'junior').toLowerCase()) === activeTier)
  }, [members, activeTier])

  if (!members.length) return null

  return (
    <section id="plans">
      <div className="container" style={{ padding: '16px 32px' }}>
        <div className="portal-section-head">
          <PortalSectionEyebrow icon="calendar" label={t.manager_section_plans_eyebrow} />
          <h2 className="portal-section-title">{t.manager_section_plans_title}</h2>
        </div>

        <ChipFilterBar
          label={t.plans_filter_label || 'Filtrer'}
          ariaLabel="Filtrer les techniciens par niveau MEDACAP"
          value={activeTier}
          onChange={setActiveTier}
          options={TIER_FILTERS.map(f => ({
            id: f.key,
            label: f.label,
            count: counts[f.key],
          }))}
          portal
        />

        {filtered.length ? (
          <div className="pv-grid cols-3 pv-grid--stretch">
            {filtered.map(member => (
              <ManagerPlanCard
                key={member.username || `${member.firstName}-${member.lastName}`}
                member={member}
                t={t}
              />
            ))}
          </div>
        ) : (
          <PortalEmptyState message="Aucun technicien à ce niveau." />
        )}
      </div>
    </section>
  )
}

/* ── Dashboard principal ─────────────────────────────────────────── */
export default function ManagerDashboard() {
  useSiteEffects()
  usePortalReveal()
  const { user } = useAuth()
  const { t } = useLocale('portal')
  const headerRef = useRef(null)
  const [modal, setModal] = useState(null)

  // Si demoKey === 'u-manager-demo' ou u12 / venance, on force Venance TONGA (ve72to)
  const demoUsername = (user?.demoKey === 'u-manager-demo' || user?.demoKey === 'u12' || user?.username === 've72to' || user?.username === 'venance.tonga' || user?.medacapUsername === 've72to') ? 've72to' : undefined
  const { scope, loading, error } = useManagerScope(user, { username: demoUsername })

  const pifByUsername = useMemo(() => {
    const map = new Map()
    for (const row of CMR_EQUIPMENT_PIF_TECHNICIANS) {
      if (row.username) map.set(row.username.toLowerCase(), row)
    }
    return map
  }, [])

  const managerPifTechnicians = useMemo(() => {
    const members = scope?.members ?? []
    return members.map(m => {
      const uname = (m.username || '').toLowerCase()
      const pifData = pifByUsername.get(uname)
      const tierKey = normalizeDpsCompetencyTier((m.level || 'junior').toLowerCase())
      const brands = (m.brands?.length ? m.brands : (pifData?.assignedBrands ?? [])).map(normalizeBrandSlug)
      const pifTotal = pifData?.total ?? pifData?.pifTotal ?? (brands.length ? Math.max(1, brands.length * 2) : 2)

      return {
        id: m.username || `${m.firstName}-${m.lastName}`,
        username: m.username,
        name: `${m.firstName} ${m.lastName}`.trim(),
        firstName: m.firstName,
        lastName: m.lastName,
        agency: m.agency || scope?.agencyName || pifData?.agency || null,
        brands,
        primaryTier: tierKey,
        level: m.level,
        pifTotal,
        pifCodes: pifData?.pifCodes ?? [],
        byBrand: pifData?.byBrand ?? null,
        codesByBrand: pifData?.codesByBrand ?? null,
        planningStatus: pifData?.planningStatus ?? null,
        scores: m.scores,
      }
    })
  }, [scope, pifByUsername])

  const managerTickets = useMemo(() => {
    const members = scope?.members ?? []
    if (!members.length) return []
    const memberNames = new Set(members.map(m => `${m.firstName} ${m.lastName}`.trim().toLowerCase()))
    const memberLastNames = new Set(members.map(m => (m.lastName || '').trim().toLowerCase()))
    const agencyName = (scope?.agencyName || members[0]?.agency || '').trim().toLowerCase()

    const pool = LMS_BY_USER.dps?.filialeTickets ?? []
    const matching = pool.filter(ticket => {
      const colName = (ticket.collaboratorName || '').trim().toLowerCase()
      const tAgency = (ticket.agency || '').trim().toLowerCase()
      if (memberNames.has(colName)) return true
      if (Array.from(memberLastNames).some(l => l && colName.includes(l))) return true
      if (agencyName && tAgency === agencyName) return true
      return false
    })

    if (matching.length >= 2) return matching

    const teamTickets = []
    const topMembers = members.slice(0, 3)
    const defaultTicketsDefs = [
      {
        brand: 'sinotruk',
        subject: 'Procédure remplacement pompe injection WD615 — calage distribution',
        status: 'progress',
        ord: 'OR #CM-4488',
        updated: '1 juin 2026',
      },
      {
        brand: 'hino',
        subject: 'Diagnostic voyant moteur Hino 300 — couple de serrage culasse',
        status: 'open',
        ord: 'OR #CM-4521',
        updated: '4 juin 2026',
      },
      {
        brand: 'renault-trucks',
        subject: 'Validation essai routier après révision boîte Optidriver',
        status: 'resolved',
        ord: 'OR #CM-4390',
        updated: '22 mai 2026',
      },
    ]

    topMembers.forEach((m, idx) => {
      const def = defaultTicketsDefs[idx % defaultTicketsDefs.length]
      const brand = m.brands?.[0] ? normalizeBrandSlug(m.brands[0]) : def.brand
      teamTickets.push({
        id: `tk-mgr-${m.username || idx + 1}`,
        userId: m.username,
        collaboratorName: `${m.firstName} ${m.lastName}`.trim(),
        agency: m.agency || scope?.agencyName || 'Yaoundé',
        country: scope?.manager?.country || 'Cameroun',
        brand,
        ord: `OR #CM-45${20 + idx}`,
        subject: def.subject,
        status: def.status,
        updated: def.updated,
      })
    })

    return teamTickets
  }, [scope])

  if (!user) return null

  // lms-shape attendue par PortalHeader pour la hero phrase
  const lms = scope
    ? {
        managerScope: {
          technicianCount: scope.technicianCount,
          brandCount: scope.brandCount,
          loading: false,
        },
      }
    : loading
      ? { managerScope: { technicianCount: 0, brandCount: 0, loading: true } }
      : null

  const teamBrands = useMemo(() => {
    const brandSet = new Set()
    // 1. Marques de la matrice (qui ont des scores)
    scope?.brandMatrix?.forEach(row => {
      if (row.brand) brandSet.add(normalizeBrandSlug(row.brand))
    })
    // 2. Toutes les marques associées aux techniciens de l'équipe
    scope?.members?.forEach(m => {
      (m.brands ?? []).forEach(b => {
        if (b) brandSet.add(normalizeBrandSlug(b))
      })
    })
    return Array.from(brandSet).map(brand => ({ brand }))
  }, [scope])

  return (
    <>
      <Nav />
      <PortalStickyBar user={user} lms={lms} headerRef={headerRef} filialeBrands={teamBrands} />
      <main className="portal-page">
        <div ref={headerRef}>
          <PortalHeader
            user={user}
            lms={lms}
            filialeBrands={teamBrands}
          />
        </div>

        {error && (
          <div className="container" style={{ padding: '16px 32px' }}>
            <PortalEmptyState message={t.manager_error} />
          </div>
        )}

        {!error && (
          <>
            <TierResultsSection scope={scope} t={t} />
            <BrandMatrixSection scope={scope} t={t} />
            {/* Section Équipe — masquée temporairement
            <TeamSection scope={scope} t={t} />
            */}
            <DpsFilialePifSection
              user={user}
              lms={lms}
              t={t}
              sectionId="pif"
              title="Plans de formation"
              eyebrow="Les PIFS (Plans Individuels de Formation Pluriannuels de votre équipe)"
              technicians={managerPifTechnicians}
            />
            <ManagerFormationsSection
              id="formations"
              onOpenReport={(rep) => setModal({ type: 'report', data: rep })}
            />
            <ManagerCertificationsSection
              id="certifications"
              onOpenCert={(cert) => setModal({ type: 'cert', data: cert })}
            />
          </>
        )}

        <DpsAssistanceSection
          t={t}
          tickets={managerTickets}
          variant="dps"
          title="Assistance technique de votre équipe"
          eyebrow="SUPPORT TECHNIQUE DE VOTRE ÉQUIPE"
        />
      </main>

      {modal && modal.type === 'report' && (
        <PortalModal
          title={modal.data.title}
          onClose={() => setModal(null)}
        >
          <div className="portal-modal-report-body" style={{ padding: '8px 0' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                marginBottom: 18,
                paddingBottom: 14,
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <img
                src={modal.data.trainerPhoto}
                alt={modal.data.trainerName}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid #fff',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                }}
              />
              <div>
                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', fontWeight: 600 }}>Formateur certifié</span>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink, #0e1126)' }}>{modal.data.trainerName}</h4>
                <span style={{ fontSize: 12, color: 'var(--muted, #64748b)' }}>{modal.data.trainerRole}</span>
              </div>
            </div>

            <div className="portal-modal-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
              <span className="portal-modal-label" style={{ fontWeight: 600, color: 'var(--muted)' }}>Technicien formé</span>
              <span className="portal-modal-value" style={{ fontWeight: 700, color: 'var(--ink)' }}>{modal.data.collaboratorName} ({modal.data.agency})</span>
            </div>
            <div className="portal-modal-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
              <span className="portal-modal-label" style={{ fontWeight: 600, color: 'var(--muted)' }}>Thématique</span>
              <span className="portal-modal-value">{modal.data.details?.theme}</span>
            </div>
            <div className="portal-modal-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
              <span className="portal-modal-label" style={{ fontWeight: 600, color: 'var(--muted)' }}>Lieu & Durée</span>
              <span className="portal-modal-value">{modal.data.details?.location} · {modal.data.details?.duration}</span>
            </div>
            <div className="portal-modal-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
              <span className="portal-modal-label" style={{ fontWeight: 600, color: 'var(--muted)' }}>Évaluation pratique</span>
              <span className="portal-modal-value" style={{ fontWeight: 700, color: '#1aab5b' }}>{modal.data.details?.practicalScore}</span>
            </div>

            {modal.data.details?.evaluation && (
              <div className="portal-modal-feedback" style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(26, 31, 60, 0.04)', borderRadius: 8 }}>
                <strong style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--navy)' }}>Appréciation du formateur</strong>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--ink)' }}>{modal.data.details?.evaluation}</p>
              </div>
            )}

            <a
              href="#"
              className="portal-cert-dl"
              style={{
                marginTop: 20,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                background: 'var(--navy)',
                color: '#fff',
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 600,
                textDecoration: 'none',
              }}
              onClick={ev => ev.preventDefault()}
            >
              Télécharger le rapport officiel de formation (PDF)
            </a>
          </div>
        </PortalModal>
      )}

      {modal && modal.type === 'cert' && (
        <PortalModal
          title={modal.data.title}
          onClose={() => setModal(null)}
        >
          <div className="portal-modal-cert-body" style={{ padding: '8px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid #e2e8f0' }}>
              <img
                src={modal.data.brandLogo}
                alt={modal.data.brandLabel}
                style={{ width: 64, height: 40, objectFit: 'contain', background: '#f8fafc', padding: '4px 8px', borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <div>
                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', fontWeight: 600 }}>Certification Constructeur</span>
                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--ink, #0e1126)' }}>{modal.data.brandLabel} · Palier {modal.data.level}</h4>
                <span style={{ fontSize: 12, color: 'var(--muted, #64748b)' }}>N° {modal.data.certId} · Promotion {modal.data.date.slice(-4)}</span>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <h5 style={{ margin: '0 0 10px 0', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted)' }}>
                Collaborateurs certifiés ({modal.data.technicians?.length})
              </h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {modal.data.technicians?.map((t, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      background: 'rgba(26, 31, 60, 0.03)',
                      borderRadius: 8,
                      border: '1px solid rgba(26, 31, 60, 0.06)',
                    }}
                  >
                    <div>
                      <strong style={{ display: 'block', fontSize: 13.5, color: 'var(--ink)' }}>{t.name}</strong>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t.agency} · Palier {t.level}</span>
                    </div>
                    <span className="portal-status-chip done">Certifié</span>
                  </div>
                ))}
              </div>
            </div>

            <a
              href="#"
              className="portal-cert-dl"
              style={{
                marginTop: 16,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                background: 'var(--navy)',
                color: '#fff',
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 600,
                textDecoration: 'none',
              }}
              onClick={ev => ev.preventDefault()}
            >
              Télécharger l'attestation collective d'équipe (PDF)
            </a>
          </div>
        </PortalModal>
      )}
      <Footer />
      <PortalDemoBar />
    </>
  )
}
