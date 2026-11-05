import PortalSectionEyebrow from './PortalSectionEyebrow.jsx'
import { useMemo, useState } from 'react'
import ChipFilterBar from './ChipFilterBar.jsx'
import PortalReveal from './PortalReveal.jsx'
import PortalStaggerGrid from './PortalStaggerGrid.jsx'
import PortalBrandLogo from './PortalBrandLogo.jsx'
import DpsStatCard, { DpsProgressMeta, DpsSubcardRow } from './DpsStatCard.jsx'
import { pct, resolveDpsBrandAccent } from '../utils/dpsMetrics.js'
import { TEAM_BRAND_DEFS } from '../utils/teamBrands.js'

function brandLabel(brandId) {
  return TEAM_BRAND_DEFS[brandId]?.label
    ?? brandId.charAt(0).toUpperCase() + brandId.slice(1)
}

export default function DpsBrandSection({ brandStats, t }) {
  const [brand, setBrand] = useState('all')

  const brandOptions = useMemo(() => [
    { id: 'all', label: t.dps_filter_all_brands },
    ...(brandStats ?? []).map(b => ({ id: b.brand, label: brandLabel(b.brand), count: b.technicians })),
  ], [brandStats, t.dps_filter_all_brands])

  const filteredBrands = useMemo(() => {
    if (brand === 'all') return brandStats ?? []
    return (brandStats ?? []).filter(b => b.brand === brand)
  }, [brandStats, brand])

  if (!brandStats?.length) return null

  return (
    <PortalReveal id="marques">
      <div className="container" style={{ padding: '16px 32px' }}>
        <div className="portal-section-head">
          <PortalSectionEyebrow icon="sliders" label={t.eyebrow_dps_filters} />
          <h2 className="portal-section-title">{t.dps_title_by_brand}</h2>
        </div>

        <ChipFilterBar
          portal
          label={t.dps_filter_brand}
          ariaLabel={t.dps_filter_brand}
          value={brand}
          onChange={setBrand}
          options={brandOptions}
        />

        {filteredBrands.length === 0 ? (
          <div className="portal-plan-filter-empty" role="status">{t.tm_filter_empty}</div>
        ) : (
          <PortalStaggerGrid>
            {filteredBrands.map(b => {
              const pifPct = pct(b.pifValidated, b.pifProposed)
              const accent = resolveDpsBrandAccent(b.avgScore, pifPct)

              return (
                <div key={b.brand} className="portal-card-anchor">
                  <DpsStatCard
                    brand={b.brand}
                    t={t}
                    accentColor={accent}
                    kicker={(
                      <span className="pv-card-kicker-row">
                        <PortalBrandLogo brand={b.brand} size="chip" />
                        <span className={`portal-status-chip ${b.avgScore >= 70 ? 'done' : 'progress'}`}>
                          {b.avgScore}%
                        </span>
                      </span>
                    )}
                    title={brandLabel(b.brand)}
                    subcards={(
                      <>
                        <DpsSubcardRow
                          items={[
                            { label: t.dps_th_technicians, value: String(b.technicians) },
                            { label: t.dps_th_avg_score, value: `${b.avgScore}%` },
                          ]}
                        />
                        <DpsProgressMeta
                          label={t.dps_th_pif_validated}
                          value={`${b.pifValidated} / ${b.pifProposed}`}
                          pct={pifPct}
                          accent={pifPct >= 70 ? '#1aab5b' : accent}
                        />
                      </>
                    )}
                  />
                </div>
              )
            })}
          </PortalStaggerGrid>
        )}
      </div>
    </PortalReveal>
  )
}
