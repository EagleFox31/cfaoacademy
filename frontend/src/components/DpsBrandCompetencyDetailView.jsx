import { useMemo } from 'react'
import PageCloseButton from './PageCloseButton.jsx'
import PortalSectionEyebrow from './PortalSectionEyebrow.jsx'
import DetailHeaderLogos from './DetailHeaderLogos.jsx'
import DpsBrandTierTechniciansSection from './DpsBrandTierTechniciansSection.jsx'
import DpsBrandResultSummary from './DpsBrandResultSummary.jsx'
import { resolveDpsBrandTechnicianResults } from '../utils/dpsMetrics.js'
import { formatDpsBrandDedicatedLine } from '../utils/dpsBrandResultSummary.js'
import { LOGO_EQUIPMENT } from '../utils/resolveDetailCfaoLogo.js'

function hasBrandTechnicians(summary) {
  return (summary?.evaluated ?? 0) > 0
}

export default function DpsBrandCompetencyDetailView({
  shellRef,
  brandItem,
  lms,
  t,
  onBack,
  tierNomenclature = 'medacap',
}) {
  const detail = useMemo(() => {
    if (!brandItem || !lms) return null
    try {
      return resolveDpsBrandTechnicianResults(lms, brandItem.id)
    } catch {
      return null
    }
  }, [brandItem, lms])

  const hasTechnicians = detail && hasBrandTechnicians(detail.summary)

  return (
    <div ref={shellRef} className="portal-brand-detail-shell">
      <div className="container article-shell portal-dps-brand-shell">
        <PageCloseButton
          onClick={onBack}
          ariaLabel={t.dps_results_detail_close}
        />

        <div className="article-main">
          <article className="article-sheet portal-dps-brand-sheet">
            <header className="article-header portal-dps-brand-header">
              <DetailHeaderLogos
                cfaoLogo={LOGO_EQUIPMENT}
                brandLogo={brandItem.logo}
                brandLabel={brandItem.logo ? undefined : brandItem.label}
                brandId={brandItem.id}
              />

              <div className="portal-dps-brand-header-intro">
                <PortalSectionEyebrow icon="award" label={t.eyebrow_skills} />
                <h1>{t.dps_title_brand_technicians}</h1>
                {detail ? (
                  <p className="article-lead portal-dps-brand-detail-sub">
                    {formatDpsBrandDedicatedLine(
                      detail.summary?.evaluated ?? 0,
                      t,
                      detail.summary?.technicians ?? null,
                    )}
                  </p>
                ) : null}
              </div>

              {detail ? (
                <div className="portal-dps-brand-header-summary">
                  <DpsBrandResultSummary
                    summary={detail.detailSummary ?? detail.summary}
                    t={t}
                    variant="detail"
                    nomenclature={tierNomenclature}
                  />
                </div>
              ) : null}
            </header>

            <div className="portal-dps-brand-sheet-body">
              {hasTechnicians ? (
                <DpsBrandTierTechniciansSection
                  detail={detail}
                  t={t}
                  nomenclature={tierNomenclature}
                />
              ) : (
                <p className="portal-morph-empty portal-dps-brand-empty">
                  {t.dps_results_detail_empty_brand}
                </p>
              )}
            </div>
          </article>
        </div>
      </div>
    </div>
  )
}
