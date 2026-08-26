import { Link } from 'react-router-dom'

import { useCampaign } from '../App'
import { Banner, Empty, Kpi, PageHead, StatusPill } from '../components/ui'
import { useFormatters, useLocale } from '../i18n'

/**
 * Porte d'entrée de la campagne.
 *
 * Les familles dont le catalogue n'est pas encore livré sont **affichées**, pas
 * masquées : une filiale doit savoir que ces formations existent et arrivent,
 * sinon elle croit son périmètre plus étroit qu'il ne l'est.
 */
export default function Campaign() {
  const { t } = useLocale()
  const { date } = useFormatters()
  const { campaign, families, submission } = useCampaign()

  if (!campaign) {
    return <Empty>{t('recap.empty')}</Empty>
  }

  const ready = families.filter((family) => family.is_open)
  const pending = families.filter((family) => !family.is_open)
  const closed = campaign.status !== 'OPEN'
  const started = submission && submission.total_headcount > 0
  const sent = submission && submission.status !== 'DRAFT' && submission.status !== 'REOPENED'

  return (
    <>
      <PageHead
        eyebrow={t('app.subtitle')}
        title={t('campaign.title', { year: campaign.year })}
        subtitle={
          campaign.closes_at
            ? t('campaign.closesOn', { date: date(campaign.closes_at) })
            : t('campaign.noClose')
        }
      >
        <span className={`pill pill--${campaign.status === 'OPEN' ? 'ok' : 'draft'}`}>
          {t(`campaign.status${campaign.status}`)}
        </span>
        {!closed &&
          (sent ? (
            <Link to="/suivi" className="btn">
              {t('campaign.view')}
            </Link>
          ) : (
            <Link to="/saisie" className="btn btn--primary">
              {started ? t('campaign.resume') : t('campaign.start')}
            </Link>
          ))}
      </PageHead>

      {closed && <Banner tone="warn">{t('campaign.closed')}</Banner>}

      {submission && (
        <div className="grid grid--kpi" style={{ marginBottom: 24 }}>
          <Kpi label={t('recap.totalHeadcount')} value={submission.total_headcount ?? 0} />
          <Kpi
            label={t('nav.tracking')}
            value={<StatusPill status={submission.status} />}
            hint={submission.org_unit_label}
          />
          <Kpi label={t('campaign.families')} value={ready.length} hint={`${pending.length} ⏳`} />
        </div>
      )}

      <div className="card">
        <div className="card__head">
          <h2>{t('campaign.families')}</h2>
        </div>
        <div className="card__body stack">
          {ready.length > 0 && (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} className="stack">
              {ready.map((family) => (
                <li key={family.id} className="row">
                  <span className="pill pill--ok">{t('campaign.familyReady')}</span>
                  <strong>{family.label}</strong>
                  <span className="muted mono" style={{ fontSize: 11 }}>
                    {family.pole}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {pending.length > 0 && (
            <>
              <Banner tone="warn" title={t('campaign.familyPending')}>
                {t('campaign.familyPendingHint')}
              </Banner>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} className="stack">
                {pending.map((family) => (
                  <li key={family.id} className="row" style={{ opacity: 0.7 }}>
                    <span className="pill pill--draft">⏳</span>
                    <strong>{family.label}</strong>
                    <span className="muted mono" style={{ fontSize: 11 }}>
                      {family.pole}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </>
  )
}
