import PvCard from './PvCard.jsx'
import { portalPvCardMedia } from '../utils/portalCardMedia.js'

/** Barre de progression — même structure que TeamMemberCard. */
export function DpsProgressMeta({ label, value, pct, accent = 'var(--red)' }) {
  return (
    <div className="portal-team-member-subcard portal-team-member-subcard--wide">
      {label && <span className="portal-team-member-subcard-lbl">{label}</span>}
      {value && <span className="portal-team-member-subcard-val">{value}</span>}
      {pct != null && (
        <div className="portal-team-member-subcard-bar">
          <div className="portal-inline-track">
            <div
              className="portal-inline-fill"
              style={{ width: `${pct}%`, background: accent }}
            />
          </div>
          <span className="portal-inline-pct">{pct}%</span>
        </div>
      )}
    </div>
  )
}

export function DpsSubcardRow({ items = [] }) {
  if (!items.length) return null
  return (
    <div className="portal-team-member-subcards-row">
      {items.map(item => (
        <div
          key={item.label}
          className={`portal-team-member-subcard${item.warn ? ' portal-team-member-subcard--warn' : ''}`}
        >
          <span className="portal-team-member-subcard-lbl">{item.label}</span>
          <span className="portal-team-member-subcard-val">{item.value}</span>
        </div>
      ))}
    </div>
  )
}

/** Carte métrique DPS — PvCard + sous-cartes (norme portail terrain). */
export default function DpsStatCard({
  kicker,
  title,
  meta,
  subcards,
  accentColor = 'var(--navy)',
  brand,
  href,
  cta,
  t,
  className = '',
  hoverHint,
  noMedia = false,
}) {
  const media = !noMedia ? portalPvCardMedia({ brand, kind: brand ? 'eval' : 'session' }) : {}

  return (
    <PvCard
      href={href}
      className={['portal-team-member-card', className].filter(Boolean).join(' ')}
      img={media.img}
      imgFallback={media.imgFallback}
      variant={media.variant}
      logo={media.logo}
      brandLabel={media.brandLabel}
      kicker={kicker}
      title={title}
      meta={subcards ? (
        <div className="portal-team-member-subcards">{subcards}</div>
      ) : meta}
      cta={cta ?? t.card_view_detail}
      accentColor={accentColor}
      hoverHint={hoverHint ?? t.plan_entry_coming_soon}
      corner
      noMedia={noMedia}
    />
  )
}
