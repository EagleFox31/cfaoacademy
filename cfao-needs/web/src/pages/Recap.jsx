import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useCampaign } from '../App'
import { AsyncBoundary, Banner, Empty, Kpi, PageHead } from '../components/ui'
import { useLocale } from '../i18n'
import { api } from '../lib/api'
import { useAsync } from '../lib/hooks'

const QUARTERS = ['q1', 'q2', 'q3', 'q4']
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Récapitulatif, destinataires en copie, puis envoi.
 *
 * Le bouton dit ce qui se passe vraiment : la déclaration part **en relecture**,
 * pas « en confirmation ». Une filiale qui croit recevoir un accusé immédiat et
 * n'en reçoit pas relance le support.
 */
export default function Recap() {
  const { t } = useLocale()
  const { campaign, submission, reload } = useCampaign()

  const state = useAsync(async () => {
    if (!submission) return null
    const [summary, cc] = await Promise.all([
      api.submissionSummary(submission.id),
      api.cc(submission.id),
    ])
    return { summary, cc: cc?.results ?? cc ?? [] }
  }, [submission?.id])

  if (!campaign || !submission) return <Empty>{t('app.loading')}</Empty>

  return (
    <AsyncBoundary state={state}>
      {(data) => (
        <Content
          campaign={campaign}
          submission={submission}
          summary={data.summary}
          initialCc={data.cc}
          onSent={reload}
        />
      )}
    </AsyncBoundary>
  )
}

function Content({ campaign, submission, summary, initialCc, onSent }) {
  const { t } = useLocale()
  const navigate = useNavigate()

  const [cc, setCc] = useState(initialCc)
  const [email, setEmail] = useState('')
  const [label, setLabel] = useState('')
  const [ccError, setCcError] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const editable = submission.status === 'DRAFT' || submission.status === 'REOPENED'
  const empty = (summary?.total_headcount ?? 0) === 0

  async function persist(next) {
    setCc(next)
    try {
      await api.setCc(
        submission.id,
        next.map((row) => ({ email: row.email, label: row.label, source: row.source })),
      )
    } catch {
      setCcError(t('app.error'))
    }
  }

  function addCc(event) {
    event.preventDefault()
    const value = email.trim().toLowerCase()
    if (!EMAIL.test(value)) {
      setCcError(t('recap.ccInvalid'))
      return
    }
    if (cc.some((row) => row.email.toLowerCase() === value)) {
      setEmail('')
      return
    }
    setCcError('')
    persist([...cc, { email: value, label: label.trim(), source: 'MANUAL' }])
    setEmail('')
    setLabel('')
  }

  async function send() {
    setSending(true)
    setError('')
    try {
      await api.submit(submission.id)
      await onSent()
      navigate('/suivi')
    } catch (err) {
      setError(err?.detail || t('app.error'))
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <PageHead
        eyebrow={t('campaign.title', { year: campaign.year })}
        title={t('recap.title')}
        subtitle={t('recap.subtitle')}
      >
        <Link to="/saisie" className="btn">
          {t('recap.back')}
        </Link>
      </PageHead>

      {empty ? (
        <Banner tone="warn">{t('recap.empty')}</Banner>
      ) : (
        <div className="grid grid--kpi" style={{ marginBottom: 24 }}>
          <Kpi label={t('recap.totalHeadcount')} value={summary.total_headcount} />
          <Kpi label={t('recap.trainings')} value={summary.trainings_selected} />
          {QUARTERS.map((q) => (
            <Kpi key={q} label={t(`quarter.${q}`)} value={summary.by_quarter?.[q] ?? 0} />
          ))}
        </div>
      )}

      <div className="stack">
        {!empty && (
          <div className="card">
            <div className="card__head">
              <h2>{t('recap.byPlace')}</h2>
            </div>
            <div className="card__body row" style={{ gap: 32 }}>
              <div>
                <div className="kpi__label">{t('grid.placeCFR')}</div>
                <div className="kpi__value">{summary.by_place?.CFR ?? 0}</div>
              </div>
              <div>
                <div className="kpi__label">{t('grid.placeFILIALE')}</div>
                <div className="kpi__value">{summary.by_place?.FILIALE ?? 0}</div>
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card__head">
            <h2>{t('recap.cc')}</h2>
          </div>
          <div className="card__body stack">
            <p className="muted" style={{ margin: 0 }}>
              {t('recap.ccHint')}
            </p>

            {cc.length > 0 && (
              <div className="chip-list">
                {cc.map((row) => (
                  <span key={row.email} className="chip">
                    <span>
                      {row.email}
                      {row.label ? ` · ${row.label}` : ''}
                    </span>
                    {row.source === 'INHERITED' && (
                      <span className="muted" style={{ fontSize: 11 }}>
                        {t('recap.ccInherited')}
                      </span>
                    )}
                    {editable && (
                      <button
                        type="button"
                        aria-label={t('recap.ccRemove', { email: row.email })}
                        onClick={() => persist(cc.filter((item) => item.email !== row.email))}
                      >
                        ✕
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}

            {editable && (
              <form className="row" onSubmit={addCc} style={{ alignItems: 'flex-end' }}>
                <div className="field" style={{ flex: '1 1 240px' }}>
                  <label htmlFor="cc-email">{t('recap.ccEmail')}</label>
                  <input
                    id="cc-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
                <div className="field" style={{ flex: '1 1 200px' }}>
                  <label htmlFor="cc-label">{t('recap.ccLabel')}</label>
                  <input
                    id="cc-label"
                    type="text"
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                  />
                </div>
                <button type="submit" className="btn">
                  {t('recap.ccAdd')}
                </button>
              </form>
            )}

            {ccError && (
              <p className="muted" style={{ color: 'var(--crit)', margin: 0 }} role="alert">
                {ccError}
              </p>
            )}
          </div>
        </div>

        {editable && (
          <div className="card">
            <div className="card__body stack">
              <p className="muted" style={{ margin: 0 }}>
                {t('recap.submitHint')}
              </p>
              {error && <Banner tone="crit">{error}</Banner>}
              <div>
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={empty || sending}
                  onClick={send}
                >
                  {sending ? t('app.loading') : t('recap.submit')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
