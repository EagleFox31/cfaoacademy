import PortalSectionEyebrow from './PortalSectionEyebrow.jsx'
import PortalSectionHead from './PortalSectionHead.jsx'
import { useMemo, useState } from 'react'
import ChipFilterBar from './ChipFilterBar.jsx'
import FormateurDisplay from './FormateurDisplay.jsx'
import PlanEntryCard from './PlanEntryCard.jsx'
import PortalReveal from './PortalReveal.jsx'
import PortalStaggerGrid from './PortalStaggerGrid.jsx'
import { resolveTeamBrands } from '../utils/teamBrands.js'
import { resolveBrandFormateurDisplay } from '../utils/catalogFormateur.js'
import {
  PIF_SCOPE_PLURI,
  PIF_YEARS,
  formatPifFormationCount,
  pifFormationLabel,
  resolvePifBrandAccentColor,
  resolvePifBrandAnnualStatus,
  resolvePifBrandCardState,
  resolveDpsFilialePifStatus,
  resolveDpsFilialePifAnnualStatus,
  resolveDpsFilialePifAccentColor,
  resolveDpsFilialePifCardState,
} from '../utils/learnerPif.js'
import {
  isDpsPifAnnualScope,
  resolveMedacapDefinePifLaunchUrl,
} from '../utils/medacapDefine.js'

const DEFAULT_PIF_SCOPE = PIF_SCOPE_PLURI

function pifAnnualStatusChip(status, t) {
  const statusKey = `annual_${status}`
  return (
    <span className={`portal-session-status-tag portal-status-chip ${statusKey}`}>
      {t[statusKey] ?? status}
    </span>
  )
}

function pifCardTitle(brand, scope, t) {
  const template = scope === PIF_SCOPE_PLURI
    ? t.pif_card_title_pluri
    : t.pif_card_title_year
  return (
    <span className="portal-pif-card-brand">
      {template.replace('{brand}', brand.label)}
    </span>
  )
}

function pifCardCountLine(cardState, scope, t, isFiliale = false) {
  const { current, done, total } = cardState
  const showRatio = isFiliale
    ? total > 0
    : total > 0 && done < total
  const formationWord = pifFormationLabel(isFiliale ? total : (showRatio ? total : current), t)

  const suffix = scope === PIF_SCOPE_PLURI
    ? (showRatio ? t.pif_card_count_progress_pluri_suffix : t.pif_card_count_pluri_suffix)
    : (showRatio
      ? t.pif_card_count_progress_year_suffix.replace('{year}', String(scope))
      : t.pif_card_count_year_suffix.replace('{year}', String(scope)))

  return (
    <p className="portal-pif-card-count-line">
      <span className="portal-pif-card-count-value">
        {showRatio
          ? `${formatPifFormationCount(done)}/${formatPifFormationCount(total)}`
          : formatPifFormationCount(current ?? total)}
      </span>
      {' '}
      <span className="portal-pif-card-count-label">
        {formationWord}
        {' '}
        {suffix}
      </span>
    </p>
  )
}

function pifCardMeta(brandId, cardState, scope, t, isFiliale = false) {
  const formateurDisplay = resolveBrandFormateurDisplay(brandId)

  let statusLines
  if (cardState.kind === 'count') {
    statusLines = pifCardCountLine(cardState, scope, t, isFiliale)
  } else {
    statusLines = cardState.lines?.map(line => {
      if (!isFiliale) return <p key={line}>{line}</p>
      if (cardState.kind === 'plan_pending') {
        return <p key="dps-pending">{t.dps_pif_line_plan_pending}</p>
      }
      if (cardState.kind === 'empty_year') {
        return (
          <p key="dps-empty-year">
            {t.dps_pif_line_empty_year.replace('{year}', String(scope))}
          </p>
        )
      }
      return <p key={line}>{line}</p>
    })
  }

  return (
    <div className="portal-pif-card-meta">
      <div className="portal-pif-card-status">
        {statusLines}
      </div>
      {formateurDisplay ? (
        <FormateurDisplay
          display={formateurDisplay}
          variant="card"
          className="pv-card-meta-formateur portal-pif-card-formateur"
        />
      ) : null}
    </div>
  )
}

