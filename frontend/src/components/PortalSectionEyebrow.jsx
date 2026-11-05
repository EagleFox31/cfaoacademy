import { PORTAL_SECTION_ICON_MAP } from './portalSectionIcons.jsx'

export default function PortalSectionEyebrow({ icon, label, children, className = '', style }) {
  const Icon = PORTAL_SECTION_ICON_MAP[icon]

  return (
    <p
      className={`portal-section-eyebrow ${className}`.trim()}
      style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', ...style }}
    >
      {Icon ? <Icon size={14} strokeWidth={2.5} style={{ flexShrink: 0 }} /> : null}
      {children ?? label}
    </p>
  )
}
