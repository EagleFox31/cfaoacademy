import { useMemo } from 'react'
import PageCloseButton from './PageCloseButton.jsx'
import PortalSectionEyebrow from './PortalSectionEyebrow.jsx'
import DetailHeaderLogos from './DetailHeaderLogos.jsx'
import DpsTierMatrixTable from './DpsTierMatrixTable.jsx'
import { resolveDpsTierMatrix } from '../utils/dpsMetrics.js'
import { dpsCompetencyTierChipClass } from '../utils/dpsCompetencyTierTheme.js'
import { evalScoreAccentColor } from '../utils/learnerTests.js'
import { LOGO_EQUIPMENT } from '../utils/resolveDetailCfaoLogo.js'

export default function DpsTierCompetencyDetailView({
  shellRef,
  tierKey,
  brandList = [],
  lms,
  t,
  onBack,
}) {
  const matrix = useMemo(() => {
    if (!lms || !tierKey) return null
    return resolveDpsTierMatrix(lms, tierKey, brandList)
  }, [lms, tierKey, brandList])

  const tierLabel = useMemo(() => {
    if (tierKey === 'expert') return t.dps_results_tier_diagnostic || 'Diagnostic'
    if (tierKey === 'senior') return t.dps_results_tier_repair || 'Réparation'
    return t.dps_results_tier_maintenance || 'Maintenance'
  }, [tierKey, t])

  const tierTitle = useMemo(() => {
    const template = t.dps_title_tier_technicians || 'Maîtrise des compétences par marque — Niveau {tier}'
    return template.replace('{tier}', tierLabel)
  }, [t.dps_title_tier_technicians, tierLabel])

  const hasTechnicians = Boolean(matrix?.technicians?.length)

  return (
    <div ref={shellRef} className="portal-brand-detail-shell">
      <div className="container article-shell portal-dps-brand-shell">
        <PageCloseButton
          onClick={onBack}
          ariaLabel={t.dps_tier_detail_close || 'Fermer et revenir aux niveaux'}
        />

        <div className="article-main">
          <article className="article-sheet portal-dps-brand-sheet">
            <header className="article-header portal-dps-brand-header">
              <DetailHeaderLogos
                cfaoLogo={LOGO_EQUIPMENT}
                brandLabel={tierLabel}
                brandId={tierKey}
              />

              <div className="portal-dps-brand-header-intro">
                <PortalSectionEyebrow icon="award" label={t.eyebrow_skills || 'Compétences'} />
                <h1>{tierTitle}</h1>
                {matrix ? (
                  <p className="article-lead portal-dps-brand-detail-sub">
                    {matrix.evaluatedCount} / {matrix.techniciansCount} techniciens évalués sur les marques de l'atelier
                  </p>
                ) : null}
              </div>

              {matrix ? (
                <div className="portal-dps-brand-header-summary">
                  <div className="portal-dps-brand-result-meta portal-dps-brand-detail-summary">
                    <p className="portal-morph-brand-kicker portal-brand-detail-summary-kicker">
                      {t.dps_brand_detail_eyebrow || 'Maîtrise de Compétences Techniques'}
                    </p>
                    <div className="portal-dps-brand-result-tiers">
                      <div className="portal-dps-brand-result-tier portal-dps-brand-result-tier--global">
                        <span className="portal-dps-brand-result-tier-label">
                          <span className="portal-dps-brand-result-tier-count">
                            {matrix.techniciansCount}
                          </span>
                          {' '}
                          {(matrix.techniciansCount > 1
                            ? (t.dps_tier_detail_techs_suffix || 'techniciens en {tier}')
                            : (t.dps_tier_detail_techs_suffix_one || 'technicien en {tier}')
                          ).replace('{tier}', tierLabel)}
                        </span>
                        <span
                          className={`portal-dps-brand-result-tier-score ${matrix.avgScore != null ? (matrix.avgScore >= 70 ? 'score-high' : matrix.avgScore >= 50 ? 'score-mid' : 'score-low') : 'portal-dps-brand-result-tier-score--pending'}`}
                        >
                          {matrix.avgScore != null ? `${matrix.avgScore}%` : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </header>

            <div className="portal-dps-brand-sheet-body">
              {hasTechnicians ? (
                <div className="portal-dps-tier-sections">
                  <section className="portal-dps-tier-block">
                    <h2 className={`portal-dps-tier-section-title ${dpsCompetencyTierChipClass(tierKey)}`}>
                      {tierLabel} ({matrix.technicians.length} techniciens)
                    </h2>
                    <DpsTierMatrixTable
                      technicians={matrix.technicians}
                      brands={matrix.brands}
                      tierKey={tierKey}
                      t={t}
                    />
                  </section>
                </div>
              ) : (
                <p className="portal-morph-empty portal-dps-brand-empty">
                  {t.dps_results_detail_empty_tier || 'Aucun technicien pour ce niveau pour le moment.'}
                </p>
              )}
            </div>
          </article>
        </div>
      </div>
    </div>
  )
}
