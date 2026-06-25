/** Barre « Filtrer » + chips — portail et accueil (sessions). */
export default function ChipFilterBar({
  label,
  ariaLabel,
  value,
  onChange,
  options,
  portal = false,
}) {
  return (
    <div
      className={`${portal ? 'portal-plan-status-filter ' : ''}sessions-brand-filter`}
      role="group"
      aria-label={ariaLabel}
    >
      <span className="sessions-brand-filter-lbl">{label}</span>
      <div className="sessions-brand-chips">
        {options.map(opt => (
          <button
            key={opt.id}
            type="button"
            className={`chip${value === opt.id ? ' active' : ''}`}
            aria-pressed={value === opt.id}
            onClick={() => onChange(opt.id)}
          >
            {opt.label}
            {typeof opt.count === 'number' && (
              <span className="tab-count">{opt.count}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
