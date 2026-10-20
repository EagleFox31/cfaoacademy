import PortalSectionEyebrow from './PortalSectionEyebrow.jsx'
import PortalSectionHead from './PortalSectionHead.jsx'
import PortalSectionSkeleton from './PortalSectionSkeleton.jsx'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import PlanEntryCard from './PlanEntryCard.jsx'
import PortalReveal from './PortalReveal.jsx'
import PortalStaggerGrid from './PortalStaggerGrid.jsx'
import DpsBrandResultSummary from './DpsBrandResultSummary.jsx'
import { resolveTeamBrands } from '../utils/teamBrands.js'
import { resolveDpsBrandResultsById } from '../utils/dpsMetrics.js'
import { hasDpsCompetencyDisplayData } from '../utils/dpsScopeSessionCache.js'
import { evalScoreAccentColor } from '../utils/learnerTests.js'

function serializeRect(rect) {
  if (!rect) return null
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  }
}

export default function DpsCollaboratorResultsSection({
  user, lms, t, updatedAt, scopeLoading = false, insightsLoading = false,
  sectionId = 'resultats',
  titleKey = 'dps_title_collab_results',
  eyebrowKey = 'eyebrow_skills',
  methodKey = null,
  extraCards = null,
  tierNomenclature = 'medacap',
}) {
  const navigate = useNavigate()

  const brandItems = useMemo(
    () => {
      const items = resolveTeamBrands(user?.brands ?? [])
      if (!items.length) return []
      const allBrandsItem = {
        id: 'toutes-marques',
        label: t.dps_results_brand_all_brands || 'Toutes marques',
        logo: null,
        isAllBrands: true,
      }
      return [allBrandsItem, ...items]
    },
    [user?.brands, t.dps_results_brand_all_brands],
  )

  const brandIds = useMemo(() => brandItems.map(b => b.id), [brandItems])

  const resultsByBrand = useMemo(
    () => resolveDpsBrandResultsById(lms, brandIds),
    [lms, brandIds],
  )

  function openBrandDetail(brandItem, event) {
    event.preventDefault()
    event.stopPropagation()
    const rect = serializeRect(event.currentTarget?.getBoundingClientRect?.())
    navigate(`/portail/competences/${encodeURIComponent(brandItem.id)}`, {
      state: { originRect: rect },
    })
  }

  if (!brandItems.length) return null

  /* Skeleton seulement tant que le scope rapide n’est pas là — insights ne doit plus bloquer l’UI. */
  const showSkeleton = scopeLoading && !hasDpsCompetencyDisplayData(lms)

  return (
    <PortalReveal id={sectionId}>
      <div className="container" style={{ padding: '16px 32px' }}>
        <PortalSectionHead
          eyebrow={<PortalSectionEyebrow icon="award" label={t[eyebrowKey]} />}
          title={t[titleKey]}
          updatedAt={updatedAt}
          updating={scopeLoading || insightsLoading}
          methodText={methodKey ? t[methodKey] : null}
          t={t}
        />

        {(showSkeleton) ? (
          <PortalSectionSkeleton
            cols={4}
            count={brandItems.length || 4}
            ariaLabel={t.data_skeleton_aria}
          />
        ) : (
        <PortalStaggerGrid className="cols-4 pv-grid--stretch portal-dps-brand-results">
          {brandItems.map(({ id, label, logo }) => {
            const summary = resultsByBrand[id]?.summary ?? {
              avgScore: null,
              technicians: 0,
              evaluated: 0,
              tiers: {},
            }
            const muted = summary.avgScore == null && summary.evaluated === 0
            const brandItem = { id, label, logo }

            return (
              <PlanEntryCard
                key={id}
                kind="results"
                className={`portal-plan-entry-card--brand-${id}`}
                onOpen={(e) => openBrandDetail(brandItem, e)}
                muted={muted}
                logo={logo}
                brandLabel={logo ? undefined : label}
                meta={(
                  <DpsBrandResultSummary
                    summary={summary}
                    t={t}
                    variant="card"
                    nomenclature={tierNomenclature}
                  />
                )}
                cta={t.dps_results_brand_cta}
                hoverHint={t.dps_results_brand_cta}
                accentColor={evalScoreAccentColor(summary.avgScore)}
              />
            )
          })}
          {extraCards}
        </PortalStaggerGrid>
        )}
      </div>
    </PortalReveal>
  )
}