export default function LearnerPifSection({
  user, lms, t, variant = 'learner',
  updatedAt, scopeLoading = false, insightsLoading = false,
}) {
  const [scope, setScope] = useState(DEFAULT_PIF_SCOPE)
  const isFiliale = variant === 'filiale'

  const brandItems = useMemo(
    () => resolveTeamBrands(user?.brands ?? []),
    [user?.brands],
  )

  const filterOptions = useMemo(() => [
    { id: PIF_SCOPE_PLURI, label: t.pif_filter_pluri },
    ...PIF_YEARS.map(year => ({
      id: String(year),
      label: String(year),
    })),
  ], [t.pif_filter_pluri])

  if (!brandItems.length) return null

  return (
    <PortalReveal id="pif" className={isFiliale ? 'portal-pif-filiale-section' : ''}>
      <div className="container portal-pif-section-inner" style={{ padding: '16px 32px' }}>
        <PortalSectionHead
          eyebrow={isFiliale ? (
            <PortalSectionEyebrow icon="milestone" label={t.dps_eyebrow_filiale_plans} />
          ) : (
            <PortalSectionEyebrow icon="milestone" className="portal-pif-eyebrow">
              <span className="portal-pif-eyebrow-kicker">{t.eyebrow_pif}</span>
              {' '}
              <span className="portal-pif-eyebrow-expansion">{t.eyebrow_pif_expansion}</span>
            </PortalSectionEyebrow>
          )}
          title={isFiliale ? t.dps_title_filiale_plans : t.title_pif}
          updatedAt={isFiliale ? updatedAt : undefined}
          updating={isFiliale ? (scopeLoading || insightsLoading) : false}
          methodText={isFiliale ? t.dps_method_pif : undefined}
          t={t}
        />

        <ChipFilterBar
          portal
          label={t.pif_filter_lbl}
          ariaLabel={t.pif_filter_aria}
          value={scope}
          onChange={setScope}
          options={filterOptions}
        />

        <PortalStaggerGrid className="cols-4 pv-grid--stretch portal-pif-cards">
          {brandItems.map(brand => {
            const cardState = isFiliale
              ? resolveDpsFilialePifCardState(lms, brand.id, user, scope, t)
              : resolvePifBrandCardState(lms, brand.id, user, scope, t)
            const annualStatus = isFiliale
              ? resolveDpsFilialePifAnnualStatus(user, lms, brand.id, scope)
              : resolvePifBrandAnnualStatus(user, lms, brand.id, scope)
            const isFilialeAnnual = isFiliale && isDpsPifAnnualScope(scope)
            const dpsStatus = isFiliale ? resolveDpsFilialePifStatus(annualStatus) : annualStatus
            const pifLaunchUrl = isFiliale && !isFilialeAnnual
              ? resolveMedacapDefinePifLaunchUrl(user, { brand: brand.id, scope })
              : undefined
            const pifHoverHint = isFiliale
              ? (isFilialeAnnual ? false : t.dps_medacap_cta)
              : t.plan_entry_coming_soon
            const pifCta = isFiliale
              ? (isFilialeAnnual ? t.dps_results_brand_pending : t.dps_medacap_cta)
              : t.pif_card_cta
            const pifStatusChip = isFilialeAnnual
              ? (
                <span className="portal-session-status-tag portal-status-chip todo">
                  {t.dps_results_brand_pending}
                </span>
              )
              : (dpsStatus ? pifAnnualStatusChip(dpsStatus, t) : undefined)

            return (
              <PlanEntryCard
                key={`${scope}-${brand.id}`}
                kind="pif"
                href={pifLaunchUrl}
                corner={!isFilialeAnnual}
                muted={cardState.muted}
                logo={brand.logo}
                brandLabel={brand.logo ? undefined : brand.label}
                title={isFiliale ? undefined : pifCardTitle(brand, scope, t)}
                meta={pifCardMeta(brand.id, cardState, scope, t, isFiliale)}
                cta={pifCta}
                hoverHint={pifHoverHint}
                accentColor={isFiliale
                  ? resolveDpsFilialePifAccentColor(user, lms, brand.id, scope)
                  : resolvePifBrandAccentColor(user, lms, brand.id, scope)}
                statusChip={pifStatusChip}
              />
            )
          })}
        </PortalStaggerGrid>
      </div>
    </PortalReveal>
  )
}
