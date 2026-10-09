/**
 * Barre « Filtrer » + chips — portail et accueil (sessions).
 *
 * Chaque option : `{ id, label, count?, icon? }`. `icon` est un noeud rendu
 * avant le libellé (logo de marque…), optionnel pour rester rétrocompatible.
 */
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
            {opt.icon && (
              <span className="chip-icon" aria-hidden="true">{opt.icon}</span>
            )}
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
