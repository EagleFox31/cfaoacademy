import { useLocale } from '../i18n'

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
  return <span className={`pill pill--${TONE[status] || 'draft'}`}>{t(`status.${status}`)}</span>
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

export function Banner({ tone = 'info', title, children }) {
  return (
    <div className={`banner banner--${tone}`} role={tone === 'crit' ? 'alert' : undefined}>
      <div>
        {title && <strong>{title}</strong>}
        {children}
      </div>
    </div>
  )
}

export function Kpi({ label, value, hint }) {
  return (
    <div className="kpi">
      <div className="kpi__label">{label}</div>
      <div className="kpi__value">{value}</div>
      {hint && <div className="kpi__hint">{hint}</div>}
    </div>
  )
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>
}

/**
 * État de chargement / erreur — un message d'erreur dit ce qui s'est passé ET
 * comment s'en sortir, jamais « une erreur est survenue » tout court.
 */
export function AsyncBoundary({ state, children }) {
  const { t } = useLocale()
  if (state.status === 'loading') return <Empty>{t('app.loading')}</Empty>
  if (state.status === 'error') {
    const network = state.error?.status === 0
    return (
      <Banner tone="crit" title={t('app.error')}>
        <p style={{ margin: '4px 0 10px' }}>
          {network ? t('grid.saveError') : state.error?.detail || String(state.error?.message || '')}
        </p>
        <button type="button" className="btn" onClick={state.reload}>
          {t('app.retry')}
        </button>
      </Banner>
    )
  }
  return children(state.data)
}

export function SaveIndicator({ state }) {
  const { t } = useLocale()
  if (state === 'idle') return null
  const label =
    state === 'saving' ? t('grid.saving') : state === 'error' ? t('grid.saveError') : t('grid.saved')
  return (
    <span className="savebar">
      <span className="savebar__dot" data-state={state} />
      {label}
    </span>
  )
}
