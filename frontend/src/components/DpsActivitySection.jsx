import { useMemo } from 'react'
import PortalSectionEyebrow from './PortalSectionEyebrow.jsx'
import PortalSectionHead from './PortalSectionHead.jsx'
import PortalReveal from './PortalReveal.jsx'
import {
  ACTIVITY_PRIMARY_DAYS,
  partitionActivityFeed,
} from '../utils/dpsActivityFeed.js'

const ACTIVITY_TYPE_LABEL_KEY = {
  pif: 'dps_activity_type_pif',
  test: 'dps_activity_type_test',
  alert: 'dps_activity_type_alert',
  session: 'dps_activity_type_session',
  other: 'dps_activity_type_other',
}

const GROUP_LABEL_KEY = {
  today: 'dps_activity_day_today',
  yesterday: 'dps_activity_day_yesterday',
  this_week: 'dps_activity_week_this',
  last_week: 'dps_activity_week_last',
}

function ActivityCard({ log, t }) {
  const typeLabel = t[ACTIVITY_TYPE_LABEL_KEY[log.type] ?? ACTIVITY_TYPE_LABEL_KEY.other]

  return (
    <li className={`portal-activity-card portal-activity-card--${log.type}`}>
      {log.brandLogo ? (
        <img
          src={log.brandLogo}
          alt=""
          className="portal-activity-brand"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="portal-activity-brand portal-activity-brand--placeholder" aria-hidden="true">
          {(typeLabel || 'Activité').slice(0, 1)}
        </span>
      )}
      <div className="portal-activity-card-main">
        <div className="portal-activity-card-head">
          <time className="portal-activity-card-time" dateTime={log.time}>{log.time}</time>
          <span className="portal-activity-card-type">{typeLabel}</span>
          {log.score != null ? (
            <span className={`portal-activity-score${log.scoreTierClass}`}>
              {log.score}
              <span className="portal-activity-score-unit">%</span>
            </span>
          ) : null}
        </div>
        <p className="portal-activity-card-text">{log.summary}</p>
      </div>
    </li>
  )
}

function ActivityGroupPanel({ groupKey, items, hiddenCount = 0, t }) {
  const label = t[GROUP_LABEL_KEY[groupKey] ?? groupKey]

  return (
    <section className="portal-activity-col">
      <h3 className="portal-activity-day-label">{label}</h3>
      <ul className="portal-activity-day-list">
        {items.map((log, i) => (
          <ActivityCard key={`${groupKey}-${log.time}-${i}`} log={log} t={t} />
        ))}
      </ul>
      {hiddenCount > 0 ? (
        <p className="portal-activity-more">
          {t.dps_activity_week_overflow.replace('{n}', String(hiddenCount))}
        </p>
      ) : null}
    </section>
  )
}

export default function DpsActivitySection({
  recentLogs,
  t,
  updatedAt,
  scopeLoading = false,
  insightsLoading = false,
  defineLaunchUrl,
}) {
  const feed = useMemo(() => partitionActivityFeed(recentLogs), [recentLogs])

  const hasPrimary = ACTIVITY_PRIMARY_DAYS.some(day => feed[day]?.length)
  const hasWeek = feed.weekGroups.length > 0

  if (!hasPrimary && !hasWeek) return null

  return (
    <PortalReveal id="activite">
      <div className="container" style={{ padding: '16px 32px' }}>
        <PortalSectionHead
          eyebrow={<PortalSectionEyebrow icon="clipboard" label={t.dps_eyebrow_collab_activity} />}
          title={t.dps_title_collab_activity}
          updatedAt={updatedAt}
          updating={scopeLoading || insightsLoading}
          methodText={t.dps_method_activity}
          t={t}
        />

        <div className="portal-activity-board" aria-label={t.dps_title_collab_activity}>
          {hasPrimary ? (
            <div className="portal-activity-board-cols">
              {ACTIVITY_PRIMARY_DAYS.map(dayKey => (
                feed[dayKey]?.length ? (
                  <ActivityGroupPanel
                    key={dayKey}
                    groupKey={dayKey}
                    items={feed[dayKey]}
                    t={t}
                  />
                ) : null
              ))}
            </div>
          ) : null}

          {hasWeek ? (
            <div
              className={`portal-activity-board-cols${
                feed.weekGroups.length === 1 ? ' portal-activity-board-cols--single' : ''
              }`}
            >
              {feed.weekGroups.map(group => (
                <ActivityGroupPanel
                  key={group.weekKey}
                  groupKey={group.weekKey}
                  items={group.items}
                  hiddenCount={group.hiddenCount}
                  t={t}
                />
              ))}
            </div>
          ) : null}
        </div>

        {defineLaunchUrl ? (
          <footer className="portal-activity-foot">
            <a
              href={defineLaunchUrl}
              className="portal-activity-cta"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.dps_activity_cta}
            </a>
          </footer>
        ) : null}
      </div>
    </PortalReveal>
  )
}
