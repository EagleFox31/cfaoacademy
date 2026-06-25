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
  resolveLearnerPifItems,
  resolvePifBrandAccentColor,
  resolvePifBrandAnnualStatus,
  resolvePifBrandCardState,
} from '../utils/learnerPif.js'

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

function pifCardCountLine(cardState, scope, t) {
  const { current, done, total } = cardState
  const showRatio = total > 0 && done < total
  const formationWord = pifFormationLabel(showRatio ? total : current, t)
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

function pifCardMeta(brandId, cardState, scope, t) {
  const formateurDisplay = resolveBrandFormateurDisplay(brandId)

  return (
    <div className="portal-pif-card-meta">
      <div className="portal-pif-card-status">
        {cardState.kind === 'count'
          ? pifCardCountLine(cardState, scope, t)
          : cardState.lines?.map(line => (
            <p key={line}>{line}</p>
          ))}
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

export default function LearnerPifSection({ user, lms, t }) {
  const [scope, setScope] = useState(DEFAULT_PIF_SCOPE)

  const brandItems = useMemo(
    () => resolveTeamBrands(user?.brands ?? []),
    [user?.brands],
  )

  const filterOptions = useMemo(() => {
    const countFor = filterScope => resolveLearnerPifItems(
      user,
      lms,
      filterScope === PIF_SCOPE_PLURI ? PIF_SCOPE_PLURI : Number(filterScope),
    ).length

    return [
      { id: PIF_SCOPE_PLURI, label: t.pif_filter_pluri, count: countFor(PIF_SCOPE_PLURI) },
      ...PIF_YEARS.map(year => ({
        id: String(year),
        label: String(year),
        count: countFor(year),
      })),
    ]
  }, [user, lms, t.pif_filter_pluri])

  if (!brandItems.length) return null

  return (
    <PortalReveal id="pif">
      <div className="container" style={{ padding: '16px 32px' }}>
        <div className="portal-section-head">
          <p className="portal-section-eyebrow portal-pif-eyebrow">
            <span className="portal-pif-eyebrow-kicker">{t.eyebrow_pif}</span>
            {' '}
            <span className="portal-pif-eyebrow-expansion">{t.eyebrow_pif_expansion}</span>
          </p>
          <h2 className="portal-section-title">{t.title_pif}</h2>
        </div>

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
            const cardState = resolvePifBrandCardState(lms, brand.id, user, scope, t)
            const annualStatus = resolvePifBrandAnnualStatus(user, lms, brand.id, scope)
            return (
              <PlanEntryCard
                key={`${scope}-${brand.id}`}
                kind="pif"
                muted={cardState.muted}
                logo={brand.logo}
                brandLabel={brand.logo ? undefined : brand.label}
                title={pifCardTitle(brand, scope, t)}
                meta={pifCardMeta(brand.id, cardState, scope, t)}
                cta={t.pif_card_cta}
                hoverHint={t.plan_entry_coming_soon}
                accentColor={resolvePifBrandAccentColor(user, lms, brand.id, scope)}
                statusChip={pifAnnualStatusChip(annualStatus, t)}
              />
            )
          })}
        </PortalStaggerGrid>
      </div>
    </PortalReveal>
  )
}
