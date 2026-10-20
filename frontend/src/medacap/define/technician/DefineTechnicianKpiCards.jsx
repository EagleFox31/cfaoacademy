import DefineAnimatedNumber from './DefineAnimatedNumber.jsx'
import { DEFINE_VOLUME_STATUS } from './resolveTechnicianDefinePlan.js'

const KPI_CONFIG = [
  {
    key: 'todo',
    valueKey: 'todo',
    volumeStatus: DEFINE_VOLUME_STATUS.TODO,
    labelKey: 'medacap_define_kpi_todo',
    mod: 'todo',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
        <rect x="9" y="3" width="6" height="4" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.65" />
        <path d="M9 12h6M9 16h4" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: 'inProgress',
    valueKey: 'inProgress',
    volumeStatus: DEFINE_VOLUME_STATUS.IN_PROGRESS,
    labelKey: 'medacap_define_kpi_progress',
    mod: 'inProgress',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.65" />
        <path d="M12 8v4.5l2.75 1.75" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: 'completed',
    valueKey: 'completed',
    volumeStatus: DEFINE_VOLUME_STATUS.COMPLETED,
    labelKey: 'medacap_define_kpi_done',
    mod: 'completed',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.65" />
        <path d="M8.5 12.25l2.35 2.35L15.75 9.5" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
]

const ELEARNING_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="5" width="18" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.65" />
    <path d="M8 21h8M12 17v4" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
    <path d="M8 9.5h8M8 12.5h5" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
  </svg>
)

/**
 * @param {{
 *   done?: number|null,
 *   required?: number|null,
 *   level?: string|null,
 *   linked?: boolean,
 * } | null | undefined} elearning
 */
export default function DefineTechnicianKpiCards({
  kpis,
  activeVolumeStatus,
  onVolumeStatusChange,
  t,
  animationKey,
  elearning = null,
}) {
  const showElearning = Boolean(elearning)
  const levelLine = elearning?.level
    ? String(t.medacap_define_kpi_elearning_level ?? '').replace('{level}', elearning.level)
    : null

  return (
    <div
      className={[
        'define-tech-kpi-grid',
        showElearning && 'define-tech-kpi-grid--with-elearning',
      ].filter(Boolean).join(' ')}
      role="list"
    >
      {KPI_CONFIG.map(({ key, valueKey, volumeStatus, labelKey, mod, icon }, index) => {
        const active = activeVolumeStatus === volumeStatus

        return (
          <button
            key={key}
            type="button"
            className={[
              'define-tech-kpi-card',
              `define-tech-kpi-card--${mod}`,
              active && 'define-tech-kpi-card--active',
            ].filter(Boolean).join(' ')}
            role="listitem"
            aria-pressed={active}
            onClick={() => onVolumeStatusChange?.(
              active ? DEFINE_VOLUME_STATUS.ALL : volumeStatus,
            )}
          >
            <span className="define-tech-kpi-card-icon-wrap">{icon}</span>
            <p className="define-tech-kpi-card-value">
              <DefineAnimatedNumber
                value={kpis[valueKey]}
                restartKey={animationKey}
                delay={index * 100}
              />
            </p>
            <p className="define-tech-kpi-card-label">{t[labelKey]}</p>
          </button>
        )
      })}

      {showElearning ? (
        <div
          className="define-tech-kpi-card define-tech-kpi-card--elearning"
          role="listitem"
          aria-label={t.medacap_define_kpi_elearning}
        >
          <span className="define-tech-kpi-card-icon-wrap">{ELEARNING_ICON}</span>
          <p className="define-tech-kpi-card-value">
            {elearning.done != null && elearning.required != null ? (
              <>
                <DefineAnimatedNumber
                  value={elearning.done}
                  restartKey={animationKey}
                  delay={300}
                />
                <span className="define-tech-kpi-card-value-suffix">
                  /
                  {elearning.required}
                </span>
              </>
            ) : elearning.required != null ? (
              <span className="define-tech-kpi-card-value-pending">
                —/
                {elearning.required}
              </span>
            ) : (
              <span className="define-tech-kpi-card-value-pending">—</span>
            )}
          </p>
          <p className="define-tech-kpi-card-label">{t.medacap_define_kpi_elearning}</p>
          {levelLine ? (
            <p className="define-tech-kpi-card-meta">{levelLine}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
