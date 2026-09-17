import { useState } from 'react'

import { Banner } from './ui'
import { useFormatters, useLocale } from '../i18n'
import { api } from '../lib/api'
import { useAsync } from '../lib/hooks'

const QUARTERS = ['q1', 'q2', 'q3', 'q4']

function IconSend() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function IconBuilding() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v8h4" />
      <path d="M18 9h2a2 2 0 0 1 2 2v11h-4" />
      <path d="M10 6h4" />
      <path d="M10 10h4" />
      <path d="M10 14h4" />
      <path d="M10 18h4" />
    </svg>
  )
}

function IconPlane() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
    </svg>
  )
}

function IconPin() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function IconCheckCircle() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}


/**
 * Répartition et envoi — au pied de l'écran des marques.
 */
export default function SubmitPanel({ submission, onSent }) {
  const state = useAsync(async () => {
    if (!submission) return null
    return api.submissionSummary(submission.id)
  }, [submission?.id, submission?.status, submission?.total_headcount])

  if (!submission || state.status === 'loading' || !state.data) return null
  if (state.status === 'error') return null

  return <Panel submission={submission} summary={state.data} onSent={onSent} />
}

function Panel({ submission, summary, onSent }) {
  const { t } = useLocale()
  const { number } = useFormatters()

  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const editable = submission.status !== 'VALIDATED' && submission.is_editable !== false
  const isSubmitted = submission.status === 'SUBMITTED'
  const totalHeadcount = summary?.total_headcount ?? 0
  const empty = totalHeadcount === 0

  async function send() {
    setSending(true)
    setError('')
    try {
      await api.submit(submission.id)
      await onSent()
    } catch (err) {
      setError(err?.detail || t('app.error'))
    } finally {
      setSending(false)
    }
  }

  if (empty && !editable) return null

  const cfrCount = summary?.by_place?.CFR ?? 0
  const filialeCount = summary?.by_place?.FILIALE ?? 0
  const totalPlacesSafe = totalHeadcount > 0 ? totalHeadcount : 1
  const cfrPct = Math.round((cfrCount / totalPlacesSafe) * 100)
  const filialePct = Math.round((filialeCount / totalPlacesSafe) * 100)

  return (
    <div id="synthese-section" className="card submit-panel">
      {/* En-tête avec titre, icône et badge de total */}
      <div className="submit-panel__head">
        <div className="submit-panel__head-left">
          <span className="submit-panel__head-icon">
            <IconCheckCircle />
          </span>
          <div>
            <h2 className="submit-panel__title">{t('recap.panelTitle')}</h2>
            <p className="submit-panel__subtitle">{t('recap.panelSubtitle')}</p>
          </div>
        </div>
      </div>

      <div className="submit-panel__body stack">
        {!empty && (
          <>
            {/* Ventilation par trimestre */}
            <div className="submit-panel__section">
              <div className="submit-panel__section-title">
                <IconCalendar />
                <span>{t('recap.quartersTitle')}</span>
              </div>
              <div className="submit-panel__quarters-grid">
                {QUARTERS.map((q) => {
                  const val = summary.by_quarter?.[q] ?? 0
                  const pct = Math.round((val / totalPlacesSafe) * 100)
                  const isNonZero = val > 0
                  return (
                    <div
                      key={q}
                      className={`submit-quarter-card ${isNonZero ? 'is-active' : 'is-empty'}`}
                    >
                      <div className="submit-quarter-card__top">
                        <span className="submit-quarter-card__badge">{t(`quarter.${q}`)}</span>
                        {isNonZero && (
                          <span className="submit-quarter-card__pct">{pct}%</span>
                        )}
                      </div>
                      <div className="submit-quarter-card__val">{number(val)}</div>
                      <div className="submit-quarter-card__bar">
                        <div
                          className="submit-quarter-card__bar-fill"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Répartition par lieu */}
            <div className="submit-panel__section">
              <div className="submit-panel__section-title">
                <IconPin />
                <span>{t('recap.placesTitle')}</span>
              </div>
              <div className="submit-panel__places-grid">
                {/* Academy de Douala */}
                <div className="submit-place-card">
                  <div className="submit-place-card__icon submit-place-card__icon--cfr">
                    <IconBuilding />
                  </div>
                  <div className="submit-place-card__body">
                    <div className="submit-place-card__meta">
                      <span className="submit-place-card__name">{t('grid.placeCFR')}</span>
                      <span className="submit-place-card__tag submit-place-card__tag--cfr">
                        {t('recap.placeCFRBadge')}
                      </span>
                    </div>
                    <div className="submit-place-card__stats">
                      <span className="submit-place-card__count">{number(cfrCount)}</span>
                      <span className="submit-place-card__sub">
                        places ({cfrPct}%)
                      </span>
                    </div>
                    <div className="submit-place-card__bar">
                      <div
                        className="submit-place-card__bar-fill submit-place-card__bar-fill--cfr"
                        style={{ width: `${cfrPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Sur site Filiale */}
                <div className="submit-place-card">
                  <div className="submit-place-card__icon submit-place-card__icon--filiale">
                    <IconPin />
                  </div>
                  <div className="submit-place-card__body">
                    <div className="submit-place-card__meta">
                      <span className="submit-place-card__name">{t('grid.placeFILIALE')}</span>
                      <span className="submit-place-card__tag submit-place-card__tag--filiale">
                        {t('recap.placeFILIALEBadge')}
                      </span>
                    </div>
                    <div className="submit-place-card__stats">
                      <span className="submit-place-card__count">{number(filialeCount)}</span>
                      <span className="submit-place-card__sub">
                        places ({filialePct}%)
                      </span>
                    </div>
                    <div className="submit-place-card__bar">
                      <div
                        className="submit-place-card__bar-fill submit-place-card__bar-fill--filiale"
                        style={{ width: `${filialePct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Pied de transmission */}
        {editable && (
          <div className="submit-panel__footer">
            {error && <Banner tone="crit">{error}</Banner>}

            <div id="submit-panel-action" className="submit-panel__actions">
              <button
                type="button"
                className="btn submit-panel__submit-btn"
                disabled={empty || sending}
                onClick={send}
              >
                <IconSend />
                <span>{sending ? t('app.loading') : isSubmitted ? "Mettre à jour mes besoins transmis" : t('recap.submit')}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
