import { dpsCompetencyTierChipClass } from '../../../utils/dpsCompetencyTierTheme.js'
import { resolveDpsTechnicianRoleLabel } from '../../../utils/dpsTechnicianRoleTheme.js'
import DefineAnimatedNumber from './DefineAnimatedNumber.jsx'
import DefineBrandFilterSelect from './DefineBrandFilterSelect.jsx'
import DefineFilterSelect from './DefineFilterSelect.jsx'

const FILTER_ICONS = {
  brand: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" />
      <path d="M12 12v9" />
      <path d="m21 7.5-9 4.5L3 7.5" />
    </svg>
  ),
  level: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19h16" />
      <path d="M7 15V9" />
      <path d="M12 15V5" />
      <path d="M17 15v-3" />
    </svg>
  ),
  scope: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4" />
      <path d="M8 3v4" />
      <path d="M3 11h18" />
    </svg>
  ),
}

export default function DefineTechnicianFilterBar({
  filters,
  brandOptions,
  levelOptions,
  scopeOptions,
  technician,
  brandCount,
  animationKey,
  onChange,
  t,
}) {
  const tierLabel = resolveDpsTechnicianRoleLabel(technician.primaryTier, t)

  return (
    <div className="define-tech-filter-bar" role="group" aria-label={t.medacap_define_filter_aria}>
      <div className="define-tech-filter-head">
        <p className="define-tech-filter-lead">
          {t.medacap_define_filter_lead_before}
          <strong className="define-tech-filter-name">{technician.name}</strong>
          {tierLabel ? (
            <>
              {' '}
              <span className={`define-tech-tier-badge ${dpsCompetencyTierChipClass(technician.primaryTier)}`}>
                {tierLabel}
              </span>
            </>
          ) : null}
          {t.medacap_define_filter_lead_after}
        </p>
      </div>
      <div className="define-tech-filter-grid">
        <div className="define-tech-filter-field">
          <span className="define-tech-filter-lbl" id="define-tech-filter-brand-lbl">
            <span className="define-tech-filter-lbl-icon">{FILTER_ICONS.brand}</span>
            {t.medacap_define_filter_brand_lbl}
            <span className="define-tech-filter-lbl-count">
              {' ('}
              <DefineAnimatedNumber
                value={brandCount}
                restartKey={animationKey}
                pad={2}
              />
              {')'}
            </span>
          </span>
          <span className="define-tech-filter-select-wrap define-tech-filter-select-wrap--brand">
            <DefineBrandFilterSelect
              value={filters.brand}
              options={brandOptions}
              onChange={brand => onChange({ brand })}
              labelledBy="define-tech-filter-brand-lbl"
              t={t}
            />
          </span>
        </div>

        <div className="define-tech-filter-field">
          <span className="define-tech-filter-lbl" id="define-tech-filter-level-lbl">
            <span className="define-tech-filter-lbl-icon">{FILTER_ICONS.level}</span>
            {t.medacap_define_filter_level_lbl}
          </span>
          <span className="define-tech-filter-select-wrap">
            <DefineFilterSelect
              value={filters.level}
              options={levelOptions}
              onChange={level => onChange({ level })}
              labelledBy="define-tech-filter-level-lbl"
              listAriaLabel={t.medacap_define_filter_level_lbl}
              t={t}
            />
          </span>
        </div>

        <div className="define-tech-filter-field">
          <span className="define-tech-filter-lbl" id="define-tech-filter-scope-lbl">
            <span className="define-tech-filter-lbl-icon">{FILTER_ICONS.scope}</span>
            {t.medacap_define_filter_scope_lbl}
          </span>
          <span className="define-tech-filter-select-wrap">
            <DefineFilterSelect
              value={filters.scope}
              options={scopeOptions}
              onChange={scope => onChange({ scope })}
              labelledBy="define-tech-filter-scope-lbl"
              listAriaLabel={t.medacap_define_filter_scope_lbl}
              t={t}
            />
          </span>
        </div>
      </div>
    </div>
  )
}
