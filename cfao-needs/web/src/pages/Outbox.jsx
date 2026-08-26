import { useEffect, useState } from 'react'

import { AsyncBoundary, Banner, Empty, PageHead, StatusPill } from '../components/ui'
import { useFormatters, useLocale } from '../i18n'
import { api } from '../lib/api'
import { useAsync } from '../lib/hooks'

/**
 * Écran « À envoyer » — le point de passage obligé.
 *
 * Rien ne part vers une filiale sans qu'un membre de l'équipe l'ait vu ici. La
 * prévisualisation montre le **rendu réel** figé à la préparation : ce qui est
 * relu est exactement ce qui partira.
 */
export default function Outbox({ onCountChange }) {
  const { t } = useLocale()
  const { dateTime } = useFormatters()

  const state = useAsync(async () => {
    const data = await api.outbound({ status: 'PENDING_REVIEW' })
    return data?.results ?? data ?? []
  }, [])

  const [selected, setSelected] = useState(() => new Set())
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (state.status === 'ready' && onCountChange) onCountChange(state.data.length)
  }, [state.status, state.data, onCountChange])

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function sendSelection(rows) {
    setBusy(true)
    setError('')
    try {
      const ids = rows.filter((row) => selected.has(row.id)).map((row) => row.id)
      for (const id of ids) {
        await api.approve(id)
        await api.send(id)
      }
      setNotice(t('outbox.sent', { count: ids.length }))
      setSelected(new Set())
      await state.reload()
    } catch (err) {
      setError(err?.detail || t('app.error'))
    } finally {
      setBusy(false)
    }
  }

  async function reject(id) {
    const reason = window.prompt(t('outbox.rejectReason'))
    if (reason === null) return
    if (!reason.trim()) {
      setError(t('outbox.rejectRequired'))
      return
    }
    setBusy(true)
    try {
      await api.reject(id, reason.trim())
      await state.reload()
    } catch (err) {
      setError(err?.detail || t('app.error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHead title={t('outbox.title')} subtitle={t('outbox.subtitle')} />

      {notice && <Banner tone="ok">{notice}</Banner>}
      {error && <Banner tone="crit">{error}</Banner>}

      <AsyncBoundary state={state}>
        {(rows) =>
          rows.length === 0 ? (
            <Empty>{t('outbox.empty')}</Empty>
          ) : (
            <>
              <div className="filters">
                <label className="row" style={{ gap: 6, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={selected.size === rows.length && rows.length > 0}
                    onChange={(event) =>
                      setSelected(event.target.checked ? new Set(rows.map((r) => r.id)) : new Set())
                    }
                  />
                  {t('outbox.selectAll')}
                </label>
                <span className="spacer" />
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={busy || selected.size === 0}
                  onClick={() => sendSelection(rows)}
                >
                  {t('outbox.sendSelected', { count: selected.size })}
                </button>
              </div>

              <div className="table-wrap">
                <table className="grid-table">
                  <thead>
                    <tr>
                      <th style={{ width: 34 }} />
                      <th>{t('outbox.colKind')}</th>
                      <th>{t('outbox.colTo')}</th>
                      <th>{t('outbox.colCreated')}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selected.has(row.id)}
                            onChange={() => toggle(row.id)}
                            aria-label={row.kind}
                          />
                        </td>
                        <td>
                          <div className="row" style={{ gap: 8 }}>
                            <span className="cell-code">{row.kind}</span>
                            <span
                              className={`pill pill--${row.audience === 'INTERNAL' ? 'info' : 'review'}`}
                            >
                              {row.audience === 'INTERNAL'
                                ? t('outbox.internal')
                                : t('outbox.external')}
                            </span>
                          </div>
                          {row.submission_label && (
                            <div className="muted" style={{ fontSize: 12 }}>
                              {row.submission_label}
                            </div>
                          )}
                        </td>
                        <td>
                          {row.to.join(', ')}
                          {row.cc?.length > 0 && (
                            <div className="muted" style={{ fontSize: 12 }}>
                              cc · {row.cc.join(', ')}
                            </div>
                          )}
                        </td>
                        <td className="muted">{dateTime(row.created_at)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              className="btn"
                              onClick={() =>
                                api
                                  .preview(row.id)
                                  .then(setPreview)
                                  .catch((err) => setError(err?.detail || t('app.error')))
                              }
                            >
                              {t('outbox.preview')}
                            </button>
                            <button
                              type="button"
                              className="btn btn--danger"
                              disabled={busy}
                              onClick={() => reject(row.id)}
                            >
                              {t('outbox.reject')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )
        }
      </AsyncBoundary>

      {preview && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card__head">
            <h2>{t('outbox.preview')}</h2>
            <button type="button" className="btn btn--ghost" onClick={() => setPreview(null)}>
              {t('app.close')}
            </button>
          </div>
          <div className="card__body stack">
            <div>
              <div className="kpi__label">{t('outbox.colTo')}</div>
              <div>{preview.to?.join(', ')}</div>
              {preview.cc?.length > 0 && <div className="muted">cc · {preview.cc.join(', ')}</div>}
            </div>
            <div>
              <div className="kpi__label">{t('outbox.subject')}</div>
              <strong>{preview.rendered_subject}</strong>
            </div>
            <div>
              <div className="kpi__label">{t('outbox.body')}</div>
              <div className="preview">{preview.rendered_text}</div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
