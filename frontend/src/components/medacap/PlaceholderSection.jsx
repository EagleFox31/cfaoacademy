import PortalReveal from '../PortalReveal.jsx'
import PortalSectionEyebrow from '../PortalSectionEyebrow.jsx'

/**
 * Placeholder de section — utilisé quand un lego MEDACAP n'a pas encore de composant
 * dédié dans le registre. Sert de repère visible pendant la construction.
 */
export default function PlaceholderSection({
  titleKey,
  eyebrowKey,
  icon = 'sparkles',
  hintKey,
  t,
  sectionId,
}) {
  const title = (titleKey && t?.[titleKey]) || titleKey || 'Section à construire'
  const eyebrow = (eyebrowKey && t?.[eyebrowKey]) || eyebrowKey || 'Prochainement'
  const hint = (hintKey && t?.[hintKey]) || hintKey || null
  return (
    <PortalReveal id={sectionId}>
      <div className="container" style={{ padding: '24px 32px' }}>
        <div className="portal-section-head">
          <PortalSectionEyebrow icon={icon} label={eyebrow} />
          <h2 className="portal-section-title">{title}</h2>
        </div>
        <div
          className="portal-placeholder-card"
          style={{
            padding: '24px',
            borderRadius: 16,
            border: '1px dashed var(--muted-2, #cbd5e1)',
            background: 'color-mix(in oklab, var(--panel, #f8fafc) 60%, transparent)',
            color: 'var(--muted, #64748b)',
            fontSize: 14,
          }}
        >
          <strong style={{ color: 'var(--fg, #0f172a)' }}>
            {t?.placeholder_wip_label ?? 'En construction'}
          </strong>
          {hint ? <p style={{ margin: '8px 0 0' }}>{hint}</p> : null}
        </div>
      </div>
    </PortalReveal>
  )
}
