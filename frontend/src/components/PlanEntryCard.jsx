import PvCard from './PvCard.jsx'
import { flagUrlForCountry } from '../utils/countryFlag.js'

function PlanEntryIcon({ kind }) {
  const svg = {
    width: 40,
    height: 40,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }

  if (kind === 'pif') {
    return (
      <svg {...svg}>
        <path d="M4 6h16M4 10h16M4 14h10M4 18h6" />
        <path d="M18 14l2 2 4-4" />
      </svg>
    )
  }

  if (kind === 'sessions') {
    return (
      <svg {...svg}>
        <path d="M3 14h11v3H3z" />
        <path d="M14 12h4l3 3v2h-7z" />
        <circle cx="6.5" cy="17" r="1.5" />
        <circle cx="17.5" cy="17" r="1.5" />
      </svg>
    )
  }

  if (kind === 'learners') {
    return (
      <svg {...svg}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 11l-5 5" />
        <path d="M17 11h5v5" />
      </svg>
    )
  }

  if (kind === 'results') {
    return (
      <svg {...svg}>
        <path d="M4 19h16" />
        <path d="M7 16V8" />
        <path d="M12 16V5" />
        <path d="M17 16v-4" />
      </svg>
    )
  }

  return (
    <svg {...svg}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
    </svg>
  )
}

/** Porte d'entrée plan pluri annuel — PIF ou planning annuel (apps à venir). */
export default function PlanEntryCard({
  kind,
  title,
  desc,
  meta,
  cta,
  hoverHint,
  accentColor = '#1a56db',
  logo,
  flagSrc,
  countryFlag,
  brandLabel,
  muted = false,
  statusChip,
  href,
  to,
  onOpen,
  corner = true,
  className = '',
  cardMedia,
  kicker,
  isComingSoon = false,
  noMedia = false,
}) {
  const resolvedFlag = flagSrc || (countryFlag ? flagUrlForCountry(countryFlag) : null)
  const isFlag = Boolean(resolvedFlag)
  const mediaClass = `pv-card-img portal-plan-entry-card-img portal-plan-entry-card-img--${kind}${logo || brandLabel ? ' portal-plan-entry-card-img--brand' : ''}${isFlag ? ' portal-plan-entry-card-img--flag' : ''}`

  const resolvedCardMedia = noMedia ? null : (cardMedia ?? (
    <div className={mediaClass}>
      {resolvedFlag ? (
        <div className="portal-plan-entry-flag-wrapper">
          <img
            src={resolvedFlag}
            alt={countryFlag || title || 'Drapeau filiale'}
            className="portal-plan-entry-flag-img"
            loading="lazy"
          />
        </div>
      ) : logo ? (
        <img src={logo} alt="" className="portal-plan-entry-brand-logo" loading="lazy" />
      ) : brandLabel ? (
        <span className="portal-plan-entry-brand-wordmark">{brandLabel}</span>
      ) : (
        <PlanEntryIcon kind={kind} />
      )}
      {statusChip ? (
        <div className="portal-eval-img-tags">{statusChip}</div>
      ) : null}
    </div>
  ))

  const resolvedCorner = isComingSoon ? (
    <span className="portal-corner-slash" title="Bientôt disponible">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
      </svg>
    </span>
  ) : corner

  const resolvedCta = isComingSoon ? (
    <span className="portal-cta-coming-soon">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
      </svg>
      <span>Bientôt disponible</span>
    </span>
  ) : cta

  const resolvedHoverHint = isComingSoon
    ? (hoverHint ? `${hoverHint} (Bientôt disponible)` : "Bientôt disponible")
    : hoverHint

  return (
    <PvCard
      href={onOpen ? undefined : href}
      to={onOpen ? undefined : to}
      onClick={onOpen}
      className={[
        'portal-plan-entry-card',
        muted ? 'portal-plan-entry-card--muted' : '',
        isComingSoon ? 'portal-card--coming-soon' : '',
        className,
      ].filter(Boolean).join(' ')}
      cardMedia={resolvedCardMedia}
      kicker={kicker}
      title={title}
      meta={(
        <>
          {desc && <p className="portal-plan-entry-desc">{desc}</p>}
          {meta && (
            <div className="portal-plan-entry-meta">
              {typeof meta === 'string' ? <p>{meta}</p> : meta}
            </div>
          )}
        </>
      )}
      cta={resolvedCta}
      accentColor={accentColor}
      hoverHint={resolvedHoverHint}
      corner={resolvedCorner}
      noMedia={noMedia}
    />
  )
}
