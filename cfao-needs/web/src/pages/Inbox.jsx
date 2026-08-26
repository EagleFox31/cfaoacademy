import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { AsyncBoundary, Banner, Empty, PageHead, StatusPill } from '../components/ui'
import { useFormatters, useLocale } from '../i18n'
import { api } from '../lib/api'
import { useAsync } from '../lib/hooks'

const SLA_HOURS = 48

/**
 * Liste des fiches à relire — côté équipe Academy.
 *
 * L'ancienneté est affichée en clair et signalée au-delà du seuil : le circuit de
 * relecture est un goulot par construction, il ne doit pas être un goulot
 * silencieux (story 16-19).
 */
export default function Inbox() {
  const { t } = useLocale()
  const { dateTime } = useFormatters()
  const [status, setStatus] = useState('SUBMITTED')

  const state = useAsync(async () => {
    const data = await api.submissions(status ? { status } : {})
    return data?.results ?? data ?? []
  }, [status])

  return (
    <>
      <PageHead title={t('inbox.title')} subtitle={t('inbox.subtitle')} />

      <div className="filters">
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label={t('inbox.filterAll')}>
          <option value="SUBMITTED">{t('status.SUBMITTED')}</option>
          <option value="VALIDATED">{t('status.VALIDATED')}</option>
          <option value="REOPENED">{t('status.REOPENED')}</option>
          <option value="">{t('inbox.filterAll')}</option>
        </select>
      </div>

      <AsyncBoundary state={state}>
        {(rows) => <Table rows={rows} dateTime={dateTime} t={t} />}
      </AsyncBoundary>
    </>
  )
}

function Table({ rows, dateTime, t }) {
  const overdue = useMemo(
    () =>
      rows.filter(
        (row) =>
          row.status === 'SUBMITTED' && row.submitted_at && hoursSince(row.submitted_at) > SLA_HOURS,
      ),
    [rows],
  )

  if (rows.length === 0) return <Empty>{t('inbox.empty')}</Empty>

  return (
    <>
      {overdue.length > 0 && (
        <Banner tone="warn">
          {t('inbox.sla', { count: overdue.length, hours: SLA_HOURS })}
        </Banner>
      )}

      <div className="table-wrap">
        <table className="grid-table">
          <thead>
            <tr>
              <th>{t('inbox.colOrgUnit')}</th>
              <th>{t('nav.tracking')}</th>
              <th className="num">{t('inbox.colHeadcount')}</th>
              <th>{t('inbox.colSubmitted')}</th>
              <th className="num">{t('inbox.colWaiting')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const waiting = row.submitted_at ? hoursSince(row.submitted_at) : null
              const late = row.status === 'SUBMITTED' && waiting > SLA_HOURS
              return (
                <tr key={row.id}>
                  <td>
                    <strong>{row.org_unit_label}</strong>
                    <div className="cell-code">{row.country}</div>
                  </td>
                  <td>
                    <StatusPill status={row.status} />
                  </td>
                  <td className="num" style={{ textAlign: 'center' }}>
                    {row.total_headcount}
                  </td>
                  <td className="muted">{dateTime(row.submitted_at)}</td>
                  <td className="num" style={{ textAlign: 'center' }}>
                    {waiting === null ? (
                      '—'
                    ) : (
                      <span className={late ? 'pill pill--crit' : 'muted'}>{waiting} h</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Link to={`/relecture/${row.id}`} className="btn">
                      {t('inbox.open')}
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

function hoursSince(value) {
  return Math.floor((Date.now() - new Date(value).getTime()) / 3600000)
}
