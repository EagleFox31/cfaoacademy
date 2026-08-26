import { Link } from 'react-router-dom'

import { useCampaign } from '../App'
import { AsyncBoundary, Banner, Empty, Kpi, PageHead, StatusPill } from '../components/ui'
import { useFormatters, useLocale } from '../i18n'
import { api } from '../lib/api'
import { useAsync } from '../lib/hooks'

/**
 * Suivi côté filiale.
 *
 * Écran volontairement explicite : « en cours de relecture par l'équipe Academy »
 * plutôt qu'un statut technique. Sans cette page, une filiale qui ne reçoit pas
 * d'accusé immédiat croit que sa saisie s'est perdue.
 */
export default function Tracking() {
  const { t } = useLocale()
  const { dateTime } = useFormatters()
  const { campaign, submission } = useCampaign()

  const state = useAsync(async () => {
    if (!submission) return { events: [] }
    const events = await api.events(submission.id)
    return { events: events?.results ?? events ?? [] }
  }, [submission?.id])

  if (!campaign || !submission) return <Empty>{t('app.loading')}</Empty>

  const tone =
    submission.status === 'VALIDATED' ? 'ok' : submission.status === 'REOPENED' ? 'crit' : 'info'
  const headline =
    submission.status === 'VALIDATED'
      ? t('tracking.validated', { date: dateTime(submission.validated_at) })
      : submission.status === 'REOPENED'
        ? t('tracking.reopened')
        : t('tracking.inReview')
  const hint =
    submission.status === 'VALIDATED'
      ? t('tracking.validatedHint')
      : submission.status === 'REOPENED'
        ? t('tracking.reopenedHint')
        : t('tracking.inReviewHint')

  return (
    <>
      <PageHead
        eyebrow={t('campaign.title', { year: campaign.year })}
        title={t('tracking.title')}
        subtitle={
          submission.submitted_at
            ? t('tracking.submitted', { date: dateTime(submission.submitted_at) })
            : undefined
        }
      >
        <StatusPill status={submission.status} />
        {(submission.status === 'DRAFT' || submission.status === 'REOPENED') && (
          <Link to="/saisie" className="btn btn--primary">
            {t('tracking.resume')}
          </Link>
        )}
      </PageHead>

      <Banner tone={tone} title={headline}>
        {hint}
        {submission.status === 'REOPENED' && submission.reopen_reason && (
          <p style={{ margin: '10px 0 0' }}>
            <strong>{t('tracking.reason')}</strong>
            {submission.reopen_reason}
          </p>
        )}
      </Banner>

      <div className="grid grid--kpi" style={{ marginBottom: 24 }}>
        <Kpi label={t('recap.totalHeadcount')} value={submission.total_headcount ?? 0} />
        <Kpi label={t('inbox.colOrgUnit')} value={submission.org_unit_label} />
        <Kpi label={t('recap.cc')} value={(submission.cc ?? []).length} />
      </div>

      <AsyncBoundary state={state}>
        {(data) => (
          <div className="card">
            <div className="card__head">
              <h2>{t('tracking.history')}</h2>
            </div>
            <div className="card__body">
              {data.events.length === 0 ? (
                <Empty>—</Empty>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} className="stack">
                  {data.events.map((event) => (
                    <li key={event.id} className="row">
                      <span className="mono muted" style={{ fontSize: 11.5, minWidth: 130 }}>
                        {dateTime(event.at)}
                      </span>
                      <span>{event.kind}</span>
                      {event.actor && <span className="muted">· {event.actor}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </AsyncBoundary>
    </>
  )
}
