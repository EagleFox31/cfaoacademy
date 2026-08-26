import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { AsyncBoundary, Banner, Empty, Kpi, PageHead, StatusPill } from '../components/ui'
import { useFormatters, useLocale } from '../i18n'
import { api } from '../lib/api'
import { useAsync } from '../lib/hooks'

const QUARTERS = ['q1', 'q2', 'q3', 'q4']

/**
 * Relecture d'une fiche — l'étape ③ du circuit.
 *
 * Valider ici **prépare** la confirmation ; elle part ensuite depuis « À envoyer ».
 * Le bouton le dit explicitement, sinon on croit avoir déjà notifié la filiale.
 */
export default function Review() {
  const { id } = useParams()
  const { t } = useLocale()

  const state = useAsync(async () => {
    const [submission, summary, lines, cc, events] = await Promise.all([
      api.submission(id),
      api.submissionSummary(id),
      api.lines(id),
      api.cc(id),
      api.events(id),
    ])
    return {
      submission,
      summary,
      lines: lines?.results ?? lines ?? [],
      cc: cc?.results ?? cc ?? [],
      events: events?.results ?? events ?? [],
    }
  }, [id])

  return (
    <AsyncBoundary state={state}>
      {(data) => <Content {...data} t={t} reload={state.reload} />}
    </AsyncBoundary>
  )
}

function Content({ submission, summary, lines, cc, events, t, reload }) {
  const { dateTime } = useFormatters()
  const [busy, setBusy] = useState(false)
  const [reason, setReason] = useState('')
  const [showReopen, setShowReopen] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  const pending = submission.status === 'SUBMITTED'

  async function act(fn) {
    setBusy(true)
    setError('')
    try {
      await fn()
      await reload()
    } catch (err) {
      setError(err?.detail || t('app.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHead
        eyebrow={<Link to="/relecture">{t('nav.inbox')}</Link>}
        title={t('review.title', {
          orgUnit: submission.org_unit_label,
          year: summary.campaign ?? '',
        })}
        subtitle={
          submission.submitted_at
            ? t('tracking.submitted', { date: dateTime(submission.submitted_at) })
            : undefined
        }
      >
        <StatusPill status={submission.status} />
      </PageHead>

      {done && <Banner tone="ok">{done}</Banner>}
      {error && <Banner tone="crit">{error}</Banner>}

      <div className="grid grid--kpi" style={{ marginBottom: 24 }}>
        <Kpi label={t('recap.totalHeadcount')} value={summary.total_headcount} />
        <Kpi label={t('recap.trainings')} value={summary.trainings_selected} />
        {QUARTERS.map((q) => (
          <Kpi key={q} label={t(`quarter.${q}`)} value={summary.by_quarter?.[q] ?? 0} />
        ))}
      </div>

      <div className="stack">
        <div className="card">
          <div className="card__head">
            <h2>{t('review.cc')}</h2>
          </div>
          <div className="card__body">
            {cc.length === 0 ? (
              <span className="muted">{t('review.noCc')}</span>
            ) : (
              <div className="chip-list">
                {cc.map((row) => (
                  <span key={row.id ?? row.email} className="chip">
                    {row.email}
                    {row.label ? ` · ${row.label}` : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card__head">
            <h2>{t('review.lines')}</h2>
            <span className="muted num">{lines.length}</span>
          </div>
          <div className="table-wrap" style={{ border: 'none', borderRadius: 0, maxHeight: 420 }}>
            <table className="grid-table">
              <thead>
                <tr>
                  <th>{t('grid.colTraining')}</th>
                  {QUARTERS.map((q) => (
                    <th key={q} className="num">
                      {t(`quarter.${q}`)}
                    </th>
                  ))}
                  <th className="num">Σ</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id}>
                    <td className="cell-title">
                      <span className="cell-code">{line.catalog_line_id?.slice(0, 8)}</span>
                    </td>
                    {QUARTERS.map((q) => (
                      <td key={q} className="num" style={{ textAlign: 'center' }}>
                        {line[q] || '—'}
                      </td>
                    ))}
                    <td className="num" style={{ textAlign: 'center', fontWeight: 600 }}>
                      {line.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {pending && (
          <div className="card">
            <div className="card__body stack">
              <p className="muted" style={{ margin: 0 }}>
                {t('review.validateHint')}
              </p>
              <div className="btn-row">
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      await api.validate(submission.id)
                      setDone(t('review.validated'))
                    })
                  }
                >
                  {t('review.validate')}
                </button>
                <button
                  type="button"
                  className="btn btn--danger"
                  disabled={busy}
                  onClick={() => setShowReopen((value) => !value)}
                >
                  {t('review.reopen')}
                </button>
              </div>

              {showReopen && (
                <div className="stack" style={{ maxWidth: 560 }}>
                  <div className="field">
                    <label htmlFor="reopen-reason">{t('review.reopenReason')}</label>
                    <textarea
                      id="reopen-reason"
                      rows={3}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                    />
                    <span className="muted" style={{ fontSize: 12 }}>
                      {t('review.reopenReasonHint')}
                    </span>
                  </div>
                  <div>
                    <button
                      type="button"
                      className="btn"
                      disabled={busy || !reason.trim()}
                      onClick={() =>
                        act(async () => {
                          await api.reopen(submission.id, reason.trim())
                          setShowReopen(false)
                          setReason('')
                        })
                      }
                    >
                      {t('review.confirm')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="card">
          <div className="card__head">
            <h2>{t('review.history')}</h2>
          </div>
          <div className="card__body">
            {events.length === 0 ? (
              <Empty>—</Empty>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} className="stack">
                {events.slice(0, 40).map((event) => (
                  <li key={event.id} className="row">
                    <span className="mono muted" style={{ fontSize: 11.5, minWidth: 130 }}>
                      {dateTime(event.at)}
                    </span>
                    <span>{event.kind}</span>
                    {event.actor && <span className="muted">· {event.actor}</span>}
                    {event.on_behalf_of && (
                      <span className="pill pill--info">↳ {event.on_behalf_of}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
