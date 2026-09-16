import { useLocale } from '../i18n'
import PortalLoader from './PortalLoader.jsx'

/** Pastille d'état — la forme porte l'information autant que le mot. */
const TONE = {
  DRAFT: 'draft',
  SUBMITTED: 'review',
  VALIDATED: 'ok',
  REOPENED: 'crit',
  PENDING_REVIEW: 'review',
  APPROVED: 'info',
  SENT: 'ok',
  FAILED: 'crit',
  REJECTED: 'draft',
}

export function StatusPill({ status }) {
  const { t } = useLocale()
  const tone = TONE[status] || 'draft'
  return (
    <span className={`pill pill--${tone}`}>
      <span
        style={{
          display: 'inline-block',
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'currentColor',
          opacity: 0.8,
        }}
        aria-hidden="true"
      />
      {t(`status.${status}`)}
    </span>
  )
}

export function PageHead({ eyebrow, title, subtitle, children }) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="btn-row">{children}</div>}
    </div>
  )
}

function BannerIcon({ tone }) {
  if (tone === 'crit') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    )
  }
  if (tone === 'warn') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    )
  }
  if (tone === 'ok') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    )
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  )
}

export function Banner({ tone = 'info', title, children }) {
  return (
    <div className={`banner banner--${tone}`} role={tone === 'crit' ? 'alert' : undefined}>
      <BannerIcon tone={tone} />
      <div style={{ flex: 1 }}>
        {title && <strong>{title}</strong>}
        {children}
      </div>
    </div>
  )
}

export function Kpi({ label, value, hint, tone }) {
  return (
    <div className="kpi">
      <div className="kpi__label">{label}</div>
      <div className={`kpi__value${tone === 'accent' ? ' accent' : tone === 'green' ? ' green' : ''}`}>
        {value}
      </div>
      {hint && <div className="kpi__hint">{hint}</div>}
    </div>
  )
}

/**
 * Compteur de campagne — icône teintée, libellé, valeur.
 *
 * Partagé entre l'accueil et la grille marque : les deux écrans annoncent les
 * mêmes chiffres, à deux niveaux d'agrégation différents.
 */
export function Counter({ tone, icon, label, value }) {
  return (
    <div className="counter">
      <span className={`counter__icon counter__icon--${tone}`}>{icon}</span>
      <div className="counter__body">
        <div className="counter__label">{label}</div>
        <div className="counter__value">{value}</div>
      </div>
    </div>
  )
}

export function Empty({ children }) {
  return (
    <div className="empty">
      <div style={{ maxWidth: 360, margin: '0 auto' }}>
        {children}
      </div>
    </div>
  )
}

/**
 * État de chargement / erreur — un message d'erreur dit ce qui s'est passé ET
 * comment s'en sortir, jamais « une erreur est survenue » tout court.
 */
export function AsyncBoundary({ state, children, fallback = <PortalLoader /> }) {
  const { t } = useLocale()
  if (state.status === 'loading') {
    return fallback
  }
  if (state.status === 'error') {
    // 401 : redirection login déjà lancée par l'API — pas de faux message d'erreur.
    if (state.error?.status === 401) {
      return <PortalLoader />
    }
    const network = state.error?.status === 0
    return (
      <Banner tone="crit" title={t('app.error')}>
        <p style={{ margin: '4px 0 10px' }}>
          {network ? t('grid.saveError') : state.error?.detail || String(state.error?.message || '')}
        </p>
        <button type="button" className="btn btn--danger" onClick={state.reload}>
          {t('app.retry')}
        </button>
      </Banner>
    )
  }
  return children(state.data)
}

// Quatre états, pas trois : `dirty` (frappé, pas encore envoyé) doit se
// distinguer de `saving` (requête en vol). Les confondre faisait afficher
// « Enregistrement… » alors que rien n'était parti, et quelqu'un qui actualisait
// à ce moment perdait sa saisie en croyant l'inverse.
const SAVE_LABELS = {
  dirty: 'grid.dirty',
  saving: 'grid.saving',
  error: 'grid.saveError',
  saved: 'grid.saved',
}

export function SaveIndicator({ state }) {
  const { t } = useLocale()
  if (state === 'idle') return null
  const key = SAVE_LABELS[state] ?? SAVE_LABELS.saved
  return (
    <span className="savebar" role="status" aria-live="polite">
      <span className="savebar__dot" data-state={state} />
      {t(key)}
    </span>
  )
}
