import PortalSectionEyebrow from './PortalSectionEyebrow.jsx'

/**
 * Etat vide de section portail.
 *
 * Norme UX : un etat vide enseigne l'action suivante, il n'est jamais une
 * impasse. D'ou les parties — ce qui est absent, ce qui remplira la zone,
 * les chiffres qui justifient d'agir, et ou aller en attendant.
 * Le CTA doit pointer AILLEURS que la section courante.
 *
 * Formalisme carte (DESIGN_SYSTEM.md §7) : var(--paper), border 1px var(--rule),
 * accent border-left 4px, rayon et ombre alignes sur .portal-fad-card — la carte
 * que ce bloc remplace dans la section. Kicker via PortalSectionEyebrow.
 *
 * `stats` : [{ value, unit, label }] — chiffres reels uniquement. Une entree
 * dont la valeur est null/undefined est ignoree, pour ne jamais afficher un
 * indicateur creux.
 */
export default function PortalEmptyState({
  icon,
  eyebrow,
  title,
  text,
  statsLead,
  stats = [],
  ctaHref,
  ctaLabel,
  className = '',
}) {
  const rows = stats.filter(s => s && s.value != null && s.value !== '')

  return (
    <div className={`portal-empty-card${className ? ` ${className}` : ''}`}>
      {eyebrow && <PortalSectionEyebrow icon={icon} label={eyebrow} />}

      <h3 className="portal-empty-card-title">{title}</h3>
      {text && <p className="portal-empty-card-text">{text}</p>}

      {rows.length > 0 && (
        <>
          {statsLead && <p className="portal-empty-card-stats-lead">{statsLead}</p>}
          <ul className="portal-empty-card-stats">
            {rows.map((s, i) => (
              <li key={s.label ?? i} className="portal-empty-card-stat">
                <span className="portal-empty-card-stat-value">
                  {s.value}
                  {s.unit && <span className="portal-empty-card-stat-unit">{s.unit}</span>}
                </span>
                <span className="portal-empty-card-stat-label">{s.label}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {ctaHref && ctaLabel && (
        <a href={ctaHref} className="portal-empty-card-cta">
          {ctaLabel}
          <span className="portal-empty-card-cta-arrow" aria-hidden="true">→</span>
        </a>
      )}
    </div>
  )
}
